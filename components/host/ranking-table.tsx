import { LinhaRegistro, Pill, formatMoney } from '@/components/ui/primitives';
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
 * A ata de encerramento da safra.
 *
 * O índice composto ordena a lista, mas cada folha expõe os quatro
 * indicadores e o perfil por extenso: dinheiro não é a única forma de se
 * destacar, e a ata precisa deixar isso visualmente óbvio, não só dizer. Os
 * prêmios ficam do lado do perfil justamente para o professor conseguir
 * apontar duas equipes com números opostos e as duas terem se saído bem.
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
      <p className="font-caderno text-sm text-tinta-500">O resultado ainda não foi calculado.</p>
    );
  }

  const ordered = scores.slice().sort((a, b) => a.rank - b.rank);

  return (
    <ol className="flex flex-col gap-4">
      {ordered.map((score) => {
        const property = PROPERTY_BY_KEY[propertyByTeam[score.teamId] ?? ''];
        const profile = isTeamProfile(score.profile) ? PROFILE_META[score.profile] : null;

        return (
          <li key={score.teamId} className="ficha flex flex-col gap-4 p-5">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-4">
                {/* A colocação escrita à máquina na margem, como numeração de lançamento. */}
                <span
                  className="tabular shrink-0 border-2 border-tinta-900 px-2.5 py-1 text-2xl font-bold text-tinta-900"
                  aria-hidden="true"
                >
                  {String(score.rank).padStart(2, '0')}
                </span>
                <div className="flex min-w-0 flex-col">
                  <span className="rotulo">{property?.region ?? 'Propriedade'}</span>
                  <h3 className="text-2xl uppercase text-tinta-900">{score.teamName}</h3>
                </div>
              </div>

              <div className="flex shrink-0 flex-col items-end">
                <span className="rotulo">Índice composto</span>
                <span className="tabular text-3xl font-bold text-carimbo-600">
                  {Math.round(score.composite)}
                </span>
              </div>
            </div>

            {profile ? (
              <p className="border-t border-dashed border-papel-300 pt-3 font-caderno text-sm text-tinta-700">
                <span className="font-maquina font-bold uppercase tracking-wider text-tinta-900">
                  {profile.label}
                </span>
                {': '}
                {profile.description}
              </p>
            ) : null}

            <div className="grid grid-cols-1 gap-x-8 gap-y-1 sm:grid-cols-2">
              <LinhaRegistro label="Finanças" value={formatMoney(score.finances)} emphasis />
              <LinhaRegistro label="Produção" value={Math.round(score.production)} emphasis />
              <LinhaRegistro label="Tecnologia" value={Math.round(score.technology)} emphasis />
              <LinhaRegistro
                label="Sustentabilidade"
                value={Math.round(score.sustainability)}
                emphasis
              />
            </div>

            {score.awards.length > 0 ? (
              <div className="flex flex-wrap gap-2 border-t border-dashed border-papel-300 pt-3">
                {score.awards.filter(isAward).map((award) => (
                  <Pill key={award} tone="ativo">
                    {AWARD_META[award].label}
                  </Pill>
                ))}
              </div>
            ) : (
              <p className="border-t border-dashed border-papel-300 pt-3 font-maquina text-xs uppercase tracking-wider text-tinta-400">
                Sem prêmio de destaque nesta partida.
              </p>
            )}
          </li>
        );
      })}
    </ol>
  );
}
