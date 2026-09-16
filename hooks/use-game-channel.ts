'use client';

import { useCallback, useEffect, useRef, useSyncExternalStore } from 'react';
import { browserClient } from '@/lib/supabase';
import type { RealtimeEventType } from '@/types/game';

/**
 * Assinatura realtime da partida.
 *
 * Arquitetura de eventos, não de estado: o servidor grava um fato em
 * `game_events` ("a rodada 2 começou") e quem está assinando reage buscando o
 * que precisa. Não existe polling e não se transmite a partida inteira a cada
 * mudança, que é justamente o que estoura a cota do plano gratuito com trinta
 * alunos conectados.
 *
 * A conexão também vigia mudanças em `teams`, porque indicador é o dado que a
 * interface precisa refletir na hora, sem esperar uma releitura completa.
 */

export interface GameChannelEvent {
  id: number;
  type: RealtimeEventType;
  payload: Record<string, unknown>;
  createdAt: string;
}

interface Options {
  gameId: string | null;
  /** Chamado a cada evento novo do barramento. */
  onEvent?: (event: GameChannelEvent) => void;
  /** Chamado quando qualquer indicador de equipe muda. */
  onTeamUpdate?: () => void;
}

export function useGameChannel({ gameId, onEvent, onTeamUpdate }: Options) {
  // Callbacks em ref: mudar handler não deve derrubar e recriar o canal.
  const eventRef = useRef(onEvent);
  const teamRef = useRef(onTeamUpdate);

  // Coalesce: evita rajada de refreshes (resolve_round → 6 updates de team).
  // Um timer único agrupa todos os onTeamUpdate em 1 chamada em ~400ms.
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingTeamRef = useRef(false);

  // A sincronização das refs acontece depois da renderização, nunca durante.
  useEffect(() => {
    eventRef.current = onEvent;
    teamRef.current = onTeamUpdate;
  });

  useEffect(() => {
    if (!gameId) return;

    let cancelled = false;
    const supabase = browserClient();

    const flushTeam = () => {
      if (cancelled || !pendingTeamRef.current) return;
      pendingTeamRef.current = false;
      teamRef.current?.();
    };

    const channel = supabase
      .channel(`game:${gameId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'game_events',
          filter: `game_id=eq.${gameId}`,
        },
        (message) => {
          const row = message.new as {
            id: number;
            type: RealtimeEventType;
            payload: Record<string, unknown>;
            created_at: string;
          };

          if (cancelled) return;
          eventRef.current?.({
            id: row.id,
            type: row.type,
            payload: row.payload ?? {},
            createdAt: row.created_at,
          });
        },
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'teams',
          filter: `game_id=eq.${gameId}`,
        },
        () => {
          if (cancelled) return;
          pendingTeamRef.current = true;
          if (!refreshTimerRef.current) {
            refreshTimerRef.current = setTimeout(() => {
              refreshTimerRef.current = null;
              flushTeam();
            }, 400);
          }
        },
      )
      .subscribe(() => {});

    return () => {
      cancelled = true;
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current);
        refreshTimerRef.current = null;
      }
      void supabase.removeChannel(channel);
    };
  }, [gameId]);
}

/**
 * Cronômetro da rodada.
 *
 * O relógio de referência é o do servidor (`endsAt`), não o do dispositivo:
 * celular com hora errada não ganha nem perde tempo de decisão. O tique local
 * só serve para desenhar a contagem.
 */
export function useRoundTimer(endsAt: string | null, active: boolean) {
  const enabled = Boolean(endsAt) && active;

  /**
   * O relógio é uma fonte externa mutável, e é assim que o React quer que ele
   * seja lido: `useSyncExternalStore` assina o tique e devolve o instante atual
   * sem guardar contagem em estado (que envelheceria) e sem ler o relógio
   * durante a renderização (que não é função pura).
   */
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
    // No servidor não existe relógio do cliente: 0 sinaliza "ainda sem tempo".
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
