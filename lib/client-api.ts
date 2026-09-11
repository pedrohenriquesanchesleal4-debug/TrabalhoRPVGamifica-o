'use client';

import type { HostView, PlayerView } from '@/lib/game-service';
import type { GameConfig } from '@/types/game';

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

async function request<T>(path: string, init?: RequestInit & { token?: string }): Promise<T> {
  const init2 = init || {};
  const token = init2.token;
  const headers = init2.headers;
  const body = init2.body;

  const response = await fetch(path, {
    method: init2.method || 'GET',
    headers: {
      ...(body ? { 'content-type': 'application/json' } : {}),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
  });

  const text = await response.text();
  const payload = text ? (JSON.parse(text) as unknown) : null;

  if (!response.ok) {
    const error = (payload as { error?: { code?: string; message?: string } } | null)?.error;
    throw new Error(error?.message ?? 'Erro');
  }

  return payload as T;
}

export interface CreateGameResponse {
  gameId: string;
  code: string;
  hostToken: string;
  config: GameConfig;
  teams: { id: string; name: string; propertyKey: string }[];
}

export function createGame(config: Partial<GameConfig> = {}) {
  return request<CreateGameResponse>('/api/games', {
    method: 'POST',
    body: JSON.stringify(config),
  });
}

export function fetchHostView(gameId: string, token: string) {
  return request<HostView>(/api/host/\${gameId}, { token, cache: 'no-store' });
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
  return request<HostActionResponse>(/api/host/\${gameId}/action, {
    method: 'POST',
    token,
    body: JSON.stringify({ action, remainingSeconds }),
  );
}

export function fetchProjection(gameId: string) {
  return request<HostView>(/api/projection/\${gameId}, { cache: 'no-store' });
}

export interface DebatePrepResponse {
  roteiro: string;
  modelo: string;
  doCache: boolean;
  materialUsado: boolean;
}

export function fetchDebateRoteiro(gameId: string) {
  return request<DebatePrepResponse>(/api/host/\${gameId}/debate, {
    method: 'POST',
    cache: 'no-store',
  });
}

export interface JoinResponse {
  playerToken: string;
  gameId: string;
  gameCode: string;
  gameStatus: string;
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
}

export interface LobbyResponse {
  gameId: string;
  gameCode: string;
  gameStatus: string;
  teams: LobbyTeamResponse[];
}

export function fetchLobby(code: string) {
  return request<LobbyResponse>(/api/games/lobby?code=${encodeURIComponent(code)}, { cache: 'no-store' });
}

export function fetchPlayerView(token: string) {
  return request<PlayerView>/api/player/view, { token, cache: 'no-store' };
}

export function submitDecision(token: string, optionKey: string) {
  return request<{ optionLabel: string; locked: true }>/api/player/decision, {
    method: 'POST',
    token,
    body: JSON.stringify({ optionKey }),
  };
}

export function sendHeartbeat(token: string) {
  return request<{ ok: true }>/api/player/heartbeat, { method: 'POST', token };
}