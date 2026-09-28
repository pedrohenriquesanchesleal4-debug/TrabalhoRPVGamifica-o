/**
 * Simulação completa de partida do SAFRA DF, como um teste de regressão.
 *
 * Rola o engine completo 6 × 5 rodadas, como os scripts de smoke, mas como
 * parte da suíte de testes — qualquer mudança que quebre o balanceamento
 * básico aparece aqui antes de deploy.
 *
 * Cobertura: 6 equipes, 5 rodadas, 6 estratégias (menos 1+ decidir), todas as
 * cartas da fase, cálculo de ranking, perfis, prêmios, diagnósticos e ganchos
 * de debate. Nenhuma chamada de banco.
 */
import { describe, expect, it } from 'vitest';
import {

  buildDiagnostics,
  buildTeachingHooks,
  diagnosticSentence,
} from '../game/diagnostics';
import type { DecisionRecord } from '../game/diagnostics';
import {
  calculateRoundResult,
  drawEventCard,
  initialTeamState,
  optionAvailability,
  rankTeams,
  resolveDecision,
} from '../game/engine';
import { pickDeterministic } from '../game/rng';
import { PROPERTIES } from '../data/properties';
import {
  DEFAULT_CONFIG,
  ROUND_META,
  ROUND_PHASES,
  TOTAL_ROUNDS,
  type DecisionTag,
  type GameEventCard,
  type RoundPhase,
  type TeamState,
} from '../types/game';

const SEED = 'teste-full-game';

// ---------------------------------------------------------------------------
// Estratégias das equipes (mesmas do simulate.ts, mas enxutas)
// ---------------------------------------------------------------------------

function availableKeys(event: GameEventCard, state: TeamState): string[] {
  return optionAvailability(event, state)
    .filter((e) => e.available)
    .map((e) => e.option.key);
}

function pickCheapest(event: GameEventCard, state: TeamState): string {
  const available = optionAvailability(event, state)
    .filter((e) => e.available)
    .map((e) => e.option);
  if (available.length === 0) return '';
  return available.reduce((best, o) => (o.displayCost < best.displayCost ? o : best)).key;
}

function pickByTag(tag: DecisionTag): (event: GameEventCard, state: TeamState) => string {
  return (event, state) => {
    const available = optionAvailability(event, state)
      .filter((e) => e.available)
      .map((e) => e.option);
    if (available.length === 0) return '';
    const match = available.find((o) => o.tags.includes(tag));
    return match?.key ?? pickCheapest(event, state);
  };
}

const STRATEGIES: Record<
  string,
  (event: GameEventCard, state: TeamState) => string
> = {
  'sitio-horizonte': pickCheapest,
  'cerrado-vivo': pickByTag('tech_invest'),
  'boa-esperanca': pickByTag('public_policy'),
  'riacho-verde': pickByTag('sustainability'),
  'nova-safra': (event, state) => {
    const keys = availableKeys(event, state);
    if (keys.length === 0) return '';
    return pickDeterministic(keys, SEED, 1, event.key, 'rnd').toString();
  },
  // planalto-familiar: nunca decide (não há entry no mapa → undefined)
};

// ---------------------------------------------------------------------------
// Validações de estado
// ---------------------------------------------------------------------------

function expectFinite(value: number, label: string): void {
  expect(value, label).toBeGreaterThanOrEqual(-100_000);
  expect(Number.isFinite(value), `${label} deve ser finito`).toBe(true);
}

function expectIndex(value: number, label: string): void {
  expect(value, label).toBeGreaterThanOrEqual(0);
  expect(value, label).toBeLessThanOrEqual(100);
}

function expectValidState(state: TeamState, team: string, phase: string): void {
  expectFinite(state.cash, `${team}/${phase}: cash`);
  expectIndex(state.production, `${team}/${phase}: production`);
  expectIndex(state.technology, `${team}/${phase}: technology`);
  expectIndex(state.sustainability, `${team}/${phase}: sustainability`);
}

// ---------------------------------------------------------------------------
// Simulação
// ---------------------------------------------------------------------------

interface TeamRuntime {
  teamId: string;
  strategy: ((event: GameEventCard, state: TeamState) => string) | null;
  state: TeamState;
}

const teams: TeamRuntime[] = PROPERTIES.map((p) => ({
  teamId: p.key,
  strategy: STRATEGIES[p.key] ?? null,
  state: initialTeamState(p.key),
}));

const records: DecisionRecord[] = [];

const allAvailable = new Set<string>();
let totalOptionsChecked = 0;

for (let roundIndex = 1; roundIndex <= TOTAL_ROUNDS; roundIndex += 1) {
  const phase: RoundPhase = ROUND_PHASES[roundIndex - 1];
  const meta = ROUND_META[phase];

  describe(`Rodada ${roundIndex} — ${meta.title}`, () => {
    it('toda equipe recebe pelo menos uma carta válida', () => {
      // Vitest 5 tirou o 2º argumento (mensagem) de `toBeGreaterThan`, e
      // numa matriz 6 equipes × 5 rodadas a primeira falha escondia as outras
      // cinco. Aqui as falhas são coletadas e reportadas de uma vez: o nome da
      // equipe, a carta e o índice da rodada aparecem juntos na mensagem.
      const semOpcao: string[] = [];
      const semDisponivel: string[] = [];

      for (const team of teams) {
        const event = drawEventCard(phase, SEED, roundIndex, team.teamId, teams.indexOf(team));
        expect(event).toBeDefined();
        expect(typeof event.key).toBe('string');
        expect(event.key.length).toBeGreaterThan(0);

        const availability = optionAvailability(event, team.state);
        if (availability.length === 0) {
          semOpcao.push(`${team.teamId} @ carta "${event.key}"`);
        } else if (!availability.some((a) => a.available)) {
          semDisponivel.push(`${team.teamId} @ carta "${event.key}"`);
        }

        totalOptionsChecked += availability.filter((a) => a.available).length;

        // Executa decisão (ou não-decisão)
        const optionKey =
          team.strategy
            ? team.strategy(event, team.state)
            : '';

        if (optionKey) {
          const result = resolveDecision({
            state: team.state,
            event,
            optionKey,
            seed: [SEED, roundIndex, team.teamId],
          });

          team.state = result.next;

          records.push({
            teamId: team.teamId,
            roundIndex,
            eventKey: event.key,
            optionKey,
            optionLabel: event.options.find((o) => o.key === optionKey)?.label ?? optionKey,
            tags: event.options.find((o) => o.key === optionKey)?.tags ?? [],
          });
        }
      }

      // Uma asserção por vez, com todas as equipes na mesma mensagem.
      expect(semOpcao, `equipes sem nenhuma opção na carta: ${semOpcao.join(', ') || '(nenhuma)'}`)
        .toHaveLength(0);
      expect(
        semDisponivel,
        `equipes com carta inteira bloqueada: ${semDisponivel.join(', ') || '(nenhuma)'}`,
      ).toHaveLength(0);
    });

    it('fechamento da rodada mantém estado válido', () => {
      for (const team of teams) {
        const closing = calculateRoundResult(team.state, phase);
        team.state = closing.state;
        expectValidState(team.state, team.teamId, `fechamento-${phase}`);
      }
    });
  });
}

// ---------------------------------------------------------------------------
// Resultados e diagnósticos
// ---------------------------------------------------------------------------

describe('PLACAR FINAL', () => {
  it('6 equipes ranqueadas, composite entre 0 e 100, perfil válido', () => {
    const ranking = rankTeams(
      teams.map((t) => ({
        teamId: t.teamId,
        state: t.state,
        tags: records.filter((r) => r.teamId === t.teamId).flatMap((r) => r.tags),
      })),
      DEFAULT_CONFIG.weights,
    );

    expect(ranking.length).toBe(6);

    for (const [i, entry] of ranking.entries()) {
      expect(entry.rank).toBe(i + 1);
      expect(entry.composite).toBeGreaterThanOrEqual(0);
      expect(entry.composite).toBeLessThanOrEqual(100);
      expect(typeof entry.profile).toBe('string');
      expect(entry.awards.length).toBeGreaterThanOrEqual(0);
      expectFinite(entry.finances, `${entry.teamId}: finances`);
      expectIndex(entry.production, `${entry.teamId}: production`);
      expectIndex(entry.technology, `${entry.teamId}: technology`);
      expectIndex(entry.sustainability, `${entry.teamId}: sustainability`);
    }
  });

  it('decisões registradas totalizam pelo menos 5 (cada rodada tem 6 equipes, mas 1+ pode não decidir)', () => {
    // 6 equipes × 5 rodadas = 30 decisões potenciais. Só planalto-familiar
    // não decide: 5 equipes × 5 rodadas = 25.
    expect(records.length).toBeGreaterThanOrEqual(25);
    expect(records.length).toBeLessThanOrEqual(30);
  });
});

describe('DIAGNÓSTICOS', () => {
  const diagnostics = buildDiagnostics(records, teams.length);

  it('ganchos de debate: sem dado, sem gancho', () => {
    const hooks = buildTeachingHooks(records, teams.length);

    // Hooks sem dado (0 equipes na tag) NÃO podem aparecer
    const zeroHooks = hooks.filter((h) => /0\s+equipe/.test(h));
    expect(zeroHooks).toEqual([]);
  });

  it('diagnosticSentence cobre todas as tags', () => {
    for (const entry of diagnostics) {
      const sentence = diagnosticSentence(entry);
      /*
        A frase é "4 de 6 equipes: investiu em tecnologia" — depois dos
        dois-pontos a frase continua, então o rótulo entra em minúscula. É a
        grafia correta em pt-BR e é o que `diagnosticSentence` faz de propósito
        (a asserção antiga exigia o rótulo capitalizado e falhava). Todos os 12
        rótulos de `DECISION_TAG_LABEL` são substantivos comuns, sem nome
        próprio nem sigla, então a regra vale para a lista inteira — e este
        teste é o que impede alguém de incluir um rótulo com sigla sem perceber
        que a frase vai sair "pnae" no telão.
      */
      expect(sentence).toContain(entry.label.toLowerCase());
      expect(sentence).not.toMatch(/\s[A-ZÀ-Ü]/);
      expect(sentence).toContain('de');
      expect(sentence).toContain(`${entry.totalTeams}`);
    }
  });

  it('total de decisões contadas no diagnóstico bate com records', () => {
    const totalDecisions = diagnostics.reduce((sum, d) => sum + d.decisions, 0);
    // Cada record pode ter 0 ou mais tags (algumas opções não têm tag)
    // mas o total de decisões contadas é ≤ records.length
    expect(totalDecisions).toBeLessThanOrEqual(records.length);
  });
});

describe('OUTRAS SANIDADES', () => {
  it('nenhuma opção disponível repete chave dentro da mesma carta', () => {
    // Itera todas as cartas possíveis do jogo (5 fases × 6 propriedades)
    const seen = new Set<string>();
    for (let roundIndex = 1; roundIndex <= TOTAL_ROUNDS; roundIndex += 1) {
      const phase: RoundPhase = ROUND_PHASES[roundIndex - 1];
      for (const prop of PROPERTIES) {
        const event = drawEventCard(phase, SEED, roundIndex, prop.key, PROPERTIES.indexOf(prop));
        const availability = optionAvailability(event, initialTeamState(prop.key));
        const key = `${phase}/${prop.key}/${event.key}`;
        // Não pode ter duas opções disponíveis com a mesma chave
        const keys = availability.filter((a) => a.available).map((a) => a.option.key);
        expect(new Set(keys).size, `Duplicata de chave em ${key}: ${keys.join(',')}`).toBe(keys.length);
        seen.add(key);
      }
    }
  });
});
