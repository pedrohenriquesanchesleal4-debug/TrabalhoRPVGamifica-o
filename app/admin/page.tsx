'use client';

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  ChevronDown,
  ExternalLink,
  Pause,
  Play,
  Power,
  RefreshCcw,
  RotateCcw,
  Settings2,
  Users,
} from 'lucide-react';
import {
  createGame,
  fetchHostView,
  runHostAction,
  RequestError,
  type HostAction,
  type HostActionResponse,
} from '@/lib/client-api';
import { hostSession } from '@/lib/client-session';
import { useGameChannel } from '@/hooks/use-game-channel';
import { Button, Field, Pill, SectionHeading } from '@/components/ui/primitives';
import { TeamBoard } from '@/components/host/team-board';
import { DEFAULT_CONFIG, ROUND_META, TOTAL_ROUNDS } from '@/types/game';
import type { HostView } from '@/lib/game-service';

/**
 * Painel de controle do professor.
 *
 * Duas telas dentro de uma: sem partida salva, a única decisão é "criar
 * partida" (a configuração fica escondida atrás de um painel opcional, porque
 * a maioria das aulas usa o padrão). Com partida, tudo gira em torno do
 * código para projetar e de quatro ou cinco botões de controle, cada um
 * explicando por texto por que está desabilitado quando está.
 */

type Phase = 'checking' | 'no_session' | 'ready' | 'session_invalid';

export default function AdminPage() {
  const [phase, setPhase] = useState<Phase>('checking');
  const [gameId, setGameId] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [code, setCode] = useState<string | null>(null);
  const [view, setView] = useState<HostView | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [lastOutcomes, setLastOutcomes] = useState<HostActionResponse['outcomes']>(null);

  const loadView = useCallback(async (id: string, hostToken: string) => {
    try {
      const nextView = await fetchHostView(id, hostToken);
      setView(nextView);
      setLoadError(null);
    } catch (error) {
      if (error instanceof RequestError && (error.code === 'unauthorized' || error.code === 'not_found')) {
        hostSession.clear();
        setPhase('session_invalid');
        return;
      }
      setLoadError(error instanceof Error ? error.message : 'Não foi possível carregar a partida.');
    }
  }, []);

  // A sessão do professor mora no localStorage, então só pode ser lida depois
  // da hidratação. A leitura acontece dentro de uma função assíncrona local
  // para não disparar setState de forma sincrona no corpo do efeito, que
  // causaria renderização em cascata.
  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const session = hostSession.get();
      if (cancelled) return;

      if (!session) {
        setPhase('no_session');
        return;
      }

      setGameId(session.gameId);
      setToken(session.token);
      setCode(session.code);
      setPhase('ready');

      await loadView(session.gameId, session.token);
    })();

    return () => {
      cancelled = true;
    };
  }, [loadView]);

  useGameChannel({
    gameId: phase === 'ready' ? gameId : null,
    onEvent: () => {
      if (gameId && token) void loadView(gameId, token);
    },
    onTeamUpdate: () => {
      if (gameId && token) void loadView(gameId, token);
    },
  });

  function handleCreated(result: {
    gameId: string;
    token: string;
    code: string;
  }) {
    hostSession.set({ token: result.token, gameId: result.gameId, code: result.code });
    setGameId(result.gameId);
    setToken(result.token);
    setCode(result.code);
    setPhase('ready');
    void loadView(result.gameId, result.token);
  }

  if (phase === 'checking') {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-areia-100">
        <p className="text-mata-600">Carregando painel...</p>
      </main>
    );
  }

  if (phase === 'no_session' || phase === 'session_invalid') {
    return (
      <CreateGameScreen
        expired={phase === 'session_invalid'}
        onCreated={handleCreated}
      />
    );
  }

  if (!gameId || !token || !code) {
    return null;
  }

  return (
    <ControlPanel
      gameId={gameId}
      token={token}
      code={code}
      view={view}
      loadError={loadError}
      lastOutcomes={lastOutcomes}
      onOutcomes={setLastOutcomes}
      onReload={() => void loadView(gameId, token)}
      onReset={() => {
        hostSession.clear();
        setPhase('no_session');
        setView(null);
        setLastOutcomes(null);
      }}
    />
  );
}

// ---------------------------------------------------------------------------
// Tela: sem partida salva
// ---------------------------------------------------------------------------

function CreateGameScreen({
  expired,
  onCreated,
}: {
  expired: boolean;
  onCreated: (result: { gameId: string; token: string; code: string }) => void;
}) {
  const [customize, setCustomize] = useState(false);
  const [initialBudget, setInitialBudget] = useState(DEFAULT_CONFIG.initialBudget);
  const [roundSeconds, setRoundSeconds] = useState(DEFAULT_CONFIG.roundSeconds);
  const [teamCount, setTeamCount] = useState(DEFAULT_CONFIG.teamCount);
  const [finances, setFinances] = useState(DEFAULT_CONFIG.weights.finances);
  const [production, setProduction] = useState(DEFAULT_CONFIG.weights.production);
  const [technology, setTechnology] = useState(DEFAULT_CONFIG.weights.technology);
  const [sustainability, setSustainability] = useState(DEFAULT_CONFIG.weights.sustainability);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const weightSum = finances + production + technology + sustainability;

  async function handleCreate() {
    setCreating(true);
    setError(null);
    try {
      const result = await createGame(
        customize
          ? {
              initialBudget,
              roundSeconds,
              teamCount,
              weights: { finances, production, technology, sustainability },
            }
          : {},
      );
      onCreated({ gameId: result.gameId, token: result.hostToken, code: result.code });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível criar a partida.');
    } finally {
      setCreating(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col justify-center gap-8 px-6 py-16">
      <div className="flex flex-col gap-2">
        <span className="rotulo">SAFRA DF · Painel do professor</span>
        <h1 className="text-4xl text-mata-900">Criar uma nova partida</h1>
        <p className="max-w-prose text-mata-600">
          A turma vai entrar pelo celular com um código. Você controla o ritmo das cinco rodadas
          por esta tela, projetada em telão ou não.
        </p>
      </div>

      {expired ? (
        <div className="carta flex items-center gap-3 border-l-4 border-l-alerta p-4">
          <AlertTriangle className="shrink-0 text-alerta" size={20} aria-hidden />
          <p className="text-sm text-mata-700">
            A partida salva neste navegador não existe mais ou o acesso expirou. Crie uma nova
            partida para continuar.
          </p>
        </div>
      ) : null}

      <Button
        variant="principal"
        size="grande"
        onClick={() => void handleCreate()}
        disabled={creating || (customize && weightSum !== 100)}
        className="text-lg"
      >
        {creating ? 'Criando partida...' : 'Criar partida'}
      </Button>

      {error ? (
        <p role="alert" className="text-sm text-alerta">
          {error}
        </p>
      ) : null}

      <div className="faixa-terra" />

      <button
        type="button"
        onClick={() => setCustomize((value) => !value)}
        className="flex items-center gap-2 self-start text-sm font-medium text-mata-700 hover:text-mata-900"
        aria-expanded={customize}
      >
        <Settings2 size={16} aria-hidden />
        Configuração opcional
        <ChevronDown
          size={16}
          aria-hidden
          className={customize ? 'rotate-180 transition-transform' : 'transition-transform'}
        />
      </button>

      {customize ? (
        <div className="carta flex flex-col gap-5 p-6">
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
            <Field
              label="Orçamento inicial (R$)"
              type="number"
              min={10_000}
              max={1_000_000}
              step={1_000}
              value={initialBudget}
              onChange={(event) => setInitialBudget(Number(event.target.value))}
            />
            <Field
              label="Segundos por rodada"
              type="number"
              min={30}
              max={900}
              step={10}
              value={roundSeconds}
              onChange={(event) => setRoundSeconds(Number(event.target.value))}
              hint="180 segundos costuma bastar para a discussão em grupo."
            />
            <Field
              label="Número de equipes"
              type="number"
              min={1}
              max={6}
              value={teamCount}
              onChange={(event) => setTeamCount(Number(event.target.value))}
              hint="Até 6, uma por propriedade."
            />
          </div>

          <div className="flex flex-col gap-3">
            <span className="rotulo">Pesos do ranking final (some 100)</span>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <Field
                label="Finanças"
                type="number"
                min={0}
                max={100}
                value={finances}
                onChange={(event) => setFinances(Number(event.target.value))}
              />
              <Field
                label="Produção"
                type="number"
                min={0}
                max={100}
                value={production}
                onChange={(event) => setProduction(Number(event.target.value))}
              />
              <Field
                label="Tecnologia"
                type="number"
                min={0}
                max={100}
                value={technology}
                onChange={(event) => setTechnology(Number(event.target.value))}
              />
              <Field
                label="Sustentabilidade"
                type="number"
                min={0}
                max={100}
                value={sustainability}
                onChange={(event) => setSustainability(Number(event.target.value))}
              />
            </div>
            <p className={`tabular text-sm ${weightSum === 100 ? 'text-mata-600' : 'text-alerta'}`}>
              Soma atual: {weightSum}{weightSum !== 100 ? ' · precisa somar exatamente 100' : ''}
            </p>
          </div>
        </div>
      ) : null}
    </main>
  );
}

// ---------------------------------------------------------------------------
// Tela: partida em andamento
// ---------------------------------------------------------------------------

interface DisabledReason {
  disabled: boolean;
  reason: string | null;
}

function computeActionState(view: HostView): Record<HostAction, DisabledReason> {
  const { game } = view;

  const startRound: DisabledReason = (() => {
    if (game.status === 'finished') return { disabled: true, reason: 'A partida já terminou.' };
    if (game.status === 'paused')
      return { disabled: true, reason: 'Retome a partida antes de abrir uma rodada.' };
    if (game.roundStatus === 'active')
      return { disabled: true, reason: 'A rodada atual ainda está aberta.' };
    if (game.currentRound >= TOTAL_ROUNDS)
      return { disabled: true, reason: 'As 5 rodadas já foram jogadas. Encerre a partida.' };
    return { disabled: false, reason: null };
  })();

  const resolveRound: DisabledReason = (() => {
    if (game.status === 'finished') return { disabled: true, reason: 'A partida já terminou.' };
    if (game.status === 'paused')
      return { disabled: true, reason: 'Retome a partida antes de resolver a rodada.' };
    if (game.roundStatus !== 'active')
      return { disabled: true, reason: 'Abra uma rodada antes de resolver.' };
    return { disabled: false, reason: null };
  })();

  const pause: DisabledReason =
    game.status === 'running'
      ? { disabled: false, reason: null }
      : { disabled: true, reason: 'Só é possível pausar uma partida em andamento.' };

  const resume: DisabledReason =
    game.status === 'paused'
      ? { disabled: false, reason: null }
      : { disabled: true, reason: 'A partida não está pausada.' };

  const finish: DisabledReason =
    game.status === 'finished'
      ? { disabled: true, reason: 'A partida já foi encerrada.' }
      : { disabled: false, reason: null };

  const reset: DisabledReason = { disabled: false, reason: null };

  return {
    start_round: startRound,
    resolve_round: resolveRound,
    pause,
    resume,
    finish,
    reset,
  };
}

function ControlPanel({
  gameId,
  token,
  code,
  view,
  loadError,
  lastOutcomes,
  onOutcomes,
  onReload,
  onReset,
}: {
  gameId: string;
  token: string;
  code: string;
  view: HostView | null;
  loadError: string | null;
  lastOutcomes: HostActionResponse['outcomes'];
  onOutcomes: (outcomes: HostActionResponse['outcomes']) => void;
  onReload: () => void;
  onReset: () => void;
}) {
  const [pending, setPending] = useState<HostAction | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [confirmFinish, setConfirmFinish] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);

  const actionStates = useMemo(() => (view ? computeActionState(view) : null), [view]);

  async function run(action: HostAction, remainingSeconds?: number) {
    setPending(action);
    setActionError(null);
    try {
      const result = await runHostAction(gameId, token, action, remainingSeconds);
      onOutcomes(result.outcomes);
      onReload();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'A ação não pôde ser concluída.');
    } finally {
      setPending(null);
    }
  }

  function handleResume() {
    if (!view) return;
    const endsAt = view.game.roundEndsAt;
    if (view.game.roundStatus === 'active' && endsAt) {
      const remaining = Math.max(0, Math.round((new Date(endsAt).getTime() - Date.now()) / 1000));
      void run('resume', remaining);
      return;
    }
    void run('resume');
  }

  if (loadError && !view) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-xl flex-col items-center justify-center gap-4 px-6 text-center">
        <AlertTriangle className="text-alerta" size={28} aria-hidden />
        <p className="text-mata-700">{loadError}</p>
        <Button variant="secundario" onClick={onReload}>
          <RefreshCcw size={16} aria-hidden />
          Tentar de novo
        </Button>
      </main>
    );
  }

  if (!view) {
    return (
      <main className="flex min-h-dvh items-center justify-center">
        <p className="text-mata-600">Carregando a partida...</p>
      </main>
    );
  }

  const { game } = view;
  const phase = game.phase ? ROUND_META[game.phase] : null;
  const connectedCount = view.teams.reduce(
    (total, team) => total + team.players.filter((player) => player.connected).length,
    0,
  );

  return (
    <main className="mx-auto flex min-h-dvh max-w-6xl flex-col gap-8 px-6 py-10">
      <header className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-2">
          <span className="rotulo">SAFRA DF · Painel do professor</span>
          <div className="flex items-baseline gap-4">
            <span className="rotulo">Código</span>
            <span className="tabular text-6xl font-semibold tracking-[0.08em] text-mata-900">
              {code}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Pill tone={game.status === 'running' ? 'ativo' : game.status === 'paused' ? 'alerta' : 'neutro'}>
              {STATUS_LABEL[game.status]}
            </Pill>
            {phase ? (
              <Pill tone="neutro">
                Rodada {phase.index} de {TOTAL_ROUNDS} · {phase.title}
              </Pill>
            ) : (
              <Pill tone="neutro">Nenhuma rodada aberta</Pill>
            )}
            <Pill tone="neutro">
              <Users size={13} aria-hidden />
              {connectedCount} conectados · {view.playerCount} entraram
            </Pill>
            <Pill tone={view.decidedTeams === view.teams.length && view.teams.length > 0 ? 'pronto' : 'neutro'}>
              {view.decidedTeams} de {view.teams.length} equipes decidiram
            </Pill>
          </div>
        </div>

        <div className="flex flex-col gap-2 sm:items-end">
          <Link
            href={`/host/${gameId}`}
            target="_blank"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-mata-700 hover:text-mata-900"
          >
            Abrir projeção <ExternalLink size={14} aria-hidden />
          </Link>
          <Link
            href={`/host/${gameId}/diagnostico`}
            target="_blank"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-mata-700 hover:text-mata-900"
          >
            Abrir diagnóstico da turma <ExternalLink size={14} aria-hidden />
          </Link>
          <Link
            href={`/host/${gameId}/resultado`}
            target="_blank"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-mata-700 hover:text-mata-900"
          >
            Abrir resultado <ExternalLink size={14} aria-hidden />
          </Link>
        </div>
      </header>

      <section className="carta flex flex-col gap-4 p-6">
        <SectionHeading overline="Controle da partida" title="O que fazer agora" />

        {actionError ? (
          <p role="alert" className="text-sm text-alerta">
            {actionError}
          </p>
        ) : null}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <ActionButton
            label={game.currentRound === 0 ? 'Iniciar rodada 1' : `Abrir rodada ${game.currentRound + 1}`}
            icon={<Play size={18} aria-hidden />}
            variant="principal"
            state={actionStates?.start_round}
            pending={pending === 'start_round'}
            onClick={() => void run('start_round')}
          />
          <ActionButton
            label="Resolver rodada"
            icon={<RefreshCcw size={18} aria-hidden />}
            variant="principal"
            state={actionStates?.resolve_round}
            pending={pending === 'resolve_round'}
            onClick={() => void run('resolve_round')}
          />
          <ActionButton
            label="Pausar"
            icon={<Pause size={18} aria-hidden />}
            variant="secundario"
            state={actionStates?.pause}
            pending={pending === 'pause'}
            onClick={() => void run('pause')}
          />
          <ActionButton
            label="Retomar"
            icon={<Play size={18} aria-hidden />}
            variant="secundario"
            state={actionStates?.resume}
            pending={pending === 'resume'}
            onClick={handleResume}
          />
        </div>

        <div className="faixa-terra" />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            {!confirmFinish ? (
              <Button
                variant="perigo"
                onClick={() => setConfirmFinish(true)}
                disabled={actionStates?.finish.disabled}
                title={actionStates?.finish.reason ?? undefined}
              >
                <Power size={16} aria-hidden />
                Encerrar partida
              </Button>
            ) : (
              <div className="carta flex flex-col gap-2 border-l-4 border-l-alerta p-4">
                <p className="text-sm text-mata-700">
                  Encerrar calcula o resultado final e trava novas decisões. Confirma?
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="perigo"
                    onClick={() => {
                      setConfirmFinish(false);
                      void run('finish');
                    }}
                  >
                    Sim, encerrar
                  </Button>
                  <Button variant="silencioso" onClick={() => setConfirmFinish(false)}>
                    Cancelar
                  </Button>
                </div>
              </div>
            )}
            {actionStates?.finish.reason ? (
              <p className="text-xs text-mata-500">{actionStates.finish.reason}</p>
            ) : null}
          </div>

          <div className="flex flex-col gap-2">
            {!confirmReset ? (
              <Button variant="perigo" onClick={() => setConfirmReset(true)}>
                <RotateCcw size={16} aria-hidden />
                Reiniciar partida
              </Button>
            ) : (
              <div className="carta flex flex-col gap-2 border-l-4 border-l-alerta p-4">
                <p className="text-sm text-mata-700">
                  Reiniciar apaga rodadas, decisões e resultado, e devolve os indicadores ao
                  início. As equipes e os jogadores continuam conectados. Confirma?
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="perigo"
                    onClick={() => {
                      setConfirmReset(false);
                      onOutcomes(null);
                      void run('reset');
                    }}
                  >
                    Sim, reiniciar
                  </Button>
                  <Button variant="silencioso" onClick={() => setConfirmReset(false)}>
                    Cancelar
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={onReset}
          className="self-start text-xs text-mata-500 underline-offset-2 hover:underline"
        >
          Esquecer esta partida neste navegador
        </button>
      </section>

      {lastOutcomes && lastOutcomes.length > 0 ? (
        <section className="carta flex flex-col gap-4 p-6">
          <SectionHeading
            overline="Última rodada resolvida"
            title="O que aconteceu com cada equipe"
          />
          <ul className="flex flex-col gap-3">
            {lastOutcomes.map((outcome) => (
              <li key={outcome.teamId} className="border-t border-areia-200 pt-3 first:border-t-0 first:pt-0">
                <p className="text-base text-mata-900">
                  <span className="font-semibold">{outcome.teamName}:</span> {outcome.outcome}
                </p>
                {outcome.effects.length > 0 ? (
                  <p className="tabular mt-1 flex flex-wrap gap-x-3 text-sm text-mata-700">
                    {outcome.effects.map((effect) => (
                      <span key={effect.indicator}>
                        {effect.indicator}: {effect.delta > 0 ? '+' : ''}
                        {effect.delta}
                      </span>
                    ))}
                  </p>
                ) : null}
                {outcome.notes.length > 0 ? (
                  <ul className="mt-1 list-inside list-disc text-sm text-mata-600">
                    {outcome.notes.map((note, index) => (
                      <li key={index}>{note}</li>
                    ))}
                  </ul>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="flex flex-col gap-4">
        <SectionHeading
          overline="Equipes"
          title={`${view.teams.length} equipes se formando`}
          description="Visão privada do professor: aqui a decisão de cada equipe aparece assim que confirmada, mesmo com a rodada aberta."
        />
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {view.teams.map((team) => (
            <TeamBoard
              key={team.id}
              team={team}
              initialBudget={game.config.initialBudget}
              revealDecision
              dense
            />
          ))}
        </div>
      </section>
    </main>
  );
}

const STATUS_LABEL: Record<HostView['game']['status'], string> = {
  lobby: 'Aguardando jogadores',
  running: 'Em andamento',
  paused: 'Pausada',
  finished: 'Encerrada',
};

function ActionButton({
  label,
  icon,
  variant,
  state,
  pending,
  onClick,
}: {
  label: string;
  icon: ReactNode;
  variant: 'principal' | 'secundario';
  state?: DisabledReason;
  pending: boolean;
  onClick: () => void;
}) {
  const disabled = pending || state?.disabled === true;

  return (
    <div className="flex flex-col gap-1.5">
      <Button
        variant={variant}
        size="grande"
        onClick={onClick}
        disabled={disabled}
        title={state?.reason ?? undefined}
      >
        {icon}
        {pending ? 'Aguarde...' : label}
      </Button>
      {state?.reason ? <p className="text-xs text-mata-500">{state.reason}</p> : null}
    </div>
  );
}
