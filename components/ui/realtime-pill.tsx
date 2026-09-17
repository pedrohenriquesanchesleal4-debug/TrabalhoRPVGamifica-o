'use client';

import { Pill } from '@/components/ui/primitives';
import type { RealtimeStatus } from '@/hooks/use-game-channel';

/**
 * Estado da conexão realtime — pílula única para as telas de projeção
 * (host, diagnóstico, resultado). Quando o Supabase religa sozinho depois de
 * um tombo de Wi-Fi, a UI avisa em vez de desenhar dados velhos como vivos.
 * `role="status"` só no estado de alerta: o AO VIVO não precisa anunciar.
 */
export function RealtimePill({ status }: { status: RealtimeStatus }) {
  if (status === 'connected') {
    return (
      <span title="Conexão em tempo real ativa">
        <Pill tone="pronto" className="text-sm">
          <span className="inline-flex items-center gap-1.5">
            <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-success" />
            AO VIVO
          </span>
        </Pill>
      </span>
    );
  }

  return (
    <span role="status" aria-live="polite">
      <Pill tone="alerta" className="text-sm">
        <span className="inline-flex items-center gap-1.5">
          <span
            aria-hidden="true"
            className="h-1.5 w-1.5 rounded-full bg-alerta motion-safe:animate-pulse"
          />
          {status === 'connecting' ? 'CONECTANDO…' : 'RECONECTANDO…'}
        </span>
      </Pill>
    </span>
  );
}