'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import { AlertTriangle, Timer, Trophy, Users } from 'lucide-react';
import { fetchProjection, RequestError } from '@/lib/client-api';
import { useGameChannel, useRoundTimer, formatClock } from '@/hooks/use-game-channel';
import { Pill, Rotulo } from '@/components/ui/primitives';
import { FocusTeamBoard, TeamRow, DenseTeamCard, useFlipRows } from '@/components/host/team-board';
import { CerradoLandscape } from '@/components/game/cerrado-landscape';
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
 * Layout "curva de nível": UM `mirante` no topo com a equipe em foco, as
 * outras cinco formam uma "encosta", coluna única em que a altura da parede
 * de cada linha é proporcional à posição no ranking. A escolha de quem entra
 * em foco é só de apresentação, calculada no cliente a partir da variação de
 * índice composto entre duas cargas consecutivas da projeção (ou seja, entre
 * antes e depois de uma rodada ser resolvida): nenhum endpoint novo, nenhum
 * dado que a API já não devolvesse.
 *
 * V6 "Amanhecer do Cerrado": paisagem atmosférica ao fundo em baixa opacidade,
 * timer com `animate-nascente` pulsando nas últimas 30s, código gigante no lobby,
 * foco em `mirante`, encosta em `terr-*`.
 */

const STATUS_LABEL: Record<GameStatus, string> = {
  lobby: 'Aguardando a turma entrar',
  running: 'Em andamento',
  paused: 'Pausada pelo professor',
  finished: 'Partida encerrada',
};

/**
 * Altura da parede (px) de cada linha da encosta, por ÍNDICE dentro da lista
 * já ordenada por rank (0 = melhor colocada fora do foco). A direção fixa
 * dois pontos ("2º lugar = 10px" e "6º = 5px") e a descida entre eles: como
 * o foco costuma ser a 1ª colocada, o índice 0 desta lista normalmente É o
 * 2º lugar geral, e assim por diante até o índice 4 (6º lugar geral).
 * Quando o foco é outra equipe, a mesma escala de degrau desce igual, só que
 * ancorada nas cinco que sobraram, o que mantém a leitura física idêntica.
 */
const WALL_BY_ENCOSTA_INDEX = [10, 9, 8, 7, 5] as const;

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

  const focusEntry = ranking.find((entry) => entry.team.id === focusTeamId) ?? ranking[0] ?? null;
  const classificados = ranking.filter((entry) => entry.team.id !== focusEntry?.team.id);
  const encostaOrderKey = classificados.map((entry) => entry.team.id).join(',');
  const setRowRef = useFlipRows(encostaOrderKey);

  // Cronômetro entrando na reta final: dispara o pulso de nascente (movimento
  // 2), o único laço infinito do sistema, quando faltam 30 segundos ou menos.
  const isEnding = remaining !== null && remaining <= 30;

  if (!gameId) {
    return null;
  }

  if (error && !view) {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
        <AlertTriangle className="text-alerta" size={32} aria-hidden />
        <p className="text-lg text-terra-700">{error}</p>
      </main>
    );
  }

  if (!view) {
    return (
      <main className="flex min-h-dvh items-center justify-center">
        <p className="dado-lg text-terra-700">Carregando projeção...</p>
      </main>
    );
  }

  const { game } = view;

  if (game.status === 'lobby') {
    return <LobbyScreen view={view} />;
  }

  const phase = game.phase ? ROUND_META[game.phase] : null;
  const revealDecision = game.roundStatus !== 'active';

  return (
    <main className="relative mx-auto flex min-h-dvh max-w-[1600px] flex-col gap-10 px-10 py-8 overflow-hidden">
      {/* Paisagem atmosférica ao fundo: amanhecer sutil, sem competir com dados. */}
      <div className="pointer-events-none fixed inset-0 z-0 opacity-10">
        <CerradoLandscape />
      </div>
      <div className="pointer-events-none fixed inset-0 z-[1] bg-nevoa-50/60" />

      {/* Conteúdo sobre a paisagem. */}
      <div className="relative z-[2] flex flex-col gap-10">
        <header className="flex flex-wrap items-center justify-between gap-6 pt-4 animate-emergir">
          <div className="flex flex-col gap-1">
            <Rotulo>SAFRA DF · Decisões que Alimentam</Rotulo>
            {phase ? (
              <h1 className="relevo-lg text-terra-900">
                Rodada {phase.index} de {TOTAL_ROUNDS} · {phase.title}
              </h1>
            ) : (
              <h1 className="relevo-lg text-terra-900">{STATUS_LABEL[game.status]}</h1>
            )}
            {phase ? <p className="text-lg text-terra-700">{phase.subtitle}</p> : null}
          </div>

          <div className="flex flex-wrap items-center gap-6">
            <Pill tone={game.status === 'paused' ? 'alerta' : 'neutro'} className="text-sm">
              {STATUS_LABEL[game.status]}
            </Pill>

            {game.roundStatus === 'active' ? (
              <div className="relative flex items-center gap-3">
                {isEnding ? (
                  <span aria-hidden="true" className="absolute -left-2 -top-2 h-9 w-9">
                    <span className="nascente-anel absolute inset-0 animate-nascente rounded-full border-2 border-alerta" />
                    <span
                      className="nascente-anel absolute inset-0 animate-nascente rounded-full border-2 border-alerta"
                      style={{ animationDelay: '600ms' }}
                    />
                  </span>
                ) : null}
                <Timer className={isEnding ? 'text-alerta' : 'text-terra-700'} size={30} aria-hidden />
                <span
                  className={isEnding ? 'dado-xl text-alerta' : 'dado-xl text-terra-900'}
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
          <section aria-live="polite" className="animate-emergir" style={{ animationDelay: '100ms' }}>
            <FocusTeamBoard
              team={focusEntry.team}
              initialBudget={game.config.initialBudget}
              revealDecision={revealDecision}
            />
          </section>
        ) : null}

        {classificados.length > 0 ? (
          <section className="flex flex-col gap-3 animate-emergir" style={{ animationDelay: '200ms' }} aria-live="polite">
            <Rotulo>
              <span className="inline-flex items-center gap-1.5">
                <Trophy size={12} aria-hidden />
                Classificados
              </span>
            </Rotulo>
            <ol className="flex flex-col gap-3">
              {classificados.map(({ team, position }, index) => (
                <TeamRow
                  key={team.id}
                  ref={setRowRef(team.id)}
                  team={team}
                  position={position}
                  wallPx={WALL_BY_ENCOSTA_INDEX[index] ?? 5}
                  initialBudget={game.config.initialBudget}
                  revealDecision={revealDecision}
                />
              ))}
            </ol>
          </section>
        ) : null}

        <footer className="mt-auto flex items-center justify-center gap-3 border-t-2 border-nevoa-200 py-4">
          <span className="text-sm text-terra-500">Chegou atrasado? O código da partida é</span>
          <span className="dado text-3xl font-bold uppercase tracking-[0.25em] text-terra-900">
            {game.code}
          </span>
        </footer>
      </div>
    </main>
  );
}

function LobbyScreen({ view }: { view: HostView }) {
  return (
    <main className="relative flex min-h-dvh flex-col items-center justify-center gap-10 px-6 py-12 text-center overflow-hidden">
      {/* Paisagem de fundo: momento de expectativa. */}
      <div className="pointer-events-none fixed inset-0 z-0 opacity-15">
        <CerradoLandscape />
      </div>
      <div className="pointer-events-none fixed inset-0 z-[1] bg-nevoa-50/50" />

      <div className="relative z-[2] flex flex-col items-center gap-10">
        <div className="flex flex-col items-center gap-3 animate-emergir">
          <Rotulo>SAFRA DF · Decisões que Alimentam</Rotulo>
          <p className="text-lg text-terra-700">Acesse, digite o código e seu nome</p>
          <span
            className="dado-xl text-terra-900"
            style={{ fontSize: 'clamp(4rem, 12vw, 9rem)', letterSpacing: '0.08em' }}
          >
            {view.game.code}
          </span>
        </div>

        <div className="filete-amanhecer w-full max-w-3xl animate-emergir" style={{ animationDelay: '100ms' }} />

        <div className="flex w-full max-w-3xl flex-col gap-4 animate-emergir" style={{ animationDelay: '200ms' }}>
          <Rotulo>
            <span className="inline-flex items-center justify-center gap-1.5">
              <Users size={14} aria-hidden />
              {view.playerCount} jogadores entraram · {view.teams.length} equipes se formando
            </span>
          </Rotulo>
          <div className="flex flex-col gap-3 text-left">
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
      </div>
    </main>
  );
}
