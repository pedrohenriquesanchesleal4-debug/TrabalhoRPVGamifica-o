'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { AlertTriangle, Timer, Trophy, Users } from 'lucide-react';
import { fetchProjection, RequestError } from '@/lib/client-api';
import { useGameChannel, useRoundTimer, formatClock } from '@/hooks/use-game-channel';
import { Pill } from '@/components/ui/primitives';
import { TeamBoard } from '@/components/host/team-board';
import { ROUND_META, TOTAL_ROUNDS, type GameStatus } from '@/types/game';
import type { HostView, HostTeamView } from '@/lib/game-service';

/**
 * Projeção na parede.
 *
 * Sem token: qualquer um com o link vê a partida, porque é para isso que
 * serve, um telão. Enquanto a rodada está aberta, o cartão de cada equipe
 * mostra só "decidiu" ou "pensando": revelar a escolha em tempo real mataria
 * a discussão que é o ponto do jogo.
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
      <main className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-areia-100 px-6 text-center">
        <AlertTriangle className="text-alerta" size={32} aria-hidden />
        <p className="text-lg text-mata-700">{error}</p>
      </main>
    );
  }

  if (!view) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-areia-100">
        <p className="text-xl text-mata-600">Carregando projeção...</p>
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

  return (
    <main className="mx-auto flex min-h-dvh max-w-[1600px] flex-col gap-8 px-10 py-8">
      <header className="flex flex-wrap items-center justify-between gap-6">
        <div className="flex flex-col gap-1">
          <span className="rotulo">SAFRA DF · Decisões que Alimentam</span>
          {phase ? (
            <h1 className="text-5xl text-mata-900">
              Rodada {phase.index} de {TOTAL_ROUNDS} · {phase.title}
            </h1>
          ) : (
            <h1 className="text-5xl text-mata-900">{STATUS_LABEL[game.status]}</h1>
          )}
          {phase ? <p className="text-lg text-mata-600">{phase.subtitle}</p> : null}
        </div>

        <div className="flex items-center gap-6">
          <Pill tone={game.status === 'paused' ? 'alerta' : 'neutro'} className="text-sm">
            {STATUS_LABEL[game.status]}
          </Pill>

          {game.roundStatus === 'active' ? (
            <div className="flex items-center gap-3 rounded-carta border border-terra-400 bg-terra-500/10 px-6 py-3">
              <Timer className="text-terra-600" size={28} aria-hidden />
              <span className="tabular text-5xl font-semibold text-terra-600" aria-live="polite">
                {formatClock(remaining)}
              </span>
            </div>
          ) : (
            <Pill tone="pronto" className="text-sm">
              Rodada resolvida
            </Pill>
          )}

          <Pill tone="neutro" className="text-sm">
            <Users size={14} aria-hidden />
            {view.decidedTeams} de {view.teams.length} equipes decidiram
          </Pill>
        </div>
      </header>

      <section
        aria-live="polite"
        className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3"
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

      <section className="carta flex flex-col gap-3 p-6">
        <span className="rotulo flex items-center gap-1.5">
          <Trophy size={14} aria-hidden />
          Ranking parcial por índice composto
        </span>
        <ol className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {ranking.map(({ team, composite }, index) => (
            <li
              key={team.id}
              className="flex items-center justify-between gap-3 border-b border-areia-200 pb-2 text-lg"
            >
              <span className="text-mata-800">
                <span className="tabular mr-2 text-mata-500">{index + 1}.</span>
                {team.name}
              </span>
              <span className="tabular font-semibold text-mata-900">{Math.round(composite)}</span>
            </li>
          ))}
        </ol>
      </section>

      <footer className="mt-auto flex items-center justify-center gap-3 py-4 text-mata-600">
        <span className="text-sm">Chegou atrasado? O código da partida é</span>
        <span className="tabular text-2xl font-semibold tracking-[0.1em] text-mata-900">
          {game.code}
        </span>
      </footer>
    </main>
  );
}

function LobbyScreen({ view }: { view: HostView }) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-10 bg-areia-100 px-6 py-12 text-center">
      <div className="flex flex-col items-center gap-3">
        <span className="rotulo">SAFRA DF · Decisões que Alimentam</span>
        <p className="text-2xl text-mata-700">Acesse, digite o código e seu nome</p>
        <span className="tabular text-[9rem] font-semibold leading-none tracking-[0.08em] text-mata-900">
          {view.game.code}
        </span>
      </div>

      <div className="faixa-terra w-full max-w-3xl" />

      <div className="flex w-full max-w-6xl flex-col gap-4">
        <span className="rotulo flex items-center justify-center gap-1.5">
          <Users size={14} aria-hidden />
          {view.playerCount} jogadores entraram · {view.teams.length} equipes se formando
        </span>
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
      </div>
    </main>
  );
}
