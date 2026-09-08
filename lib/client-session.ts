'use client';

/**
 * Sessão no navegador.
 *
 * O token emitido pelo servidor fica em localStorage, por dois motivos
 * práticos de sala de aula: o aluno que recarrega a página sem querer volta
 * para a mesma equipe e a mesma função, e o professor que fecha a aba do painel
 * reabre o controle da partida sem criar outra.
 *
 * Não é dado sensível: o token identifica um jogador anônimo dentro de uma
 * partida que dura vinte minutos, e não dá acesso a nada além dela.
 */

const PLAYER_KEY = 'safra-df:player';
const HOST_KEY = 'safra-df:host';

export interface PlayerSessionData {
  token: string;
  gameId: string;
  gameCode: string;
  playerName: string;
  teamName: string;
  role: string;
}

export interface HostSessionData {
  token: string;
  gameId: string;
  code: string;
}

function read<T>(key: string): T | null {
  if (typeof window === 'undefined') return null;

  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    // Navegador com armazenamento bloqueado: o jogo segue, sem persistência.
    return null;
  }
}

function write(key: string, value: unknown): void {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Sem espaço ou sem permissão: ignora em silêncio, nada aqui é crítico.
  }
}

function clear(key: string): void {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage.removeItem(key);
  } catch {
    // Idem.
  }
}

export const playerSession = {
  get: () => read<PlayerSessionData>(PLAYER_KEY),
  set: (data: PlayerSessionData) => write(PLAYER_KEY, data),
  clear: () => clear(PLAYER_KEY),
};

export const hostSession = {
  get: () => read<HostSessionData>(HOST_KEY),
  set: (data: HostSessionData) => write(HOST_KEY, data),
  clear: () => clear(HOST_KEY),
};
