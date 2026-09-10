'use client';

import { forwardRef, useLayoutEffect, useRef, type CSSProperties } from 'react';
import { Users, Wifi, WifiOff, CircleDot, CheckCircle2 } from 'lucide-react';
import { Degrau, Meter, Pill, Rotulo, formatMoney } from '@/components/ui/primitives';
import { PROPERTY_BY_KEY } from '@/data/properties';
import { ROLE_LABEL } from '@/types/game';
import type { HostTeamView } from '@/lib/game-service';
import { PropertyScene } from '@/components/game/property-scene';

/**
 * As três peças da direção "Noite de Cerrado" na projeção: a equipe em foco
 * vira `mirante` (cena inteira, indicadores em tamanho `projecao`), as
 * demais formam a "encosta" (uma linha `banco` cada, parede proporcional ao
 * rank) e o lobby/painel do professor usa um cartão `banco` denso e neutro.
 * Nunca o mesmo peso visual para as seis equipes: é a regra estrutural do
 * contrato visual, e a régua de layout é sempre o rank, nunca uma grade.
 */

function clampPercent(value: number): number {
  return Math.max(0, Math.min(100, value));
}

/** Estilo com a custom property `--pared-h`, que o CSS de `.degrau` já lê. */
type ParedeStyle = CSSProperties & { '--pared-h'?: string };

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
          : 'flex flex-wrap items-center gap-x-5 gap-y-1.5'
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
      <Rotulo>
        <span className="inline-flex items-center gap-1.5">
          <Users size={12} aria-hidden />
          Integrantes
        </span>
      </Rotulo>
      <ul className="flex flex-wrap gap-x-4 gap-y-1">
        {players.map((player) => (
          <li
            key={player.id}
            className="flex items-center gap-1.5 text-sm text-terra-700"
            title={player.connected ? 'Conectado' : 'Desconectado'}
          >
            {player.connected ? (
              <Wifi size={13} className="text-terra-500" aria-hidden />
            ) : (
              <WifiOff size={13} className="text-terra-500/60" aria-hidden />
            )}
            <span className={player.connected ? '' : 'text-terra-500/60 line-through'}>
              {player.name}
            </span>
            <span className="text-xs text-terra-500">{ROLE_LABEL[player.role]}</span>
          </li>
        ))}
        {players.length === 0 ? (
          <li className="text-sm text-terra-500/70">Ninguém entrou ainda.</li>
        ) : null}
      </ul>
    </div>
  );
}

/**
 * Mirante único da projeção: a equipe em foco. Cena completa, nome em
 * `.relevo-xl`, indicadores no tamanho de leitura a 6 metros (`projecao`).
 * Prato `claro` (neutro claro) porque a cor da cena da propriedade já cobre
 * área grande sozinha; empilhar outra família de cor por trás competiria com
 * ela em vez de destacá-la.
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
    <Degrau nivel="mirante" familia="claro" className="flex flex-col gap-6 p-6 sm:p-8">
      <article className="flex flex-col gap-5" aria-label={`Equipe em foco: ${team.name}`}>
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex flex-col gap-1">
            <Rotulo>{property?.region ?? 'Propriedade em destaque'}</Rotulo>
            <h2 className="relevo-xl text-terra-900">{team.name}</h2>
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
            <p className="text-lg text-terra-700">
              Escolheu:{' '}
              <span className="font-bold text-terra-900">{team.currentDecision.optionLabel}</span>
            </p>
          ) : (
            <p className="text-lg text-terra-700">Sem decisão confirmada nesta rodada.</p>
          )
        ) : null}

        <IndicatorGrid team={team} initialBudget={initialBudget} size="projecao" />

        <PlayerRoster players={team.players} />
      </article>
    </Degrau>
  );
}

/**
 * Linha da "encosta": as 5 equipes fora do foco, uma coluna única onde a
 * altura da PAREDE de cada linha é proporcional à posição no ranking. É essa
 * altura variável, e não uma grade, que vira a régua do layout: por isso não
 * existe mais geometria capaz de tratar as seis equipes como iguais.
 *
 * A altura vem de `wallPx`, calculado pelo componente-pai a partir do índice
 * da equipe na lista já ordenada por rank (ver `WALL_BY_ENCOSTA_INDEX` em
 * `app/host/[gameId]/page.tsx`). Como `.banco` fixa `--pared-h: 4px` na
 * própria classe, a única forma de variar a altura da parede SEM reescrever
 * o `box-shadow` inteiro é sobrescrever essa custom property por estilo
 * inline: um estilo inline aplicado no próprio elemento sempre vence uma
 * declaração feita por classe no mesmo elemento, então `.degrau` continua
 * lendo `var(--pared-h, 4px)` na mesma fórmula de sempre (blur zero,
 * deslocamento só para baixo, cor 800 da família), só que com o número
 * certo para aquele rank. Nenhum `box-shadow` novo é inventado aqui: é o
 * mesmo, parametrizado.
 */
export const TeamRow = forwardRef<
  HTMLLIElement,
  {
    team: HostTeamView;
    /** Posição 1-based no ranking parcial da partida. */
    position: number;
    /** Altura da parede em pixels, já calculada pelo rank dentro da encosta. */
    wallPx: number;
    initialBudget: number;
    revealDecision: boolean;
  }
>(function TeamRow({ team, position, wallPx, initialBudget, revealDecision }, ref) {
  const property = PROPERTY_BY_KEY[team.propertyKey];
  const decided = team.currentDecision !== null;
  const incomplete = team.players.length < 2;
  const paredeStyle: ParedeStyle = { '--pared-h': `${wallPx}px` };

  return (
    <li
      ref={ref}
      style={paredeStyle}
      className="degrau banco terr-neutro flex flex-wrap items-center gap-4 px-5 py-4 sm:flex-nowrap"
      aria-label={`Equipe ${team.name}, posição ${position}`}
    >
      <span className="dado-lg w-10 shrink-0 text-terra-500">{position}</span>

      <div className="flex min-w-0 shrink-0 items-center gap-3 sm:w-56">
        <PropertyScene
          propertyKey={team.propertyKey}
          production={team.state.production}
          technology={team.state.technology}
          sustainability={team.state.sustainability}
          compact
          className="w-16 shrink-0"
        />
        <div className="flex min-w-0 flex-col gap-0.5">
          <Rotulo className="hidden sm:block">{property?.region ?? 'Propriedade'}</Rotulo>
          <h3 className="relevo-sm truncate text-terra-900">{team.name}</h3>
          {revealDecision && team.currentDecision ? (
            <span className="truncate text-xs text-terra-500">{team.currentDecision.optionLabel}</span>
          ) : null}
        </div>
      </div>

      <div className="min-w-0 flex-1">
        <IndicatorGrid team={team} initialBudget={initialBudget} size="compacto" />
      </div>

      <div className="flex shrink-0 flex-col items-end gap-1.5">
        <Pill tone={decided ? 'pronto' : 'neutro'}>
          {decided ? <CheckCircle2 size={12} aria-hidden /> : <CircleDot size={12} aria-hidden />}
          {decided ? 'Decidiu' : 'Pensando'}
        </Pill>
        {incomplete ? <Pill tone="alerta">Menos de 2 jogadores</Pill> : null}
      </div>
    </li>
  );
});

/**
 * Movimento 4 · troca de relevo (técnica FLIP), sem biblioteca.
 *
 * Quando `orderKey` muda (a ordem das equipes na encosta mudou), este efeito
 * mede, para cada linha registrada, a diferença entre a posição vertical
 * antiga e a nova, aplica essa diferença como `translateY()` instantâneo
 * (sem transição: a linha aparenta não ter se mexido) e, no frame seguinte,
 * zera o deslocamento com a transição ligada. O navegador anima do estado
 * "como se não tivesse mexido" até o real, 420ms
 * `cubic-bezier(0.22, 1, 0.36, 1)`, e o olho lê como o degrau descendo.
 * Só `transform` é animado, nada de biblioteca, nada de `height`.
 */
export function useFlipRows(orderKey: string) {
  const rowsRef = useRef(new Map<string, HTMLLIElement>());
  const positionsRef = useRef(new Map<string, number>());
  const isFirstRunRef = useRef(true);

  useLayoutEffect(() => {
    const rows = rowsRef.current;
    const previous = positionsRef.current;
    const next = new Map<string, number>();

    rows.forEach((el, id) => {
      const top = el.getBoundingClientRect().top;
      next.set(id, top);

      if (isFirstRunRef.current) return;

      const before = previous.get(id);
      if (before === undefined) return;

      const delta = before - top;
      if (delta === 0) return;

      el.style.transition = 'none';
      el.style.transform = `translateY(${delta}px)`;
      // Força o navegador a aplicar o estilo acima antes de soltar a
      // transição no próximo frame: sem isto, as duas mudanças de estilo
      // são agrupadas e a animação nunca dispara.
      el.getBoundingClientRect();

      requestAnimationFrame(() => {
        el.style.transition = 'transform 420ms cubic-bezier(0.22, 1, 0.36, 1)';
        el.style.transform = '';
      });
    });

    positionsRef.current = next;
    isFirstRunRef.current = false;
  }, [orderKey]);

  return (id: string) => (el: HTMLLIElement | null) => {
    if (el) rowsRef.current.set(id, el);
    else rowsRef.current.delete(id);
  };
}

/**
 * Cartão denso usado no lobby e no painel do professor, onde as seis equipes
 * ainda não têm hierarquia de rodada (ninguém decidiu nada). Empilhado em
 * coluna única: mesmo sem rank ainda formado, seis cartões lado a lado numa
 * grade voltaria a tratá-los como iguais, o que a direção proíbe.
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
    <Degrau nivel="banco" familia="neutro" className="flex flex-col gap-3 p-4">
      <article aria-label={`Equipe ${team.name}`} className="flex flex-col gap-3">
        <header className="flex items-start justify-between gap-3">
          <div className="flex flex-col gap-0.5">
            <Rotulo>{property?.region ?? 'Propriedade'}</Rotulo>
            <h3 className="relevo-sm text-terra-900">{team.name}</h3>
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
            <p className="text-sm text-terra-700">
              Escolheu:{' '}
              <span className="font-bold text-terra-900">{team.currentDecision.optionLabel}</span>
            </p>
          ) : (
            <p className="text-sm text-terra-500">Sem decisão confirmada nesta rodada.</p>
          )
        ) : null}

        <PlayerRoster players={team.players} />
      </article>
    </Degrau>
  );
}
