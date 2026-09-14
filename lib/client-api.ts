'use client';

import type { HostView, PlayerView } from '@/lib/game-service';
import type { OficinaPublicView } from '@/lib/oficina-service';
import type { GameConfig } from '@/types/game';
import type { GameMode, OficinaIndicadores, OficinaSolucao } from '@/types/oficina';

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
  const payload = text ? (JSON.parse(text) as unknown) : null;

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
 */
export function fetchDebateRoteiro(gameId: string) {
  return request<DebatePrepResponse>(`/api/host/${gameId}/debate`, {
    method: 'POST',
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

export interface OficinaEu {
  playerId: string;
  name: string;
  teamId: string;
  teamName: string;
  perfil: string | null;
  indicadores: OficinaIndicadores | null;
  marcadores: string[];
  acoesUsadas: number;
  solucao: OficinaSolucao | null;
}

export interface OficinaPanelResponse {
  game: { id: string; code: string; status: string };
  briefing: { narrativaInicial: string | null };
  eu: OficinaEu;
  view: OficinaPublicView;
}

export function fetchOficinaPanel(token: string) {
  return request<OficinaPanelResponse>('/api/player/oficina', { token, cache: 'no-store' });
}

export interface OficinaAcaoResult {
  acao: { id: string; acao_key: string; stage: string; efeitos: Partial<OficinaIndicadores> };
  pistaDescoberta?: { id: string; pista_id: string; team_id: string } | null;
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

export function compartilharOficinaPista(token: string, pistaId: string) {
  return request<{ pista: { id: string; titulo: string; texto_pista: string } }>(
    '/api/player/oficina',
    { method: 'POST', token, body: JSON.stringify({ action: 'compartilhar', pistaId }) },
  );
}

export function votarOficinaEvento(token: string, eventKey: string, opcaoKey: string) {
  return request<{ contribuicao: { opcaoKey: string; efeitos: Partial<OficinaIndicadores> } }>(
    '/api/player/oficina',
    { method: 'POST', token, body: JSON.stringify({ action: 'votar', eventKey, opcaoKey }) },
  );
}

export function submeterOficinaSolucao(token: string, solucao: OficinaSolucao) {
  return request<{ solucao: { blocos: OficinaSolucao } }>('/api/player/oficina', {
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
