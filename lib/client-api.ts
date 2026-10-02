'use client';

import type { HostView, PlayerView } from '@/lib/game-service';
import type { GameConfig } from '@/types/game';
import type {
  GameMode,
  OficinaAcaoRow,
  OficinaAlunoView,
  OficinaEventoOpcao,
  OficinaIndicadores,
  OficinaPistaRow,
  OficinaPublicView,
  OficinaSolucao,
  OficinaSolucaoRow,
} from '@/types/oficina';

/**
 * Cliente HTTP da interface.
 *
 * Um único lugar que fala com o servidor, com um formato de erro só. Toda
 * mutação passa por route handler: a interface nunca escreve no Supabase, nem
 * mesmo para entrar na partida.
 */

export class RequestError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'RequestError';
  }
}

async function request<T>(
  path: string,
  init: RequestInit & { token?: string } = {},
): Promise<T> {
  const { token, headers, ...rest } = init;

  const response = await fetch(path, {
    ...rest,
    headers: {
      ...(rest.body ? { 'content-type': 'application/json' } : {}),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
  });

  const text = await response.text();
  let payload: unknown = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const error = (payload as { error?: { code?: string; message?: string } } | null)?.error;
    throw new RequestError(
      error?.code ?? 'server_error',
      error?.message ?? 'Não foi possível concluir a ação.',
      response.status,
    );
  }

  return payload as T;
}

// ---------------------------------------------------------------------------
// Professor
// ---------------------------------------------------------------------------

export interface CreateGameResponse {
  gameId: string;
  code: string;
  hostToken: string;
  mode: GameMode;
  config: GameConfig;
  teams: { id: string; name: string; propertyKey: string }[];
}

export function createGame(config: Partial<GameConfig> = {}, mode: GameMode = 'diagnostico') {
  const body: Record<string, unknown> = { ...config };
  if (mode !== 'diagnostico') body.mode = mode;

  return request<CreateGameResponse>('/api/games', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function fetchHostView(gameId: string, token: string) {
  return request<HostView>(`/api/host/${gameId}`, { token, cache: 'no-store' });
}

/** Exclui a partida inteira (cascata). O token é o Bearer do professor. */
export function deleteGame(gameId: string, token: string) {
  return request<{ deleted: boolean }>(`/api/games/${gameId}`, {
    method: 'DELETE',
    token,
  });
}

export type HostAction =
  | 'start_round'
  | 'resolve_round'
  | 'pause'
  | 'resume'
  | 'finish'
  | 'reset';

export interface HostActionResponse {
  action: HostAction;
  outcomes:
    | {
        teamId: string;
        teamName: string;
        optionLabel: string | null;
        outcome: string;
        notes: string[];
        effects: { indicator: string; delta: number }[];
      }[]
    | null;
  view: HostView;
}

export function runHostAction(
  gameId: string,
  token: string,
  action: HostAction,
  remainingSeconds?: number,
) {
  return request<HostActionResponse>(`/api/host/${gameId}/action`, {
    method: 'POST',
    token,
    body: JSON.stringify({ action, remainingSeconds }),
  });
}

export function fetchProjection(gameId: string) {
  return request<HostView>(`/api/projection/${gameId}`, { cache: 'no-store' });
}

// ---------------------------------------------------------------------------
// Professor · roteiro de debate (pós-jogo)
// ---------------------------------------------------------------------------

export interface DebatePrepResponse {
  roteiro: string;
  modelo: string;
  doCache: boolean;
  /** true quando o roteiro veio com fichas citáveis de políticas/tecnologias. */
  materialUsado: boolean;
}

/**
 * Gera (ou relê do cache) o roteiro de debate da partida encerrada.
 * A 1ª chamada consome a cota de IA da partida; as seguintes vêm do banco.
 * Exige autenticação do professor (Bearer token).
 */
export function fetchDebateRoteiro(gameId: string, token: string) {
  return request<DebatePrepResponse>(`/api/host/${gameId}/debate`, {
    method: 'POST',
    token,
    cache: 'no-store',
  });
}

// ---------------------------------------------------------------------------
// Aluno
// ---------------------------------------------------------------------------

export interface JoinResponse {
  playerToken: string;
  gameId: string;
  gameCode: string;
  gameStatus: string;
  mode: 'diagnostico' | 'oficina';
  player: { id: string; name: string };
  team: { id: string; name: string; propertyKey: string };
  role: string;
  roleLabel: string;
  roleMission: string;
}

export interface JoinChoice {
  teamId?: string;
  role?: string;
}

export function joinGame(code: string, name: string, choice?: JoinChoice) {
  return request<JoinResponse>('/api/games/join', {
    method: 'POST',
    body: JSON.stringify({ code, name, ...choice }),
  });
}

// ---------------------------------------------------------------------------
// Lobby de pré-entrada: propriedade e papel antes de confirmar
// ---------------------------------------------------------------------------

export interface LobbyRoleResponse {
  role: string;
  roleLabel: string;
  taken: boolean;
  playerName: string | null;
}

export interface LobbyTeamResponse {
  id: string;
  name: string;
  propertyKey: string;
  slotsUsed: number;
  slotsMax: number;
  roles: LobbyRoleResponse[];
  perfil: string | null;
}

export interface LobbyResponse {
  gameId: string;
  gameCode: string;
  gameStatus: string;
  mode: 'diagnostico' | 'oficina';
  teams: LobbyTeamResponse[];
}

export function fetchLobby(code: string) {
  return request<LobbyResponse>(`/api/games/lobby?code=${encodeURIComponent(code)}`, {
    cache: 'no-store',
  });
}

export function fetchPlayerView(token: string) {
  return request<PlayerView>('/api/player/view', { token, cache: 'no-store' });
}

export function submitDecision(token: string, optionKey: string) {
  return request<{ optionLabel: string; locked: true }>('/api/player/decision', {
    method: 'POST',
    token,
    body: JSON.stringify({ optionKey }),
  });
}

export function sendHeartbeat(token: string) {
  return request<{ ok: true }>('/api/player/heartbeat', { method: 'POST', token });
}

// ---------------------------------------------------------------------------
// Modo Oficina · aluno
// ---------------------------------------------------------------------------

/**
 * O aluno, do ponto de vista dele.
 *
 * `maxAcoes` é o teto do estágio e vem do servidor: a constante do contrato é
 * o valor de projeto, e quem manda o número em uma partida é o host. Fica
 * opcional de propósito — uma partida já aberta por uma rota que ainda não
 * publica o campo precisa continuar mostrando um saldo verdadeiro em vez de
 * `undefined` na tela (a tela cai em `MAX_ACOES_POR_ESTAGIO`).
 */
export interface OficinaEu {
  playerId: string;
  name: string;
  teamId: string;
  teamName: string;
  perfil: string | null;
  indicadores: OficinaIndicadores | null;
  marcadores: string[];
  acoesUsadas: number;
  maxAcoes?: number;
  solucao: OficinaSolucao | null;
}

/**
 * GET /api/player/oficina.
 *
 * `view` é a visão do ALUNO (`OficinaAlunoView`), não a pública: a tela do aluno
 * nunca recebe `solucoes` nem `resultados` das outras equipes. Tipar isso como
 * `OficinaPublicView` é o que autorizava a tela a ler `view.resultados` e
 * exibir a proposta de quem ainda não enviou.
 */
export interface OficinaPanelResponse {
  game: { id: string; code: string; status: string };
  briefing: { narrativaInicial: string | null };
  eu: OficinaEu;
  view: OficinaAlunoView;
}

export function fetchOficinaPanel(token: string) {
  return request<OficinaPanelResponse>('/api/player/oficina', { token, cache: 'no-store' });
}

/**
 * `acao.efeitos` é o DELTA gravado no log da ação, não o estado novo: é o que a
 * tela precisa mostrar para o aluno entender o que o gesto dele mudou.
 */
export interface OficinaAcaoResult {
  acao: OficinaAcaoRow;
  pistaDescoberta?: OficinaPistaRow | null;
  indicadoresAtualizados: OficinaIndicadores;
  aviso?: string;
}

export function executarOficinaAcao(token: string, acaoKey: string, alvoId?: string) {
  return request<OficinaAcaoResult>('/api/player/oficina', {
    method: 'POST',
    token,
    body: JSON.stringify({ action: 'acao', acaoKey, alvoId }),
  });
}

/** `pista` é a linha completa: a tela precisa saber se ela já foi publicada. */
export function compartilharOficinaPista(token: string, pistaId: string) {
  return request<{ pista: OficinaPistaRow }>(
    '/api/player/oficina',
    { method: 'POST', token, body: JSON.stringify({ action: 'compartilhar', pistaId }) },
  );
}

/**
 * O servidor devolve a OPÇÃO escolhida (`opcao`), não a chave: a tela quer o
 * rótulo para confirmar a escolha da equipe, e `contribuicao.opcaoKey` nunca
 * existiu no payload.
 */
export function votarOficinaEvento(token: string, eventKey: string, opcaoKey: string) {
  return request<{
    contribuicao: { opcao: OficinaEventoOpcao; efeitos: Partial<OficinaIndicadores> };
  }>(
    '/api/player/oficina',
    { method: 'POST', token, body: JSON.stringify({ action: 'votar', eventKey, opcaoKey }) },
  );
}

/** `solucao` é a linha persistida, com `enviada_em` para confirmar o salvamento. */
export function submeterOficinaSolucao(token: string, solucao: OficinaSolucao) {
  return request<{ solucao: OficinaSolucaoRow }>('/api/player/oficina', {
    method: 'POST',
    token,
    body: JSON.stringify({ action: 'solucao', solucao }),
  });
}

// ---------------------------------------------------------------------------
// Modo Oficina · professor
// ---------------------------------------------------------------------------

export type OficinaHostAction =
  | 'iniciar'
  | 'avancar'
  | 'reabrir'
  | 'pausar'
  | 'retomar'
  | 'encerrar'
  | 'reiniciar'
  | 'abrir_evento'
  | 'resolver_evento'
  | 'resumo'
  | 'reflexao';

export interface OficinaHostViewResponse {
  game: {
    id: string;
    code: string;
    status: string;
    currentRound: number;
    roundStatus: string;
    roundEndsAt: string | null;
    totalRounds: number;
    config: Record<string, unknown>;
  };
  view: OficinaPublicView;
}

export function fetchOficinaHostView(gameId: string, token: string) {
  return request<OficinaHostViewResponse>(`/api/oficina/${gameId}`, {
    token,
    cache: 'no-store',
  });
}

export function runOficinaHostAction(
  gameId: string,
  token: string,
  action: OficinaHostAction,
) {
  return request<Record<string, unknown>>(`/api/oficina/${gameId}`, {
    method: 'POST',
    token,
    body: JSON.stringify({ action }),
  });
}

export interface OficinaProjecaoResponse {
  game: {
    id: string;
    code: string;
    status: string;
    mode: GameMode;
  };
  view: OficinaPublicView;
}

/** Projeção pública da Oficina (sem token), resultado direto da parede. */
export function fetchOficinaProjecao(gameId: string) {
  return request<OficinaProjecaoResponse>(`/api/oficina/${gameId}/projecao`, {
    cache: 'no-store',
  });
}
