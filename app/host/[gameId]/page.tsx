'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { fetchProjection, RequestError } from '@/lib/client-api';
import { useGameChannel, useRoundTimer, formatClock } from '@/hooks/use-game-channel';
import { Pill } from '@/components/ui/primitives';
import { TeamBoard } from '@/components/host/team-board';
import { ROUND_META, TOTAL_ROUNDS, type GameStatus } from '@/types/game';
import type { HostView, HostTeamView } from '@/lib/game-service';

/**
 * A folha aberta na parede.
 *
 * Sem token: qualquer um com o link vê a partida, porque é para isso que
 * serve, um telão. Enquanto a rodada está aberta, a folha de cada equipe
 * mostra só "decidiu" ou "pensando": revelar a escolha em tempo real mataria
 * a discussão que é o ponto do jogo.
 *
 * Tudo aqui é dimensionado para leitura a seis metros: código e cronômetro em
 * corpo enorme, nada dependendo de hover, nada dependendo só de cor.
 */

const STATUS_LABEL: Record<GameStatus, string> = {
  lobby: 'Aguardando a turma entrar',
  running: 'Em andamento',
  paused: 'Pausada pelo professor',
  finished: 'Partida encerrada',
};

/**
 * Ranking parcial só para acompanhar o clima da turma durante o jogo: usa os
 * mesmos pesos configurados, mas normaliza caixa como percentual do orçamento
 * inicial. O ranking oficial só existe depois de "Encerrar partida", em
 * `/host/[gameId]/resultado`.
 */
function partialRanking(teams: HostTeamView[], weights: HostView['game']['config']['weights'], initialBudget: number) {
  const totalWeight = weights.finances + weights.production + weights.technology + weights.sustainability;

  return teams
    .map((team) => {
      const cashScore = Math.max(0, Math.min(100, (team.state.cash / Math.max(initialBudget, 1)) * 100));
      const composite =
        totalWeight > 0
          ? (cashScore * weights.finances +
              team.state.production * weights.production +
              team.state.technology * weights.technology +
              team.state.sustainability * weights.sustainability) /
            totalWeight
          : 0;
      return { team, composite };
    })
    .sort((a, b) => b.composite - a.composite);
}

export default function HostProjectionPage() {
  const params = useParams<{ gameId: string }>();
  const gameId = typeof params.gameId === 'string' ? params.gameId : null;

  const [view, setView] = useState<HostView | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!gameId) return;
    try {
      const next = await fetchProjection(gameId);
      setView(next);
      setError(null);
    } catch (err) {
      setError(
        err instanceof RequestError
          ? err.message
          : 'Não foi possível carregar a projeção. Verifique a conexão.',
      );
    }
  }, [gameId]);

  // A busca inicial roda dentro de uma função assíncrona local, e não como
  // chamada direta no corpo do efeito: assim nenhum setState acontece de forma
  // sincrona durante a sincronização, e o guarda de cancelamento evita
  // atualizar uma tela que já foi desmontada.
  useEffect(() => {
    let cancelled = false;

    void (async () => {
      await load();
      if (cancelled) return;
    })();

    return () => {
      cancelled = true;
    };
  }, [load]);

  useGameChannel({
    gameId,
    onEvent: () => void load(),
    onTeamUpdate: () => void load(),
  });

  const remaining = useRoundTimer(
    view?.game.roundEndsAt ?? null,
    view?.game.roundStatus === 'active' && view.game.status === 'running',
  );

  if (!gameId) {
    return null;
  }

  if (error && !view) {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center gap-3 px-6 text-center">
        <span className="rotulo text-carimbo-600">Falhou</span>
        <p className="font-caderno text-lg text-tinta-700">{error}</p>
      </main>
    );
  }

  if (!view) {
    return (
      <main className="flex min-h-dvh items-center justify-center">
        <p className="font-maquina text-xl uppercase tracking-[0.14em] text-tinta-500 cursor-maquina">
          Carregando projeção
        </p>
      </main>
    );
  }

  const { game } = view;

  if (game.status === 'lobby') {
    return <LobbyScreen view={view} />;
  }

  const phase = game.phase ? ROUND_META[game.phase] : null;
  const revealDecision = game.roundStatus !== 'active';
  const ranking = partialRanking(view.teams, game.config.weights, game.config.initialBudget);
  const urgente = remaining !== null && remaining <= 30;

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[1600px] flex-col gap-6 px-8 py-6">
      <header className="ficha flex flex-wrap items-end justify-between gap-6 p-6">
        <div className="flex flex-col gap-1">
          <span className="rotulo text-carimbo-600">Safra DF · Decisões que Alimentam</span>
          {phase ? (
            <>
              <h1 className="text-4xl uppercase leading-none text-tinta-900 xl:text-5xl">
                Rodada {phase.index} de {TOTAL_ROUNDS} · {phase.title}
              </h1>
              <p className="font-caderno text-lg text-tinta-500">{phase.subtitle}</p>
            </>
          ) : (
            <h1 className="text-4xl uppercase leading-none text-tinta-900 xl:text-5xl">
              {STATUS_LABEL[game.status]}
            </h1>
          )}
        </div>

        <div className="flex items-end gap-8">
          <div className="flex flex-col items-end">
            <span className="rotulo">Equipes decididas</span>
            <span className="tabular text-4xl font-bold leading-none text-tinta-900">
              {view.decidedTeams}/{view.teams.length}
            </span>
          </div>

          {game.roundStatus === 'active' ? (
            <div
              className={[
                'flex flex-col items-end border-2 px-5 py-2',
                urgente ? 'border-carimbo-500 text-carimbo-600' : 'border-tinta-900 text-tinta-900',
              ].join(' ')}
            >
              <span className={urgente ? 'rotulo text-carimbo-600' : 'rotulo'}>
                {urgente ? 'Fechando' : 'Tempo'}
              </span>
              <span
                className={`tabular text-6xl font-bold leading-none ${urgente ? 'animate-pisca' : ''}`}
                aria-live="polite"
              >
                {formatClock(remaining)}
              </span>
            </div>
          ) : (
            <Pill tone="pronto" className="text-sm">
              Rodada resolvida
            </Pill>
          )}
        </div>
      </header>

      <section
        aria-live="polite"
        className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3"
      >
        {view.teams.map((team) => (
          <TeamBoard
            key={team.id}
            team={team}
            initialBudget={game.config.initialBudget}
            revealDecision={revealDecision}
          />
        ))}
      </section>

      <section className="ficha ficha-margem py-5 pr-5">
        <span className="rotulo">Ranking parcial por índice composto</span>
        <ol className="mt-3 grid grid-cols-1 gap-x-10 sm:grid-cols-2 lg:grid-cols-3">
          {ranking.map(({ team, composite }, index) => (
            <li
              key={team.id}
              className="flex items-baseline gap-3 border-b border-dotted border-papel-300 py-1.5"
            >
              <span className="tabular shrink-0 text-tinta-400">
                {String(index + 1).padStart(2, '0')}
              </span>
              <span className="truncate font-maquina text-lg uppercase text-tinta-900">
                {team.name}
              </span>
              <span className="pontilhado" aria-hidden="true" />
              <span className="tabular shrink-0 text-xl font-bold text-tinta-900">
                {Math.round(composite)}
              </span>
            </li>
          ))}
        </ol>
      </section>

      <footer className="mt-auto flex items-baseline justify-center gap-4 py-2">
        <span className="rotulo">Chegou atrasado? O código é</span>
        <span className="tabular text-3xl font-bold tracking-[0.16em] text-tinta-900">
          {game.code}
        </span>
      </footer>
    </main>
  );
}

/**
 * O lobby projetado.
 *
 * Uma coisa só importa nesta tela: o código, lido do fundo da sala por alguém
 * que está com o celular na mão. Ele ocupa a maior parte da folha, e o resto é
 * a lista de quem já entrou.
 */
function LobbyScreen({ view }: { view: HostView }) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[1600px] flex-col gap-8 px-8 py-8">
      <div className="ficha ficha-furos flex flex-col items-center gap-2 py-10 pl-10 pr-8 text-center">
        <span className="rotulo text-carimbo-600">Safra DF · Decisões que Alimentam</span>
        <p className="font-caderno text-2xl text-tinta-700">
          Acesse pelo celular, digite o código e o seu nome
        </p>
        <span className="tabular text-[8rem] font-bold leading-none tracking-[0.1em] text-tinta-900 xl:text-[11rem]">
          {view.game.code}
        </span>
        <div className="regua mt-4 w-full max-w-2xl" />
        <span className="rotulo mt-2">
          {view.playerCount} jogadores entraram · {view.teams.length} equipes se formando
        </span>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {view.teams.map((team) => (
          <TeamBoard
            key={team.id}
            team={team}
            initialBudget={view.game.config.initialBudget}
            revealDecision={false}
            dense
          />
        ))}
      </div>
    </main>
  );
}
