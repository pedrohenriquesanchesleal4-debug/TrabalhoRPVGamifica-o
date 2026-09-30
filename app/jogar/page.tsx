'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
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
import { playerSession, type PlayerSessionData } from '@/lib/client-session';
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
import { Button, Degrau, Meter, Pill, Rotulo, formatMoney } from '@/components/ui/primitives';
import { IndicatorPanel } from '@/components/game/indicator-panel';
import { TeamRoster } from '@/components/game/team-roster';
import { EventCard } from '@/components/game/event-card';
import { RoundTimer } from '@/components/game/round-timer';
import { OpeningSequence } from '@/components/game/opening-sequence';
import { PropertyScene } from '@/components/game/property-scene';
import { CerradoLandscape } from '@/components/game/cerrado-landscape';
import { PROPERTY_BY_KEY } from '@/data/properties';
import { financeIndex } from '@/game/finance-index';

/*
 * A Oficina é um MODO DE JOGO, não um pedaço desta tela: ela só é desenhada
 * quando `session.mode === 'oficina'`, e a partida Diagnóstico — o caso comum,
 * trinta alunos por turma — nunca chega nesse ramo. Mesmo assim o import
 * estático mandava o painel do aluno (42 KB) mais `oficina-map` e
 * `data/oficina-content` (38 KB) para o bundle de quem ia decidir sobre
 * irrigação. Carregar sob demanda tira esse peso do caminho comum.
 *
 * `ssr: false` aqui não custa LCP nenhum, e a checagem é objetiva: esta rota é
 * CLIENT-ONLY desde antes. `playerSession` lê `localStorage`, então no
 * servidor `session` é `null`, o `if (!session) return null` (linha abaixo)
 * encerra a página, e o HTML servido sai com 13,1 KB e ZERO `<svg>` — medido,
 * não presumido. Ou seja: não havia conteúdo de Oficina no SSR para ser
 * perdido. (A paisagem realmente SSR'd vive em `/` e `/entrar`, que têm 15 e
 * 3 SVGs no HTML e não foram tocados aqui.)
 */
const OficinaPlayerApp = dynamic(
  () => import('@/components/oficina/oficina-player').then((mod) => mod.OficinaPlayerApp),
  {
    ssr: false,
    loading: () => <OficinaLoading />,
  },
);

/**
 * SAFRA DF · Tela do aluno — direção V6 "Amanhecer do Cerrado".
 *
 * Central de Operações ao amanhecer: a fazenda é o centro visual, painéis de
 * dado em torno. Momentos cinematográficos: abertura (opening), "DECISÃO
 * REGISTRADA" (mirante dourado), contagem 3-2-1 (entrada sequencial).
 *
 * Mobile-first (360-430px): decisão em 2 toques, alvos ≥44px, sem scroll
 * horizontal obrigatório.
 *
 * Toda a lógica de jogo, contratos de servidor e fluxo de eventos é
 * PRESERVADA. O que muda é apenas a camada visual.
 */

const HEARTBEAT_MS = 45_000;

/**
 * Janela de coalescência do barramento.
 *
 * O mesmo 400 ms que `hooks/use-game-channel.ts` já usa para `teams`: abaixo
 * disso a tela não ganha nada (a resposta traz o estado inteiro, não um
 * delta), acima disso o aluno passa tempo demais vendo rodada velha.
 */
const EVENT_COALESCE_MS = 400;

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
  const [session, setSession] = useState<PlayerSessionData | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const current = playerSession.get();
      if (cancelled) return;
      setSession(current);
      setHydrated(true);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const [view, setView] = useState<PlayerView | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [showOpening, setShowOpening] = useState(false);
  const openingCheckedRef = useRef(false);

  /*
   * Guarda de request em voo.
   *
   * `onEvent` e `onTeamUpdate` podem disparar dois GETs antes do primeiro
   * responder, e o que chegasse por último pintava na tela — inclusive a
   * resposta VELHA, que chegava depois. Cada refresh toma um número de
   * sequência; só a resposta do número ainda vigente é desenhada. É o mesmo
   * contrato do "último a chegar vence" que já existia, corrigido para
   * "o mais NOVO vence".
   *
   * `AbortController` seria o complemento ideal (gasta menos banda), mas
   * `fetchPlayerView` não aceita `signal` e o `request` de `lib/client-api.ts`
   * é privado: dar o sinal exigiria mexer naquele arquivo. Fica registrado
   * aqui como pendência em vez de espalhar um `fetch` cru pela tela e duplicar
   * o tratamento de erro do `RequestError`.
   */
  const requestSeqRef = useRef(0);

  const refresh = useCallback(async () => {
    if (!session || session.mode !== 'diagnostico') return;

    const seq = requestSeqRef.current + 1;
    requestSeqRef.current = seq;

    try {
      const next = await fetchPlayerView(session.token);
      // Respondeu uma requisição que já foi substituída: o estado dela é velho
      // por construção, então descartá-lo é o que evita o dado regredir na tela.
      if (seq !== requestSeqRef.current) return;
      setView(next);
      setLoadError(null);
    } catch (err) {
      if (err instanceof RequestError && (err.code === 'unauthorized' || err.code === 'not_found')) {
        // Fato de sessão, não de estado: vale mesmo que a resposta seja antiga.
        playerSession.clear();
        router.replace('/entrar');
        return;
      }
      if (seq !== requestSeqRef.current) return;
      setLoadError(
        err instanceof Error ? err.message : 'Não foi possível carregar a partida.',
      );
    } finally {
      setLoading(false);
    }
  }, [session, router]);

  useEffect(() => {
    if (!hydrated) return undefined;

    if (!session) {
      router.replace('/entrar');
      return undefined;
    }

    let cancelled = false;

    void (async () => {
      await refresh();
      if (cancelled) return;
    })();

    return () => {
      cancelled = true;
    };
  }, [hydrated, session, router, refresh]);

  /*
   * Coalesce de `onEvent`, no mesmo formato do `use-game-channel.ts`.
   *
   * `game_events` é um ASSINTE de fatos, não de estado: uma rodada aberta,
   * resolvida e o registro de nota chegam como linhas separadas, e o heartbeat
   * dos outros alunos aparece no mesmo canal. Buscar por evento_transformava
   * uma rajada em uma rajada de GETs para a mesma tela. Agendar em 400 ms
   * (o mesmo prazo que o hook já usa para `teams`) reduz o número de buscas
   * sem mudar o que é desenhado: a última ainda traz o estado completo.
   */
  const eventTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const refreshRef = useRef(refresh);

  // O handler vai para ref para que agendar o timer não dependa da identidade
  // de `refresh`, que muda a cada `session`/`router`.
  useEffect(() => {
    refreshRef.current = refresh;
  });

  const scheduleRefresh = useCallback(() => {
    if (eventTimerRef.current) return;
    eventTimerRef.current = setTimeout(() => {
      eventTimerRef.current = null;
      void refreshRef.current();
    }, EVENT_COALESCE_MS);
  }, []);

  // Timer pendente não pode sobreviver ao desmonte: ele dispararia um GET
  // numa tela que já saiu.
  useEffect(() => {
    return () => {
      if (eventTimerRef.current) {
        clearTimeout(eventTimerRef.current);
        eventTimerRef.current = null;
      }
    };
  }, []);

  const { realtimeStatus } = useGameChannel({
    gameId: view?.game.id ?? null,
    onEvent: () => {
      scheduleRefresh();
    },
    onTeamUpdate: () => {
      void refresh();
    },
  });

  const offline = realtimeStatus === 'reconnecting';

  useEffect(() => {
    if (!session || session.mode !== 'diagnostico') return undefined;
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
      // A releitura do aluno suprema o refresh já agendado: deixar os dois
      // dispararia um GET inútil 400 ms depois.
      if (eventTimerRef.current) {
        clearTimeout(eventTimerRef.current);
        eventTimerRef.current = null;
      }
      await refresh();
    },
    [session, refresh],
  );

  if (!session) return null;

  // Modo Oficina Safra DF: tela própria, mesma sessão de aluno.
  if (session.mode === 'oficina') {
    return <OficinaPlayerApp session={session} />;
  }

  return (
    <main className="relative mx-auto flex min-h-dvh w-full max-w-4xl flex-col gap-5 px-4 py-5 sm:px-6">
      {/*
        Paisagem ao fundo: opacidade baixa, não compete com a decisão.

        `animado={false}`: aqui a paisagem é AMBIÊNCIA, não produto — 30 celulares
        por turma pagariam 19 animações em laço infinito por um fundo a 20% de
        opacidade. A home e a abertura mantêm a animação, que é onde a
        ambiência é o que se está vendendo.

        `{!showOpening && …}`: a `OpeningSequence` é `fixed inset-0 z-50` com
        `bg-nevoa-50` opaco e traz a PRÓPRIA paisagem a 40%. Durante os 4,2s
        da abertura, esta cópia aqui fica 100% encoberta — 68 nós e 19
        animações renderizando atrás de um fundo opaco. some de graça.
      */}
      {!showOpening ? (
        <div className="pointer-events-none fixed inset-0 z-0 opacity-20">
          <CerradoLandscape animado={false} />
        </div>
      ) : null}

      {/* Conteúdo acima da paisagem. */}
      <div className="relative z-10 flex flex-1 flex-col gap-5">
        {offline ? (
          <div role="status" aria-live="polite" className="flex items-center justify-center gap-2 py-1">
            <span
              aria-hidden="true"
              className="h-1.5 w-1.5 rounded-full bg-alerta motion-safe:animate-pulse"
            />
            <p className="rotulo text-alerta-texto">
              Conexão instável — reconectando. Os dados desta tela podem estar parados.
            </p>
          </div>
        ) : null}

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
      </div>
    </main>
  );
}

/**
 * Espera do chunk da Oficina.
 *
 * Mesma gramática visual de `app/loading.tsx` (prato `degrau` no meio do breu,
 * rótulo em mono, três barras em `motion-safe:animate-pulse`) para que a troca
 * de tela não seja um salto de idioma. Sem laço infinito de JS: a animação é
 * CSS, então o custo enquanto o chunk viaja é zero.
 */
function OficinaLoading() {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-lg flex-col items-center justify-center gap-6 px-4">
      <Degrau nivel="terraco" familia="neutro" className="flex flex-col items-center gap-5 px-10 py-9">
        <p className="dado text-xs uppercase tracking-[0.22em] text-financas-texto">
          Carregando oficina
        </p>

        <div className="flex items-end gap-1.5" aria-hidden="true">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="block h-4 w-1.5 bg-financas motion-safe:animate-pulse"
              style={{ animationDelay: `${i * 180}ms` }}
            />
          ))}
        </div>

        <Rotulo className="text-terra-500">SAFRA DF · OFICINA</Rotulo>
      </Degrau>

      {/* O aluno precisa saber que a tela está viva, não travada. */}
      <p role="status" className="text-sm text-terra-500">
        Preparando a comunidade da propriedade...
      </p>
    </div>
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
  const roundMeta = currentRoundMeta(view);

  return (
    <div className="flex flex-1 flex-col gap-5">
      {/* h1 sr-only para leitores de tela: contexto da partida sem poluir visual. */}
      <h1 className="sr-only">Partida SAFRA DF — Rodada {view.game.currentRound} de {TOTAL_ROUNDS}</h1>
      {/* Cabeçalho compacto: propriedade à esquerda, rodada + timer à direita. */}
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <Sprout size={18} className="shrink-0 text-verde-700" aria-hidden="true" />
          <div className="flex min-w-0 flex-col">
            <span className="relevo-sm text-terra-900 truncate">{view.team.name}</span>
            {property ? (
              <Rotulo className="truncate">{property.region}</Rotulo>
            ) : null}
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <Pill tone={decisionOpen ? 'ativo' : 'neutro'}>
            RODADA {view.game.currentRound}/{TOTAL_ROUNDS}
          </Pill>
          {view.game.status === 'running' ? (
            <RoundTimer
              endsAt={view.game.roundEndsAt}
              active={view.game.roundStatus === 'active'}
              size="compacto"
            />
          ) : null}
        </div>
      </header>

      {/* Cena principal: a fazenda é o centro. Painel terraco claro. */}
      {property ? (
        <div className="degrau terraco terr-claro p-3 sm:p-4 animate-emergir">
          <PropertyScene
            propertyKey={property.key}
            production={view.team.state.production}
            technology={view.team.state.technology}
            sustainability={view.team.state.sustainability}
          />
        </div>
      ) : null}

      {/* Indicadores: 4 colunas em bancos, rótulos curtos. */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
        <IndicadorBanco
          kind="financas"
          label="FINANÇAS"
          value={financeIndex(view.team.state.cash)}
          display={formatMoney(view.team.state.cash)}
          delta={view.lastResolution?.effects?.find((e) => e.indicator === 'cash')?.delta}
        />
        <IndicadorBanco
          kind="producao"
          label="PRODUÇÃO"
          value={view.team.state.production}
          display={String(Math.round(view.team.state.production))}
          delta={view.lastResolution?.effects?.find((e) => e.indicator === 'production')?.delta}
        />
        <IndicadorBanco
          kind="tecnologia"
          label="TECNOLOGIA"
          value={view.team.state.technology}
          display={String(Math.round(view.team.state.technology))}
          delta={view.lastResolution?.effects?.find((e) => e.indicator === 'technology')?.delta}
        />
        <IndicadorBanco
          kind="sustentabilidade"
          label="SUSTENT."
          value={view.team.state.sustainability}
          display={String(Math.round(view.team.state.sustainability))}
          delta={view.lastResolution?.effects?.find((e) => e.indicator === 'sustainability')?.delta}
        />
      </div>

      <StatusBody view={view} onConfirm={onConfirm} roundMeta={roundMeta} />
    </div>
  );
}

/**
 * Indicador isolado em `banco`: canal + valor em coluna, sem o wrapper de
 * `Meter` que vem com o `IndicatorPanel`. Mantém a mesma acessibilidade
 * (role="meter", aria-valuenow/label).
 */
function IndicadorBanco({
  kind,
  label,
  value,
  display,
  delta,
}: {
  kind: 'financas' | 'producao' | 'tecnologia' | 'sustentabilidade';
  label: string;
  value: number;
  display: string;
  delta?: number | null;
}) {
  return (
    <div className="degrau banco terr-claro flex flex-col items-center gap-1.5 p-3 text-center">
      <Meter kind={kind} label={label} value={value} display={display} delta={delta} size="compacto" />
    </div>
  );
}

function StatusBody({
  view,
  onConfirm,
  roundMeta,
}: {
  view: PlayerView;
  onConfirm: (optionKey: string) => Promise<void>;
  roundMeta: { index: number; title: string; subtitle: string };
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
        {/* Timer em destaque quando decisão está aberta. */}
        <div className="flex justify-end">
          <RoundTimer
            endsAt={view.game.roundEndsAt}
            active={view.game.roundStatus === 'active'}
            size="destaque"
          />
        </div>

        {/*
          A `key` pela carta da rodada zera a seleção pendente quando o
          evento muda: o React descarta a carta antiga e monta a nova limpa.
        */}
        <EventCard
          key={`${view.game.currentRound}:${view.event.key}`}
          event={{
            title: view.event.title,
            narrative: view.event.narrative,
            options: view.event.options,
            roleHint: view.event.roleHint,
          }}
          roundLabel={`RODADA ${view.game.currentRound} · ${roundMeta.title}`}
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
        <Rotulo className="text-(--cor-tinta-panel-verde)">Sua propriedade</Rotulo>
        <h2 className="relevo-md text-white">{property?.name ?? view.team.name}</h2>
        {property ? (
          <>
            <p className="text-sm text-(--cor-tinta-panel-verde)">{property.region}</p>
            <p className="text-base leading-[1.6] text-white">{property.tagline}</p>
            <dl className="mt-1 flex flex-col gap-1.5 text-sm text-(--cor-tinta-panel-amena)">
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
    <div className="flex flex-col gap-4" aria-live="polite">
      <div className="degrau mirante terr-azul animate-emergir flex items-start gap-3 p-5">
        <PauseCircle size={22} className="mt-0.5 shrink-0 text-azul-300" aria-hidden="true" />
        <div className="flex flex-col gap-1">
          <Rotulo className="text-azul-300">Partida pausada</Rotulo>
          <p className="text-sm font-medium text-azul-300">
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

/**
 * Tela "DECISÃO REGISTRADA" — momento de destaque na sessão.
 *
 * `mirante terr-financas`: painel dourado, o único mirante da tela de decisão.
 * Texto claro (`verde-300`) sobre painel tingido (lição V5: variante escura
 * falha contraste). `.travado` + `animate-emergir` no corpo.
 */
function LockedScreen({ view }: { view: PlayerView }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <RoundTimer endsAt={view.game.roundEndsAt} active size="destaque" />
      </div>

      {/* aria-live aqui, fora do timer: anuncia o registro sem ecoar o tique. */}
      <div className="degrau mirante terr-financas animate-emergir relative flex flex-col gap-3 p-5" aria-live="polite">
        <CircleCheck size={22} className="absolute right-4 top-4 text-financas-texto" aria-hidden="true" />
        <Rotulo className="text-financas-texto">DECISÃO REGISTRADA</Rotulo>
        <p className="relevo-sm pr-8 text-financas-texto">{view.decision?.optionLabel}</p>
        <div aria-hidden="true" className="filete-amanhecer" />
        <p className="text-sm text-terra-700">
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

/**
 * Tela de resolução da rodada.
 *
 * "A DECISÃO FOI TOMADA." + contagem 3-2-1 em `.dado-xl` entrando por
 * `animate-emergir` sequencial com delays. Contagem única, não laço.
 */
function ResolutionScreen({ view }: { view: PlayerView }) {
  const resolution = view.lastResolution;
  if (!resolution) return null;

  return (
    <div className="flex flex-col gap-4" aria-live="polite">
      {/* Contagem regressiva 3-2-1: entrada sequencial, contagem única. */}
      <div className="flex flex-col items-center gap-2 py-4">
        <p className="rotulo text-(--cor-tinta-panel-dourado)">A DECISÃO FOI TOMADA</p>
        <div className="flex items-center gap-4">
          {[3, 2, 1].map((n, i) => (
            <span
              key={n}
              className="dado-xl text-(--cor-tinta-panel) animate-emergir"
              style={{ animationDelay: `${i * 420}ms` }}
            >
              {n}
            </span>
          ))}
        </div>
        <div aria-hidden="true" className="filete-amanhecer mt-1 w-32" />
      </div>

      {/* Resultado em mirante: o veredito da rodada. */}
      <div className="degrau mirante terr-fundo-azul animate-emergir flex flex-col gap-2 p-5">
        <Rotulo className="text-(--cor-tinta-panel-azul)">O que aconteceu</Rotulo>
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
                      ? 'text-alerta-texto'
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
    <div className="flex flex-col gap-4" aria-live="polite">
      <div className="degrau mirante terr-fundo-verde animate-emergir flex flex-col gap-2 p-5">
        <Rotulo className="text-(--cor-tinta-panel-verde)">Partida encerrada</Rotulo>
        <p className="relevo-md text-white">
          A safra da equipe {view.team.name} terminou por aqui.
        </p>
        <p className="text-sm text-terra-700">
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
