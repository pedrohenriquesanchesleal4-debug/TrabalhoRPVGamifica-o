'use client';

import { useRoundTimer, formatClock } from '@/hooks/use-game-channel';

/**
 * O relógio da rodada, escrito à máquina na margem da ficha.
 *
 * Abaixo de 30 segundos a urgência aparece por três canais ao mesmo tempo:
 * cor de carimbo, moldura sólida em volta e a palavra "fechando" por extenso.
 * Nunca só cor, e nunca só piscar, que é requisito de acessibilidade do
 * contrato e também o que faz o aviso funcionar de longe.
 */

export function RoundTimer({
  endsAt,
  active,
  size = 'normal',
}: {
  endsAt: string | null;
  active: boolean;
  size?: 'normal' | 'projecao';
}) {
  const remaining = useRoundTimer(endsAt, active);
  const projecao = size === 'projecao';

  if (!active || remaining === null) {
    return (
      <div className="flex items-baseline gap-2">
        <span className="rotulo">Tempo</span>
        <span className={projecao ? 'tabular text-4xl text-tinta-200' : 'tabular text-sm text-tinta-400'}>
          {formatClock(null)}
        </span>
      </div>
    );
  }

  const urgente = remaining <= 30;

  return (
    <div
      className={[
        'flex items-baseline gap-2 border px-2.5 py-1',
        urgente ? 'border-carimbo-500 text-carimbo-600' : 'border-transparent text-tinta-900',
      ].join(' ')}
      role="timer"
      aria-live="off"
    >
      <span className={urgente ? 'rotulo text-carimbo-600' : 'rotulo'}>Tempo</span>
      <span
        className={[
          'tabular font-bold',
          projecao ? 'text-5xl' : 'text-base',
          urgente ? 'animate-pisca' : '',
        ].join(' ')}
      >
        {formatClock(remaining)}
      </span>
      {urgente ? (
        <span className={projecao ? 'rotulo text-carimbo-600' : 'rotulo text-carimbo-600'}>
          fechando
        </span>
      ) : null}
    </div>
  );
}
