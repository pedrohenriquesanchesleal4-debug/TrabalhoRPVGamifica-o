'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import { AlertTriangle, Timer, Trophy, Users } from 'lucide-react';
import { fetchProjection, RequestError } from '@/lib/client-api';
import { useGameChannel, useRoundTimer, formatClock } from '@/hooks/use-game-channel';
import { Pill, Chapeu } from '@/components/ui/primitives';
import { FocusTeamBoard, TeamRow, DenseTeamCard } from '@/components/host/team-board';
import { ROUND_META, TOTAL_ROUNDS, type GameStatus } from '@/types/game';
import type { HostView, HostTeamView } from '@/lib/game-service';

/**
 * Projeção na parede.
 *
 * Sem token: qualquer um com o link vê a partida, porque é para isso que
 * serve, um telão. Enquanto a rodada está aberta, a linha de cada equipe
 * mostra só "decidiu" ou "pensando": revelar a escolha em tempo real mataria
 * a discussão que é o ponto do jogo.
 *
 * Layout de manchete + classificados: uma equipe em foco ocupa a matéria
 * principal, as outras cinco viram lista numerada densa. A escolha de quem
 * entra em foco é só de apresentação, calculada no cliente a partir da
 * variação de índice composto entre duas cargas consecutivas da projeção
 * (ou seja, entre antes e depois de uma rodada ser resolvida): nenhum
 * endpoint novo, nenhum dado que a API já não devolvesse.
 */

const STATUS_LABEL: Record<GameStatus, string> = {
  lobby: 'Aguardando a turma entrar',
  running: 'Em andamento',
  paused: 'Pausada pelo professor',
  finished: 'Partida encerrada',
};

interface RankedTeam {
  team: HostTeamView;
  composite: number;
  position: number;
}

/**
 * Ranking parcial só para acompanhar o clima da turma durante o jogo: usa os
 * mesmos pesos configurados, mas normaliza caixa como percentual do orçamento
 * inicial. O ranking oficial só existe depois de "Encerrar partida", em
 * `/host/[gameId]/resultado`.
 */
function partialRanking(
  teams: HostTeamView[],
  weights: HostView['game']['config']['weights'],
  initialBudget: number,
): RankedTeam[] {
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
    .sort((a, b) => b.composite - a.composite)
    .map((entry, index) => ({ ...entry, position: index + 1 }));
}

/**
 * Rastreia o índice composto de cada equipe entre cargas da projeção e
 * devolve o id de quem teve a maior alta desde a última rodada resolvida.
 *
 * A memória de "o que foi visto antes" mora numa ref (é histórico de
 * apresentação, não estado de UI), mas a escrita acontece dentro de um
 * efeito, nunca durante a renderização: é o que a regra `react-hooks/refs`
 * exige, e também evita recalcular a cada render em vão.
 */
function useFocusTeamId(ranking: RankedTeam[], roundKey: string): string | null {
  const previousRef = useRef<{ roundKey: string; composites: Map<string, number> } | null>(null);
  const [focusTeamId, setFocusTeamId] = useState<string | null>(null);

  useEffect(() => {
    const previous = previousRef.current;
    if (previous && previous.roundKey === roundKey) return;

    let next: string | null;
    if (previous) {
      let bestTeamId: string | null = null;
      let bestDelta = -Infinity;
      for (const entry of ranking) {
        const before = previous.composites.get(entry.team.id) ?? entry.composite;
        const delta = entry.composite - before;
        if (delta > bestDelta) {
          bestDelta = delta;
          bestTeamId = entry.team.id;
        }
      }
      next = bestDelta > 0 ? bestTeamId : (ranking[0]?.team.id ?? null);
    } else {
      next = ranking[0]?.team.id ?? null;
    }

    previousRef.current = {
      roundKey,
      composites: new Map(ranking.map((entry) => [entry.team.id, entry.composite])),
    };
    setFocusTeamId(next);
  }, [ranking, roundKey]);

  return focusTeamId;
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

  const ranking = view
    ? partialRanking(view.teams, view.game.config.weights, view.game.config.initialBudget)
    : [];
  const roundKey = view ? `${view.game.currentRound}-${view.game.roundStatus}` : 'sem-partida';
  const focusTeamId = useFocusTeamId(ranking, roundKey);

  if (!gameId) {
    return null;
  }

  if (error && !view) {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
        <AlertTriangle className="text-alerta" size={32} aria-hidden />
        <p className="text-lg text-tinta-700">{error}</p>
      </main>
    );
  }

  if (!view) {
    return (
      <main className="flex min-h-dvh items-center justify-center">
        <p className="dado-lg text-tinta-700">Carregando projeção...</p>
      </main>
    );
  }

  const { game } = view;

  if (game.status === 'lobby') {
    return <LobbyScreen view={view} />;
  }

  const phase = game.phase ? ROUND_META[game.phase] : null;
  const revealDecision = game.roundStatus !== 'active';
  const focusEntry = ranking.find((entry) => entry.team.id === focusTeamId) ?? ranking[0] ?? null;
  const classificados = ranking.filter((entry) => entry.team.id !== focusEntry?.team.id);

  return (
    <main className="mx-auto flex min-h-dvh max-w-[1600px] flex-col gap-10 px-10 py-8">
      <header className="filete-grosso flex flex-wrap items-center justify-between gap-6 pt-4">
        <div className="flex flex-col gap-1">
          <Chapeu>SAFRA DF · Decisões que Alimentam</Chapeu>
          {phase ? (
            <h1 className="manchete-lg text-tinta-900">
              Rodada {phase.index} de {TOTAL_ROUNDS} · {phase.title}
            </h1>
          ) : (
            <h1 className="manchete-lg text-tinta-900">{STATUS_LABEL[game.status]}</h1>
          )}
          {phase ? <p className="olho">{phase.subtitle}</p> : null}
        </div>

        <div className="flex flex-wrap items-center gap-6">
          <Pill tone={game.status === 'paused' ? 'alerta' : 'neutro'} className="text-sm">
            {STATUS_LABEL[game.status]}
          </Pill>

          {game.roundStatus === 'active' ? (
            <div className="flex items-center gap-3">
              <Timer className={remaining !== null && remaining <= 20 ? 'text-alerta' : 'text-manchete'} size={30} aria-hidden />
              <span
                className={
                  remaining !== null && remaining <= 20
                    ? 'dado-xl animate-brasa text-alerta'
                    : 'dado-xl text-tinta-900'
                }
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

          <Pill tone="neutro" className="text-sm">
            <Users size={14} aria-hidden />
            {view.decidedTeams} de {view.teams.length} equipes decidiram
          </Pill>
        </div>
      </header>

      {focusEntry ? (
        <section aria-live="polite">
          <FocusTeamBoard
            team={focusEntry.team}
            initialBudget={game.config.initialBudget}
            revealDecision={revealDecision}
          />
        </section>
      ) : null}

      {classificados.length > 0 ? (
        <section className="flex flex-col gap-1" aria-live="polite">
          <span className="rotulo flex items-center gap-1.5 pb-1">
            <Trophy size={12} aria-hidden />
            Classificados
          </span>
          <ol className="flex flex-col">
            {classificados.map(({ team, position }) => (
              <TeamRow
                key={team.id}
                team={team}
                position={position}
                initialBudget={game.config.initialBudget}
                revealDecision={revealDecision}
              />
            ))}
          </ol>
        </section>
      ) : null}

      <footer className="filete-fino mt-auto flex items-center justify-center gap-3 py-4">
        <span className="text-sm text-tinta-500">Chegou atrasado? O código da partida é</span>
        <span className="dado text-2xl font-bold uppercase tracking-[0.2em] text-tinta-900">{game.code}</span>
      </footer>
    </main>
  );
}

function LobbyScreen({ view }: { view: HostView }) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-10 px-6 py-12 text-center">
      <div className="flex flex-col items-center gap-3">
        <Chapeu>SAFRA DF · Decisões que Alimentam</Chapeu>
        <p className="olho">Acesse, digite o código e seu nome</p>
        <span className="dado-xl text-tinta-900" style={{ fontSize: 'clamp(4rem, 12vw, 9rem)', letterSpacing: '0.08em' }}>
          {view.game.code}
        </span>
      </div>

      <div className="filete-duplo w-full max-w-3xl" />

      <div className="flex w-full max-w-6xl flex-col gap-4">
        <span className="rotulo flex items-center justify-center gap-1.5">
          <Users size={14} aria-hidden />
          {view.playerCount} jogadores entraram · {view.teams.length} equipes se formando
        </span>
        <div className="grid grid-cols-1 gap-4 text-left sm:grid-cols-2 lg:grid-cols-3">
          {view.teams.map((team) => (
            <DenseTeamCard
              key={team.id}
              team={team}
              initialBudget={view.game.config.initialBudget}
              revealDecision={false}
            />
          ))}
        </div>
      </div>
    </main>
  );
}
