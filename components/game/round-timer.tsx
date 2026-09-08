'use client';

import { Clock, TriangleAlert } from 'lucide-react';
import { useRoundTimer, formatClock } from '@/hooks/use-game-channel';

/**
 * Cronômetro da rodada.
 *
 * Abaixo de 30 segundos a urgência aparece em cor E em texto (`animate-brasa`
 * mais a palavra "Corre"): nunca só cor, pedido de acessibilidade do contrato.
 */

export function RoundTimer({ endsAt, active }: { endsAt: string | null; active: boolean }) {
  const remaining = useRoundTimer(endsAt, active);

  if (!active || remaining === null) {
    return (
      <div className="flex items-center gap-2 text-sm text-mata-500">
        <Clock size={16} aria-hidden="true" />
        <span className="tabular">--:--</span>
      </div>
    );
  }

  const urgent = remaining <= 30;

  return (
    <div
      className={
        urgent
          ? 'flex items-center gap-2 text-sm font-semibold text-terra-600 animate-brasa'
          : 'flex items-center gap-2 text-sm font-medium text-mata-800'
      }
      role="timer"
      aria-live="off"
    >
      {urgent ? (
        <TriangleAlert size={16} aria-hidden="true" />
      ) : (
        <Clock size={16} aria-hidden="true" />
      )}
      <span className="tabular">{formatClock(remaining)}</span>
      {urgent ? <span>Corre, a rodada está fechando</span> : null}
    </div>
  );
}
