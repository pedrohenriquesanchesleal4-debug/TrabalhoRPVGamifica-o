'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  CircleCheck,
  Hourglass,
  Loader2,
  PauseCircle,
  RefreshCcw,
  Sprout,
  TriangleAlert,
  Users,
} from 'lucide-react';
import { fetchPlayerView, sendHeartbeat, submitDecision, RequestError } from '@/lib/client-api';
import { playerSession } from '@/lib/client-session';
import { useGameChannel } from '@/hooks/use-game-channel';
import type { PlayerView } from '@/lib/game-service';
import {
  INDICATOR_LABEL,
  ROLE_LABEL,
  ROLE_MISSION,
  ROUND_META,
  TOTAL_ROUNDS,
  phaseForRound,
} from '@/types/game';
import { Button, Rotulo } from '@/components/ui/primitives';
import { IndicatorPanel } from '@/components/game/indicator-panel';
import { TeamRoster } from '@/components/game/team-roster';
import { EventCard } from '@/components/game/event-card';
import { RoundTimer } from '@/components/game/round-timer';
import { OpeningSequence } from '@/components/game/opening-sequence';
import { PropertyScene } from '@/components/game/property-scene';
import { PROPERTY_BY_KEY } from '@/data/properties';

const HEARTBEAT_MS = 45_000;

function classes(...values: (string | false | null | undefined)[]): string {
  return values.filter(Boolean).join(' ');
}

/** Fase e título da rodada corrente, com o mesmo critério em toda a tela. */
function currentRoundMeta(view: PlayerView) {
  const phase = view.event?.phase ?? phaseForRound(view.game.currentRound);
  return ROUND_META[phase];
}

export default function JogarPage() {
  const router = useRouter();
  const [session] = useState(() => playerSession.get());

  const [view, setView] = useState<PlayerView | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [showOpening, setShowOpening] = useState(false);
  const openingCheckedRef = useRef(false);

  const refresh = useCallback(async () => {
    if (!session) return;
    try {
      const next = await fetchPlayerView(session.token);
      setView(next);
      setLoadError(null);
    } catch (err) {
      if (err instanceof RequestError && (err.code === 'unauthorized' || err.code === 'not_found')) {
        playerSession.clear();
        router.replace('/entrar');
        return;
      }
      setLoadError(
        err instanceof Error ? err.message : 'Não foi possível carregar a partida.',
      );
    } finally {
      setLoading(false);
    }
  }, [session, router]);

  // A carga inicial roda dentro de uma função assíncrona local: nenhum setState
  // acontece de forma sincrona no corpo do efeito, e o guarda de cancelamento
  // evita atualizar a tela depois de sair dela.
  useEffect(() => {
    if (!session) {
      router.replace('/entrar');
      return;
    }

    let cancelled = false;

    void (async () => {
      await refresh();
      if (cancelled) return;
    })();

    return () => {
      cancelled = true;
    };
  }, [session, router, refresh]);

  useGameChannel({
    gameId: view?.game.id ?? null,
    onEvent: () => {
      void refresh();
    },
    onTeamUpdate: () => {
      void refresh();
    },
  });

  useEffect(() => {
    if (!session) return undefined;
    const interval = window.setInterval(() => {
      sendHeartbeat(session.token).catch(() => {
        // Falha de rede pontual: a próxima batida tenta de novo, sem incomodar o aluno.
      });
    }, HEARTBEAT_MS);
    return () => window.clearInterval(interval);
  }, [session]);

  // Abertura da rodada 1: mostra uma única vez por jogador, guardada no aparelho.
  useEffect(() => {
    if (!view || !session || openingCheckedRef.current) return;
    if (
      view.game.status !== 'running' ||
      view.game.currentRound !== 1 ||
      view.game.roundStatus !== 'active'
    ) {
      return;
    }

    openingCheckedRef.current = true;
    const key = `safra-df:abertura:${session.token}`;

    // A leitura do localStorage e a decisão de mostrar a abertura ficam numa
    // função assíncrona local, pelo mesmo motivo do efeito acima.
    void (async () => {
      try {
        if (!window.localStorage.getItem(key)) {
          window.localStorage.setItem(key, '1');
          setShowOpening(true);
        }
      } catch {
        setShowOpening(true);
      }
    })();
  }, [view, session]);

  const handleConfirm = useCallback(
    async (optionKey: string) => {
      if (!session) return;
      await submitDecision(session.token, optionKey);
      await refresh();
    },
    [session, refresh],
  );

  if (!session) return null;

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-4xl flex-col gap-5 px-4 py-5 sm:px-6">
      {showOpening && view ? (
        <OpeningSequence
          budget={view.team.state.cash}
          property={PROPERTY_BY_KEY[view.team.propertyKey] ?? null}
          onDone={() => setShowOpening(false)}
        />
      ) : null}

      {loading ? (
        <LoadingScreen />
      ) : loadError ? (
        <ErrorScreen message={loadError} onRetry={refresh} />
      ) : view ? (
        <GameBody view={view} onConfirm={handleConfirm} />
      ) : null}
    </main>
  );
}

function LoadingScreen() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 text-terra-500">
      <Loader2 size={28} className="animate-spin" aria-hidden="true" />
      <p className="text-sm">Carregando a partida...</p>
    </div>
  );
}

function ErrorScreen({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
      <TriangleAlert size={28} className="text-alerta" aria-hidden="true" />
      <p className="max-w-xs text-sm text-terra-700">{message}</p>
      <Button type="button" variant="secundario" onClick={onRetry}>
        <RefreshCcw size={16} aria-hidden="true" />
        Tentar de novo
      </Button>
    </div>
  );
}

function GameBody({
  view,
  onConfirm,
}: {
  view: PlayerView;
  onConfirm: (optionKey: string) => Promise<void>;
}) {
  const property = PROPERTY_BY_KEY[view.team.propertyKey];
  const decisionOpen = Boolean(view.event) && !view.decision && view.game.status === 'running';

  return (
    <div className="flex flex-1 flex-col gap-5">
      <header
        className={classes(
          'flex flex-col gap-4',
          decisionOpen && 'md:grid md:grid-cols-[60%_40%] md:gap-6',
        )}
      >
        <div className="flex items-center gap-2 text-terra-700">
          <Sprout size={20} className="shrink-0 text-verde-700" aria-hidden="true" />
          <span className="relevo-sm text-terra-900">{view.team.name}</span>
        </div>

        <IndicatorPanel
          indicators={view.team.state}
          lastEffects={view.lastResolution?.effects ?? null}
          variant="compact"
        />
      </header>

      {property ? (
        <PropertyScene
          propertyKey={property.key}
          production={view.team.state.production}
          technology={view.team.state.technology}
          sustainability={view.team.state.sustainability}
          compact
        />
      ) : null}

      <StatusBody view={view} onConfirm={onConfirm} />
    </div>
  );
}

function StatusBody({
  view,
  onConfirm,
}: {
  view: PlayerView;
  onConfirm: (optionKey: string) => Promise<void>;
}) {
  if (view.game.status === 'finished') {
    return <FinishedScreen view={view} />;
  }

  if (view.game.status === 'lobby') {
    return <LobbyScreen view={view} />;
  }

  if (view.game.status === 'paused') {
    return <PausedScreen view={view} />;
  }

  if (view.game.roundStatus === 'resolved' && view.lastResolution) {
    return <ResolutionScreen view={view} />;
  }

  if (view.event && view.decision) {
    return <LockedScreen view={view} />;
  }

  if (view.event && !view.decision) {
    const roundMeta = currentRoundMeta(view);
    return (
      <div className="flex flex-col gap-4">
        <div className="flex justify-end">
          <RoundTimer
            endsAt={view.game.roundEndsAt}
            active={view.game.roundStatus === 'active'}
            size="destaque"
          />
        </div>
        {/*
          A `key` pela carta da rodada é o que zera a seleção pendente quando o
          evento muda: em vez de um efeito limpando estado, o React descarta a
          carta antiga e monta a nova já limpa. É a forma recomendada de
          resetar estado quando a identidade do dado muda.
        */}
        <EventCard
          key={`${view.game.currentRound}:${view.event.key}`}
          event={{
            title: view.event.title,
            narrative: view.event.narrative,
            options: view.event.options,
            roleHint: view.event.roleHint,
          }}
          roundLabel={`Rodada ${view.game.currentRound} de ${TOTAL_ROUNDS} · ${roundMeta.title}`}
          roleLabel={ROLE_LABEL[view.player.role]}
          onConfirm={onConfirm}
        />
      </div>
    );
  }

  return <WaitingRoundScreen view={view} />;
}

function LobbyScreen({ view }: { view: PlayerView }) {
  const property = PROPERTY_BY_KEY[view.team.propertyKey];

  return (
    <div className="flex flex-col gap-4">
      <div className="degrau mirante terr-fundo-verde animate-emergir flex flex-col gap-2 p-5">
        <Rotulo className="text-verde-300">Sua propriedade</Rotulo>
        <h2 className="relevo-md text-white">{property?.name ?? view.team.name}</h2>
        {property ? (
          <>
            <p className="text-sm text-verde-300">{property.region}</p>
            <p className="text-base leading-[1.6] text-white">{property.tagline}</p>
            <dl className="mt-1 flex flex-col gap-1.5 text-sm text-nevoa-100">
              <div className="flex flex-wrap gap-1.5">
                <dt className="font-semibold text-white">Força:</dt>
                <dd>{property.strength}</dd>
              </div>
              <div className="flex flex-wrap gap-1.5">
                <dt className="font-semibold text-white">Dificuldade:</dt>
                <dd>{property.weakness}</dd>
              </div>
            </dl>
          </>
        ) : null}
      </div>

      <div className="degrau banco terr-claro animate-emergir flex flex-col gap-1.5 p-4">
        <Rotulo>Sua função</Rotulo>
        <p className="text-base font-semibold text-terra-900">{ROLE_LABEL[view.player.role]}</p>
        <p className="text-sm text-terra-700">{ROLE_MISSION[view.player.role]}</p>
      </div>

      <div className="degrau banco terr-claro animate-emergir flex flex-col gap-3 p-4">
        <div className="flex items-center gap-2">
          <Users size={14} className="text-terra-500" aria-hidden="true" />
          <Rotulo>Equipe</Rotulo>
        </div>
        <TeamRoster members={view.teammates} />
      </div>

      <div className="flex items-center justify-center gap-2 py-4 text-sm text-terra-500">
        <Hourglass size={16} aria-hidden="true" />
        Aguardando o professor iniciar a partida
      </div>
    </div>
  );
}

function PausedScreen({ view }: { view: PlayerView }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="degrau mirante terr-azul animate-emergir flex items-start gap-3 p-5">
        <PauseCircle size={22} className="mt-0.5 shrink-0 text-azul-800" aria-hidden="true" />
        <div className="flex flex-col gap-1">
          <Rotulo className="text-azul-800">Partida pausada</Rotulo>
          <p className="text-sm font-medium text-azul-800">
            O professor pausou a partida. A rodada continua de onde parou assim que ele retomar.
          </p>
        </div>
      </div>

      <div className="degrau banco terr-claro animate-emergir flex flex-col gap-3 p-4">
        <div className="flex items-center gap-2">
          <Users size={14} className="text-terra-500" aria-hidden="true" />
          <Rotulo>Equipe</Rotulo>
        </div>
        <TeamRoster members={view.teammates} />
      </div>
    </div>
  );
}

function LockedScreen({ view }: { view: PlayerView }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <RoundTimer endsAt={view.game.roundEndsAt} active size="destaque" />
      </div>

      <div className="degrau terraco terr-verde animate-emergir relative flex flex-col gap-2 p-4">
        <CircleCheck size={22} className="absolute right-4 top-4 text-verde-800" aria-hidden="true" />
        <Rotulo className="text-verde-800">Registrada</Rotulo>
        <p className="relevo-sm pr-8 text-verde-800">{view.decision?.optionLabel}</p>
        <p className="text-sm text-verde-800">
          A equipe já decidiu e não é possível mudar nesta rodada. Enquanto o tempo corre, vejam o
          que os colegas ainda estão fazendo.
        </p>
      </div>

      <div className="degrau banco terr-claro animate-emergir flex flex-col gap-3 p-4">
        <div className="flex items-center gap-2">
          <Users size={14} className="text-terra-500" aria-hidden="true" />
          <Rotulo>Equipe</Rotulo>
        </div>
        <TeamRoster members={view.teammates} />
      </div>
    </div>
  );
}

const INDICATOR_KEY_LABEL: Record<string, string> = {
  cash: INDICATOR_LABEL.cash,
  production: INDICATOR_LABEL.production,
  technology: INDICATOR_LABEL.technology,
  sustainability: INDICATOR_LABEL.sustainability,
};

function ResolutionScreen({ view }: { view: PlayerView }) {
  const resolution = view.lastResolution;
  if (!resolution) return null;

  return (
    <div className="flex flex-col gap-4" aria-live="polite">
      {/*
        `resolution.outcome` (vindo da engine) já nomeia a opção escolhida:
        "A equipe escolheu: {opção}.". Não repetimos a frase aqui, apenas
        damos a ela o peso do único mirante desta tela.
      */}
      <div className="degrau mirante terr-fundo-azul animate-emergir flex flex-col gap-2 p-5">
        <Rotulo className="text-azul-300">O que aconteceu</Rotulo>
        <p className="relevo-md text-white">{resolution.outcome}</p>
      </div>

      {resolution.notes.length > 0 ? (
        <div className="degrau banco terr-claro animate-emergir flex flex-col gap-1.5 p-4 text-sm text-terra-700">
          {resolution.notes.map((note, index) => (
            <p key={`${index}-${note}`}>{note}</p>
          ))}
        </div>
      ) : null}

      {resolution.effects.length > 0 ? (
        <div className="degrau banco terr-claro animate-emergir flex flex-col gap-1.5 p-4">
          {resolution.effects.map((effect, index) => (
            <div
              key={`${index}-${effect.indicator}`}
              className="flex items-center justify-between gap-3 text-sm"
            >
              <Rotulo>{INDICATOR_KEY_LABEL[effect.indicator] ?? effect.indicator}</Rotulo>
              <span
                className={classes(
                  'dado font-bold',
                  effect.delta > 0
                    ? 'text-sucesso'
                    : effect.delta < 0
                      ? 'text-alerta'
                      : 'text-terra-500',
                )}
              >
                {effect.delta > 0 ? '+' : ''}
                {effect.delta}
              </span>
            </div>
          ))}
        </div>
      ) : null}

      <div className="flex items-center justify-center gap-2 py-2 text-sm text-terra-500">
        <Hourglass size={16} aria-hidden="true" />
        A próxima rodada começa em instantes
      </div>
    </div>
  );
}

function WaitingRoundScreen({ view }: { view: PlayerView }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-center gap-2 py-8 text-sm text-terra-500">
        <Hourglass size={16} aria-hidden="true" />
        Aguardando a próxima rodada
      </div>

      <div className="degrau banco terr-claro animate-emergir flex flex-col gap-3 p-4">
        <div className="flex items-center gap-2">
          <Users size={14} className="text-terra-500" aria-hidden="true" />
          <Rotulo>Equipe</Rotulo>
        </div>
        <TeamRoster members={view.teammates} />
      </div>
    </div>
  );
}

function FinishedScreen({ view }: { view: PlayerView }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="degrau mirante terr-fundo-verde animate-emergir flex flex-col gap-2 p-5">
        <Rotulo className="text-verde-300">Partida encerrada</Rotulo>
        <p className="relevo-md text-white">
          A safra da equipe {view.team.name} terminou por aqui.
        </p>
        <p className="text-sm text-nevoa-100">
          O professor vai conduzir o debate com a turma inteira a partir dos resultados de cada
          equipe.
        </p>
      </div>

      <div className="degrau banco terr-claro animate-emergir flex flex-col gap-4 p-4">
        <Rotulo>Indicadores finais</Rotulo>
        <IndicatorPanel indicators={view.team.state} variant="full" />
      </div>
    </div>
  );
}
