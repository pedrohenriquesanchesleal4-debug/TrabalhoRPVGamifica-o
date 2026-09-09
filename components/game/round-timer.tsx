'use client';

import { Clock, TriangleAlert } from 'lucide-react';
import { useRoundTimer, formatClock } from '@/hooks/use-game-channel';

/**
 * Cronômetro da rodada.
 *
 * O componente carrega a própria escala tipográfica: `compacto` para contexto
 * discreto (canto da tela de espera), `destaque` para o momento em que o
 * cronômetro É a informação (decisão em aberto, decisão travada). Abaixo de
 * 30 segundos a urgência dispara o "pulso de nascente" (`animate-nascente`),
 * único laço infinito do sistema, além de tamanho e peso maiores: nunca só
 * cor, requisito de acessibilidade do contrato visual.
 */

type RoundTimerSize = 'compacto' | 'destaque';

function classes(...values: (string | false | null | undefined)[]): string {
  return values.filter(Boolean).join(' ');
}

export function RoundTimer({
  endsAt,
  active,
  size = 'compacto',
}: {
  endsAt: string | null;
  active: boolean;
  size?: RoundTimerSize;
}) {
  const remaining = useRoundTimer(endsAt, active);

  if (!active || remaining === null) {
    return (
      <div className="flex items-center gap-2 text-terra-500">
        <Clock size={16} aria-hidden="true" />
        <span className="dado text-sm">--:--</span>
      </div>
    );
  }

  const urgent = remaining <= 30;
  const valueClass =
    size === 'destaque'
      ? urgent
        ? 'dado-lg'
        : 'dado text-2xl font-bold'
      : urgent
        ? 'dado text-base font-bold'
        : 'dado text-sm font-semibold';

  return (
    <div
      className={classes('relative flex items-center gap-2', urgent ? 'text-alerta' : 'text-terra-700')}
      role="timer"
      aria-live="off"
    >
      {urgent ? (
        <span
          className="relative inline-flex shrink-0 items-center justify-center"
          style={{ width: size === 'destaque' ? 22 : 16, height: size === 'destaque' ? 22 : 16 }}
        >
          <span
            aria-hidden="true"
            className="nascente-anel absolute inset-0 animate-nascente rounded-full border-2 border-alerta"
          />
          <span
            aria-hidden="true"
            className="nascente-anel absolute inset-0 animate-nascente rounded-full border-2 border-alerta"
            style={{ animationDelay: '600ms' }}
          />
          <TriangleAlert size={size === 'destaque' ? 22 : 16} className="relative" aria-hidden="true" />
        </span>
      ) : (
        <Clock size={size === 'destaque' ? 20 : 16} aria-hidden="true" />
      )}
      <span className={valueClass}>{formatClock(remaining)}</span>
      {urgent ? <span className="rotulo text-alerta">Corre</span> : null}
    </div>
  );
}
