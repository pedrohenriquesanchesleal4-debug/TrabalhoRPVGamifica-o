import { Award as AwardIcon, Trophy } from 'lucide-react';
import { Degrau, Pill, Rotulo, formatMoney } from '@/components/ui/primitives';
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
 * O índice composto ordena a lista, mas a campeã vira o único `mirante` da
 * tela: é o momento de clímax do jogo. O resto desce em `banco`, um por
 * linha, numa coluna única, sem repetir o molde de bloco fechado da campeã.
 */

function isTeamProfile(value: string): value is TeamProfile {
  return (TEAM_PROFILES as readonly string[]).includes(value);
}

function isAward(value: string): value is Award {
  return (AWARDS as readonly string[]).includes(value);
}

function IndicatorStat({
  label,
  value,
  onDark,
}: {
  label: string;
  value: string;
  onDark?: boolean;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <Rotulo className={onDark ? 'text-verde-300' : undefined}>{label}</Rotulo>
      <span className={onDark ? 'dado-lg text-white' : 'dado-lg text-terra-900'}>{value}</span>
    </div>
  );
}

function IndicatorRow({
  score,
  onDark,
}: {
  score: HostView['scores'][number];
  onDark?: boolean;
}) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <IndicatorStat label="Finanças" value={formatMoney(score.finances)} onDark={onDark} />
      <IndicatorStat label="Produção" value={String(Math.round(score.production))} onDark={onDark} />
      <IndicatorStat label="Tecnologia" value={String(Math.round(score.technology))} onDark={onDark} />
      <IndicatorStat
        label="Sustentabilidade"
        value={String(Math.round(score.sustainability))}
        onDark={onDark}
      />
    </div>
  );
}

function AwardRow({ awards }: { awards: string[] }) {
  const known = awards.filter(isAward);
  if (known.length === 0) {
    return (
      <p className="flex items-center gap-1.5 text-xs text-terra-500">
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
    return <p className="text-sm text-terra-700">O resultado ainda não foi calculado.</p>;
  }

  const ordered = scores.slice().sort((a, b) => a.rank - b.rank);
  const [champion, ...rest] = ordered;

  return (
    <div className="flex flex-col gap-8">
      {champion ? (
        <Degrau nivel="mirante" familia="fundo-verde" className="flex flex-col gap-5 p-6 sm:p-8">
          <article aria-label={`Campeã: ${champion.teamName}`} className="flex flex-col gap-5">
            <Rotulo className="text-verde-300">
              {PROPERTY_BY_KEY[propertyByTeam[champion.teamId] ?? '']?.region ?? '1º lugar'}
            </Rotulo>
            <h2 className="relevo-xl text-white">{champion.teamName}</h2>

            <div className="flex items-baseline gap-3">
              <Rotulo className="text-verde-300">Índice composto</Rotulo>
              <span className="dado-xl text-white">{Math.round(champion.composite)}</span>
            </div>

            {isTeamProfile(champion.profile) ? (
              <p className="text-lg text-verde-300">
                <span className="font-bold text-white">{PROFILE_META[champion.profile].label}:</span>{' '}
                {PROFILE_META[champion.profile].description}
              </p>
            ) : null}

            <IndicatorRow score={champion} onDark />
            <AwardRow awards={champion.awards} />
          </article>
        </Degrau>
      ) : null}

      {rest.length > 0 ? (
        <ol className="flex flex-col gap-3">
          {rest.map((score) => {
            const property = PROPERTY_BY_KEY[propertyByTeam[score.teamId] ?? ''];
            const profile = isTeamProfile(score.profile) ? PROFILE_META[score.profile] : null;

            return (
              <li key={score.teamId} className="degrau banco terr-neutro flex flex-col gap-3 p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <span className="dado-lg w-10 shrink-0 text-terra-500">{score.rank}</span>
                    <div className="flex flex-col gap-0.5">
                      <Rotulo>{property?.region ?? 'Propriedade'}</Rotulo>
                      <h3 className="relevo-sm text-terra-900">{score.teamName}</h3>
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-0.5">
                    <Rotulo>Índice composto</Rotulo>
                    <span className="dado-lg text-terra-900">{Math.round(score.composite)}</span>
                  </div>
                </div>

                {profile ? (
                  <p className="text-sm text-terra-700">
                    <span className="font-bold text-terra-900">{profile.label}:</span>{' '}
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
