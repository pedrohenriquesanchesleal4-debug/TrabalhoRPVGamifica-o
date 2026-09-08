import { Users, Wifi, WifiOff, CircleDot, CheckCircle2 } from 'lucide-react';
import { Meter, Pill, formatMoney } from '@/components/ui/primitives';
import { PROPERTY_BY_KEY } from '@/data/properties';
import { ROLE_LABEL } from '@/types/game';
import type { HostTeamView } from '@/lib/game-service';
import { PropertyScene } from '@/components/game/property-scene';

/**
 * Cartão de equipe para a projeção.
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
    <article className="carta flex flex-col gap-4 p-5" aria-label={`Equipe ${team.name}`}>
      <header className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <span className="rotulo">{property?.region ?? 'Propriedade'}</span>
          <h3 className={dense ? 'text-lg text-mata-900' : 'text-xl text-mata-900'}>
            {team.name}
          </h3>
        </div>

        <Pill tone={decided ? 'pronto' : 'neutro'}>
          {decided ? <CheckCircle2 size={14} aria-hidden /> : <CircleDot size={14} aria-hidden />}
          {decided ? 'Decidiu' : 'Pensando'}
        </Pill>
      </header>

      {!dense ? (
        <PropertyScene
          propertyKey={team.propertyKey}
          production={team.state.production}
          technology={team.state.technology}
          sustainability={team.state.sustainability}
        />
      ) : null}

      <div className="grid grid-cols-2 gap-x-4 gap-y-3">
        <Meter
          kind="financas"
          label="Finanças"
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
        team.currentDecision ? (
          <p className="border-t border-areia-200 pt-3 text-sm text-mata-700">
            Escolheu: <span className="font-semibold text-mata-900">{team.currentDecision.optionLabel}</span>
          </p>
        ) : (
          <p className="border-t border-areia-200 pt-3 text-sm text-mata-500">
            Sem decisão confirmada nesta rodada.
          </p>
        )
      ) : null}

      <div className="flex flex-col gap-1.5 border-t border-areia-200 pt-3">
        <span className="rotulo flex items-center gap-1.5">
          <Users size={12} aria-hidden />
          Integrantes
        </span>
        <ul className="flex flex-wrap gap-x-4 gap-y-1">
          {team.players.map((player) => (
            <li
              key={player.id}
              className="flex items-center gap-1.5 text-sm text-mata-700"
              title={player.connected ? 'Conectado' : 'Desconectado'}
            >
              {player.connected ? (
                <Wifi size={13} className="text-mata-500" aria-hidden />
              ) : (
                <WifiOff size={13} className="text-areia-400" aria-hidden />
              )}
              <span className={player.connected ? '' : 'text-areia-400 line-through'}>
                {player.name}
              </span>
              <span className="text-xs text-mata-500">{ROLE_LABEL[player.role]}</span>
            </li>
          ))}
          {team.players.length === 0 ? (
            <li className="text-sm text-areia-400">Ninguém entrou ainda.</li>
          ) : null}
        </ul>
      </div>
    </article>
  );
}
