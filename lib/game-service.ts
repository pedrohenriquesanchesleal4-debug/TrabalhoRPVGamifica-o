import type { SupabaseClient } from '@supabase/supabase-js';
import { EVENT_BY_KEY } from '@/data/events';
import { PROPERTIES, PROPERTY_BY_KEY } from '@/data/properties';
import {
  drawEventCard,
  calculateRoundResult,
  initialTeamState,
  optionAvailability,
  rankTeams,
  resolveDecision,
  type TeamScoreInput,
} from '@/game/engine';
import {
  buildDiagnostics,
  buildPolicyConnections,
  buildTeachingHooks,
  type DecisionRecord,
} from '@/game/diagnostics';
import {
  DEFAULT_CONFIG,
  ROLE_ASSIGNMENT_ORDER,
  TOTAL_ROUNDS,
  phaseForRound,
  type DecisionTag,
  type GameConfig,
  type GameStatus,
  type RealtimeEventType,
  type Role,
  type RoundPhase,
  type RoundStatus,
  type TeamState,
  type TeamTraits,
} from '@/types/game';
import { ApiError } from './http';
import { adminClient } from './supabase';
import { generateGameCode, generateToken, hashToken, normalizeGameCode } from './tokens';

/**
 * O servidor do jogo.
 *
 * Toda regra que decide dinheiro, indicador, rodada ou pontuação passa por
 * aqui, com a service_role key. O cliente só envia intenção ("escolhi a opção
 * B") e recebe resultado. Nada do que o navegador manda é usado como estado:
 * o estado vem sempre do banco, e o próximo estado é calculado pela engine.
 *
 * Camadas: route handler (HTTP) → game-service (orquestração + I/O) → engine
 * (regras puras). A engine não conhece este arquivo.
 */

// ---------------------------------------------------------------------------
// Linhas do banco
// ---------------------------------------------------------------------------

export interface GameRow {
  id: string;
  code: string;
  status: GameStatus;
  current_round: number;
  round_status: RoundStatus;
  round_started_at: string | null;
  round_ends_at: string | null;
  config: GameConfig;
  created_at: string;
  finished_at: string | null;
}

export interface TeamRow {
  id: string;
  game_id: string;
  slug: string;
  name: string;
  property_key: string;
  order_index: number;
  cash: number;
  production: number;
  technology: number;
  sustainability: number;
  traits: TeamTraits;
}

export interface PlayerRow {
  id: string;
  game_id: string;
  name: string;
  connected: boolean;
  state: 'thinking' | 'decided';
  last_seen: string;
}

export interface TeamMemberRow {
  id: string;
  game_id: string;
  team_id: string;
  player_id: string;
  role: Role;
}

export interface RoundRow {
  id: string;
  game_id: string;
  index: number;
  phase: RoundPhase;
  started_at: string;
  ends_at: string | null;
  resolved_at: string | null;
}

export interface EventRow {
  id: string;
  game_id: string;
  round_id: string;
  team_id: string;
  event_key: string;
  options: StoredOption[];
}

export interface StoredOption {
  key: string;
  label: string;
  detail: string;
  displayCost: number;
  available: boolean;
  reason: string | null;
}

export interface DecisionRow {
  id: string;
  game_id: string;
  round_id: string;
  team_id: string;
  event_id: string;
  option_key: string;
  option_label: string;
  tags: DecisionTag[];
  submitted_by: string | null;
  effects: { indicator: string; delta: number }[];
  notes: string[];
  risk_hit: boolean | null;
  state_before: TeamState;
  state_after: TeamState;
  created_at: string;
}

// ---------------------------------------------------------------------------
// Utilidades internas
// ---------------------------------------------------------------------------

function db(): SupabaseClient {
  return adminClient();
}

/** Erro de banco vira ApiError com contexto, nunca stack crua para o cliente. */
function unwrap<T>(result: { data: T | null; error: { message: string } | null }, context: string): T {
  if (result.error) {
    throw new ApiError('server_error', `Falha ao ${context}.`, result.error.message);
  }
  if (result.data === null) {
    throw new ApiError('not_found', `Não encontrado ao ${context}.`);
  }
  return result.data;
}

// ---------------------------------------------------------------------------
// Classificação de erro inesperado (criação de partida)
//
// `@supabase/supabase-js` nesta versão já converte falha de rede em `{ data:
// null, error }` em vez de rejeitar a promise (ver PostgrestBuilder: o catch
// só relança se `.throwOnError()` for chamado, o que este projeto nunca faz).
// Então a exceção crua que chega até aqui na criação da partida vem de outro
// lugar: `adminClient()`/`createClient()` lançando `Error` síncrono quando a
// variável de ambiente está ausente/mal formada, ou `initialTeamState`
// lançando para uma chave de propriedade desconhecida. Ainda assim, a escrita
// (INSERT) não tem retry embutido na biblioteca (só leitura idempotente tem),
// então uma falha de rede transitória numa escrita chega como resultado com
// `error` preenchido, não como exceção. As duas rotas (exceção e resultado com
// erro) precisam de tratamento explícito para nunca sobrar no fallback
// genérico de `toResponse`.
// ---------------------------------------------------------------------------

const NETWORK_ERROR_PATTERN =
  /fetch failed|ECONNREFUSED|ECONNRESET|ENOTFOUND|ETIMEDOUT|EAI_AGAIN|network|socket hang up/i;

const CONFIG_ERROR_PATTERN =
  /vari.vel de ambiente ausente|Invalid supabaseUrl|supabaseKey is required|supabaseUrl is required/i;

function errorMessageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function isNetworkError(error: unknown): boolean {
  if (error instanceof TypeError) return true;
  return NETWORK_ERROR_PATTERN.test(errorMessageOf(error));
}

function isConfigError(error: unknown): boolean {
  return CONFIG_ERROR_PATTERN.test(errorMessageOf(error));
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Converte qualquer exceção não prevista da criação de partida numa ApiError
 * com causa distinguível. O professor vendo o erro precisa saber se é rede
 * (tenta de novo), configuração do servidor (avisa a coordenação técnica) ou
 * outra coisa: a ação de recuperação é diferente em cada caso. O erro real
 * completo (tipo, causa, etapa) sempre vai para o log do servidor.
 */
function classifyGameCreationError(error: unknown, step: string): ApiError {
  if (error instanceof ApiError) return error;

  const detail = errorMessageOf(error);
  console.error(`[safra-df] erro inesperado ao criar partida (etapa: ${step}):`, {
    type: error instanceof Error ? error.constructor.name : typeof error,
    message: detail,
    stack: error instanceof Error ? error.stack : undefined,
  });

  if (isConfigError(error)) {
    return new ApiError(
      'server_error',
      'O servidor não está configurado corretamente para acessar o banco de dados. Avise a coordenação técnica antes de tentar de novo.',
      detail,
    );
  }

  if (isNetworkError(error)) {
    return new ApiError(
      'server_error',
      'Não foi possível falar com o banco de dados agora. Verifique a conexão de rede e tente criar a partida de novo.',
      detail,
    );
  }

  return new ApiError(
    'server_error',
    'Não foi possível criar a partida por um erro inesperado no servidor.',
    detail,
  );
}

/**
 * Repete uma escrita (INSERT) algumas vezes só quando a falha detectada é de
 * rede transitória: erro de negócio (violação de constraint, RLS, etc.) falha
 * na primeira tentativa, sem esperar.
 *
 * A biblioteca do Supabase já reexecuta requisições GET/HEAD sozinha; POST não
 * é idempotente por natureza, então essa camada de retry é responsabilidade
 * de quem chama, e só faz sentido para a etapa de escrita da criação da
 * partida, que não pode falhar a aula por uma oscilação de rede de um segundo.
 */
async function withNetworkRetry<T>(
  step: string,
  attempt: () => PromiseLike<{ data: T | null; error: { message: string } | null }>,
): Promise<{ data: T | null; error: { message: string } | null }> {
  const backoffMs = [150, 400];

  let result = await attempt();
  for (let index = 0; index < backoffMs.length && result.error && isNetworkError(new Error(result.error.message)); index += 1) {
    console.error(`[safra-df] falha de rede transitória em "${step}", tentando de novo:`, result.error.message);
    await sleep(backoffMs[index]);
    result = await attempt();
  }
  return result;
}

function teamStateOf(team: TeamRow): TeamState {
  return {
    cash: Number(team.cash),
    production: team.production,
    technology: team.technology,
    sustainability: team.sustainability,
    traits: team.traits,
  };
}

function teamUpdateFrom(state: TeamState) {
  return {
    cash: state.cash,
    production: state.production,
    technology: state.technology,
    sustainability: state.sustainability,
    traits: state.traits,
  };
}

/**
 * Publica um evento no barramento realtime.
 *
 * É o único mecanismo de push do sistema: o cliente assina `game_events` e
 * reage ao tipo. Nunca se transmite o estado inteiro da partida por aqui, só o
 * fato de que algo aconteceu e o mínimo para a interface reagir.
 */
async function emit(
  gameId: string,
  type: RealtimeEventType,
  payload: Record<string, unknown> = {},
): Promise<void> {
  const { error } = await db().from('game_events').insert({ game_id: gameId, type, payload });
  if (error) {
    // Um evento perdido não pode derrubar a jogada: a interface tem fallback de
    // releitura. Registra e segue.
    console.error(`[safra-df] falha ao emitir ${type}:`, error.message);
  }
}

// ---------------------------------------------------------------------------
// Criação da partida
// ---------------------------------------------------------------------------

export interface CreateGameResult {
  game: GameRow;
  hostToken: string;
  teams: TeamRow[];
}

/**
 * Cria a partida, as equipes e o token do professor.
 *
 * As equipes já nascem com estado próprio (uma propriedade real, indicadores
 * ajustados, orçamento igual), porque grupo sem estado próprio é divisão
 * visual, não jogo.
 */
export async function createGame(
  overrides: Partial<GameConfig> = {},
): Promise<CreateGameResult> {
  // Todo o caminho de criação passa por um único try/catch: qualquer exceção
  // não prevista (env ausente, cliente mal configurado, chave de propriedade
  // desconhecida, ou algo ainda não catalogado) é classificada aqui em vez de
  // vazar para o fallback genérico de `toResponse`. O professor precisa saber
  // se é rede, configuração do servidor ou outra coisa.
  try {
    const config: GameConfig = {
      ...DEFAULT_CONFIG,
      ...overrides,
      weights: { ...DEFAULT_CONFIG.weights, ...(overrides.weights ?? {}) },
    };

    const teamCount = Math.max(1, Math.min(config.teamCount, PROPERTIES.length));
    config.teamCount = teamCount;

    // Colisão de código é improvável, mas a partida não pode falhar por isso.
    // Esse laço também absorve uma falha de rede transitória isolada: se uma
    // tentativa falha por rede, a próxima tentativa (com um novo código) tem
    // outra chance, sem esperar o backoff de `withNetworkRetry`.
    let game: GameRow | null = null;
    let lastError: string | null = null;

    for (let attempt = 0; attempt < 5 && !game; attempt += 1) {
      const { data, error } = await db()
        .from('games')
        .insert({ code: generateGameCode(), config })
        .select('*')
        .single();

      if (data) game = data as GameRow;
      else lastError = error?.message ?? null;
    }

    if (!game) {
      // Deixa a classificação para o catch externo: se as 5 tentativas
      // falharam por rede, o professor recebe a mensagem de rede, não a
      // genérica de colisão de código.
      throw new Error(lastError ?? 'Não foi possível criar a partida após 5 tentativas.');
    }

    const hostToken = generateToken();
    const secretResult = await withNetworkRetry('registrar o token do professor', () =>
      db().from('game_secrets').insert({ game_id: game!.id, host_token_hash: hashToken(hostToken) }),
    );

    // Se as tentativas de `withNetworkRetry` se esgotarem porque a rede
    // continua caindo, o erro final ainda é de rede: reclassifica em vez de
    // usar a mensagem genérica de negócio ("falha ao registrar/criar"), que
    // não diz ao professor que o caminho de recuperação é tentar de novo.
    if (secretResult.error) {
      if (isNetworkError(new Error(secretResult.error.message))) {
        throw classifyGameCreationError(new Error(secretResult.error.message), 'registrar o token do professor');
      }
      throw new ApiError(
        'server_error',
        'Falha ao registrar o acesso do professor.',
        secretResult.error.message,
      );
    }

    const teamRows = PROPERTIES.slice(0, teamCount).map((property, index) => {
      const state = initialTeamState(property.key, config);
      return {
        game_id: game!.id,
        slug: property.key,
        name: property.name,
        property_key: property.key,
        order_index: index,
        ...teamUpdateFrom(state),
      };
    });

    const teamsResult = await withNetworkRetry('criar as equipes', () =>
      db().from('teams').insert(teamRows).select('*'),
    );

    if (teamsResult.error && isNetworkError(new Error(teamsResult.error.message))) {
      throw classifyGameCreationError(new Error(teamsResult.error.message), 'criar as equipes');
    }
    const teams = unwrap(teamsResult, 'criar as equipes') as TeamRow[];

    return { game, hostToken, teams };
  } catch (error) {
    throw classifyGameCreationError(error, 'criar-partida');
  }
}

// ---------------------------------------------------------------------------
// Entrada de jogador
// ---------------------------------------------------------------------------

export interface JoinResult {
  playerToken: string;
  player: PlayerRow;
  team: TeamRow;
  role: Role;
  game: GameRow;
}

async function gameByCode(code: string): Promise<GameRow> {
  const normalized = normalizeGameCode(code);
  if (normalized.length < 4) {
    throw new ApiError('bad_request', 'Código da partida incompleto.');
  }

  const { data, error } = await db()
    .from('games')
    .select('*')
    .eq('code', normalized)
    .maybeSingle();

  if (error) {
    throw new ApiError('server_error', 'Falha ao localizar a partida.', error.message);
  }
  if (!data) {
    throw new ApiError('not_found', 'Nenhuma partida com esse código. Confira na tela do professor.');
  }

  return data as GameRow;
}

export async function getGameByCode(code: string): Promise<GameRow> {
  return gameByCode(code);
}

// ---------------------------------------------------------------------------
// Lobby: propriedade e papel visíveis antes de entrar
// ---------------------------------------------------------------------------

export interface LobbyRole {
  role: Role;
  taken: boolean;
  /** Só o nome, nunca token nem qualquer dado de sessão: já é público via `team_members`/`players`. */
  playerName: string | null;
}

export interface LobbyTeam {
  id: string;
  name: string;
  propertyKey: string;
  slotsUsed: number;
  slotsMax: number;
  roles: LobbyRole[];
}

export interface LobbyView {
  gameId: string;
  gameCode: string;
  gameStatus: GameStatus;
  teams: LobbyTeam[];
}

/**
 * Leitura pública de pré-entrada: as 6 equipes, com quem já ocupa qual papel.
 *
 * Sem token porque o jogador ainda não tem um: é exatamente o que permite
 * escolher propriedade e papel ANTES de digitar o nome e confirmar. Nenhum
 * dado sensível sai daqui, só o que `team_members`/`players` já expõem via
 * SELECT público (nome e papel), a mesma leitura que a projeção usa.
 */
export async function getGameLobby(code: string): Promise<LobbyView> {
  const game = await gameByCode(code);

  if (game.status === 'finished') {
    throw new ApiError('conflict', 'Esta partida já terminou.');
  }

  const teams = await teamsOf(game.id);

  const rows = unwrap(
    await db()
      .from('team_members')
      .select('team_id, role, players(name)')
      .eq('game_id', game.id),
    'carregar os integrantes',
  ) as { team_id: string; role: Role; players: { name: string } | { name: string }[] | null }[];

  function embeddedName(row: (typeof rows)[number]): string | null {
    const value = Array.isArray(row.players) ? (row.players[0] ?? null) : row.players;
    return value?.name ?? null;
  }

  const membersByTeam = new Map<string, { role: Role; name: string | null }[]>();
  for (const row of rows) {
    const list = membersByTeam.get(row.team_id) ?? [];
    list.push({ role: row.role, name: embeddedName(row) });
    membersByTeam.set(row.team_id, list);
  }

  const lobbyTeams: LobbyTeam[] = teams.map((team) => {
    const taken = membersByTeam.get(team.id) ?? [];
    const roles: LobbyRole[] = ROLE_ASSIGNMENT_ORDER.map((role) => {
      const match = taken.find((entry) => entry.role === role);
      return { role, taken: Boolean(match), playerName: match?.name ?? null };
    });

    return {
      id: team.id,
      name: team.name,
      propertyKey: team.property_key,
      slotsUsed: taken.length,
      slotsMax: game.config.maxPlayersPerTeam,
      roles,
    };
  });

  return {
    gameId: game.id,
    gameCode: game.code,
    gameStatus: game.status,
    teams: lobbyTeams,
  };
}

/**
 * Distribui o jogador na equipe com menos gente.
 *
 * Balanceia por tamanho e, no empate, respeita a ordem das propriedades. O
 * papel é o próximo livre na ordem de prioridade: em equipe pequena, as funções
 * essenciais são cobertas primeiro, e a partir da sexta pessoa os papéis
 * repetem em vez de deixar alguém sem função.
 */
function chooseTeamAndRole(
  teams: TeamRow[],
  members: TeamMemberRow[],
  maxPerTeam: number,
): { team: TeamRow; role: Role } {
  const countByTeam = new Map<string, number>(teams.map((team) => [team.id, 0]));
  const rolesByTeam = new Map<string, Role[]>(teams.map((team) => [team.id, []]));

  for (const member of members) {
    countByTeam.set(member.team_id, (countByTeam.get(member.team_id) ?? 0) + 1);
    rolesByTeam.get(member.team_id)?.push(member.role);
  }

  const ordered = teams
    .slice()
    .sort((a, b) => {
      const diff = (countByTeam.get(a.id) ?? 0) - (countByTeam.get(b.id) ?? 0);
      return diff !== 0 ? diff : a.order_index - b.order_index;
    });

  const team = ordered[0];
  if (!team) {
    throw new ApiError('server_error', 'A partida não tem equipes configuradas.');
  }

  if ((countByTeam.get(team.id) ?? 0) >= maxPerTeam) {
    throw new ApiError('game_full', 'Todas as equipes estão completas nesta partida.');
  }

  const taken = rolesByTeam.get(team.id) ?? [];
  const free = ROLE_ASSIGNMENT_ORDER.find((role) => !taken.includes(role));
  const role = free ?? ROLE_ASSIGNMENT_ORDER[taken.length % ROLE_ASSIGNMENT_ORDER.length];

  return { team, role };
}

/** O que o jogador pediu explicitamente ao entrar, em vez do auto-alocado. */
export interface JoinChoice {
  teamId?: string;
  role?: Role;
}

/**
 * Resolve equipe e papel quando o jogador ESCOLHE, em vez de receber o
 * alocado automaticamente.
 *
 * Mesma regra de vaga e de "um papel por equipe" do auto-assign, só que
 * aplicada à escolha explícita: equipe cheia ou papel já ocupado naquela
 * equipe viram `ApiError('conflict', ...)`, nunca uma alocação silenciosa
 * para outro lugar. É o que permite a tela de entrada mostrar a lista
 * atualizada e deixar o jogador tentar de novo em vez de travar.
 */
export function chooseTeamAndRoleExplicit(
  teams: TeamRow[],
  members: TeamMemberRow[],
  maxPerTeam: number,
  choice: JoinChoice,
): { team: TeamRow; role: Role } {
  const rolesByTeam = new Map<string, Role[]>(teams.map((team) => [team.id, []]));
  const countByTeam = new Map<string, number>(teams.map((team) => [team.id, 0]));
  for (const member of members) {
    countByTeam.set(member.team_id, (countByTeam.get(member.team_id) ?? 0) + 1);
    rolesByTeam.get(member.team_id)?.push(member.role);
  }

  if (choice.teamId) {
    const team = teams.find((entry) => entry.id === choice.teamId);
    if (!team) {
      throw new ApiError('bad_request', 'Esta equipe não existe nesta partida.');
    }

    const count = countByTeam.get(team.id) ?? 0;
    if (count >= maxPerTeam) {
      throw new ApiError('conflict', 'Esta equipe já está completa. Escolha outra.');
    }

    const taken = rolesByTeam.get(team.id) ?? [];

    if (choice.role) {
      if (taken.includes(choice.role)) {
        throw new ApiError('conflict', 'Este papel já foi escolhido nesta equipe. Escolha outro.');
      }
      return { team, role: choice.role };
    }

    const free = ROLE_ASSIGNMENT_ORDER.find((role) => !taken.includes(role));
    const role = free ?? ROLE_ASSIGNMENT_ORDER[taken.length % ROLE_ASSIGNMENT_ORDER.length];
    return { team, role };
  }

  // Só o papel foi escolhido, sem equipe: procura, entre as equipes com vaga
  // e com esse papel livre, a que tem menos gente (mesmo critério de
  // balanceamento do auto-assign), para não empilhar todo mundo na primeira.
  const candidates = teams
    .filter((team) => (countByTeam.get(team.id) ?? 0) < maxPerTeam)
    .filter((team) => !(rolesByTeam.get(team.id) ?? []).includes(choice.role!))
    .sort((a, b) => {
      const diff = (countByTeam.get(a.id) ?? 0) - (countByTeam.get(b.id) ?? 0);
      return diff !== 0 ? diff : a.order_index - b.order_index;
    });

  const team = candidates[0];
  if (!team) {
    throw new ApiError('conflict', 'Nenhuma equipe com vaga tem este papel livre agora.');
  }

  return { team, role: choice.role! };
}

/**
 * Entra na partida: nome, equipe, função e token. Sem cadastro, sem senha.
 *
 * Entrada é permitida no lobby e também com a partida em andamento: aluno que
 * chega atrasado ou perde a conexão entra na equipe mais vazia em vez de ficar
 * de fora da aula. Quando `choice` traz `teamId`/`role`, o jogador escolheu de
 * propósito na tela de entrada; sem `choice`, cai no auto-assign de sempre
 * (mesmo comportamento de quem usa a API direto ou de qualquer teste que já
 * exista).
 */
export async function joinGame(
  code: string,
  rawName: string,
  choice?: JoinChoice,
): Promise<JoinResult> {
  const game = await gameByCode(code);

  if (game.status === 'finished') {
    throw new ApiError('conflict', 'Esta partida já terminou.');
  }

  const name = rawName.trim().slice(0, 40);
  if (name.length === 0) {
    throw new ApiError('bad_request', 'Escreva seu nome para entrar.');
  }

  const teams = unwrap(
    await db().from('teams').select('*').eq('game_id', game.id).order('order_index'),
    'carregar as equipes',
  ) as TeamRow[];

  const members = unwrap(
    await db().from('team_members').select('*').eq('game_id', game.id),
    'carregar os integrantes',
  ) as TeamMemberRow[];

  const { team, role } =
    choice && (choice.teamId || choice.role)
      ? chooseTeamAndRoleExplicit(teams, members, game.config.maxPlayersPerTeam, choice)
      : chooseTeamAndRole(teams, members, game.config.maxPlayersPerTeam);

  const player = unwrap(
    await db()
      .from('players')
      .insert({ game_id: game.id, name })
      .select('*')
      .single(),
    'registrar o jogador',
  ) as PlayerRow;

  const playerToken = generateToken();

  const secret = await db()
    .from('player_secrets')
    .insert({ player_id: player.id, token_hash: hashToken(playerToken) });

  if (secret.error) {
    throw new ApiError('server_error', 'Falha ao criar a sessão do jogador.', secret.error.message);
  }

  const membership = await db().from('team_members').insert({
    game_id: game.id,
    team_id: team.id,
    player_id: player.id,
    role,
  });

  if (membership.error) {
    throw new ApiError('server_error', 'Falha ao alocar o jogador na equipe.', membership.error.message);
  }

  await emit(game.id, 'PLAYER_JOINED', {
    playerId: player.id,
    playerName: player.name,
    teamId: team.id,
    teamName: team.name,
    role,
  });

  return { playerToken, player, team, role, game };
}

// ---------------------------------------------------------------------------
// Autenticação
// ---------------------------------------------------------------------------

export interface PlayerSession {
  player: PlayerRow;
  member: TeamMemberRow;
  team: TeamRow;
  game: GameRow;
}

/** Resolve o token do jogador para a sessão completa, ou 401. */
export async function authenticatePlayer(token: string): Promise<PlayerSession> {
  const { data: secret, error } = await db()
    .from('player_secrets')
    .select('player_id')
    .eq('token_hash', hashToken(token))
    .maybeSingle();

  if (error) {
    throw new ApiError('server_error', 'Falha ao validar a sessão.', error.message);
  }
  if (!secret) {
    throw new ApiError('unauthorized', 'Sessão expirada. Entre na partida de novo.');
  }

  // `member` só depende de secret.player_id (não do resultado de `player`), e
  // `player` só depende de secret.player_id também: as duas consultas rodam em
  // paralelo em vez de em série, o que corta um hop de rede por chamada. O
  // mesmo vale para `team` (depende só de `member`) e `game` (depende só de
  // `player`) no segundo par. Isso importa de verdade aqui: o Supabase deste
  // projeto fica em us-west-2 e só é alcançável por um pooler IPv4, então cada
  // round-trip evitado é ~250-400ms medidos a menos por chamada de
  // /api/player/view, e essa função é chamada em toda leitura de tela do aluno.
  const [playerResult, memberResult] = await Promise.all([
    db().from('players').select('*').eq('id', secret.player_id).single(),
    db().from('team_members').select('*').eq('player_id', secret.player_id).single(),
  ]);

  const player = unwrap(playerResult, 'carregar o jogador') as PlayerRow;
  const member = unwrap(memberResult, 'carregar a equipe do jogador') as TeamMemberRow;

  const [teamResult, gameResult] = await Promise.all([
    db().from('teams').select('*').eq('id', member.team_id).single(),
    db().from('games').select('*').eq('id', player.game_id).single(),
  ]);

  const team = unwrap(teamResult, 'carregar a equipe') as TeamRow;
  const game = unwrap(gameResult, 'carregar a partida') as GameRow;

  return { player, member, team, game };
}

/** Confere o token do professor para uma partida específica. */
export async function authenticateHost(gameId: string, token: string): Promise<GameRow> {
  const { data, error } = await db()
    .from('game_secrets')
    .select('host_token_hash')
    .eq('game_id', gameId)
    .maybeSingle();

  if (error) {
    throw new ApiError('server_error', 'Falha ao validar o acesso do professor.', error.message);
  }
  if (!data || data.host_token_hash !== hashToken(token)) {
    throw new ApiError('forbidden', 'Este acesso de professor não vale para esta partida.');
  }

  return unwrap(
    await db().from('games').select('*').eq('id', gameId).single(),
    'carregar a partida',
  ) as GameRow;
}

// ---------------------------------------------------------------------------
// Controle de rodada
// ---------------------------------------------------------------------------

async function teamsOf(gameId: string): Promise<TeamRow[]> {
  return unwrap(
    await db().from('teams').select('*').eq('game_id', gameId).order('order_index'),
    'carregar as equipes',
  ) as TeamRow[];
}

async function roundOf(gameId: string, index: number): Promise<RoundRow | null> {
  const { data, error } = await db()
    .from('rounds')
    .select('*')
    .eq('game_id', gameId)
    .eq('index', index)
    .maybeSingle();

  if (error) {
    throw new ApiError('server_error', 'Falha ao carregar a rodada.', error.message);
  }
  return (data as RoundRow) ?? null;
}

/**
 * Abre a próxima rodada: sorteia a carta de cada equipe e libera o cronômetro.
 *
 * Cada equipe recebe uma carta sorteada de forma determinística, com as opções
 * já filtradas pelo estado dela naquele instante: quem está sem caixa vê a
 * opção caríssima marcada como indisponível, com o motivo, em vez de descobrir
 * o bloqueio ao confirmar.
 *
 * As dicas por função vão para tabela separada, sem acesso público: cada
 * jogador busca só a própria pela API.
 */
export async function startRound(gameId: string, hostToken: string): Promise<{
  game: GameRow;
  round: RoundRow;
}> {
  const game = await authenticateHost(gameId, hostToken);

  if (game.status === 'finished') {
    throw new ApiError('conflict', 'A partida já terminou.');
  }
  if (game.round_status === 'active') {
    throw new ApiError('conflict', 'A rodada atual ainda está aberta.');
  }
  if (game.current_round >= TOTAL_ROUNDS) {
    throw new ApiError('conflict', 'Todas as rodadas já foram jogadas. Encerre a partida.');
  }

  const index = game.current_round + 1;
  const phase = phaseForRound(index);
  const endsAt = new Date(Date.now() + game.config.roundSeconds * 1000).toISOString();

  const existing = await roundOf(gameId, index);
  const round = existing
    ? ((unwrap(
        await db()
          .from('rounds')
          .update({ started_at: new Date().toISOString(), ends_at: endsAt, resolved_at: null })
          .eq('id', existing.id)
          .select('*')
          .single(),
        'reabrir a rodada',
      ) as RoundRow))
    : ((unwrap(
        await db()
          .from('rounds')
          .insert({ game_id: gameId, index, phase, ends_at: endsAt })
          .select('*')
          .single(),
        'abrir a rodada',
      ) as RoundRow));

  const teams = await teamsOf(gameId);

  for (const team of teams) {
    const card = drawEventCard(phase, gameId, index, team.id, team.order_index);
    const availability = optionAvailability(card, teamStateOf(team));

    const options: StoredOption[] = availability.map((entry) => ({
      key: entry.option.key,
      label: entry.option.label,
      detail: entry.option.detail,
      displayCost: entry.option.displayCost,
      available: entry.available,
      reason: entry.reason,
    }));

    const event = unwrap(
      await db()
        .from('events')
        .upsert(
          {
            game_id: gameId,
            round_id: round.id,
            team_id: team.id,
            event_key: card.key,
            options,
          },
          { onConflict: 'round_id,team_id' },
        )
        .select('*')
        .single(),
      'sortear o evento da equipe',
    ) as EventRow;

    const hints = Object.entries(card.roleHints).map(([role, hint]) => ({
      event_id: event.id,
      role,
      hint,
    }));

    if (hints.length > 0) {
      const hintResult = await db()
        .from('event_role_hints')
        .upsert(hints, { onConflict: 'event_id,role' });

      if (hintResult.error) {
        throw new ApiError(
          'server_error',
          'Falha ao distribuir as informações por função.',
          hintResult.error.message,
        );
      }
    }
  }

  const updated = unwrap(
    await db()
      .from('games')
      .update({
        status: 'running',
        current_round: index,
        round_status: 'active',
        round_started_at: new Date().toISOString(),
        round_ends_at: endsAt,
      })
      .eq('id', gameId)
      .select('*')
      .single(),
    'iniciar a rodada',
  ) as GameRow;

  const reset = await db()
    .from('players')
    .update({ state: 'thinking' })
    .eq('game_id', gameId);

  if (reset.error) {
    console.error('[safra-df] falha ao resetar estado dos jogadores:', reset.error.message);
  }

  await emit(gameId, 'ROUND_STARTED', {
    roundIndex: index,
    phase,
    endsAt,
    roundSeconds: game.config.roundSeconds,
  });

  return { game: updated, round };
}

// ---------------------------------------------------------------------------
// Decisão
// ---------------------------------------------------------------------------

export interface SubmitDecisionResult {
  optionLabel: string;
  locked: true;
}

/**
 * Registra a decisão da equipe.
 *
 * Qualquer integrante confirma pela equipe, e a confirmação é definitiva:
 * a restrição `unique (round_id, team_id)` garante no banco o que o briefing
 * pede como regra de jogo. Segunda tentativa recebe 409, não sobrescreve.
 *
 * A consequência NÃO é aplicada aqui. A decisão é gravada com o estado de
 * "antes" e o resultado calculado, mas o estado da equipe só muda quando o
 * professor resolve a rodada: assim todas as equipes viram a consequência no
 * mesmo momento, e ninguém joga a rodada seguinte na frente das outras.
 */
export async function submitDecision(
  playerToken: string,
  optionKey: string,
): Promise<SubmitDecisionResult> {
  const session = await authenticatePlayer(playerToken);
  const { game, team, player } = session;

  if (game.status !== 'running') {
    throw new ApiError('conflict', 'A partida não está em andamento.');
  }
  if (game.round_status !== 'active') {
    throw new ApiError('conflict', 'A rodada está fechada. Aguarde a próxima.');
  }

  const round = await roundOf(game.id, game.current_round);
  if (!round) {
    throw new ApiError('conflict', 'A rodada atual não foi aberta.');
  }

  const event = unwrap(
    await db()
      .from('events')
      .select('*')
      .eq('round_id', round.id)
      .eq('team_id', team.id)
      .single(),
    'carregar o evento da equipe',
  ) as EventRow;

  const card = EVENT_BY_KEY[event.event_key];
  if (!card) {
    throw new ApiError('server_error', `Carta de evento desconhecida: ${event.event_key}.`);
  }

  const state = teamStateOf(team);
  // Recalcula a resolução no servidor a partir do estado gravado no banco:
  // nada que veio do navegador entra nessa conta além da opção escolhida.
  const resolution = resolveDecision({
    state,
    event: card,
    optionKey,
    seed: [game.id, round.index, team.id],
  });

  const option = card.options.find((entry) => entry.key === optionKey)!;

  const insert = await db().from('decisions').insert({
    game_id: game.id,
    round_id: round.id,
    team_id: team.id,
    event_id: event.id,
    option_key: option.key,
    option_label: option.label,
    tags: option.tags,
    submitted_by: player.id,
    effects: resolution.effects,
    notes: resolution.notes,
    risk_hit: resolution.riskHit,
    state_before: state,
    state_after: resolution.next,
  });

  if (insert.error) {
    // 23505 = unique_violation: a equipe já confirmou nesta rodada.
    if (insert.error.code === '23505') {
      throw new ApiError('conflict', 'Esta equipe já confirmou a decisão desta rodada.');
    }
    throw new ApiError('server_error', 'Falha ao registrar a decisão.', insert.error.message);
  }

  const members = unwrap(
    await db().from('team_members').select('player_id').eq('team_id', team.id),
    'carregar os integrantes da equipe',
  ) as { player_id: string }[];

  const markDecided = await db()
    .from('players')
    .update({ state: 'decided' })
    .in(
      'id',
      members.map((member) => member.player_id),
    );

  if (markDecided.error) {
    console.error('[safra-df] falha ao marcar equipe como decidida:', markDecided.error.message);
  }

  await emit(game.id, 'DECISION_LOCKED', {
    teamId: team.id,
    teamName: team.name,
    roundIndex: round.index,
    optionLabel: option.label,
    playerName: player.name,
  });

  return { optionLabel: option.label, locked: true };
}

// ---------------------------------------------------------------------------
// Resolução da rodada
// ---------------------------------------------------------------------------

export interface RoundOutcome {
  teamId: string;
  teamName: string;
  optionLabel: string | null;
  outcome: string;
  notes: string[];
  effects: { indicator: string; delta: number }[];
  state: TeamState;
}

/**
 * Fecha a rodada e aplica as consequências de todas as equipes de uma vez.
 *
 * Quem decidiu recebe o efeito da decisão mais o fechamento da fase (custeio,
 * receita de programa público, parcela de crédito, tecnologia parada que
 * destrava). Quem não decidiu recebe só o fechamento, com uma nota explícita:
 * não decidir também é uma decisão, e ela aparece no diagnóstico.
 */
export async function resolveRound(
  gameId: string,
  hostToken: string,
): Promise<{ game: GameRow; outcomes: RoundOutcome[] }> {
  const game = await authenticateHost(gameId, hostToken);

  if (game.current_round === 0) {
    throw new ApiError('conflict', 'Nenhuma rodada foi aberta ainda.');
  }

  const round = await roundOf(gameId, game.current_round);
  if (!round) {
    throw new ApiError('conflict', 'A rodada atual não existe.');
  }
  if (round.resolved_at) {
    throw new ApiError('conflict', 'Esta rodada já foi resolvida.');
  }

  const teams = await teamsOf(gameId);

  const decisions = unwrap(
    await db().from('decisions').select('*').eq('round_id', round.id),
    'carregar as decisões da rodada',
  ) as DecisionRow[];

  const decisionByTeam = new Map(decisions.map((decision) => [decision.team_id, decision]));
  const outcomes: RoundOutcome[] = [];

  for (const team of teams) {
    const decision = decisionByTeam.get(team.id);
    const notes: string[] = [];
    let stateAfterDecision: TeamState;
    let outcomeText: string;

    if (decision) {
      stateAfterDecision = decision.state_after;
      notes.push(...decision.notes);
      outcomeText = `A equipe escolheu: ${decision.option_label}.`;
    } else {
      stateAfterDecision = teamStateOf(team);
      outcomeText = 'A equipe não confirmou decisão nesta rodada.';
      notes.push('Sem decisão confirmada: a propriedade seguiu no automático, e o tempo cobrou o seu preço.');
    }

    const closing = calculateRoundResult(stateAfterDecision, round.phase);
    notes.push(...closing.notes);

    const update = await db()
      .from('teams')
      .update(teamUpdateFrom(closing.state))
      .eq('id', team.id);

    if (update.error) {
      throw new ApiError('server_error', 'Falha ao atualizar os indicadores da equipe.', update.error.message);
    }

    outcomes.push({
      teamId: team.id,
      teamName: team.name,
      optionLabel: decision?.option_label ?? null,
      outcome: outcomeText,
      notes,
      effects: decision?.effects ?? [],
      state: closing.state,
    });
  }

  const resolvedAt = new Date().toISOString();

  const roundUpdate = await db()
    .from('rounds')
    .update({ resolved_at: resolvedAt })
    .eq('id', round.id);

  if (roundUpdate.error) {
    throw new ApiError('server_error', 'Falha ao fechar a rodada.', roundUpdate.error.message);
  }

  const updated = unwrap(
    await db()
      .from('games')
      .update({ round_status: 'resolved' })
      .eq('id', gameId)
      .select('*')
      .single(),
    'marcar a rodada como resolvida',
  ) as GameRow;

  await emit(gameId, 'EVENT_RESOLVED', { roundIndex: round.index, phase: round.phase });
  await emit(gameId, 'ROUND_ENDED', {
    roundIndex: round.index,
    isLastRound: round.index >= TOTAL_ROUNDS,
  });

  return { game: updated, outcomes };
}

// ---------------------------------------------------------------------------
// Estado da partida
// ---------------------------------------------------------------------------

export async function pauseGame(gameId: string, hostToken: string): Promise<GameRow> {
  await authenticateHost(gameId, hostToken);

  const game = unwrap(
    await db().from('games').update({ status: 'paused' }).eq('id', gameId).select('*').single(),
    'pausar a partida',
  ) as GameRow;

  await emit(gameId, 'GAME_PAUSED', {});
  return game;
}

/**
 * Retoma a partida e devolve o tempo que restava.
 *
 * O cronômetro é recalculado a partir do que faltava quando pausou: pausar para
 * explicar algo no meio da rodada não pode custar tempo de decisão à turma.
 */
export async function resumeGame(
  gameId: string,
  hostToken: string,
  remainingSeconds?: number,
): Promise<GameRow> {
  const current = await authenticateHost(gameId, hostToken);

  const seconds = Math.max(
    10,
    Math.min(remainingSeconds ?? current.config.roundSeconds, current.config.roundSeconds),
  );
  const endsAt = new Date(Date.now() + seconds * 1000).toISOString();

  const game = unwrap(
    await db()
      .from('games')
      .update({ status: 'running', round_ends_at: endsAt })
      .eq('id', gameId)
      .select('*')
      .single(),
    'retomar a partida',
  ) as GameRow;

  await emit(gameId, 'GAME_RESUMED', { endsAt });
  return game;
}

/**
 * Encerra a partida e calcula o resultado final.
 *
 * O ranking usa os pesos configurados, e os prêmios existem para que exista
 * mais de uma forma de se destacar: a equipe com menos dinheiro pode levar
 * sustentabilidade, equilíbrio ou recuperação.
 */
export async function finishGame(
  gameId: string,
  hostToken: string,
): Promise<{ game: GameRow }> {
  const game = await authenticateHost(gameId, hostToken);
  const teams = await teamsOf(gameId);

  const decisions = unwrap(
    await db().from('decisions').select('*').eq('game_id', gameId),
    'carregar as decisões da partida',
  ) as DecisionRow[];

  const tagsByTeam = new Map<string, DecisionTag[]>(teams.map((team) => [team.id, []]));
  for (const decision of decisions) {
    tagsByTeam.get(decision.team_id)?.push(...decision.tags);
  }

  const inputs: TeamScoreInput[] = teams.map((team) => ({
    teamId: team.id,
    state: teamStateOf(team),
    tags: tagsByTeam.get(team.id) ?? [],
  }));

  const ranked = rankTeams(inputs, game.config.weights);

  const scoreRows = ranked.map((score) => ({
    game_id: gameId,
    team_id: score.teamId,
    finances: score.finances,
    production: score.production,
    technology: score.technology,
    sustainability: score.sustainability,
    composite: score.composite,
    profile: score.profile,
    awards: score.awards,
    rank: score.rank,
  }));

  const upsert = await db()
    .from('scores')
    .upsert(scoreRows, { onConflict: 'game_id,team_id' });

  if (upsert.error) {
    throw new ApiError('server_error', 'Falha ao gravar o resultado final.', upsert.error.message);
  }

  const updated = unwrap(
    await db()
      .from('games')
      .update({
        status: 'finished',
        round_status: 'resolved',
        finished_at: new Date().toISOString(),
      })
      .eq('id', gameId)
      .select('*')
      .single(),
    'encerrar a partida',
  ) as GameRow;

  await emit(gameId, 'GAME_FINISHED', { teams: ranked.length });
  return { game: updated };
}

/**
 * Reinicia a partida mantendo os jogadores e as equipes.
 *
 * Serve para a segunda turma do dia ou para uma rodada de demonstração: apaga
 * rodadas, eventos, decisões e resultado, e devolve os indicadores ao estado
 * inicial de cada propriedade. Os alunos continuam conectados, com o mesmo
 * token e a mesma função.
 */
export async function resetGame(gameId: string, hostToken: string): Promise<GameRow> {
  const game = await authenticateHost(gameId, hostToken);

  for (const table of ['scores', 'decisions', 'events', 'rounds'] as const) {
    const { error } = await db().from(table).delete().eq('game_id', gameId);
    if (error) {
      throw new ApiError('server_error', `Falha ao limpar ${table}.`, error.message);
    }
  }

  const teams = await teamsOf(gameId);
  for (const team of teams) {
    const property = PROPERTY_BY_KEY[team.property_key];
    if (!property) continue;

    const fresh = initialTeamState(property.key, game.config);
    const { error } = await db().from('teams').update(teamUpdateFrom(fresh)).eq('id', team.id);
    if (error) {
      throw new ApiError('server_error', 'Falha ao restaurar as equipes.', error.message);
    }
  }

  const reset = await db().from('players').update({ state: 'thinking' }).eq('game_id', gameId);
  if (reset.error) {
    console.error('[safra-df] falha ao resetar jogadores:', reset.error.message);
  }

  const updated = unwrap(
    await db()
      .from('games')
      .update({
        status: 'lobby',
        current_round: 0,
        round_status: 'idle',
        round_started_at: null,
        round_ends_at: null,
        finished_at: null,
      })
      .eq('id', gameId)
      .select('*')
      .single(),
    'reiniciar a partida',
  ) as GameRow;

  await emit(gameId, 'GAME_RESET', {});
  return updated;
}

// ---------------------------------------------------------------------------
// Visões
// ---------------------------------------------------------------------------

export interface TeammateView {
  playerId: string;
  name: string;
  role: Role;
  connected: boolean;
  state: 'thinking' | 'decided';
  isSelf: boolean;
}

export interface PlayerView {
  game: {
    id: string;
    code: string;
    status: GameStatus;
    currentRound: number;
    roundStatus: RoundStatus;
    roundEndsAt: string | null;
    totalRounds: number;
    config: GameConfig;
  };
  player: { id: string; name: string; role: Role };
  team: {
    id: string;
    name: string;
    propertyKey: string;
    state: TeamState;
  };
  teammates: TeammateView[];
  event: {
    id: string;
    key: string;
    title: string;
    narrative: string;
    phase: RoundPhase;
    options: StoredOption[];
    /** Apenas a dica da função deste jogador. */
    roleHint: string | null;
  } | null;
  decision: {
    optionKey: string;
    optionLabel: string;
    locked: true;
  } | null;
  /** Resultado da última rodada resolvida, para a tela de consequência. */
  lastResolution: {
    roundIndex: number;
    optionLabel: string | null;
    outcome: string;
    notes: string[];
    effects: { indicator: string; delta: number }[];
  } | null;
}

/**
 * Tudo o que a tela do jogador precisa, em uma chamada.
 *
 * Inclui a dica da PRÓPRIA função e nunca a dos colegas: a informação
 * complementar só circula pela conversa da equipe, que é o ponto da atividade.
 */
export async function getPlayerView(token: string): Promise<PlayerView> {
  const { player, member, team, game } = await authenticatePlayer(token);

  // Uma consulta com embedding de FK (`team_members.player_id -> players.id`)
  // no lugar de duas consultas em série (buscar os ids do time e só depois
  // buscar os jogadores desses ids): o PostgREST resolve o join num único
  // round-trip.
  const rosterRows = unwrap(
    await db()
      .from('team_members')
      .select('player_id, role, players(id, name, connected, state, last_seen)')
      .eq('team_id', team.id),
    'carregar os integrantes',
  ) as { player_id: string; role: Role; players: PlayerRow | PlayerRow[] | null }[];

  // O tipo sem generics do Supabase infere o embed de FK como array mesmo
  // sendo `team_members.player_id -> players.id` (um-para-um): normaliza os
  // dois formatos possíveis em runtime.
  function embeddedPlayer(row: (typeof rosterRows)[number]): PlayerRow | null {
    if (Array.isArray(row.players)) return row.players[0] ?? null;
    return row.players;
  }

  const teammates: TeammateView[] = rosterRows
    .map((row) => ({ role: row.role, player: embeddedPlayer(row) }))
    .filter((entry): entry is { role: Role; player: PlayerRow } => entry.player !== null)
    .map((entry) => ({
      playerId: entry.player.id,
      name: entry.player.name,
      role: entry.role,
      connected: entry.player.connected,
      state: entry.player.state,
      isSelf: entry.player.id === player.id,
    }))
    .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));

  let event: PlayerView['event'] = null;
  let decision: PlayerView['decision'] = null;
  let lastResolution: PlayerView['lastResolution'] = null;

  if (game.current_round > 0) {
    const round = await roundOf(game.id, game.current_round);

    if (round) {
      // O evento e a decisão da equipe não dependem um do outro (ambos só
      // precisam de round.id + team.id): buscar em paralelo evita um hop de
      // rede em série a cada carregamento de tela do aluno.
      const [{ data: eventRow }, { data: decisionRow }] = await Promise.all([
        db().from('events').select('*').eq('round_id', round.id).eq('team_id', team.id).maybeSingle(),
        db().from('decisions').select('*').eq('round_id', round.id).eq('team_id', team.id).maybeSingle(),
      ]);

      if (eventRow) {
        const row = eventRow as EventRow;
        const card = EVENT_BY_KEY[row.event_key];

        const { data: hint } = await db()
          .from('event_role_hints')
          .select('hint')
          .eq('event_id', row.id)
          .eq('role', member.role)
          .maybeSingle();

        event = {
          id: row.id,
          key: row.event_key,
          title: card?.title ?? 'Situação na propriedade',
          narrative: card?.narrative ?? '',
          phase: round.phase,
          options: row.options,
          roleHint: (hint as { hint: string } | null)?.hint ?? null,
        };
      }

      if (decisionRow) {
        const row2 = decisionRow as DecisionRow;
        decision = { optionKey: row2.option_key, optionLabel: row2.option_label, locked: true };

        if (round.resolved_at) {
          lastResolution = {
            roundIndex: round.index,
            optionLabel: row2.option_label,
            outcome: `A equipe escolheu: ${row2.option_label}.`,
            notes: row2.notes,
            effects: row2.effects,
          };
        }
      }
    }
  }

  return {
    game: {
      id: game.id,
      code: game.code,
      status: game.status,
      currentRound: game.current_round,
      roundStatus: game.round_status,
      roundEndsAt: game.round_ends_at,
      totalRounds: TOTAL_ROUNDS,
      config: game.config,
    },
    player: { id: player.id, name: player.name, role: member.role },
    team: {
      id: team.id,
      name: team.name,
      propertyKey: team.property_key,
      state: teamStateOf(team),
    },
    teammates,
    event,
    decision,
    lastResolution,
  };
}

export interface HostTeamView {
  id: string;
  name: string;
  propertyKey: string;
  orderIndex: number;
  state: TeamState;
  players: { id: string; name: string; role: Role; state: 'thinking' | 'decided'; connected: boolean }[];
  currentEvent: { key: string; title: string } | null;
  currentDecision: { optionKey: string; optionLabel: string } | null;
  history: { roundIndex: number; optionLabel: string; tags: DecisionTag[] }[];
}

export interface HostView {
  game: {
    id: string;
    code: string;
    status: GameStatus;
    currentRound: number;
    roundStatus: RoundStatus;
    roundEndsAt: string | null;
    totalRounds: number;
    config: GameConfig;
    phase: RoundPhase | null;
  };
  teams: HostTeamView[];
  playerCount: number;
  decidedTeams: number;
  diagnostics: ReturnType<typeof buildDiagnostics>;
  teachingHooks: string[];
  /** Ponte entre o que a turma fez e a política pública/assistência real correspondente. */
  policyConnections: ReturnType<typeof buildPolicyConnections>;
  scores: {
    teamId: string;
    teamName: string;
    finances: number;
    production: number;
    technology: number;
    sustainability: number;
    composite: number;
    profile: string;
    awards: string[];
    rank: number;
  }[];
}

/**
 * Visão do professor: a partida inteira, sem segredo de jogador.
 *
 * Serve tanto ao painel de controle quanto à projeção. Traz o diagnóstico já
 * agregado e os ganchos de debate prontos, porque é isso que o professor vai
 * usar assim que a partida terminar.
 */
export async function getHostView(gameId: string, hostToken: string): Promise<HostView> {
  const game = await authenticateHost(gameId, hostToken);
  return buildHostView(game);
}

/** Projeção pública: mesma visão, sem exigir token, para /host/[gameId]. */
export async function getProjectionView(gameId: string): Promise<HostView> {
  const game = unwrap(
    await db().from('games').select('*').eq('id', gameId).single(),
    'carregar a partida',
  ) as GameRow;

  return buildHostView(game);
}

async function buildHostView(game: GameRow): Promise<HostView> {
  const teams = await teamsOf(game.id);

  const members = unwrap(
    await db().from('team_members').select('*').eq('game_id', game.id),
    'carregar os integrantes',
  ) as TeamMemberRow[];

  const players = unwrap(
    await db().from('players').select('*').eq('game_id', game.id),
    'carregar os jogadores',
  ) as PlayerRow[];

  const decisions = unwrap(
    await db().from('decisions').select('*').eq('game_id', game.id),
    'carregar as decisões',
  ) as DecisionRow[];

  const rounds = unwrap(
    await db().from('rounds').select('*').eq('game_id', game.id).order('index'),
    'carregar as rodadas',
  ) as RoundRow[];

  const currentRound = rounds.find((round) => round.index === game.current_round) ?? null;

  const events = currentRound
    ? ((unwrap(
        await db().from('events').select('*').eq('round_id', currentRound.id),
        'carregar os eventos da rodada',
      ) as EventRow[]))
    : [];

  const scoreRows = unwrap(
    await db().from('scores').select('*').eq('game_id', game.id).order('rank'),
    'carregar o resultado',
  ) as {
    team_id: string;
    finances: number;
    production: number;
    technology: number;
    sustainability: number;
    composite: number;
    profile: string;
    awards: string[];
    rank: number;
  }[];

  const playerById = new Map(players.map((player) => [player.id, player]));
  const teamNameById = new Map(teams.map((team) => [team.id, team.name]));
  const eventByTeam = new Map(events.map((event) => [event.team_id, event]));

  const hostTeams: HostTeamView[] = teams.map((team) => {
    const teamMembers = members.filter((member) => member.team_id === team.id);
    const event = eventByTeam.get(team.id) ?? null;
    const card = event ? EVENT_BY_KEY[event.event_key] : null;

    const teamDecisions = decisions
      .filter((decision) => decision.team_id === team.id)
      .map((decision) => {
        const round = rounds.find((entry) => entry.id === decision.round_id);
        return {
          roundIndex: round?.index ?? 0,
          optionLabel: decision.option_label,
          tags: decision.tags,
        };
      })
      .sort((a, b) => a.roundIndex - b.roundIndex);

    const current = currentRound
      ? decisions.find(
          (decision) => decision.team_id === team.id && decision.round_id === currentRound.id,
        )
      : undefined;

    return {
      id: team.id,
      name: team.name,
      propertyKey: team.property_key,
      orderIndex: team.order_index,
      state: teamStateOf(team),
      players: teamMembers
        .map((member) => {
          const player = playerById.get(member.player_id);
          return {
            id: member.player_id,
            name: player?.name ?? 'jogador',
            role: member.role,
            state: player?.state ?? ('thinking' as const),
            connected: player?.connected ?? false,
          };
        })
        .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')),
      currentEvent: event && card ? { key: card.key, title: card.title } : null,
      currentDecision: current
        ? { optionKey: current.option_key, optionLabel: current.option_label }
        : null,
      history: teamDecisions,
    };
  });

  const records: DecisionRecord[] = decisions.map((decision) => {
    const round = rounds.find((entry) => entry.id === decision.round_id);
    return {
      teamId: decision.team_id,
      roundIndex: round?.index ?? 0,
      eventKey: decision.event_id,
      optionKey: decision.option_key,
      optionLabel: decision.option_label,
      tags: decision.tags,
    };
  });

  return {
    game: {
      id: game.id,
      code: game.code,
      status: game.status,
      currentRound: game.current_round,
      roundStatus: game.round_status,
      roundEndsAt: game.round_ends_at,
      totalRounds: TOTAL_ROUNDS,
      config: game.config,
      phase: currentRound?.phase ?? null,
    },
    teams: hostTeams,
    playerCount: players.length,
    decidedTeams: currentRound
      ? decisions.filter((decision) => decision.round_id === currentRound.id).length
      : 0,
    diagnostics: buildDiagnostics(records, teams.length),
    teachingHooks: buildTeachingHooks(records, teams.length),
    policyConnections: buildPolicyConnections(records, teams.length),
    scores: scoreRows.map((score) => ({
      teamId: score.team_id,
      teamName: teamNameById.get(score.team_id) ?? 'Equipe',
      finances: score.finances,
      production: score.production,
      technology: score.technology,
      sustainability: score.sustainability,
      composite: Number(score.composite),
      profile: score.profile,
      awards: score.awards,
      rank: score.rank,
    })),
  };
}

/** Marca presença do jogador: usado pelo heartbeat leve da tela do aluno. */
export async function touchPlayer(token: string): Promise<void> {
  const { player } = await authenticatePlayer(token);

  const { error } = await db()
    .from('players')
    .update({ connected: true, last_seen: new Date().toISOString() })
    .eq('id', player.id);

  if (error) {
    console.error('[safra-df] falha no heartbeat:', error.message);
  }
}
