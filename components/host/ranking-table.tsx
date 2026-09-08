import { Award as AwardIcon, Trophy } from 'lucide-react';
import { formatMoney, Pill } from '@/components/ui/primitives';
import { PROPERTY_BY_KEY } from '@/data/properties';
import {
  AWARD_META,
  PROFILE_META,
  TEAM_PROFILES,
  AWARDS,
  type Award,
  type TeamProfile,
} from '@/types/game';
import type { HostView } from '@/lib/game-service';

/**
 * Tabela de ranking final, para projeção.
 *
 * O índice composto ordena a lista, mas o cartão de cada equipe expõe os
 * quatro indicadores e o perfil por extenso: dinheiro não é a única forma de
 * se destacar, e a tabela precisa deixar isso visualmente óbvio, não só dizer.
 */

function isTeamProfile(value: string): value is TeamProfile {
  return (TEAM_PROFILES as readonly string[]).includes(value);
}

function isAward(value: string): value is Award {
  return (AWARDS as readonly string[]).includes(value);
}

export function RankingTable({ scores, propertyByTeam }: {
  scores: HostView['scores'];
  /** teamId -> propertyKey, para mostrar a propriedade junto do nome. */
  propertyByTeam: Record<string, string>;
}) {
  if (scores.length === 0) {
    return (
      <p className="text-sm text-mata-600">
        O resultado ainda não foi calculado.
      </p>
    );
  }

  const ordered = scores.slice().sort((a, b) => a.rank - b.rank);

  return (
    <ol className="flex flex-col gap-4">
      {ordered.map((score) => {
        const property = PROPERTY_BY_KEY[propertyByTeam[score.teamId] ?? ''];
        const profile = isTeamProfile(score.profile) ? PROFILE_META[score.profile] : null;

        return (
          <li key={score.teamId} className="carta flex flex-col gap-4 p-6">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-4">
                <span
                  className="tabular flex h-12 w-12 shrink-0 items-center justify-center rounded-carta bg-mata-800 text-2xl font-semibold text-areia-50"
                  aria-hidden
                >
                  {score.rank}
                </span>
                <div className="flex flex-col gap-0.5">
                  <span className="rotulo">{property?.region ?? 'Propriedade'}</span>
                  <h3 className="text-2xl text-mata-900">{score.teamName}</h3>
                </div>
              </div>

              <div className="flex flex-col items-end gap-0.5">
                <span className="rotulo">Índice composto</span>
                <span className="tabular text-3xl font-semibold text-terra-600">
                  {Math.round(score.composite)}
                </span>
              </div>
            </div>

            {profile ? (
              <p className="border-t border-areia-200 pt-3 text-sm text-mata-700">
                <span className="font-semibold text-mata-900">{profile.label}:</span>{' '}
                {profile.description}
              </p>
            ) : null}

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <IndicatorStat label="Finanças" value={formatMoney(score.finances)} />
              <IndicatorStat label="Produção" value={String(Math.round(score.production))} />
              <IndicatorStat label="Tecnologia" value={String(Math.round(score.technology))} />
              <IndicatorStat
                label="Sustentabilidade"
                value={String(Math.round(score.sustainability))}
              />
            </div>

            {score.awards.length > 0 ? (
              <div className="flex flex-wrap gap-2 border-t border-areia-200 pt-3">
                {score.awards.filter(isAward).map((award) => (
                  <Pill key={award} tone="pronto" className="normal-case tracking-normal">
                    <AwardIcon size={13} aria-hidden />
                    {AWARD_META[award].label}
                  </Pill>
                ))}
              </div>
            ) : (
              <p className="flex items-center gap-1.5 border-t border-areia-200 pt-3 text-xs text-mata-500">
                <Trophy size={13} aria-hidden />
                Sem prêmio de destaque nesta partida.
              </p>
            )}
          </li>
        );
      })}
    </ol>
  );
}

function IndicatorStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="rotulo">{label}</span>
      <span className="tabular text-lg font-semibold text-mata-900">{value}</span>
    </div>
  );
}
