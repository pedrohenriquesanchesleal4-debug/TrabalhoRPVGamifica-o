'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  CheckCircle2,
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
import { Button, Pill, SectionHeading } from '@/components/ui/primitives';
import { IndicatorPanel } from '@/components/game/indicator-panel';
import { TeamRoster } from '@/components/game/team-roster';
import { EventCard } from '@/components/game/event-card';
import { RoundTimer } from '@/components/game/round-timer';
import { OpeningSequence } from '@/components/game/opening-sequence';
import { PropertyScene } from '@/components/game/property-scene';
import { PROPERTY_BY_KEY } from '@/data/properties';

const HEARTBEAT_MS = 45_000;

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
    <main className="mx-auto flex min-h-dvh w-full max-w-lg flex-col gap-5 px-4 py-5 sm:px-6">
      {showOpening && view ? (
        <OpeningSequence
          budget={view.team.state.cash}
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
    <div className="flex flex-1 flex-col items-center justify-center gap-3 text-mata-600">
      <Loader2 size={28} className="animate-spin" aria-hidden="true" />
      <p className="text-sm">Carregando a partida...</p>
    </div>
  );
}

function ErrorScreen({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
      <TriangleAlert size={28} className="text-alerta" aria-hidden="true" />
      <p className="max-w-xs text-sm text-mata-700">{message}</p>
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
  const phase = view.event?.phase ?? phaseForRound(view.game.currentRound);
  const roundMeta = ROUND_META[phase];

  return (
    <div className="flex flex-1 flex-col gap-5">
      <header className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Sprout size={18} className="text-terra-600" aria-hidden="true" />
            <span className="text-sm font-medium text-mata-800">{view.team.name}</span>
          </div>
          <Pill tone={view.game.status === 'paused' ? 'alerta' : 'neutro'}>
            Rodada {view.game.currentRound} de {TOTAL_ROUNDS} · {roundMeta.title}
          </Pill>
        </div>

        <IndicatorPanel
          indicators={view.team.state}
          lastEffects={view.lastResolution?.effects ?? null}
          variant="compact"
        />
      </header>

      <div className="faixa-terra" />

      {property ? (
        <PropertyScene
          propertyKey={property.key}
          production={view.team.state.production}
          technology={view.team.state.technology}
          sustainability={view.team.state.sustainability}
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
    return (
      <div className="flex flex-col gap-4">
        <div className="flex justify-end">
          <RoundTimer endsAt={view.game.roundEndsAt} active={view.game.roundStatus === 'active'} />
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
    <div className="flex flex-col gap-6">
      <div className="carta flex flex-col gap-2 p-5">
        <span className="rotulo text-terra-600">Sua propriedade</span>
        <h2 className="text-xl text-mata-900">{property?.name ?? view.team.name}</h2>
        {property ? (
          <>
            <p className="text-sm text-mata-600">{property.region}</p>
            <p className="text-sm text-mata-700">{property.tagline}</p>
            <div className="mt-2 flex flex-col gap-1.5 text-sm text-mata-700">
              <p>
                <span className="font-medium text-mata-900">Força: </span>
                {property.strength}
              </p>
              <p>
                <span className="font-medium text-mata-900">Dificuldade: </span>
                {property.weakness}
              </p>
            </div>
          </>
        ) : null}
      </div>

      <div className="carta flex flex-col gap-2 p-5">
        <span className="rotulo text-terra-600">Sua função</span>
        <h3 className="text-lg text-mata-900">{ROLE_LABEL[view.player.role]}</h3>
        <p className="text-sm text-mata-700">{ROLE_MISSION[view.player.role]}</p>
      </div>

      <div className="carta flex flex-col gap-3 p-5">
        <div className="flex items-center gap-2">
          <Users size={16} className="text-mata-600" aria-hidden="true" />
          <span className="rotulo">Equipe</span>
        </div>
        <TeamRoster members={view.teammates} />
      </div>

      <div className="flex items-center justify-center gap-2 py-4 text-sm text-mata-600">
        <Hourglass size={16} className="animate-brasa" aria-hidden="true" />
        Aguardando o professor iniciar a partida
      </div>
    </div>
  );
}

function PausedScreen({ view }: { view: PlayerView }) {
  return (
    <div className="flex flex-col gap-5">
      <div className="carta flex items-center gap-3 border-terra-400 bg-terra-500/10 p-4">
        <PauseCircle size={22} className="shrink-0 text-terra-600" aria-hidden="true" />
        <p className="text-sm text-mata-800">
          O professor pausou a partida. A rodada continua de onde parou assim que ele retomar.
        </p>
      </div>

      <div className="carta flex flex-col gap-3 p-5">
        <div className="flex items-center gap-2">
          <Users size={16} className="text-mata-600" aria-hidden="true" />
          <span className="rotulo">Equipe</span>
        </div>
        <TeamRoster members={view.teammates} />
      </div>
    </div>
  );
}

function LockedScreen({ view }: { view: PlayerView }) {
  return (
    <div className="flex flex-col gap-5">
      <div className="flex justify-end">
        <RoundTimer endsAt={view.game.roundEndsAt} active />
      </div>

      <div className="carta flex flex-col gap-2 p-5">
        <div className="flex items-center gap-2 text-mata-700">
          <CheckCircle2 size={18} aria-hidden="true" />
          <span className="rotulo">Decisão registrada</span>
        </div>
        <p className="text-lg text-mata-900">{view.decision?.optionLabel}</p>
        <p className="text-sm text-mata-600">
          A equipe já decidiu e não é possível mudar nesta rodada. Enquanto o tempo corre, vejam
          o que os colegas ainda estão fazendo.
        </p>
      </div>

      <div className="carta flex flex-col gap-3 p-5">
        <div className="flex items-center gap-2">
          <Users size={16} className="text-mata-600" aria-hidden="true" />
          <span className="rotulo">Equipe</span>
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
    <div className="flex flex-col gap-5" aria-live="polite">
      <SectionHeading overline="O que aconteceu" title="Consequência da decisão" />

      <div className="carta flex flex-col gap-3 p-5">
        {resolution.optionLabel ? (
          <p className="text-sm text-mata-600">
            A equipe escolheu <span className="font-medium text-mata-900">{resolution.optionLabel}</span>.
          </p>
        ) : null}
        <p className="text-base text-mata-900">{resolution.outcome}</p>

        {resolution.notes.length > 0 ? (
          <ul className="flex flex-col gap-1.5 border-t border-areia-200 pt-3 text-sm text-mata-700">
            {resolution.notes.map((note, index) => (
              <li key={`${index}-${note}`}>{note}</li>
            ))}
          </ul>
        ) : null}

        {resolution.effects.length > 0 ? (
          <ul className="flex flex-col gap-1.5 border-t border-areia-200 pt-3 text-sm">
            {resolution.effects.map((effect, index) => (
              <li
                key={`${index}-${effect.indicator}`}
                className={
                  effect.delta > 0
                    ? 'tabular text-sucesso'
                    : effect.delta < 0
                      ? 'tabular text-alerta'
                      : 'tabular text-mata-600'
                }
              >
                {INDICATOR_KEY_LABEL[effect.indicator] ?? effect.indicator}: {effect.delta > 0 ? '+' : ''}
                {effect.delta}
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      <div className="flex items-center justify-center gap-2 py-2 text-sm text-mata-600">
        <Hourglass size={16} aria-hidden="true" />
        A próxima rodada começa em instantes
      </div>
    </div>
  );
}

function WaitingRoundScreen({ view }: { view: PlayerView }) {
  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-center gap-2 py-6 text-sm text-mata-600">
        <Hourglass size={16} className="animate-brasa" aria-hidden="true" />
        Aguardando a próxima rodada
      </div>

      <div className="carta flex flex-col gap-3 p-5">
        <div className="flex items-center gap-2">
          <Users size={16} className="text-mata-600" aria-hidden="true" />
          <span className="rotulo">Equipe</span>
        </div>
        <TeamRoster members={view.teammates} />
      </div>
    </div>
  );
}

function FinishedScreen({ view }: { view: PlayerView }) {
  return (
    <div className="flex flex-col gap-5">
      <div className="carta flex flex-col gap-2 p-5">
        <div className="flex items-center gap-2 text-mata-700">
          <CheckCircle2 size={18} aria-hidden="true" />
          <span className="rotulo">Partida encerrada</span>
        </div>
        <p className="text-base text-mata-900">
          A safra da equipe {view.team.name} terminou por aqui. O professor vai conduzir o debate
          com a turma inteira a partir dos resultados de cada equipe.
        </p>
      </div>

      <div className="carta flex flex-col gap-4 p-5">
        <span className="rotulo">Indicadores finais</span>
        <IndicatorPanel indicators={view.team.state} variant="full" />
      </div>
    </div>
  );
}
