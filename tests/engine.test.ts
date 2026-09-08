import { describe, expect, it } from 'vitest';
import { EVENT_BY_KEY } from '@/data/events';
import { PROPERTIES } from '@/data/properties';
import {
  FINANCE_CEILING,
  FINANCE_FLOOR,
  InvalidDecisionError,
  applyRoundClosing,
  calculateFinalScore,
  calculateTeamProfile,
  canAfford,
  clampIndex,
  financeIndex,
  initialTeamState,
  optionAvailability,
  rankTeams,
  resolveDecision,
} from '@/game/engine';
import { DEFAULT_CONFIG, INITIAL_TRAITS, type ScoreWeights, type TeamState } from '@/types/game';

const PREP_IRRIGACAO = EVENT_BY_KEY['prep-irrigacao'];
const PREP_SEMENTE = EVENT_BY_KEY['prep-semente'];
const MERC_COOPERATIVA = EVENT_BY_KEY['merc-cooperativa'];
const DES_MAQUINA = EVENT_BY_KEY['des-maquina'];
const COLH_PROXIMA = EVENT_BY_KEY['colh-proxima'];
const COLH_LOGISTICA = EVENT_BY_KEY['colh-logistica'];

/** Estado base neutro para testes que não dependem de propriedade específica. */
function baseState(overrides: Partial<TeamState> = {}): TeamState {
  return {
    cash: DEFAULT_CONFIG.initialBudget,
    production: 50,
    technology: 40,
    sustainability: 55,
    traits: { ...INITIAL_TRAITS },
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// initialTeamState
// ---------------------------------------------------------------------------

describe('initialTeamState', () => {
  it('gera estado válido para as 6 propriedades jogáveis', () => {
    expect(PROPERTIES).toHaveLength(6);
    for (const property of PROPERTIES) {
      const state = initialTeamState(property.key);
      expect(state.production).toBeGreaterThanOrEqual(0);
      expect(state.production).toBeLessThanOrEqual(100);
      expect(state.technology).toBeGreaterThanOrEqual(0);
      expect(state.technology).toBeLessThanOrEqual(100);
      expect(state.sustainability).toBeGreaterThanOrEqual(0);
      expect(state.sustainability).toBeLessThanOrEqual(100);
      expect(Number.isFinite(state.cash)).toBe(true);
    }
  });

  it('todas as propriedades partem do MESMO orçamento base antes dos modificadores', () => {
    for (const property of PROPERTIES) {
      const state = initialTeamState(property.key);
      const modifierCash = property.modifiers.cash ?? 0;
      expect(state.cash - modifierCash).toBe(DEFAULT_CONFIG.initialBudget);
    }
  });

  it('lança erro para propriedade desconhecida', () => {
    expect(() => initialTeamState('propriedade-que-nao-existe')).toThrow();
  });
});

// ---------------------------------------------------------------------------
// optionAvailability e canAfford
// ---------------------------------------------------------------------------

describe('optionAvailability e canAfford', () => {
  it('bloqueia opção com requiresCash quando o caixa é curto, com motivo insufficient_cash', () => {
    const state = baseState({ cash: 100 });
    const option = PREP_IRRIGACAO.options.find((entry) => entry.key === 'a')!; // displayCost 20000
    expect(canAfford(option, state)).toBe(false);

    const availability = optionAvailability(PREP_IRRIGACAO, state).find(
      (entry) => entry.option.key === 'a',
    )!;
    expect(availability.available).toBe(false);
    expect(availability.reason).toBe('insufficient_cash');
  });

  it('bloqueia opção com requiresTraits quando o marcador não existe, com motivo missing_trait', () => {
    const state = baseState({ cash: 100_000 }); // caixa de sobra, mas sem inCooperative
    const availability = optionAvailability(COLH_LOGISTICA, state).find(
      (entry) => entry.option.key === 'c',
    )!;
    expect(availability.available).toBe(false);
    expect(availability.reason).toBe('missing_trait');
  });

  it('libera a opção com requiresTraits quando a equipe já possui o marcador', () => {
    const state = baseState({
      cash: 100_000,
      traits: { ...INITIAL_TRAITS, inCooperative: true },
    });
    const availability = optionAvailability(COLH_LOGISTICA, state).find(
      (entry) => entry.option.key === 'c',
    )!;
    expect(availability.available).toBe(true);
    expect(availability.reason).toBeNull();
  });

  it('usa o displayCost, não o efeito líquido de caixa, para calcular afordabilidade', () => {
    // merc-cooperativa opção "a": displayCost 2000, mas o efeito líquido de caixa é +3000.
    const option = MERC_COOPERATIVA.options.find((entry) => entry.key === 'a')!;
    expect(option.displayCost).toBe(2000);
    expect(option.effects.cash).toBe(3000);

    // Com caixa abaixo do displayCost (mesmo que o efeito líquido daria caixa positivo),
    // a opção precisa ficar indisponível.
    const stateSemCaixa = baseState({ cash: 1500 });
    expect(canAfford(option, stateSemCaixa)).toBe(false);

    // Com caixa igual ao displayCost, já é suficiente.
    const stateComCaixa = baseState({ cash: 2000 });
    expect(canAfford(option, stateComCaixa)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// resolveDecision: validação
// ---------------------------------------------------------------------------

describe('resolveDecision: validação', () => {
  it('lança InvalidDecisionError para opção inexistente', () => {
    const state = baseState();
    expect(() =>
      resolveDecision({
        state,
        event: PREP_IRRIGACAO,
        optionKey: 'opcao-fantasma',
        seed: ['jogo-1', 1, 'time-a'],
      }),
    ).toThrow(InvalidDecisionError);
  });

  it('lança InvalidDecisionError com motivo insufficient_cash quando o caixa é curto', () => {
    const state = baseState({ cash: 0 });
    try {
      resolveDecision({
        state,
        event: PREP_IRRIGACAO,
        optionKey: 'a',
        seed: ['jogo-1', 1, 'time-a'],
      });
      expect.unreachable('deveria ter lançado InvalidDecisionError');
    } catch (error) {
      expect(error).toBeInstanceOf(InvalidDecisionError);
      expect((error as InvalidDecisionError).reason).toBe('insufficient_cash');
    }
  });

  it('lança InvalidDecisionError com motivo missing_trait quando falta o marcador exigido', () => {
    const state = baseState({ cash: 100_000 });
    try {
      resolveDecision({
        state,
        event: COLH_LOGISTICA,
        optionKey: 'c',
        seed: ['jogo-1', 5, 'time-a'],
      });
      expect.unreachable('deveria ter lançado InvalidDecisionError');
    } catch (error) {
      expect(error).toBeInstanceOf(InvalidDecisionError);
      expect((error as InvalidDecisionError).reason).toBe('missing_trait');
    }
  });
});

// ---------------------------------------------------------------------------
// resolveDecision: determinismo
// ---------------------------------------------------------------------------

describe('resolveDecision: determinismo do sorteio de risco', () => {
  const riskyOption = PREP_IRRIGACAO.options.find((entry) => entry.key === 'c')!; // tem risk, sem requiresCash
  expect(riskyOption.risk).toBeTruthy();

  it('a mesma semente sempre produz o mesmo resultado, inclusive o sorteio de risco', () => {
    const state = baseState();
    const seed: (string | number)[] = ['jogo-fixo', 1, 'time-fixo'];

    const first = resolveDecision({ state, event: PREP_IRRIGACAO, optionKey: 'c', seed });
    const second = resolveDecision({ state, event: PREP_IRRIGACAO, optionKey: 'c', seed });

    expect(second.riskHit).toBe(first.riskHit);
    expect(second.next).toEqual(first.next);
    expect(second.outcome).toBe(first.outcome);
  });

  it('sementes diferentes produzem resultados de risco diferentes em algum caso', () => {
    const state = baseState();
    const results = Array.from({ length: 24 }, (_, index) =>
      resolveDecision({
        state,
        event: PREP_IRRIGACAO,
        optionKey: 'c',
        seed: ['jogo-fixo', 1, `time-${index}`],
      }),
    );

    const riskHits = new Set(results.map((result) => result.riskHit));
    expect(riskHits.size).toBeGreaterThan(1);
  });

  it('aplica os efeitos declarados da opção sobre o estado', () => {
    const state = baseState({ cash: 50_000 });
    const option = PREP_SEMENTE.options.find((entry) => entry.key === 'a')!; // sem risco
    const result = resolveDecision({
      state,
      event: PREP_SEMENTE,
      optionKey: 'a',
      seed: ['jogo-1', 1, 'time-a'],
    });

    expect(result.next.cash).toBe(state.cash + option.effects.cash!);
    expect(result.next.production).toBe(clampIndex(state.production + option.effects.production!));
    expect(result.next.sustainability).toBe(
      clampIndex(state.sustainability + option.effects.sustainability!),
    );
  });
});

describe('resolveDecision: limites e caixa negativo', () => {
  it('mantém os índices sempre presos em 0..100 mesmo com efeito grande', () => {
    const state = baseState({ production: 95, cash: 50_000 });
    // prep-agua opção "b": production +12, empurra o índice para além de 100.
    const result = resolveDecision({
      state,
      event: EVENT_BY_KEY['prep-agua'],
      optionKey: 'b',
      seed: ['jogo-1', 1, 'time-a'],
    });
    expect(result.next.production).toBe(100);
  });

  it('permite que o caixa fique negativo quando o risco é desfavorável', () => {
    const state = baseState({ cash: 5000 }); // exatamente o displayCost da opção b
    const option = DES_MAQUINA.options.find((entry) => entry.key === 'b')!;
    expect(option.displayCost).toBe(5000);

    let foundNegative = false;
    for (let index = 0; index < 40; index += 1) {
      const result = resolveDecision({
        state,
        event: DES_MAQUINA,
        optionKey: 'b',
        seed: ['jogo-negativo', index, 'time-b'],
      });
      if (result.riskHit === false) {
        // efeito base: cash -5000 (fica 0); penalidade: cash -4000 (fica -4000).
        expect(result.next.cash).toBeLessThan(0);
        foundNegative = true;
      }
    }
    expect(foundNegative).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Mecanismo pedagógico central: productionIfTrained / idleTech
// ---------------------------------------------------------------------------

describe('productionIfTrained: tecnologia sem capacitação não vira produção na hora', () => {
  it('sem "trained", o ganho de produção não é aplicado e acumula em idleTech', () => {
    const state = baseState({ cash: 40_000, traits: { ...INITIAL_TRAITS, trained: false } });
    const option = PREP_IRRIGACAO.options.find((entry) => entry.key === 'a')!;

    const result = resolveDecision({
      state,
      event: PREP_IRRIGACAO,
      optionKey: 'a',
      seed: ['jogo-1', 1, 'time-a'],
    });

    // Produção não muda na hora: a opção não declara "production", só "productionIfTrained".
    expect(result.next.production).toBe(state.production);
    expect(result.next.traits.idleTech).toBe(option.effects.productionIfTrained);
    expect(result.notes.some((note) => note.includes('ficaram parados'))).toBe(true);
  });

  it('com "trained", o mesmo ganho aumenta a produção imediatamente', () => {
    const state = baseState({ cash: 40_000, traits: { ...INITIAL_TRAITS, trained: true } });
    const option = PREP_IRRIGACAO.options.find((entry) => entry.key === 'a')!;

    const result = resolveDecision({
      state,
      event: PREP_IRRIGACAO,
      optionKey: 'a',
      seed: ['jogo-1', 1, 'time-a'],
    });

    expect(result.next.production).toBe(
      clampIndex(state.production + option.effects.productionIfTrained!),
    );
    expect(result.next.traits.idleTech).toBe(0);
  });

  it('applyRoundClosing converte idleTech acumulado em produção quando a equipe se capacita depois', () => {
    const state = baseState({
      production: 40,
      traits: { ...INITIAL_TRAITS, trained: true, idleTech: 12 },
    });

    const closing = applyRoundClosing(state);

    expect(closing.state.production).toBe(52);
    expect(closing.state.traits.idleTech).toBe(0);
    expect(closing.notes.some((note) => note.includes('destravou a tecnologia'))).toBe(true);
  });

  it('idleTech não se converte em produção enquanto a equipe não estiver treinada', () => {
    const state = baseState({
      production: 40,
      traits: { ...INITIAL_TRAITS, trained: false, idleTech: 12 },
    });

    const closing = applyRoundClosing(state);

    expect(closing.state.production).toBe(40);
    expect(closing.state.traits.idleTech).toBe(12);
  });
});

// ---------------------------------------------------------------------------
// applyRoundClosing
// ---------------------------------------------------------------------------

describe('applyRoundClosing', () => {
  it('desconta debtPerRound e decrementa debtInstallments', () => {
    const state = baseState({
      cash: 10_000,
      traits: { ...INITIAL_TRAITS, debtInstallments: 3, debtPerRound: 1_000 },
    });

    const closing = applyRoundClosing(state);

    expect(closing.state.cash).toBe(9_000);
    expect(closing.state.traits.debtInstallments).toBe(2);
    expect(closing.debtCharged).toBe(1_000);
  });

  it('zera debtPerRound quando a última parcela é paga', () => {
    const state = baseState({
      cash: 10_000,
      traits: { ...INITIAL_TRAITS, debtInstallments: 1, debtPerRound: 1_000 },
    });

    const closing = applyRoundClosing(state);

    expect(closing.state.traits.debtInstallments).toBe(0);
    expect(closing.state.traits.debtPerRound).toBe(0);
    expect(closing.notes.some((note) => note.includes('quitado'))).toBe(true);
  });

  it('incrementa cashCrises quando a rodada fecha com o caixa negativo', () => {
    const state = baseState({ cash: -500, traits: { ...INITIAL_TRAITS, cashCrises: 0 } });
    const closing = applyRoundClosing(state);
    expect(closing.state.traits.cashCrises).toBe(1);
  });

  it('não incrementa cashCrises quando a rodada fecha com o caixa positivo', () => {
    const state = baseState({ cash: 500, traits: { ...INITIAL_TRAITS, cashCrises: 0 } });
    const closing = applyRoundClosing(state);
    expect(closing.state.traits.cashCrises).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Fusão de marcadores
// ---------------------------------------------------------------------------

describe('fusão de marcadores (mergeTraits, via resolveDecision)', () => {
  it('efeito com debtInstallments: 0 quita a dívida em vez de somar', () => {
    const state = baseState({
      cash: 20_000,
      traits: { ...INITIAL_TRAITS, debtInstallments: 3, debtPerRound: 800 },
    });

    const result = resolveDecision({
      state,
      event: COLH_PROXIMA,
      optionKey: 'c', // "Quitar dívida e limpar o nome": traits: { debtInstallments: 0, debtPerRound: 0 }
      seed: ['jogo-1', 5, 'time-a'],
    });

    expect(result.next.traits.debtInstallments).toBe(0);
    expect(result.next.traits.debtPerRound).toBe(0);
  });

  it('idleTech acumula entre decisões em vez de sobrescrever', () => {
    const state = baseState({ cash: 40_000, traits: { ...INITIAL_TRAITS, trained: false } });

    const first = resolveDecision({
      state,
      event: PREP_IRRIGACAO,
      optionKey: 'a',
      seed: ['jogo-1', 1, 'time-a'],
    });
    const second = resolveDecision({
      state: first.next,
      event: PREP_IRRIGACAO,
      optionKey: 'a',
      seed: ['jogo-1', 2, 'time-a'],
    });

    expect(second.next.traits.idleTech).toBe(24); // 12 + 12
  });

  it('opportunitiesTaken acumula entre decisões', () => {
    const state = baseState({ cash: 40_000 });

    const first = resolveDecision({
      state,
      event: PREP_IRRIGACAO,
      optionKey: 'a',
      seed: ['jogo-1', 1, 'time-a'],
    });
    const second = resolveDecision({
      state: first.next,
      event: PREP_IRRIGACAO,
      optionKey: 'a',
      seed: ['jogo-1', 2, 'time-a'],
    });

    expect(second.next.traits.opportunitiesTaken).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// financeIndex e calculateFinalScore
// ---------------------------------------------------------------------------

describe('financeIndex', () => {
  it('é monotônico: mais caixa nunca produz índice financeiro menor', () => {
    expect(financeIndex(0)).toBeLessThanOrEqual(financeIndex(50_000));
    expect(financeIndex(-10_000)).toBeLessThanOrEqual(financeIndex(0));
  });

  it('fica preso em 0..100 mesmo além do piso e do teto', () => {
    expect(financeIndex(FINANCE_FLOOR - 100_000)).toBe(0);
    expect(financeIndex(FINANCE_CEILING + 100_000)).toBe(100);
    expect(financeIndex(FINANCE_FLOOR)).toBe(0);
    expect(financeIndex(FINANCE_CEILING)).toBe(100);
  });
});

describe('calculateFinalScore', () => {
  it('o composto é monotônico em cada indicador, com os demais fixos', () => {
    const lowProduction = baseState({ production: 30 });
    const highProduction = baseState({ production: 80 });

    const low = calculateFinalScore(lowProduction);
    const high = calculateFinalScore(highProduction);

    expect(high.composite).toBeGreaterThan(low.composite);
  });

  it('os índices individuais no limite (0 e 100) permanecem dentro de 0..100 no resultado final', () => {
    // TeamState só chega a calculateFinalScore já clampado pela engine (applyEffects,
    // initialTeamState): o teste exercita os extremos válidos, não um estado impossível.
    const score = calculateFinalScore(baseState({ production: 100, technology: 0 }));
    expect(score.production).toBeLessThanOrEqual(100);
    expect(score.production).toBeGreaterThanOrEqual(0);
    expect(score.technology).toBeGreaterThanOrEqual(0);
    expect(score.technology).toBeLessThanOrEqual(100);
  });

  it('os pesos alteram a ordem do composto entre duas equipes', () => {
    // Equipe X é forte em tecnologia e fraca em sustentabilidade; equipe Y o oposto.
    const teamX = baseState({ technology: 90, sustainability: 20 });
    const teamY = baseState({ technology: 20, sustainability: 90 });

    const weightsTechHeavy: ScoreWeights = { finances: 10, production: 10, technology: 70, sustainability: 10 };
    const weightsSustainHeavy: ScoreWeights = { finances: 10, production: 10, technology: 10, sustainability: 70 };

    const xUnderTech = calculateFinalScore(teamX, weightsTechHeavy).composite;
    const yUnderTech = calculateFinalScore(teamY, weightsTechHeavy).composite;
    expect(xUnderTech).toBeGreaterThan(yUnderTech);

    const xUnderSustain = calculateFinalScore(teamX, weightsSustainHeavy).composite;
    const yUnderSustain = calculateFinalScore(teamY, weightsSustainHeavy).composite;
    expect(yUnderSustain).toBeGreaterThan(xUnderSustain);
  });
});

// ---------------------------------------------------------------------------
// calculateTeamProfile
// ---------------------------------------------------------------------------

describe('calculateTeamProfile', () => {
  const neutralIndices = { finances: 50, production: 50, technology: 50, sustainability: 50, composite: 50 };

  it('identifica perfil sustentável para histórico só de sustentabilidade', () => {
    const profile = calculateTeamProfile(
      ['sustainability', 'sustainability', 'sustainability'],
      { ...neutralIndices, sustainability: 90 },
    );
    expect(profile).toBe('sustentavel');
  });

  it('identifica perfil de inovação agressiva para tecnologia com crédito', () => {
    const profile = calculateTeamProfile(
      ['tech_invest', 'tech_invest', 'credit', 'credit'],
      { ...neutralIndices, technology: 85 },
    );
    expect(profile).toBe('inovacao_agressiva');
  });

  it('identifica perfil de conservação de caixa para histórico conservador', () => {
    const profile = calculateTeamProfile(
      ['cash_conservative', 'cash_conservative', 'cash_conservative', 'tech_avoid'],
      { ...neutralIndices, finances: 95 },
    );
    expect(profile).toBe('conservacao_caixa');
  });

  it('identifica perfil articulado para política pública com cooperação', () => {
    const profile = calculateTeamProfile(
      ['public_policy', 'public_policy', 'cooperation', 'cooperation', 'training'],
      neutralIndices,
    );
    expect(profile).toBe('articulada');
  });
});

// ---------------------------------------------------------------------------
// rankTeams
// ---------------------------------------------------------------------------

describe('rankTeams', () => {
  function team(teamId: string, overrides: Partial<TeamState> = {}, tags: string[] = []) {
    return { teamId, state: baseState(overrides), tags: tags as never[] };
  }

  it('ordena por composto decrescente e atribui rank de 1 a N', () => {
    const inputs = [
      team('time-fraco', { cash: -20_000, production: 10, technology: 10, sustainability: 10 }),
      team('time-forte', { cash: 100_000, production: 90, technology: 90, sustainability: 90 }),
      team('time-medio', { cash: 40_000, production: 50, technology: 50, sustainability: 50 }),
    ];

    const ranked = rankTeams(inputs);

    expect(ranked.map((entry) => entry.teamId)).toEqual(['time-forte', 'time-medio', 'time-fraco']);
    expect(ranked.map((entry) => entry.rank)).toEqual([1, 2, 3]);
  });

  it('distribui os prêmios de melhor indicador para quem de fato liderou aquele indicador', () => {
    const inputs = [
      team('time-a', { cash: 100_000, production: 10, technology: 10, sustainability: 10 }),
      team('time-b', { cash: -10_000, production: 95, technology: 10, sustainability: 10 }),
      team('time-c', { cash: -10_000, production: 10, technology: 95, sustainability: 10 }),
      team('time-d', { cash: -10_000, production: 10, technology: 10, sustainability: 95 }),
    ];

    const ranked = rankTeams(inputs);
    const awardsOf = (teamId: string) => ranked.find((entry) => entry.teamId === teamId)!.awards;

    expect(awardsOf('time-a')).toContain('best_finance');
    expect(awardsOf('time-b')).toContain('best_production');
    expect(awardsOf('time-c')).toContain('best_technology');
    expect(awardsOf('time-d')).toContain('best_sustainability');
  });

  it('só concede best_recovery a quem passou por crise de caixa (cashCrises > 0)', () => {
    const semCrise = baseState({ cash: 10_000 });
    const comCrise = baseState({
      cash: 20_000,
      traits: { ...INITIAL_TRAITS, cashCrises: 2 },
    });

    const ranked = rankTeams([
      { teamId: 'nunca-teve-crise', state: semCrise, tags: [] },
      { teamId: 'se-recuperou', state: comCrise, tags: [] },
    ]);

    const semCriseEntry = ranked.find((entry) => entry.teamId === 'nunca-teve-crise')!;
    const comCriseEntry = ranked.find((entry) => entry.teamId === 'se-recuperou')!;

    expect(semCriseEntry.awards).not.toContain('best_recovery');
    expect(comCriseEntry.awards).toContain('best_recovery');
  });

  it('não concede best_recovery a ninguém quando nenhuma equipe teve crise de caixa', () => {
    const ranked = rankTeams([
      { teamId: 'time-a', state: baseState(), tags: [] },
      { teamId: 'time-b', state: baseState(), tags: [] },
    ]);

    expect(ranked.every((entry) => !entry.awards.includes('best_recovery'))).toBe(true);
  });

  it('o desempate é estável: mesma entrada produz sempre a mesma saída', () => {
    const inputs = [
      team('time-b', { cash: 50_000, production: 50, technology: 50, sustainability: 50 }),
      team('time-a', { cash: 50_000, production: 50, technology: 50, sustainability: 50 }),
      team('time-c', { cash: 50_000, production: 50, technology: 50, sustainability: 50 }),
    ];

    const firstRun = rankTeams(inputs).map((entry) => entry.teamId);
    const secondRun = rankTeams(inputs).map((entry) => entry.teamId);

    expect(firstRun).toEqual(secondRun);
    // Empate total: desempate alfabético pelo id da equipe.
    expect(firstRun).toEqual(['time-a', 'time-b', 'time-c']);
  });
});
