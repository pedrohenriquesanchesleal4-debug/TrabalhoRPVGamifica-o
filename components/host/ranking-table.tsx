import { Award as AwardIcon, Trophy } from 'lucide-react';
import { Degrau, Rotulo, formatMoney } from '@/components/ui/primitives';
import { GAUGE_INK, type IndicatorKind } from '@/components/ui/gauges';
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
 * Mapeia cada prêmio ao indicador (kind) que ele representa, para tingir a
 * pílula com a cor correta do sistema de indicadores.
 */
const AWARD_KIND: Record<Award, IndicatorKind> = {
  best_finance: 'financas',
  best_production: 'producao',
  best_technology: 'tecnologia',
  best_sustainability: 'sustentabilidade',
  most_balanced: 'financas',      // dourado como "equilíbrio geral"
  best_recovery: 'financas',      // recuperação de caixa = finanças
  best_opportunist: 'producao',   // aproveitamento = produção
};

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

/** Pílula de prêmio com a cor do indicador correspondente. */
function AwardPill({ award }: { award: Award }) {
  const meta = AWARD_META[award];
  const kind = AWARD_KIND[award];
  return (
    <span
      className={[
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1',
        'font-mono text-[0.6875rem] font-bold uppercase tracking-[0.12em]',
        `bg-[var(--color-${kind}-300)]`,
        GAUGE_INK[kind],
        'normal-case tracking-normal',
      ].join(' ')}
    >
      <AwardIcon size={13} aria-hidden />
      {meta.label}
    </span>
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
        <AwardPill key={award} award={award} />
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
        <Degrau nivel="terraco" familia="financas" className="flex flex-col gap-5 p-6 sm:p-8">
          <article aria-label={`Campeã: ${champion.teamName}`} className="flex flex-col gap-5">
            <Rotulo className="text-financas-texto">
              {PROPERTY_BY_KEY[propertyByTeam[champion.teamId] ?? '']?.region ?? '1º lugar'}
            </Rotulo>
            <h2 className="relevo-xl text-terra-900">{champion.teamName}</h2>

            <div className="flex items-baseline gap-3">
              <Rotulo className="text-financas-texto">Índice composto</Rotulo>
              <span className="dado-xl text-terra-900">{Math.round(champion.composite)}</span>
            </div>

            {isTeamProfile(champion.profile) ? (
              <p className="text-lg text-financas-texto">
                <span className="font-bold text-terra-900">{PROFILE_META[champion.profile].label}:</span>{' '}
                {PROFILE_META[champion.profile].description}
              </p>
            ) : null}

            <IndicatorRow score={champion} />
            <AwardRow awards={champion.awards} />
          </article>
        </Degrau>
      ) : null}

      {rest.length > 0 ? (
        <table className="w-full border-collapse">
          <caption className="sr-only">Ranking final da partida</caption>
          <thead>
            <tr className="border-b-2 border-nevoa-200">
              <th scope="col" className="text-left py-2 px-1 text-sm font-bold text-terra-500">Pos.</th>
              <th scope="col" className="text-left py-2 px-1 text-sm font-bold text-terra-500">Equipe</th>
              <th scope="col" className="text-right py-2 px-1 text-sm font-bold text-terra-500">Índice</th>
              <th scope="col" className="text-right py-2 px-1 text-sm font-bold text-terra-500">Finanças</th>
              <th scope="col" className="text-right py-2 px-1 text-sm font-bold text-terra-500">Produção</th>
              <th scope="col" className="text-right py-2 px-1 text-sm font-bold text-terra-500">Tecnologia</th>
              <th scope="col" className="text-right py-2 px-1 text-sm font-bold text-terra-500">Sustentab.</th>
              <th scope="col" className="text-left py-2 px-1 text-sm font-bold text-terra-500">Prêmios</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-nevoa-200">
            {rest.map((score) => {
              const property = PROPERTY_BY_KEY[propertyByTeam[score.teamId] ?? ''];
              const profile = isTeamProfile(score.profile) ? PROFILE_META[score.profile] : null;
              const isSecond = score.rank === 2;
              const isThird = score.rank === 3;

              return (
                <tr key={score.teamId} className={['degrau banco', isSecond || isThird ? 'filete-amanhecer' : '', 'terr-neutro'].join(' ')}>
                  <td className="py-3 px-1">
                    <span className="dado-lg text-terra-500">{score.rank}</span>
                    {(isSecond || isThird) && (
                      <Rotulo className="text-financas-texto mt-1 block">
                        {isSecond ? '2º LUGAR' : '3º LUGAR'}
                      </Rotulo>
                    )}
                  </td>
                  <td className="py-3 px-1">
                    <div className="flex flex-col gap-0.5">
                      <Rotulo>{property?.region ?? 'Propriedade'}</Rotulo>
                      <h3 className="relevo-sm text-terra-900">{score.teamName}</h3>
                    </div>
                  </td>
                  <td className="py-3 px-1 text-right">
                    <span className="dado-lg text-terra-900">{Math.round(score.composite)}</span>
                  </td>
                  <td className="py-3 px-1 text-right">
                    <span className="dado text-terra-900">{formatMoney(score.finances)}</span>
                  </td>
                  <td className="py-3 px-1 text-right">
                    <span className="dado text-terra-900">{Math.round(score.production)}</span>
                  </td>
                  <td className="py-3 px-1 text-right">
                    <span className="dado text-terra-900">{Math.round(score.technology)}</span>
                  </td>
                  <td className="py-3 px-1 text-right">
                    <span className="dado text-terra-900">{Math.round(score.sustainability)}</span>
                  </td>
                  <td className="py-3 px-1">
                    <div className="flex flex-wrap gap-1.5">
                      {profile ? (
                        <p className="text-sm text-terra-700 w-full">
                          <span className="font-bold text-terra-900">{profile.label}:</span>{' '}
                          {profile.description}
                        </p>
                      ) : null}
                      <AwardRow awards={score.awards} />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      ) : null}
    </div>
  );
}
