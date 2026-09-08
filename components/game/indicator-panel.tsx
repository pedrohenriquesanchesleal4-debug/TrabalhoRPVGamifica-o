import { Meter, formatMoney } from '@/components/ui/primitives';
import { financeIndex } from '@/game/engine';
import { INDICATOR_LABEL } from '@/types/game';
import type { IndicatorKey, TeamIndicators } from '@/types/game';

/**
 * Painel dos 4 indicadores da equipe.
 *
 * `compact` empilha em duas colunas para caber no topo do celular sem
 * disputar espaço com a carta de evento; a variante cheia usa uma coluna só,
 * mais respirada, para telas de lobby e de encerramento.
 */

type EffectMap = Partial<Record<IndicatorKey, number>>;

function buildEffectMap(effects?: { indicator: string; delta: number }[] | null): EffectMap {
  if (!effects) return {};
  const map: EffectMap = {};
  for (const effect of effects) {
    if (
      effect.indicator === 'cash' ||
      effect.indicator === 'production' ||
      effect.indicator === 'technology' ||
      effect.indicator === 'sustainability'
    ) {
      map[effect.indicator] = effect.delta;
    }
  }
  return map;
}

export function IndicatorPanel({
  indicators,
  lastEffects,
  variant = 'compact',
}: {
  indicators: TeamIndicators;
  /** Efeitos da última resolução, para mostrar a variação ao lado do valor. */
  lastEffects?: { indicator: string; delta: number }[] | null;
  variant?: 'compact' | 'full';
}) {
  const effects = buildEffectMap(lastEffects);

  return (
    <div
      className={
        variant === 'compact'
          ? 'grid grid-cols-2 gap-x-4 gap-y-3'
          : 'flex flex-col gap-4'
      }
    >
      <Meter
        kind="financas"
        label={INDICATOR_LABEL.cash}
        value={financeIndex(indicators.cash)}
        display={formatMoney(indicators.cash)}
        delta={effects.cash}
      />
      <Meter
        kind="producao"
        label={INDICATOR_LABEL.production}
        value={indicators.production}
        display={String(Math.round(indicators.production))}
        delta={effects.production}
      />
      <Meter
        kind="tecnologia"
        label={INDICATOR_LABEL.technology}
        value={indicators.technology}
        display={String(Math.round(indicators.technology))}
        delta={effects.technology}
      />
      <Meter
        kind="sustentabilidade"
        label={INDICATOR_LABEL.sustainability}
        value={indicators.sustainability}
        display={String(Math.round(indicators.sustainability))}
        delta={effects.sustainability}
      />
    </div>
  );
}
