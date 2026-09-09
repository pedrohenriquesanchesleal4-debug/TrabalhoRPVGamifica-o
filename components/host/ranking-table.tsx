import { Award as AwardIcon, Trophy } from 'lucide-react';
import { formatMoney, Pill, Chapeu } from '@/components/ui/primitives';
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
 * O índice composto ordena a lista, mas a campeã vira manchete: é o único
 * momento de clímax do jogo, e o resto vira classificado denso separado por
 * filete, sem repetir o molde de bloco fechado nas outras posições.
 */

function isTeamProfile(value: string): value is TeamProfile {
  return (TEAM_PROFILES as readonly string[]).includes(value);
}

function isAward(value: string): value is Award {
  return (AWARDS as readonly string[]).includes(value);
}

function IndicatorStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="rotulo">{label}</span>
      <span className="dado-lg text-tinta-900">{value}</span>
    </div>
  );
}

function IndicatorRow({ score }: { score: HostView['scores'][number] }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <IndicatorStat label="Finanças" value={formatMoney(score.finances)} />
      <IndicatorStat label="Produção" value={String(Math.round(score.production))} />
      <IndicatorStat label="Tecnologia" value={String(Math.round(score.technology))} />
      <IndicatorStat label="Sustentabilidade" value={String(Math.round(score.sustainability))} />
    </div>
  );
}

function AwardRow({ awards }: { awards: string[] }) {
  const known = awards.filter(isAward);
  if (known.length === 0) {
    return (
      <p className="flex items-center gap-1.5 text-xs text-tinta-500">
        <Trophy size={13} aria-hidden />
        Sem prêmio de destaque nesta partida.
      </p>
    );
  }
  return (
    <div className="flex flex-wrap gap-2">
      {known.map((award) => (
        <Pill key={award} tone="pronto" className="normal-case tracking-normal">
          <AwardIcon size={13} aria-hidden />
          {AWARD_META[award].label}
        </Pill>
      ))}
    </div>
  );
}

export function RankingTable({
  scores,
  propertyByTeam,
}: {
  scores: HostView['scores'];
  /** teamId -> propertyKey, para mostrar a propriedade junto do nome. */
  propertyByTeam: Record<string, string>;
}) {
  if (scores.length === 0) {
    return <p className="text-sm text-tinta-500">O resultado ainda não foi calculado.</p>;
  }

  const ordered = scores.slice().sort((a, b) => a.rank - b.rank);
  const [champion, ...rest] = ordered;

  return (
    <div className="flex flex-col gap-10">
      {champion ? (
        <article className="flex flex-col gap-5" aria-label={`Campeã: ${champion.teamName}`}>
          <Chapeu>{PROPERTY_BY_KEY[propertyByTeam[champion.teamId] ?? '']?.region ?? '1º lugar'}</Chapeu>
          <h2 className="manchete-xl text-tinta-900">{champion.teamName}</h2>

          <div className="flex items-baseline gap-3">
            <span className="rotulo">Índice composto</span>
            <span className="dado-xl text-manchete">{Math.round(champion.composite)}</span>
          </div>

          {isTeamProfile(champion.profile) ? (
            <p className="olho">
              <span className="font-semibold not-italic text-tinta-900">
                {PROFILE_META[champion.profile].label}:
              </span>{' '}
              {PROFILE_META[champion.profile].description}
            </p>
          ) : null}

          <IndicatorRow score={champion} />
          <AwardRow awards={champion.awards} />
        </article>
      ) : null}

      {rest.length > 0 ? (
        <ol className="flex flex-col">
          {rest.map((score) => {
            const property = PROPERTY_BY_KEY[propertyByTeam[score.teamId] ?? ''];
            const profile = isTeamProfile(score.profile) ? PROFILE_META[score.profile] : null;

            return (
              <li key={score.teamId} className="filete-fino flex flex-col gap-3 py-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <span className="dado text-3xl font-bold text-tinta-500">{score.rank}</span>
                    <div className="flex flex-col gap-0.5">
                      <span className="rotulo">{property?.region ?? 'Propriedade'}</span>
                      <h3 className="manchete-sm text-tinta-900">{score.teamName}</h3>
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-0.5">
                    <span className="rotulo">Índice composto</span>
                    <span className="dado-lg text-tinta-900">{Math.round(score.composite)}</span>
                  </div>
                </div>

                {profile ? (
                  <p className="text-sm text-tinta-700">
                    <span className="font-semibold text-tinta-900">{profile.label}:</span>{' '}
                    {profile.description}
                  </p>
                ) : null}

                <IndicatorRow score={score} />
                <AwardRow awards={score.awards} />
              </li>
            );
          })}
        </ol>
      ) : null}
    </div>
  );
}
