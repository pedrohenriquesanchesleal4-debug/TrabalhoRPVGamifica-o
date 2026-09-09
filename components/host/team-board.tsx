import { Users, Wifi, WifiOff, CircleDot, CheckCircle2 } from 'lucide-react';
import { Meter, Pill, Chapeu, formatMoney } from '@/components/ui/primitives';
import { PROPERTY_BY_KEY } from '@/data/properties';
import { ROLE_LABEL } from '@/types/game';
import type { HostTeamView } from '@/lib/game-service';
import { PropertyScene } from '@/components/game/property-scene';

/**
 * As duas peças do "boletim de safra" na projeção: a equipe em foco vira
 * matéria principal (cena inteira, indicadores grandes) e as demais viram
 * linha de classificado (densa, sem cena, indicadores compactos). Nunca o
 * mesmo peso visual para as seis: é a regra estrutural do contrato visual.
 */

function clampPercent(value: number): number {
  return Math.max(0, Math.min(100, value));
}

function IndicatorGrid({
  team,
  initialBudget,
  size,
}: {
  team: HostTeamView;
  initialBudget: number;
  size: 'projecao' | 'compacto';
}) {
  const cashPercent = clampPercent((team.state.cash / Math.max(initialBudget, 1)) * 100);

  return (
    <div
      className={
        size === 'projecao'
          ? 'grid grid-cols-2 gap-x-8 gap-y-5 sm:grid-cols-4'
          : 'grid grid-cols-4 gap-x-4'
      }
    >
      <Meter
        kind="financas"
        label="Finanças"
        value={cashPercent}
        display={formatMoney(team.state.cash)}
        size={size}
      />
      <Meter
        kind="producao"
        label="Produção"
        value={team.state.production}
        display={String(Math.round(team.state.production))}
        size={size}
      />
      <Meter
        kind="tecnologia"
        label="Tecnologia"
        value={team.state.technology}
        display={String(Math.round(team.state.technology))}
        size={size}
      />
      <Meter
        kind="sustentabilidade"
        label="Sustentabilidade"
        value={team.state.sustainability}
        display={String(Math.round(team.state.sustainability))}
        size={size}
      />
    </div>
  );
}

function PlayerRoster({ players }: { players: HostTeamView['players'] }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="rotulo flex items-center gap-1.5">
        <Users size={12} aria-hidden />
        Integrantes
      </span>
      <ul className="flex flex-wrap gap-x-4 gap-y-1">
        {players.map((player) => (
          <li
            key={player.id}
            className="flex items-center gap-1.5 text-sm text-tinta-700"
            title={player.connected ? 'Conectado' : 'Desconectado'}
          >
            {player.connected ? (
              <Wifi size={13} className="text-tinta-500" aria-hidden />
            ) : (
              <WifiOff size={13} className="text-papel-400" aria-hidden />
            )}
            <span className={player.connected ? '' : 'text-papel-400 line-through'}>
              {player.name}
            </span>
            <span className="text-xs text-tinta-500">{ROLE_LABEL[player.role]}</span>
          </li>
        ))}
        {players.length === 0 ? <li className="text-sm text-papel-400">Ninguém entrou ainda.</li> : null}
      </ul>
    </div>
  );
}

/**
 * Matéria principal: a equipe em foco na projeção. Nome em manchete, cena da
 * propriedade em largura total, citação da última decisão e os 4 indicadores
 * no tamanho de leitura a 6 metros.
 */
export function FocusTeamBoard({
  team,
  initialBudget,
  revealDecision,
}: {
  team: HostTeamView;
  initialBudget: number;
  /** Verdadeiro quando é seguro mostrar a decisão da rodada atual. */
  revealDecision: boolean;
}) {
  const property = PROPERTY_BY_KEY[team.propertyKey];
  const decided = team.currentDecision !== null;

  return (
    <article className="flex flex-col gap-5" aria-label={`Equipe em foco: ${team.name}`}>
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <Chapeu>{property?.region ?? 'Propriedade em destaque'}</Chapeu>
          <h2 className="manchete-xl text-tinta-900">{team.name}</h2>
        </div>

        <Pill tone={decided ? 'pronto' : 'neutro'} className="text-sm">
          {decided ? <CheckCircle2 size={14} aria-hidden /> : <CircleDot size={14} aria-hidden />}
          {decided ? 'Decidiu' : 'Pensando'}
        </Pill>
      </header>

      <PropertyScene
        propertyKey={team.propertyKey}
        production={team.state.production}
        technology={team.state.technology}
        sustainability={team.state.sustainability}
        className="w-full"
      />

      {revealDecision ? (
        team.currentDecision ? (
          <p className="olho">
            Escolheu: <span className="font-semibold not-italic text-tinta-900">{team.currentDecision.optionLabel}</span>
          </p>
        ) : (
          <p className="olho">Sem decisão confirmada nesta rodada.</p>
        )
      ) : null}

      <IndicatorGrid team={team} initialBudget={initialBudget} size="projecao" />

      <PlayerRoster players={team.players} />
    </article>
  );
}

/**
 * Linha de classificado: posição em dado grande, nome em manchete pequena,
 * os 4 indicadores compactos em coluna de tabela e o estado em pílula. Sem
 * cena de propriedade: é o que diferencia visualmente do destaque.
 */
export function TeamRow({
  team,
  position,
  initialBudget,
  revealDecision,
}: {
  team: HostTeamView;
  /** Posição 1-based no ranking parcial, para o número grande à esquerda. */
  position: number;
  initialBudget: number;
  revealDecision: boolean;
}) {
  const property = PROPERTY_BY_KEY[team.propertyKey];
  const decided = team.currentDecision !== null;
  const incomplete = team.players.length < 2;

  return (
    <li
      className="filete-fino grid grid-cols-[3rem_1fr_auto] items-center gap-4 py-3 transition-transform duration-300 sm:grid-cols-[3rem_14rem_1fr_auto]"
      aria-label={`Equipe ${team.name}, posição ${position}`}
    >
      <span className="dado text-2xl font-bold text-tinta-500">{position}</span>

      <div className="flex flex-col gap-0.5">
        <span className="rotulo hidden sm:block">{property?.region ?? 'Propriedade'}</span>
        <h3 className="manchete-sm text-tinta-900">{team.name}</h3>
        {revealDecision && team.currentDecision ? (
          <span className="text-xs text-tinta-500">{team.currentDecision.optionLabel}</span>
        ) : null}
      </div>

      <div className="hidden sm:block">
        <IndicatorGrid team={team} initialBudget={initialBudget} size="compacto" />
      </div>

      <div className="flex flex-col items-end gap-1.5">
        <Pill tone={decided ? 'pronto' : 'neutro'}>
          {decided ? <CheckCircle2 size={12} aria-hidden /> : <CircleDot size={12} aria-hidden />}
          {decided ? 'Decidiu' : 'Pensando'}
        </Pill>
        {incomplete ? <Pill tone="alerta">Menos de 2 jogadores</Pill> : null}
      </div>

      <div className="col-span-3 sm:hidden">
        <IndicatorGrid team={team} initialBudget={initialBudget} size="compacto" />
      </div>
    </li>
  );
}

/**
 * Cartão denso usado no lobby e no painel do professor, onde as seis equipes
 * ainda não têm hierarquia de rodada (ninguém decidiu nada). Mantém a cena
 * pequena e a lista de integrantes, para o professor conferir formação de
 * equipe e conexão sem abrir outra tela.
 */
export function DenseTeamCard({
  team,
  initialBudget,
  revealDecision,
}: {
  team: HostTeamView;
  initialBudget: number;
  revealDecision: boolean;
}) {
  const property = PROPERTY_BY_KEY[team.propertyKey];
  const decided = team.currentDecision !== null;
  const incomplete = team.players.length < 2;

  return (
    <article className="bloco flex flex-col gap-3 p-4" aria-label={`Equipe ${team.name}`}>
      <header className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <span className="rotulo">{property?.region ?? 'Propriedade'}</span>
          <h3 className="manchete-sm text-tinta-900">{team.name}</h3>
        </div>

        <div className="flex flex-col items-end gap-1.5">
          <Pill tone={decided ? 'pronto' : 'neutro'}>
            {decided ? <CheckCircle2 size={13} aria-hidden /> : <CircleDot size={13} aria-hidden />}
            {decided ? 'Decidiu' : 'Pensando'}
          </Pill>
          {incomplete ? <Pill tone="alerta">Incompleta</Pill> : null}
        </div>
      </header>

      <IndicatorGrid team={team} initialBudget={initialBudget} size="compacto" />

      {revealDecision ? (
        team.currentDecision ? (
          <p className="filete-fino pt-2 text-sm text-tinta-700">
            Escolheu: <span className="font-semibold text-tinta-900">{team.currentDecision.optionLabel}</span>
          </p>
        ) : (
          <p className="filete-fino pt-2 text-sm text-tinta-500">Sem decisão confirmada nesta rodada.</p>
        )
      ) : null}

      <div className="filete-fino pt-2">
        <PlayerRoster players={team.players} />
      </div>
    </article>
  );
}
