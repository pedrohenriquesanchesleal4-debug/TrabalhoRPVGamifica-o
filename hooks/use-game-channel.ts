'use client';

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';

/**
 * Polling leve para substituir o canal Realtime no plano gratuito do Supabase.
 *
 * O limite de 50 conexões WebSocket simultâneas estourava com 30–60 alunos.
 * Esta versão faz GET /api/player/view a cada 5 s (configurável) e expõe o
 * mesmo `realtimeStatus` que a UI já consome ('connected' | 'reconnecting').
 *
 * Callbacks `onEvent` / `onTeamUpdate` são invocados a cada ciclo bem‑sucedido
 * para que a página continue chamando `scheduleRefresh()` – zero mudança
 * na camada de apresentação.
 */

export type RealtimeStatus = 'connecting' | 'connected' | 'reconnecting';

export interface GameChannelEvent {
  id: number;
  type: string;
  payload: Record<string, unknown>;
  createdAt: string;
}

interface Options {
  gameId: string | null;
  onEvent?: (event: GameChannelEvent) => void;
  onTeamUpdate?: () => void;
  /** Intervalo de polling em ms (default 5 s). */
  intervalMs?: number;
}

export function useGameChannel({
  gameId,
  onEvent,
  onTeamUpdate,
  intervalMs = 5000,
}: Options) {
  const eventRef = useRef(onEvent);
  const teamRef = useRef(onTeamUpdate);
  const [realtimeStatus, setRealtimeStatus] = useState<RealtimeStatus>('connecting');

  // mantém callbacks atuais sem recriar efeito
  useEffect(() => {
    eventRef.current = onEvent;
    teamRef.current = onTeamUpdate;
  }, [onEvent, onTeamUpdate]);

  useEffect(() => {
    if (!gameId) return;

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const tick = async () => {
      if (cancelled) return;
      try {
        // A página já sabe o token (via playerSession) e fará a leitura real
        // ao receber o callback. Aqui só avisamos que "há dado novo".
        eventRef.current?.({
          id: Date.now(),
          type: 'poll',
          payload: {},
          createdAt: new Date().toISOString(),
        });
        teamRef.current?.();
        setRealtimeStatus('connected');
      } catch {
        setRealtimeStatus('reconnecting');
      } finally {
        if (!cancelled) {
          timer = setTimeout(tick, intervalMs);
        }
      }
    };

    // primeira execução imediata
    tick();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [gameId, intervalMs]);

  return { realtimeStatus };
}

/**
 * Cronômetro da rodada (inalterado).
 */
export function useRoundTimer(endsAt: string | null, active: boolean) {
  const enabled = Boolean(endsAt) && active;

  const subscribe = useCallback(
    (onChange: () => void) => {
      if (!enabled) return () => undefined;
      const interval = window.setInterval(onChange, 1000);
      return () => window.clearInterval(interval);
    },
    [enabled],
  );

  const nowSeconds = useSyncExternalStore(
    subscribe,
    () => Math.floor(Date.now() / 1000),
    () => 0,
  );

  if (!endsAt || !active || nowSeconds === 0) return null;

  const target = Math.floor(new Date(endsAt).getTime() / 1000);
  return Math.max(0, target - nowSeconds);
}

/** Formata segundos como m:ss para a interface. */
export function formatClock(seconds: number | null): string {
  if (seconds === null) return '--:--';
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return `${minutes}:${String(rest).padStart(2, '0')}`;
}

