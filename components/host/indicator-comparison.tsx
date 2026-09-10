import { CanalIcone, GAUGE_LABEL, type IndicatorKind } from '@/components/ui/gauges';
import { Degrau, Pill, Rotulo } from '@/components/ui/primitives';
import { PROPERTY_BY_KEY } from '@/data/properties';
import { PROFILE_META, TEAM_PROFILES, type TeamProfile } from '@/types/game';
import type { HostView } from '@/lib/game-service';

/**
 * Comparação lado a lado das 6 propriedades, um eixo por vez.
 *
 * A tabela de ranking (`RankingTable`) responde "quem ganhou"; esta grade
 * responde uma pergunta diferente, eixo a eixo: "quem se destacou em
 * finanças, e quem se destacou em sustentabilidade, mesmo que não tenha
 * vencido no composto". Cada indicador vira uma fileira própria de 6 barras
 * verticais comparáveis, na cor que aquele indicador já tem em todo o
 * sistema: zero gráfico novo, zero biblioteca, só `div` + altura em CSS.
 */

type AxisKey = 'finances' | 'production' | 'technology' | 'sustainability';

const AXES: { key: AxisKey; kind: IndicatorKind }[] = [
  { key: 'finances', kind: 'financas' },
  { key: 'production', kind: 'producao' },
  { key: 'technology', kind: 'tecnologia' },
  { key: 'sustainability', kind: 'sustentabilidade' },
];

function isTeamProfile(value: string): value is TeamProfile {
  return (TEAM_PROFILES as readonly string[]).includes(value);
}

function clampPercent(value: number): number {
  return Math.max(0, Math.min(100, value));
}

function AxisRow({
  axisKind,
  axisLabel,
  scores,
  propertyByTeam,
}: {
  axisKind: IndicatorKind;
  axisLabel: string;
  scores: HostView['scores'];
  propertyByTeam: Record<string, string>;
}) {
  const axisKey: AxisKey =
    axisKind === 'financas'
      ? 'finances'
      : axisKind === 'producao'
        ? 'production'
        : axisKind === 'tecnologia'
          ? 'technology'
          : 'sustainability';

  const ordered = scores.slice().sort((a, b) => a.rank - b.rank);
  const maxValue = Math.max(...ordered.map((score) => score[axisKey]));

  return (
    <Degrau nivel="banco" familia="neutro" className="flex flex-col gap-4 p-5">
      <div className="flex items-center gap-2.5">
        <CanalIcone kind={axisKind} size="aluno" />
        <Rotulo>{axisLabel}</Rotulo>
      </div>

      <div className="flex items-end gap-5 overflow-x-auto pb-1">
        {ordered.map((score) => {
          const value = clampPercent(score[axisKey]);
          const isBest = score[axisKey] === maxValue;
          const region = PROPERTY_BY_KEY[propertyByTeam[score.teamId] ?? '']?.region;

          return (
            <div key={score.teamId} className="flex w-28 shrink-0 flex-col items-center gap-2">
              <div
                className="relative flex h-28 w-10 items-end overflow-hidden rounded-t-[8px]"
                style={{ backgroundColor: 'var(--color-nevoa-200)' }}
              >
                <div
                  className="w-full rounded-t-[6px] transition-[height] duration-700 ease-out"
                  style={{ height: `${value}%`, backgroundColor: `var(--color-${axisKind})` }}
                />
              </div>

              <span className="dado text-sm font-bold text-terra-900">{Math.round(score[axisKey])}</span>

              <div className="flex min-h-11 w-full min-w-0 flex-col items-center gap-0.5">
                <span className="w-full truncate text-center text-[0.6875rem] font-bold text-terra-700">
                  {score.teamName}
                </span>
                {region ? (
                  <span className="w-full truncate text-center text-[0.625rem] text-terra-500">
                    {region.split('·')[0]?.trim()}
                  </span>
                ) : null}
              </div>

              {isBest ? (
                <Pill tone="pronto" className="normal-case tracking-normal">
                  <span aria-hidden="true">Maior</span>
                  <span className="sr-only">Maior {axisLabel.toLowerCase()} da turma</span>
                </Pill>
              ) : null}
            </div>
          );
        })}
      </div>
    </Degrau>
  );
}

export function IndicatorComparison({
  scores,
  propertyByTeam,
}: {
  scores: HostView['scores'];
  /** teamId -> propertyKey, para identificar a equipe além do nome do time. */
  propertyByTeam: Record<string, string>;
}) {
  if (scores.length === 0) {
    return <p className="text-sm text-terra-700">O resultado ainda não foi calculado.</p>;
  }

  const ordered = scores.slice().sort((a, b) => a.rank - b.rank);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4">
        {AXES.map((axis) => (
          <AxisRow
            key={axis.key}
            axisKind={axis.kind}
            axisLabel={GAUGE_LABEL[axis.kind]}
            scores={scores}
            propertyByTeam={propertyByTeam}
          />
        ))}
      </div>

      <div className="flex flex-wrap gap-2.5">
        {ordered.map((score) =>
          isTeamProfile(score.profile) ? (
            <Pill key={score.teamId} tone="neutro" className="normal-case tracking-normal">
              <span className="font-bold text-terra-900">{score.teamName}:</span>{' '}
              {PROFILE_META[score.profile].label}
            </Pill>
          ) : null,
        )}
      </div>
    </div>
  );
}
