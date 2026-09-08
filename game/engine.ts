import { EVENTS_BY_PHASE } from '@/data/events';
import { PROPERTY_BY_KEY } from '@/data/properties';
import {
  AWARDS,
  DEFAULT_CONFIG,
  INITIAL_TRAITS,
  type Award,
  type DecisionEffects,
  type DecisionOption,
  type DecisionResolution,
  type DecisionTag,
  type GameConfig,
  type GameEventCard,
  type IndicatorKey,
  type ResolvedEffect,
  type RoundPhase,
  type ScoreWeights,
  type TeamProfile,
  type TeamScore,
  type TeamState,
  type TeamTraits,
} from '@/types/game';
import { hashSeed, seededRandom, pickDeterministic } from './rng';

/**
 * A engine do SAFRA DF: regras puras, sem I/O.
 *
 * Nenhuma função aqui conhece React, Supabase, HTTP ou relógio. Recebe estado e
 * devolve estado novo. É isso que permite (a) testar o jogo inteiro sem banco,
 * (b) validar toda decisão no servidor e (c) trocar a interface sem reescrever
 * as regras.
 *
 * Convenções de unidade:
 * - `cash` está em reais fictícios e PODE ficar negativo (dívida é consequência
 *   legítima, não erro).
 * - `production`, `technology` e `sustainability` são índices inteiros 0..100.
 */

// ---------------------------------------------------------------------------
// Limites e normalização
// ---------------------------------------------------------------------------

/** Piso e teto usados para converter caixa em índice financeiro 0..100. */
export const FINANCE_FLOOR = -20_000;
export const FINANCE_CEILING = 120_000;

/** Mantém um índice dentro de 0..100 e inteiro. */
export function clampIndex(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

/** Converte caixa em reais para índice financeiro comparável aos demais. */
export function financeIndex(cash: number): number {
  const range = FINANCE_CEILING - FINANCE_FLOOR;
  return clampIndex(((cash - FINANCE_FLOOR) / range) * 100);
}

// ---------------------------------------------------------------------------
// Estado inicial
// ---------------------------------------------------------------------------

/** Índices de partida antes dos modificadores da propriedade. */
export const BASE_INDICATORS = {
  production: 50,
  technology: 40,
  sustainability: 55,
} as const;

/**
 * Estado inicial de uma equipe.
 *
 * Todas as equipes começam com o MESMO orçamento. A assimetria vem dos
 * modificadores da propriedade: vantagem produtiva, dificuldade tecnológica,
 * distância do mercado. Assim a comparação no debriefing continua justa.
 */
export function initialTeamState(
  propertyKey: string,
  config: GameConfig = DEFAULT_CONFIG,
): TeamState {
  const property = PROPERTY_BY_KEY[propertyKey];
  if (!property) {
    throw new Error(`initialTeamState: propriedade desconhecida "${propertyKey}"`);
  }

  const { modifiers } = property;

  return {
    cash: config.initialBudget + (modifiers.cash ?? 0),
    production: clampIndex(BASE_INDICATORS.production + (modifiers.production ?? 0)),
    technology: clampIndex(BASE_INDICATORS.technology + (modifiers.technology ?? 0)),
    sustainability: clampIndex(
      BASE_INDICATORS.sustainability + (modifiers.sustainability ?? 0),
    ),
    traits: { ...INITIAL_TRAITS, ...(modifiers.traits ?? {}) },
  };
}

// ---------------------------------------------------------------------------
// Sorteio de evento
// ---------------------------------------------------------------------------

/**
 * Carta de evento da rodada para uma equipe.
 *
 * Determinístico por (partida, rodada, equipe) e, quando a posição da equipe é
 * informada, DISTRIBUÍDO: as cartas da fase são repartidas em rodízio a partir
 * de um deslocamento sorteado para aquela rodada.
 *
 * A diferença importa para a aula. Sorteio puro por hash faz três equipes
 * caírem na mesma situação e empobrece a comparação no debate; o rodízio
 * garante que, com 3 cartas e 6 equipes, cada situação apareça em exatamente
 * duas propriedades, e ainda muda de rodada para rodada e de turma para turma.
 */
export function drawEventCard(
  phase: RoundPhase,
  gameId: string,
  roundIndex: number,
  teamId: string,
  teamOrderIndex?: number,
): GameEventCard {
  const pool = EVENTS_BY_PHASE[phase];

  if (teamOrderIndex === undefined) {
    return pickDeterministic(pool, gameId, roundIndex, teamId);
  }

  const offset = hashSeed(gameId, roundIndex) % pool.length;
  return pool[(teamOrderIndex + offset) % pool.length];
}

// ---------------------------------------------------------------------------
// Validação de opção
// ---------------------------------------------------------------------------

export type OptionBlockedReason = 'unknown_option' | 'insufficient_cash' | 'missing_trait';

export interface OptionAvailability {
  option: DecisionOption;
  available: boolean;
  reason: OptionBlockedReason | null;
}

/** Marcador numérico presente e maior que zero, ou booleano verdadeiro. */
function hasTrait(traits: TeamTraits, key: keyof TeamTraits): boolean {
  const value = traits[key];
  return typeof value === 'boolean' ? value : value > 0;
}

/** A equipe tem caixa para a opção? Usa o custo exibido, não o efeito líquido. */
export function canAfford(option: DecisionOption, state: TeamState): boolean {
  if (!option.requiresCash) return true;
  return state.cash >= option.displayCost;
}

/**
 * Situação de cada opção da carta para uma equipe.
 *
 * A interface usa isto para desabilitar (e explicar) o que a equipe não pode
 * escolher. O servidor usa o mesmo cálculo antes de aceitar a decisão: a regra
 * vive num lugar só.
 */
export function optionAvailability(
  event: GameEventCard,
  state: TeamState,
): OptionAvailability[] {
  return event.options.map((option) => {
    const missingTrait = (option.requiresTraits ?? []).some(
      (trait) => !hasTrait(state.traits, trait),
    );

    if (missingTrait) {
      return { option, available: false, reason: 'missing_trait' as const };
    }

    if (!canAfford(option, state)) {
      return { option, available: false, reason: 'insufficient_cash' as const };
    }

    return { option, available: true, reason: null };
  });
}

export class InvalidDecisionError extends Error {
  constructor(
    readonly reason: OptionBlockedReason,
    message: string,
  ) {
    super(message);
    this.name = 'InvalidDecisionError';
  }
}

// ---------------------------------------------------------------------------
// Aplicação de efeitos
// ---------------------------------------------------------------------------

/**
 * Funde marcadores.
 *
 * Regras, propositalmente explícitas:
 * - booleanos são atribuídos (true liga, false desliga);
 * - `idleTech`, `cashCrises` e `opportunitiesTaken` acumulam;
 * - `debtInstallments` e `debtPerRound` acumulam, EXCETO quando o efeito traz 0,
 *   que significa quitação e zera o compromisso.
 */
function mergeTraits(current: TeamTraits, patch?: Partial<TeamTraits>): TeamTraits {
  if (!patch) return current;
  const next: TeamTraits = { ...current };

  for (const [key, value] of Object.entries(patch) as [
    keyof TeamTraits,
    boolean | number | undefined,
  ][]) {
    if (value === undefined) continue;

    if (typeof value === 'boolean') {
      (next[key] as boolean) = value;
      continue;
    }

    if (key === 'debtInstallments' || key === 'debtPerRound') {
      (next[key] as number) = value === 0 ? 0 : (next[key] as number) + value;
      continue;
    }

    (next[key] as number) = (next[key] as number) + value;
  }

  return next;
}

interface AppliedEffects {
  state: TeamState;
  notes: string[];
}

/**
 * Aplica um bloco de efeitos sobre o estado.
 *
 * `productionIfTrained` é o mecanismo pedagógico central: sem capacitação, o
 * ganho de produção não acontece, ele fica parado em `idleTech` esperando
 * treinamento. É a diferença entre TER tecnologia e ADOTAR tecnologia.
 */
function applyEffects(state: TeamState, effects: DecisionEffects): AppliedEffects {
  const notes: string[] = [];
  let production = state.production + (effects.production ?? 0);
  const traitsPatch: Partial<TeamTraits> = { ...(effects.traits ?? {}) };

  if (effects.productionIfTrained) {
    if (state.traits.trained) {
      production += effects.productionIfTrained;
      notes.push(
        `A capacitação da equipe fez a tecnologia render: +${effects.productionIfTrained} em produção.`,
      );
    } else {
      traitsPatch.idleTech = (traitsPatch.idleTech ?? 0) + effects.productionIfTrained;
      notes.push(
        `A tecnologia entrou, mas ninguém foi capacitado: ${effects.productionIfTrained} pontos de produção ficaram parados esperando treinamento.`,
      );
    }
  }

  return {
    state: {
      cash: Math.round(state.cash + (effects.cash ?? 0)),
      production: clampIndex(production),
      technology: clampIndex(state.technology + (effects.technology ?? 0)),
      sustainability: clampIndex(state.sustainability + (effects.sustainability ?? 0)),
      traits: mergeTraits(state.traits, traitsPatch),
    },
    notes,
  };
}

/** Deltas por indicador entre dois estados, já prontos para a interface. */
function diffIndicators(before: TeamState, after: TeamState): ResolvedEffect[] {
  const keys: IndicatorKey[] = ['cash', 'production', 'technology', 'sustainability'];
  return keys
    .map((indicator) => ({ indicator, delta: after[indicator] - before[indicator] }))
    .filter((effect) => effect.delta !== 0);
}

// ---------------------------------------------------------------------------
// Resolução de decisão
// ---------------------------------------------------------------------------

export interface ResolveDecisionInput {
  state: TeamState;
  event: GameEventCard;
  optionKey: string;
  /** Partes da semente: use (gameId, roundIndex, teamId). */
  seed: (string | number)[];
}

/**
 * Resolve a decisão de uma equipe.
 *
 * Sequência: valida, aplica efeitos declarados, sorteia o risco de forma
 * determinística e devolve estado novo com o que mudou e por quê. Não toca em
 * dívida nem em tecnologia parada: isso é fechamento de rodada
 * (`applyRoundClosing`).
 */
export function resolveDecision({
  state,
  event,
  optionKey,
  seed,
}: ResolveDecisionInput): DecisionResolution {
  const availability = optionAvailability(event, state).find(
    (entry) => entry.option.key === optionKey,
  );

  if (!availability) {
    throw new InvalidDecisionError(
      'unknown_option',
      `Opção "${optionKey}" não existe na carta "${event.key}".`,
    );
  }

  if (!availability.available) {
    const message =
      availability.reason === 'insufficient_cash'
        ? 'Caixa insuficiente para esta opção.'
        : 'A equipe ainda não tem o que esta opção exige.';
    throw new InvalidDecisionError(availability.reason!, message);
  }

  const { option } = availability;
  const notes: string[] = [];

  const base = applyEffects(state, option.effects);
  notes.push(...base.notes);

  let current = base.state;
  let riskHit: boolean | null = null;

  if (option.risk) {
    const random = seededRandom(...seed, option.key);
    riskHit = random() < option.risk.chance;
    const extra = riskHit ? option.risk.bonus : option.risk.penalty;
    const note = riskHit ? option.risk.bonusNote : option.risk.penaltyNote;

    if (extra) {
      const applied = applyEffects(current, extra);
      current = applied.state;
      notes.push(...applied.notes);
    }
    if (note) notes.push(note);
  }

  return {
    optionKey,
    effects: diffIndicators(state, current),
    next: current,
    outcome: buildOutcome(option, riskHit),
    notes,
    riskHit,
  };
}

/** Frase de consequência apresentada à equipe. */
function buildOutcome(option: DecisionOption, riskHit: boolean | null): string {
  if (riskHit === null) {
    return `A equipe escolheu: ${option.label}.`;
  }
  return riskHit
    ? `A equipe escolheu: ${option.label}. E deu certo.`
    : `A equipe escolheu: ${option.label}. E não saiu como esperado.`;
}

// ---------------------------------------------------------------------------
// Fechamento de rodada
// ---------------------------------------------------------------------------

export interface RoundClosing {
  state: TeamState;
  notes: string[];
  /** Valor descontado de parcela nesta rodada (0 quando não há dívida). */
  debtCharged: number;
}

/**
 * Consequências que não dependem da decisão da rodada.
 *
 * É aqui que a conta chega: parcela de crédito é descontada e tecnologia parada
 * vira produção se a equipe tiver se capacitado no meio do caminho. Crise de
 * caixa é registrada para o prêmio de recuperação.
 */
export function applyRoundClosing(state: TeamState): RoundClosing {
  const notes: string[] = [];
  let cash = state.cash;
  let production = state.production;
  const traits: TeamTraits = { ...state.traits };
  let debtCharged = 0;

  if (traits.debtInstallments > 0 && traits.debtPerRound > 0) {
    debtCharged = traits.debtPerRound;
    cash -= debtCharged;
    traits.debtInstallments -= 1;
    notes.push(
      `Parcela do financiamento descontada: R$ ${debtCharged.toLocaleString('pt-BR')}. Faltam ${traits.debtInstallments}.`,
    );
    if (traits.debtInstallments === 0) {
      traits.debtPerRound = 0;
      notes.push('Financiamento quitado.');
    }
  }

  if (traits.trained && traits.idleTech > 0) {
    production += traits.idleTech;
    notes.push(
      `A capacitação destravou a tecnologia que estava parada: +${traits.idleTech} em produção.`,
    );
    traits.idleTech = 0;
  }

  if (cash < 0) {
    traits.cashCrises += 1;
    notes.push('A rodada fechou com o caixa negativo: a propriedade está endividada.');
  }

  return {
    state: {
      cash: Math.round(cash),
      production: clampIndex(production),
      technology: state.technology,
      sustainability: state.sustainability,
      traits,
    },
    notes,
    debtCharged,
  };
}

/**
 * Efeito passivo da fase, aplicado a todas as equipes no fim da rodada.
 *
 * Serve para dar textura à passagem do tempo sem depender de decisão: o
 * desgaste natural da produção, o custeio fixo da propriedade e o retorno de
 * quem está em programa público ou cooperativa.
 */
export function resolveEvent(state: TeamState, phase: RoundPhase): AppliedEffects {
  const upkeep: DecisionEffects = { cash: -1_500 };

  const byPhase: Record<RoundPhase, DecisionEffects> = {
    preparacao: { ...upkeep },
    producao: { ...upkeep, production: -2 },
    mercado: {
      ...upkeep,
      cash: -1_500 + (state.traits.inPublicProgram ? 6_000 : 0) + (state.traits.inCooperative ? 2_500 : 0),
    },
    desafio: { ...upkeep, sustainability: -2 },
    colheita: {
      ...upkeep,
      cash:
        -1_500 +
        (state.traits.inPublicProgram ? 8_000 : 0) +
        (state.traits.storage ? 3_000 : 0) +
        (state.traits.irrigation ? 2_000 : 0),
    },
  };

  const applied = applyEffects(state, byPhase[phase]);
  const notes = [...applied.notes];

  if (phase === 'mercado' && state.traits.inPublicProgram) {
    notes.push('O contrato institucional garantiu receita mesmo com o mercado oscilando.');
  }
  if (phase === 'colheita' && state.traits.irrigation) {
    notes.push('A irrigação sustentou a produção até o fim do ciclo.');
  }

  return { state: applied.state, notes };
}

/**
 * Fecha a rodada de uma equipe: efeito passivo da fase e depois as contas.
 *
 * A ordem importa: a receita da fase entra antes de a parcela ser descontada,
 * senão a equipe entraria em crise de caixa por causa da ordem de cálculo, não
 * por causa das próprias decisões.
 */
export function calculateRoundResult(
  state: TeamState,
  phase: RoundPhase,
): { state: TeamState; notes: string[]; debtCharged: number } {
  const passive = resolveEvent(state, phase);
  const closing = applyRoundClosing(passive.state);

  return {
    state: closing.state,
    notes: [...passive.notes, ...closing.notes],
    debtCharged: closing.debtCharged,
  };
}

// ---------------------------------------------------------------------------
// Pontuação final
// ---------------------------------------------------------------------------

export interface FinalIndices {
  finances: number;
  production: number;
  technology: number;
  sustainability: number;
  composite: number;
}

/**
 * Índices finais 0..100 e o índice composto.
 *
 * O composto existe para gerar diversão, não veredito: os pesos são
 * configuráveis pelo professor justamente para deixar explícito que "vencer"
 * depende do que a turma decidir valorizar.
 */
export function calculateFinalScore(
  state: TeamState,
  weights: ScoreWeights = DEFAULT_CONFIG.weights,
): FinalIndices {
  const finances = financeIndex(state.cash);
  const totalWeight =
    weights.finances + weights.production + weights.technology + weights.sustainability;

  const composite =
    totalWeight === 0
      ? 0
      : (finances * weights.finances +
          state.production * weights.production +
          state.technology * weights.technology +
          state.sustainability * weights.sustainability) /
        totalWeight;

  return {
    finances,
    production: state.production,
    technology: state.technology,
    sustainability: state.sustainability,
    composite: Math.round(composite * 10) / 10,
  };
}

/**
 * Perfil estratégico da equipe.
 *
 * Calculado a partir do que a equipe FEZ (tags das decisões) e de onde ela
 * chegou (índices). Não é nota: é retrato. Dois perfis diferentes podem ter o
 * mesmo composto.
 */
export function calculateTeamProfile(
  tags: DecisionTag[],
  indices: FinalIndices,
): TeamProfile {
  const count = (tag: DecisionTag) => tags.filter((entry) => entry === tag).length;

  const spread =
    Math.max(indices.finances, indices.production, indices.technology, indices.sustainability) -
    Math.min(indices.finances, indices.production, indices.technology, indices.sustainability);

  const scores: Record<TeamProfile, number> = {
    sustentavel: count('sustainability') * 2 + indices.sustainability / 20,
    inovacao_agressiva:
      count('tech_invest') * 2 + count('credit') * 1.5 + indices.technology / 20,
    conservacao_caixa:
      count('cash_conservative') * 2 + count('tech_avoid') * 1.5 + indices.finances / 20,
    articulada: count('public_policy') * 2 + count('cooperation') * 2 + count('training'),
    produtiva: count('production_first') * 2 + indices.production / 20,
    // Equilíbrio não vem de tag alguma: vem de nenhum indicador ter desabado.
    equilibrada: spread < 25 ? 6 : 0,
  };

  const ordered: TeamProfile[] = [
    'sustentavel',
    'inovacao_agressiva',
    'articulada',
    'produtiva',
    'conservacao_caixa',
    'equilibrada',
  ];

  return ordered.reduce((best, profile) =>
    scores[profile] > scores[best] ? profile : best,
  );
}

export interface TeamScoreInput {
  teamId: string;
  state: TeamState;
  tags: DecisionTag[];
}

/** Desvio médio absoluto dos quatro índices: quanto menor, mais equilibrada. */
function balanceDistance(indices: FinalIndices): number {
  const values = [
    indices.finances,
    indices.production,
    indices.technology,
    indices.sustainability,
  ];
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  return values.reduce((sum, value) => sum + Math.abs(value - mean), 0) / values.length;
}

/**
 * Classificação final da turma.
 *
 * Devolve todas as equipes com índices, perfil, prêmios e posição. Os prêmios
 * existem para que exista mais de uma forma de se destacar: a equipe com menos
 * dinheiro pode levar sustentabilidade ou recuperação.
 */
export function rankTeams(
  inputs: TeamScoreInput[],
  weights: ScoreWeights = DEFAULT_CONFIG.weights,
): TeamScore[] {
  const computed = inputs.map((input) => {
    const indices = calculateFinalScore(input.state, weights);
    return {
      teamId: input.teamId,
      indices,
      state: input.state,
      profile: calculateTeamProfile(input.tags, indices),
      tags: input.tags,
    };
  });

  const awardsByTeam = new Map<string, Award[]>(
    computed.map((entry) => [entry.teamId, []]),
  );

  const give = (award: Award, teamId: string | undefined) => {
    if (!teamId) return;
    awardsByTeam.get(teamId)?.push(award);
  };

  /** Vencedor por métrica, com desempate estável pelo id da equipe. */
  const bestBy = (score: (entry: (typeof computed)[number]) => number) =>
    computed.reduce<(typeof computed)[number] | undefined>((best, entry) => {
      if (!best) return entry;
      const diff = score(entry) - score(best);
      if (diff > 0) return entry;
      if (diff === 0 && entry.teamId < best.teamId) return entry;
      return best;
    }, undefined);

  give('best_finance', bestBy((entry) => entry.indices.finances)?.teamId);
  give('best_production', bestBy((entry) => entry.indices.production)?.teamId);
  give('best_technology', bestBy((entry) => entry.indices.technology)?.teamId);
  give('best_sustainability', bestBy((entry) => entry.indices.sustainability)?.teamId);
  give('most_balanced', bestBy((entry) => -balanceDistance(entry.indices))?.teamId);
  give(
    'best_opportunist',
    bestBy((entry) => entry.state.traits.opportunitiesTaken)?.teamId,
  );

  // Recuperação só faz sentido para quem passou por crise de caixa.
  const recovered = computed.filter((entry) => entry.state.traits.cashCrises > 0);
  if (recovered.length > 0) {
    const best = recovered.reduce((bestEntry, entry) =>
      entry.indices.composite > bestEntry.indices.composite ? entry : bestEntry,
    );
    give('best_recovery', best.teamId);
  }

  return computed
    .slice()
    .sort((a, b) =>
      b.indices.composite === a.indices.composite
        ? a.teamId.localeCompare(b.teamId)
        : b.indices.composite - a.indices.composite,
    )
    .map((entry, index) => ({
      teamId: entry.teamId,
      finances: entry.indices.finances,
      production: entry.indices.production,
      technology: entry.indices.technology,
      sustainability: entry.indices.sustainability,
      composite: entry.indices.composite,
      profile: entry.profile,
      awards: awardsByTeam.get(entry.teamId) ?? [],
      rank: index + 1,
    }));
}

/** Lista de prêmios na ordem de exibição do painel de resultado. */
export const AWARD_ORDER: readonly Award[] = AWARDS;
