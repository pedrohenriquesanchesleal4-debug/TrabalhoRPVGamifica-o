'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
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
import { Button, Carimbo, Chapeu, Filete } from '@/components/ui/primitives';
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
    <main className="mx-auto flex min-h-dvh w-full max-w-lg flex-col gap-5 px-4 py-5 sm:px-6">
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
    <div className="flex flex-1 flex-col items-center justify-center gap-3 text-tinta-500">
      <Loader2 size={28} className="animate-spin" aria-hidden="true" />
      <p className="text-sm">Carregando a partida...</p>
    </div>
  );
}

function ErrorScreen({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
      <TriangleAlert size={28} className="text-alerta" aria-hidden="true" />
      <p className="max-w-xs text-sm text-tinta-700">{message}</p>
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

  return (
    <div className="flex flex-1 flex-col gap-5">
      <header className="flex flex-col gap-4">
        <div className="flex items-center gap-2 text-tinta-700">
          <Sprout size={20} className="shrink-0 text-producao" aria-hidden="true" />
          <span className="manchete-sm text-tinta-900">{view.team.name}</span>
        </div>

        <IndicatorPanel
          indicators={view.team.state}
          lastEffects={view.lastResolution?.effects ?? null}
          variant="compact"
        />
      </header>

      <Filete espessura="fino" />

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
        <div className="flex items-center justify-between gap-3">
          <Chapeu>
            Rodada {view.game.currentRound} de {TOTAL_ROUNDS} · {roundMeta.title}
          </Chapeu>
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
      <div className="filete-grosso flex flex-col gap-2 pt-3">
        <Chapeu>Sua propriedade</Chapeu>
        <h2 className="manchete-lg text-tinta-900">{property?.name ?? view.team.name}</h2>
        {property ? (
          <>
            <p className="text-sm text-tinta-500">{property.region}</p>
            <p className="olho">{property.tagline}</p>
            <dl className="mt-1 flex flex-col gap-1.5 text-sm text-tinta-700">
              <div className="flex flex-wrap gap-1.5">
                <dt className="font-semibold text-tinta-900">Força:</dt>
                <dd>{property.strength}</dd>
              </div>
              <div className="flex flex-wrap gap-1.5">
                <dt className="font-semibold text-tinta-900">Dificuldade:</dt>
                <dd>{property.weakness}</dd>
              </div>
            </dl>
          </>
        ) : null}
      </div>

      <div className="filete-fino flex flex-col gap-1.5 pt-3">
        <span className="rotulo">Sua função</span>
        <p className="text-base font-semibold text-tinta-900">{ROLE_LABEL[view.player.role]}</p>
        <p className="text-sm text-tinta-500">{ROLE_MISSION[view.player.role]}</p>
      </div>

      <div className="filete-fino flex flex-col gap-3 pt-3">
        <div className="flex items-center gap-2">
          <Users size={14} className="text-tinta-500" aria-hidden="true" />
          <span className="rotulo">Equipe</span>
        </div>
        <TeamRoster members={view.teammates} />
      </div>

      <div className="flex items-center justify-center gap-2 py-4 text-sm text-tinta-500">
        <Hourglass size={16} className="animate-brasa" aria-hidden="true" />
        Aguardando o professor iniciar a partida
      </div>
    </div>
  );
}

function PausedScreen({ view }: { view: PlayerView }) {
  return (
    <div className="flex flex-col gap-6">
      <div className="bloco-realce flex items-start gap-3 p-4">
        <PauseCircle size={22} className="mt-0.5 shrink-0 text-manchete" aria-hidden="true" />
        <div className="flex flex-col gap-1">
          <span className="rotulo text-manchete">Partida pausada</span>
          <p className="text-sm font-medium text-tinta-900">
            O professor pausou a partida. A rodada continua de onde parou assim que ele retomar.
          </p>
        </div>
      </div>

      <div className="filete-fino flex flex-col gap-3 pt-3">
        <div className="flex items-center gap-2">
          <Users size={14} className="text-tinta-500" aria-hidden="true" />
          <span className="rotulo">Equipe</span>
        </div>
        <TeamRoster members={view.teammates} />
      </div>
    </div>
  );
}

function LockedScreen({ view }: { view: PlayerView }) {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex justify-end">
        <RoundTimer endsAt={view.game.roundEndsAt} active size="destaque" />
      </div>

      <div className="filete-grosso flex flex-col gap-3 pt-3">
        <Carimbo>Decisão registrada</Carimbo>
        <p className="manchete-md text-tinta-900">{view.decision?.optionLabel}</p>
        <p className="text-sm text-tinta-500">
          A equipe já decidiu e não é possível mudar nesta rodada. Enquanto o tempo corre, vejam o
          que os colegas ainda estão fazendo.
        </p>
      </div>

      <div className="filete-fino flex flex-col gap-3 pt-3">
        <div className="flex items-center gap-2">
          <Users size={14} className="text-tinta-500" aria-hidden="true" />
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
    <div className="flex flex-col gap-6" aria-live="polite">
      {/*
        `resolution.outcome` (vindo da engine) já nomeia a opção escolhida:
        "A equipe escolheu: {opção}.". Não repetimos a frase aqui, apenas
        damos a ela o peso de manchete: era a duplicação encontrada em
        auditoria.
      */}
      <div className="filete-grosso flex flex-col gap-2 pt-3">
        <Chapeu>O que aconteceu</Chapeu>
        <p className="manchete-md text-tinta-900">{resolution.outcome}</p>
      </div>

      {resolution.notes.length > 0 ? (
        <ul className="filete-fino flex flex-col gap-1.5 pt-3 text-sm text-tinta-700">
          {resolution.notes.map((note, index) => (
            <li key={`${index}-${note}`}>{note}</li>
          ))}
        </ul>
      ) : null}

      {resolution.effects.length > 0 ? (
        <ul className="filete-fino flex flex-col gap-1.5 pt-3">
          {resolution.effects.map((effect, index) => (
            <li
              key={`${index}-${effect.indicator}`}
              className="flex items-center justify-between gap-3 text-sm"
            >
              <span className="rotulo text-tinta-500">
                {INDICATOR_KEY_LABEL[effect.indicator] ?? effect.indicator}
              </span>
              <span
                className={classes(
                  'dado font-bold',
                  effect.delta > 0
                    ? 'text-sucesso'
                    : effect.delta < 0
                      ? 'text-alerta'
                      : 'text-tinta-500',
                )}
              >
                {effect.delta > 0 ? '+' : ''}
                {effect.delta}
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="flex items-center justify-center gap-2 py-2 text-sm text-tinta-500">
        <Hourglass size={16} aria-hidden="true" />
        A próxima rodada começa em instantes
      </div>
    </div>
  );
}

function WaitingRoundScreen({ view }: { view: PlayerView }) {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-center gap-2 py-8 text-sm text-tinta-500">
        <Hourglass size={16} className="animate-brasa" aria-hidden="true" />
        Aguardando a próxima rodada
      </div>

      <div className="filete-fino flex flex-col gap-3 pt-3">
        <div className="flex items-center gap-2">
          <Users size={14} className="text-tinta-500" aria-hidden="true" />
          <span className="rotulo">Equipe</span>
        </div>
        <TeamRoster members={view.teammates} />
      </div>
    </div>
  );
}

function FinishedScreen({ view }: { view: PlayerView }) {
  return (
    <div className="flex flex-col gap-6">
      <div className="filete-grosso flex flex-col gap-2 pt-3">
        <Chapeu>Partida encerrada</Chapeu>
        <p className="manchete-md text-tinta-900">
          A safra da equipe {view.team.name} terminou por aqui.
        </p>
        <p className="text-sm text-tinta-500">
          O professor vai conduzir o debate com a turma inteira a partir dos resultados de cada
          equipe.
        </p>
      </div>

      <div className="filete-fino flex flex-col gap-4 pt-3">
        <span className="rotulo">Indicadores finais</span>
        <IndicatorPanel indicators={view.team.state} variant="full" />
      </div>
    </div>
  );
}
