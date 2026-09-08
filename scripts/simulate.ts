/**
 * Simulação de partida completa do SAFRA DF, sem banco.
 *
 * Roda 6 equipes (as 6 propriedades jogáveis) por 5 rodadas, cada uma seguindo
 * uma estratégia explícita e diferente, usando só a engine pura
 * (`drawEventCard`, `optionAvailability`, `resolveDecision`,
 * `calculateRoundResult`). No fim, imprime placar, perfis e diagnóstico da
 * turma com as mesmas funções que o professor vê em `/host/[gameId]/resultado`
 * e `/host/[gameId]/diagnostico`.
 *
 * Serve também de teste de fumaça do balanceamento: se alguma equipe terminar
 * com índice fora de 0..100, caixa em NaN, ou encontrar uma carta sem nenhuma
 * opção disponível, o script encerra com código de saída 1.
 *
 * Uso:
 *   npx tsx scripts/simulate.ts
 *   npx tsx scripts/simulate.ts --seed=turma-2026-1
 *   npx tsx scripts/simulate.ts --json
 */

import { buildDiagnostics, buildTeachingHooks, diagnosticBar, diagnosticSentence } from '../game/diagnostics';
import type { DecisionRecord } from '../game/diagnostics';
import {
  calculateRoundResult,
  drawEventCard,
  initialTeamState,
  optionAvailability,
  rankTeams,
  resolveDecision,
  type OptionAvailability,
} from '../game/engine';
import { pickDeterministic } from '../game/rng';
import { PROPERTIES } from '../data/properties';
import {
  AWARD_META,
  DEFAULT_CONFIG,
  PROFILE_META,
  ROUND_META,
  ROUND_PHASES,
  TOTAL_ROUNDS,
  type DecisionOption,
  type DecisionTag,
  type GameEventCard,
  type RoundPhase,
  type TeamState,
} from '../types/game';

// ---------------------------------------------------------------------------
// Argumentos de linha de comando
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);
const jsonMode = args.includes('--json');
const seedArg = args.find((arg) => arg.startsWith('--seed='));
const gameId = seedArg ? seedArg.slice('--seed='.length) : 'simulacao-safra-df';

// ---------------------------------------------------------------------------
// Estratégias de equipe
// ---------------------------------------------------------------------------

interface StrategyContext {
  gameId: string;
  roundIndex: number;
  teamId: string;
}

type Strategy = {
  name: string;
  /** Devolve a chave da opção escolhida, ou null se a equipe não decide. */
  pick: (event: GameEventCard, availability: OptionAvailability[], ctx: StrategyContext) => string | null;
};

function availableOptions(availability: OptionAvailability[]): DecisionOption[] {
  return availability.filter((entry) => entry.available).map((entry) => entry.option);
}

function cheapest(options: DecisionOption[]): DecisionOption {
  return options.reduce((best, option) => (option.displayCost < best.displayCost ? option : best));
}

/** Prefere a primeira opção disponível com a tag pedida; sem ela, cai para a mais barata. */
function preferTag(tag: DecisionTag): Strategy['pick'] {
  return (_event, availability) => {
    const options = availableOptions(availability);
    if (options.length === 0) return null;
    const tagged = options.find((option) => option.tags.includes(tag));
    return (tagged ?? cheapest(options)).key;
  };
}

const STRATEGIES: Record<string, Strategy> = {
  'sitio-horizonte': {
    name: 'Sempre a opção mais barata',
    pick: (_event, availability) => {
      const options = availableOptions(availability);
      return options.length === 0 ? null : cheapest(options).key;
    },
  },
  'cerrado-vivo': {
    name: 'Sempre tecnologia',
    pick: preferTag('tech_invest'),
  },
  'boa-esperanca': {
    name: 'Sempre política pública',
    pick: preferTag('public_policy'),
  },
  'riacho-verde': {
    name: 'Sempre sustentabilidade',
    pick: preferTag('sustainability'),
  },
  'nova-safra': {
    name: 'Aleatória com semente fixa',
    pick: (_event, availability, ctx) => {
      const options = availableOptions(availability);
      if (options.length === 0) return null;
      return pickDeterministic(options, ctx.gameId, ctx.roundIndex, ctx.teamId, 'estrategia-aleatoria').key;
    },
  },
  'planalto-familiar': {
    name: 'Nunca decide',
    pick: () => null,
  },
};

// ---------------------------------------------------------------------------
// Validação de estado (teste de fumaça de balanceamento)
// ---------------------------------------------------------------------------

const problems: string[] = [];

function checkIndex(label: string, value: number): void {
  if (!Number.isFinite(value) || value < 0 || value > 100) {
    problems.push(`${label} fora de 0..100 ou não numérico: ${value}`);
  }
}

function checkState(label: string, state: TeamState): void {
  if (!Number.isFinite(state.cash)) {
    problems.push(`${label}: caixa não numérico (NaN): ${state.cash}`);
  }
  checkIndex(`${label}: produção`, state.production);
  checkIndex(`${label}: tecnologia`, state.technology);
  checkIndex(`${label}: sustentabilidade`, state.sustainability);
}

function checkAvailability(label: string, availability: OptionAvailability[]): void {
  if (!availability.some((entry) => entry.available)) {
    problems.push(`${label}: nenhuma opção disponível para a equipe nesta carta.`);
  }
}

// ---------------------------------------------------------------------------
// Execução da partida
// ---------------------------------------------------------------------------

interface TeamRuntime {
  teamId: string;
  propertyName: string;
  strategyName: string;
  state: TeamState;
}

const teams: TeamRuntime[] = PROPERTIES.map((property) => ({
  teamId: property.key,
  propertyName: property.name,
  strategyName: STRATEGIES[property.key]?.name ?? 'Sem estratégia definida',
  state: initialTeamState(property.key),
}));

const records: DecisionRecord[] = [];
const log: string[] = [];

function print(line = ''): void {
  log.push(line);
}

print(`SAFRA DF · simulação de partida completa (semente: "${gameId}")`);
print('='.repeat(60));

for (let roundIndex = 1; roundIndex <= TOTAL_ROUNDS; roundIndex += 1) {
  const phase: RoundPhase = ROUND_PHASES[roundIndex - 1];
  const meta = ROUND_META[phase];
  print();
  print(`Rodada ${roundIndex}/${TOTAL_ROUNDS} · ${meta.title} · ${meta.subtitle}`);
  print('-'.repeat(60));

  for (const [index, team] of teams.entries()) {
    const event = drawEventCard(phase, gameId, roundIndex, team.teamId, index);
    const availability = optionAvailability(event, team.state);
    checkAvailability(`Rodada ${roundIndex} · ${team.propertyName} · carta "${event.key}"`, availability);

    const strategy = STRATEGIES[team.teamId];
    const optionKey = strategy.pick(event, availability, { gameId, roundIndex, teamId: team.teamId });

    if (optionKey === null) {
      print(`${team.propertyName.padEnd(20)} [${team.strategyName}] não decidiu em "${event.title}".`);
      continue;
    }

    const result = resolveDecision({
      state: team.state,
      event,
      optionKey,
      seed: [gameId, roundIndex, team.teamId],
    });

    const chosenOption = event.options.find((option) => option.key === optionKey)!;
    team.state = result.next;
    checkState(`Rodada ${roundIndex} · ${team.propertyName} · após decisão`, team.state);

    records.push({
      teamId: team.teamId,
      roundIndex,
      eventKey: event.key,
      optionKey,
      optionLabel: chosenOption.label,
      tags: chosenOption.tags,
    });

    print(`${team.propertyName.padEnd(20)} [${team.strategyName}] escolheu "${chosenOption.label}" em "${event.title}".`);
    print(`  ${result.outcome}`);
    for (const note of result.notes) print(`  · ${note}`);
  }

  print();
  print(`Fechamento da rodada ${roundIndex} (${meta.title}):`);
  for (const team of teams) {
    const closing = calculateRoundResult(team.state, phase);
    team.state = closing.state;
    checkState(`Rodada ${roundIndex} · ${team.propertyName} · fechamento`, team.state);

    print(
      `  ${team.propertyName.padEnd(20)} caixa: R$ ${team.state.cash.toLocaleString('pt-BR')} · ` +
        `produção ${team.state.production} · tecnologia ${team.state.technology} · sustentabilidade ${team.state.sustainability}`,
    );
    for (const note of closing.notes) print(`    · ${note}`);
  }
}

// ---------------------------------------------------------------------------
// Placar final
// ---------------------------------------------------------------------------

const tagsByTeam = new Map<string, DecisionTag[]>();
for (const record of records) {
  const list = tagsByTeam.get(record.teamId) ?? [];
  list.push(...record.tags);
  tagsByTeam.set(record.teamId, list);
}

const ranking = rankTeams(
  teams.map((team) => ({
    teamId: team.teamId,
    state: team.state,
    tags: tagsByTeam.get(team.teamId) ?? [],
  })),
  DEFAULT_CONFIG.weights,
);

const propertyName = new Map(teams.map((team) => [team.teamId, team.propertyName]));

print();
print('='.repeat(60));
print('PLACAR FINAL');
print('='.repeat(60));

for (const entry of ranking) {
  const name = propertyName.get(entry.teamId) ?? entry.teamId;
  print(
    `${String(entry.rank).padStart(2)}º ${name.padEnd(20)} composto ${entry.composite.toFixed(1).padStart(5)} ` +
      `· finanças ${String(entry.finances).padStart(3)} · produção ${String(entry.production).padStart(3)} ` +
      `· tecnologia ${String(entry.technology).padStart(3)} · sustentabilidade ${String(entry.sustainability).padStart(3)}`,
  );
  print(`     Perfil: ${PROFILE_META[entry.profile].label}. ${PROFILE_META[entry.profile].description}`);
  if (entry.awards.length > 0) {
    print(`     Prêmios: ${entry.awards.map((award) => AWARD_META[award].label).join(', ')}`);
  }
}

// ---------------------------------------------------------------------------
// Diagnóstico da turma
// ---------------------------------------------------------------------------

print();
print('='.repeat(60));
print('DIAGNÓSTICO DA TURMA');
print('='.repeat(60));

const diagnostics = buildDiagnostics(records, teams.length);
for (const entry of diagnostics) {
  const decisionWord = entry.decisions === 1 ? 'decisão' : 'decisões';
  print(`${diagnosticBar(entry)} ${diagnosticSentence(entry)} (${entry.decisions} ${decisionWord})`);
}

print();
print('Ganchos para o debriefing:');
const hooks = buildTeachingHooks(records, teams.length);
if (hooks.length === 0) {
  print('  Nenhum contraste relevante encontrado nesta partida.');
} else {
  for (const hook of hooks) print(`  · ${hook}`);
}

// ---------------------------------------------------------------------------
// Saída
// ---------------------------------------------------------------------------

if (jsonMode) {
  console.log(
    JSON.stringify(
      {
        gameId,
        problems,
        ranking,
        diagnostics,
        hooks,
        teams: teams.map((team) => ({
          teamId: team.teamId,
          propertyName: team.propertyName,
          strategy: team.strategyName,
          state: team.state,
        })),
      },
      null,
      2,
    ),
  );
} else {
  console.log(log.join('\n'));
}

if (problems.length > 0) {
  console.error('\nESTADO INVÁLIDO DETECTADO DURANTE A SIMULAÇÃO:');
  for (const problem of problems) console.error(`  · ${problem}`);
  process.exitCode = 1;
} else if (!jsonMode) {
  console.log('\nSimulação concluída sem estado inválido: balanceamento consistente.');
}
