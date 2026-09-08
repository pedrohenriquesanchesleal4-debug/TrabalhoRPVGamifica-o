import { Meter, formatMoney } from '@/components/ui/primitives';
import { financeIndex } from '@/game/engine';
import { INDICATOR_LABEL } from '@/types/game';
import type { IndicatorKey, TeamIndicators } from '@/types/game';

/**
 * Os quatro indicadores como as quatro colunas do livro-caixa da propriedade.
 *
 * `compact` empilha em duas colunas para caber no topo do celular sem disputar
 * espaço com a ficha da ocorrência; `full` usa uma coluna só, com bloco maior,
 * para o lobby e o encerramento; `projecao` cresce o número para ser lido a
 * seis metros do telão.
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
  variant?: 'compact' | 'full' | 'projecao';
}) {
  const effects = buildEffectMap(lastEffects);
  const size = variant === 'projecao' ? 'grande' : 'normal';

  return (
    <div
      className={
        variant === 'compact'
          ? 'grid grid-cols-2 gap-x-5 gap-y-3'
          : variant === 'projecao'
            ? 'grid grid-cols-2 gap-x-8 gap-y-5'
            : 'flex flex-col gap-4'
      }
    >
      <Meter
        kind="financas"
        label="Caixa"
        value={financeIndex(indicators.cash)}
        display={formatMoney(indicators.cash)}
        delta={effects.cash}
        size={size}
      />
      <Meter
        kind="producao"
        label={INDICATOR_LABEL.production}
        value={indicators.production}
        display={String(Math.round(indicators.production))}
        delta={effects.production}
        size={size}
      />
      <Meter
        kind="tecnologia"
        label={INDICATOR_LABEL.technology}
        value={indicators.technology}
        display={String(Math.round(indicators.technology))}
        delta={effects.technology}
        size={size}
      />
      <Meter
        kind="sustentabilidade"
        label={INDICATOR_LABEL.sustainability}
        value={indicators.sustainability}
        display={String(Math.round(indicators.sustainability))}
        delta={effects.sustainability}
        size={size}
      />
    </div>
  );
}
