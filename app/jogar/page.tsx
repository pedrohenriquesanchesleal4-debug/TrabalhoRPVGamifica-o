'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
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
import { Button, Carimbo, LinhaRegistro, SectionHeading } from '@/components/ui/primitives';
import { IndicatorPanel } from '@/components/game/indicator-panel';
import { TeamRoster } from '@/components/game/team-roster';
import { EventCard, DecisionStamp } from '@/components/game/event-card';
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
    <main className="mx-auto flex min-h-dvh w-full max-w-lg flex-col gap-4 px-3 py-4 sm:px-5 sm:py-6">
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
    <div className="flex flex-1 flex-col items-center justify-center gap-2">
      <span className="rotulo">Abrindo o caderno</span>
      <p className="font-maquina text-sm text-tinta-500 cursor-maquina">Carregando a partida</p>
    </div>
  );
}

function ErrorScreen({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="ficha ficha-margem flex flex-col gap-3 py-5 pr-5">
      <span className="rotulo text-carimbo-600">Falhou</span>
      <p className="font-caderno text-sm text-tinta-700">{message}</p>
      <Button type="button" variant="secundario" onClick={onRetry} className="self-start">
        Tentar de novo
      </Button>
    </div>
  );
}

/**
 * Uma folha do caderno com título datilografado no alto.
 *
 * Substitui o cartão genérico: o rótulo fica na dobra superior e o conteúdo
 * corre logo abaixo, sem moldura extra em volta de cada parágrafo.
 */
function Folha({
  titulo,
  children,
  className,
}: {
  titulo: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`ficha ficha-margem py-4 pr-4 ${className ?? ''}`}>
      <span className="rotulo">{titulo}</span>
      <div className="mt-2">{children}</div>
    </section>
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
    <div className="flex flex-1 flex-col gap-4">
      {/*
        O cabeçalho fixo do caderno: qual propriedade, qual rodada, quanto
        tempo. Fica grudado no topo porque o aluno rola a ficha da ocorrência
        e não pode perder de vista o caixa enquanto decide gastar.
      */}
      <header className="ficha sticky top-0 z-10 flex flex-col gap-3 p-3">
        <div className="flex items-baseline justify-between gap-3">
          <span className="truncate font-maquina text-sm font-bold uppercase tracking-wider text-tinta-900">
            {view.team.name}
          </span>
          <span className="shrink-0 font-maquina text-[0.6875rem] uppercase tracking-[0.12em] text-tinta-500">
            R{view.game.currentRound}/{TOTAL_ROUNDS} · {roundMeta.title}
          </span>
        </div>

        <div className="regua" />

        <IndicatorPanel
          indicators={view.team.state}
          lastEffects={view.lastResolution?.effects ?? null}
          variant="compact"
        />
      </header>

      {property ? (
        <figure className="ficha">
          <PropertyScene
            propertyKey={property.key}
            production={view.team.state.production}
            technology={view.team.state.technology}
            sustainability={view.team.state.sustainability}
          />
        </figure>
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

/** Linha de espera: sempre a mesma marca, para o aluno reconhecer o estado. */
function Aguardando({ children }: { children: React.ReactNode }) {
  return (
    <p className="py-4 text-center font-maquina text-sm uppercase tracking-[0.14em] text-tinta-500 cursor-maquina">
      {children}
    </p>
  );
}

function LobbyScreen({ view }: { view: PlayerView }) {
  const property = PROPERTY_BY_KEY[view.team.propertyKey];

  return (
    <div className="flex flex-col gap-4">
      <Folha titulo="Sua propriedade">
        <h2 className="text-xl uppercase text-tinta-900">{property?.name ?? view.team.name}</h2>
        {property ? (
          <>
            <p className="mt-0.5 font-maquina text-xs uppercase tracking-wider text-tinta-500">
              {property.region}
            </p>
            <p className="mt-2 font-caderno text-sm text-tinta-700">{property.tagline}</p>
            <div className="mt-3 flex flex-col gap-2 border-t border-dashed border-papel-300 pt-3">
              <div>
                <span className="rotulo text-producao">O que ajuda</span>
                <p className="font-caderno text-sm text-tinta-700">{property.strength}</p>
              </div>
              <div>
                <span className="rotulo text-carimbo-600">O que atrapalha</span>
                <p className="font-caderno text-sm text-tinta-700">{property.weakness}</p>
              </div>
            </div>
          </>
        ) : null}
      </Folha>

      <Folha titulo="Sua função na equipe">
        <h3 className="text-lg uppercase text-tinta-900">{ROLE_LABEL[view.player.role]}</h3>
        <p className="mt-1 font-caderno text-sm text-tinta-700">
          {ROLE_MISSION[view.player.role]}
        </p>
      </Folha>

      <Folha titulo="Lista de presença">
        <TeamRoster members={view.teammates} />
      </Folha>

      <Aguardando>Aguardando o professor iniciar</Aguardando>
    </div>
  );
}

function PausedScreen({ view }: { view: PlayerView }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="ficha border-carimbo-500 p-4">
        <span className="rotulo text-carimbo-600">Partida pausada</span>
        <p className="mt-1 font-caderno text-sm text-tinta-900">
          O professor pausou a partida. A rodada continua de onde parou assim que ele retomar.
        </p>
      </div>

      <Folha titulo="Lista de presença">
        <TeamRoster members={view.teammates} />
      </Folha>
    </div>
  );
}

function LockedScreen({ view }: { view: PlayerView }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <RoundTimer endsAt={view.game.roundEndsAt} active />
      </div>

      <DecisionStamp
        optionLabel={view.decision?.optionLabel ?? 'Decisão registrada'}
        round={view.game.currentRound}
      />

      <Folha titulo="Lista de presença">
        <TeamRoster members={view.teammates} />
      </Folha>
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
      <SectionHeading overline="O que aconteceu" title="Consequência da decisão" />

      <article className="ficha ficha-margem py-4 pr-4">
        {resolution.optionLabel ? (
          <p className="font-maquina text-xs uppercase tracking-wider text-tinta-500">
            Lançado: {resolution.optionLabel}
          </p>
        ) : null}

        <p className="mt-2 font-caderno text-base leading-relaxed text-tinta-900">
          {resolution.outcome}
        </p>

        {resolution.notes.length > 0 ? (
          <ul className="mt-3 flex flex-col gap-1.5 border-t border-dashed border-papel-300 pt-3">
            {resolution.notes.map((note, index) => (
              <li key={`${index}-${note}`} className="font-caderno text-sm text-tinta-700">
                {note}
              </li>
            ))}
          </ul>
        ) : null}

        {resolution.effects.length > 0 ? (
          <div className="mt-3 flex flex-col gap-1 border-t border-dashed border-papel-300 pt-3">
            <span className="rotulo mb-1">Lançamentos no caixa e nos índices</span>
            {resolution.effects.map((effect, index) => (
              <LinhaRegistro
                key={`${index}-${effect.indicator}`}
                label={INDICATOR_KEY_LABEL[effect.indicator] ?? effect.indicator}
                value={
                  <span className={effect.delta > 0 ? 'text-sucesso' : effect.delta < 0 ? 'text-carimbo-600' : ''}>
                    {effect.delta > 0 ? '+' : ''}
                    {effect.delta}
                  </span>
                }
              />
            ))}
          </div>
        ) : null}
      </article>

      <Aguardando>A próxima rodada começa em instantes</Aguardando>
    </div>
  );
}

function WaitingRoundScreen({ view }: { view: PlayerView }) {
  return (
    <div className="flex flex-col gap-4">
      <Aguardando>Aguardando a próxima rodada</Aguardando>

      <Folha titulo="Lista de presença">
        <TeamRoster members={view.teammates} />
      </Folha>
    </div>
  );
}

function FinishedScreen({ view }: { view: PlayerView }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="ficha ficha-margem flex flex-col items-center gap-4 py-6 pr-5 text-center">
        <Carimbo detail={`Equipe ${view.team.name}`} bate>
          Safra encerrada
        </Carimbo>
        <p className="font-caderno text-sm text-tinta-700">
          A safra terminou por aqui. O professor vai conduzir o debate com a turma inteira a
          partir dos resultados de cada equipe.
        </p>
      </div>

      <Folha titulo="Fechamento dos índices">
        <IndicatorPanel indicators={view.team.state} variant="full" />
      </Folha>
    </div>
  );
}
