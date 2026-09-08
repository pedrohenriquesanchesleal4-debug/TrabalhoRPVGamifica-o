import { Meter, Pill, formatMoney } from '@/components/ui/primitives';
import { PROPERTY_BY_KEY } from '@/data/properties';
import { ROLE_LABEL } from '@/types/game';
import type { HostTeamView } from '@/lib/game-service';
import { PropertyScene } from '@/components/game/property-scene';

/**
 * A folha de uma equipe no caderno do professor.
 *
 * Mostra os quatro indicadores sempre; mostra O QUE a equipe escolheu só
 * quando `revealDecision` é verdadeiro (rodada resolvida ou lobby). Enquanto a
 * rodada está aberta, revelar a escolha de uma equipe para as outras mataria a
 * discussão em sala: por isso o cartão nesse estado só informa se a equipe já
 * decidiu, nunca o quê.
 */

function clampPercent(value: number): number {
  return Math.max(0, Math.min(100, value));
}

export function TeamBoard({
  team,
  initialBudget,
  revealDecision,
  dense = false,
}: {
  team: HostTeamView;
  initialBudget: number;
  /** Verdadeiro quando é seguro mostrar a decisão da rodada atual. */
  revealDecision: boolean;
  /** Layout compacto para telas com muitas equipes lado a lado. */
  dense?: boolean;
}) {
  const property = PROPERTY_BY_KEY[team.propertyKey];
  const cashPercent = clampPercent((team.state.cash / Math.max(initialBudget, 1)) * 100);
  const decided = team.currentDecision !== null;

  return (
    <article className="ficha ficha-margem flex flex-col gap-4 py-4 pr-4" aria-label={`Equipe ${team.name}`}>
      <header className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col">
          <span className="rotulo truncate">{property?.region ?? 'Propriedade'}</span>
          <h3
            className={
              dense
                ? 'truncate text-lg uppercase text-tinta-900'
                : 'truncate text-xl uppercase text-tinta-900'
            }
          >
            {team.name}
          </h3>
        </div>

        <Pill tone={decided ? 'pronto' : 'neutro'}>{decided ? '× decidiu' : '○ pensando'}</Pill>
      </header>

      {!dense ? (
        <div className="border-y border-papel-300">
          <PropertyScene
            propertyKey={team.propertyKey}
            production={team.state.production}
            technology={team.state.technology}
            sustainability={team.state.sustainability}
          />
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-x-5 gap-y-3">
        <Meter
          kind="financas"
          label="Caixa"
          value={cashPercent}
          display={formatMoney(team.state.cash)}
        />
        <Meter
          kind="producao"
          label="Produção"
          value={team.state.production}
          display={String(Math.round(team.state.production))}
        />
        <Meter
          kind="tecnologia"
          label="Tecnologia"
          value={team.state.technology}
          display={String(Math.round(team.state.technology))}
        />
        <Meter
          kind="sustentabilidade"
          label="Sustentabilidade"
          value={team.state.sustainability}
          display={String(Math.round(team.state.sustainability))}
        />
      </div>

      {revealDecision ? (
        <div className="border-t border-dashed border-papel-300 pt-3">
          <span className="rotulo">Lançou na rodada</span>
          {team.currentDecision ? (
            <p className="font-maquina text-sm font-bold text-tinta-900">
              {team.currentDecision.optionLabel}
            </p>
          ) : (
            <p className="font-maquina text-sm text-tinta-400">Nada lançado nesta rodada.</p>
          )}
        </div>
      ) : null}

      <div className="flex flex-col gap-1 border-t border-dashed border-papel-300 pt-3">
        <span className="rotulo">Presentes</span>
        <ul className="flex flex-col">
          {team.players.map((player) => (
            <li
              key={player.id}
              className="flex items-baseline gap-2 text-sm"
              title={player.connected ? 'Conectado' : 'Desconectado'}
            >
              <span
                className={
                  player.connected
                    ? 'truncate font-maquina text-tinta-900'
                    : 'truncate font-maquina text-papel-400 line-through'
                }
              >
                {player.name}
              </span>
              <span className="pontilhado" aria-hidden="true" />
              <span className="rotulo shrink-0">{ROLE_LABEL[player.role]}</span>
            </li>
          ))}
          {team.players.length === 0 ? (
            <li className="font-caderno text-sm text-tinta-400">Ninguém entrou ainda.</li>
          ) : null}
        </ul>
      </div>
    </article>
  );
}
