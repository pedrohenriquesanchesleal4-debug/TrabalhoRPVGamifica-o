'use client';

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { Pause, Play, Power, RefreshCcw, RotateCcw } from 'lucide-react';
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
import { Button, Field, LinhaRegistro, Pill, SectionHeading } from '@/components/ui/primitives';
import { TeamBoard } from '@/components/host/team-board';
import { DEFAULT_CONFIG, ROUND_META, ROUND_PHASES, TOTAL_ROUNDS } from '@/types/game';
import type { HostView } from '@/lib/game-service';

/**
 * O caderno de bordo do professor.
 *
 * Duas telas dentro de uma: sem partida salva, a única decisão é "abrir a
 * safra" (a configuração fica dobrada atrás de um painel opcional, porque a
 * maioria das aulas usa o padrão). Com partida, tudo gira em torno do código
 * para projetar e de quatro ou cinco botões de controle, cada um explicando
 * por texto por que está desabilitado quando está.
 *
 * Esta é a única tela do projeto com ícone: o professor opera sob pressão, com
 * a turma esperando, e a forma do triângulo de "iniciar" é reconhecida mais
 * rápido do que a palavra.
 */

type Phase = 'checking' | 'no_session' | 'ready' | 'session_invalid';

/**
 * As cinco rodadas listadas na folha de abertura.
 *
 * Sai de `ROUND_META` de propósito: mudar o nome de uma fase no conteúdo muda
 * aqui também, sem ninguém precisar lembrar de editar dois arquivos.
 */
const ROTEIRO = ROUND_PHASES.map((phase) => ({
  titulo: ROUND_META[phase].title,
  nota: ROUND_META[phase].subtitle,
}));

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
      <main className="flex min-h-dvh items-center justify-center">
        <p className="font-maquina text-sm uppercase tracking-[0.14em] text-tinta-500 cursor-maquina">
          Abrindo o caderno de bordo
        </p>
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
    <main className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col px-4 py-6 sm:px-8 sm:py-10">
      <div className="ficha ficha-furos flex flex-1 flex-col pl-6 pr-5 py-6 sm:pl-10 sm:pr-9 sm:py-9">
        <span className="rotulo text-carimbo-600">Safra DF · caderno de bordo</span>
        <h1 className="mt-1 text-3xl uppercase leading-tight text-tinta-900 sm:text-5xl">
          Abrir uma nova safra
        </h1>
        <p className="mt-3 max-w-prose font-caderno text-base text-tinta-700">
          A turma entra pelo celular com um código. Você controla o ritmo das cinco rodadas por
          esta tela, projetada em telão ou não.
        </p>

        {expired ? (
          <p className="mt-5 border border-carimbo-500 px-4 py-3 font-caderno text-sm text-tinta-900">
            <span className="rotulo block text-carimbo-600">Sessão perdida</span>
            A partida salva neste navegador não existe mais ou o acesso expirou. Abra uma nova
            safra para continuar.
          </p>
        ) : null}

        <div className="regua my-7" />

        <Button
          variant="principal"
          size="grande"
          onClick={() => void handleCreate()}
          disabled={creating || (customize && weightSum !== 100)}
          className="w-full text-lg"
        >
          {creating ? 'Abrindo a safra...' : 'Abrir a safra'}
        </Button>

        {error ? (
          <p role="alert" className="mt-3 font-maquina text-sm text-carimbo-600">
            {error}
          </p>
        ) : null}

        <div className="regua my-7" />

        <button
          type="button"
          onClick={() => setCustomize((value) => !value)}
          className="flex items-center gap-2 font-maquina text-sm font-bold uppercase tracking-[0.12em] text-tinta-700 hover:text-tinta-900"
          aria-expanded={customize}
        >
          <span aria-hidden="true">{customize ? '[×]' : '[ ]'}</span>
          Ajustar orçamento, tempo e pesos
        </button>

        {!customize ? (
          <div className="mt-7 flex flex-col">
            <span className="rotulo">Roteiro da partida</span>
            <ol className="mt-2 flex flex-col">
              {ROTEIRO.map((item, index) => (
                <li
                  key={item.titulo}
                  className="flex items-baseline gap-3 border-t border-dotted border-papel-300 py-2 first:border-t-0"
                >
                  <span className="tabular shrink-0 text-sm text-tinta-400">
                    R{index + 1}
                  </span>
                  <span className="font-maquina text-sm font-bold uppercase tracking-wider text-tinta-900">
                    {item.titulo}
                  </span>
                  <span className="pontilhado" aria-hidden="true" />
                  <span className="shrink-0 font-caderno text-sm text-tinta-500">
                    {item.nota}
                  </span>
                </li>
              ))}
            </ol>
          </div>
        ) : null}

        {customize ? (
          <div className="mt-5 flex flex-col gap-6 border-t border-dashed border-papel-300 pt-5">
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
              <p
                className={`tabular text-sm ${weightSum === 100 ? 'text-tinta-500' : 'text-carimbo-600'}`}
              >
                Soma atual: {weightSum}
                {weightSum !== 100 ? ' · precisa somar exatamente 100' : ''}
              </p>
            </div>
          </div>
        ) : null}
      </div>
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
        <span className="rotulo text-carimbo-600">Falhou</span>
        <p className="font-caderno text-tinta-700">{loadError}</p>
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
        <p className="font-maquina text-sm uppercase tracking-[0.14em] text-tinta-500 cursor-maquina">
          Carregando a partida
        </p>
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
    <main className="mx-auto flex min-h-dvh w-full max-w-6xl flex-col gap-6 px-4 py-6 sm:px-8 sm:py-10">
      {/*
        O bloco de cabeçalho do caderno de bordo: código enorme à esquerda,
        porque é o dado que a turma inteira precisa ler; estado e atalhos à
        direita, porque são para uma pessoa só, a um braço de distância.
      */}
      <header className="ficha flex flex-col gap-5 p-5 sm:flex-row sm:items-start sm:justify-between sm:p-6">
        <div className="flex flex-col gap-3">
          <span className="rotulo text-carimbo-600">Safra DF · caderno de bordo</span>

          <div className="flex flex-col">
            <span className="rotulo">Código da partida</span>
            <span
              data-testid="game-code"
              className="tabular text-5xl font-bold leading-none tracking-[0.12em] text-tinta-900 sm:text-7xl"
            >
              {code}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Pill tone={game.status === 'running' ? 'ativo' : game.status === 'paused' ? 'alerta' : 'neutro'}>
              {STATUS_LABEL[game.status]}
            </Pill>
            {phase ? (
              <Pill tone="neutro">
                R{phase.index}/{TOTAL_ROUNDS} · {phase.title}
              </Pill>
            ) : (
              <Pill tone="neutro">Nenhuma rodada aberta</Pill>
            )}
            <Pill tone="neutro">
              {connectedCount} conectados · {view.playerCount} entraram
            </Pill>
            <Pill tone={view.decidedTeams === view.teams.length && view.teams.length > 0 ? 'pronto' : 'neutro'}>
              {view.decidedTeams} de {view.teams.length} equipes decidiram
            </Pill>
          </div>
        </div>

        <nav aria-label="Telas de projeção" className="flex shrink-0 flex-col gap-1 sm:items-end">
          <span className="rotulo">Abrir no telão</span>
          {[
            { href: `/host/${gameId}`, label: 'Projeção da partida' },
            { href: `/host/${gameId}/diagnostico`, label: 'Diagnóstico da turma' },
            { href: `/host/${gameId}/resultado`, label: 'Resultado e debate' },
          ].map((item) => (
            <Link
              key={item.href}
              href={item.href}
              target="_blank"
              className="font-maquina text-sm text-tinta-700 underline decoration-dotted underline-offset-4 hover:text-carimbo-600"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </header>

      <section className="ficha ficha-margem py-5 pr-5">
        <SectionHeading overline="Controle da partida" title="O que fazer agora" />

        {actionError ? (
          <p role="alert" className="mt-4 font-maquina text-sm text-carimbo-600">
            {actionError}
          </p>
        ) : null}

        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
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

        <div className="regua my-5" />

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
              <div className="border border-carimbo-500 p-4">
                <p className="font-caderno text-sm text-tinta-900">
                  Encerrar calcula o resultado final e trava novas decisões. Confirma?
                </p>
                <div className="mt-3 flex gap-2">
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
              <p className="font-maquina text-xs text-tinta-400">{actionStates.finish.reason}</p>
            ) : null}
          </div>

          <div className="flex flex-col gap-2">
            {!confirmReset ? (
              <Button variant="perigo" onClick={() => setConfirmReset(true)}>
                <RotateCcw size={16} aria-hidden />
                Reiniciar partida
              </Button>
            ) : (
              <div className="border border-carimbo-500 p-4">
                <p className="font-caderno text-sm text-tinta-900">
                  Reiniciar apaga rodadas, decisões e resultado, e devolve os indicadores ao
                  início. As equipes e os jogadores continuam conectados. Confirma?
                </p>
                <div className="mt-3 flex gap-2">
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
          className="mt-4 font-maquina text-xs uppercase tracking-wider text-tinta-400 underline decoration-dotted underline-offset-4 hover:text-tinta-700"
        >
          Esquecer esta partida neste navegador
        </button>
      </section>

      {lastOutcomes && lastOutcomes.length > 0 ? (
        <section className="ficha ficha-margem py-5 pr-5">
          <SectionHeading
            overline="Última rodada resolvida"
            title="O que aconteceu com cada equipe"
          />
          <ul className="mt-4 flex flex-col">
            {lastOutcomes.map((outcome) => (
              <li
                key={outcome.teamId}
                className="border-t border-dashed border-papel-300 py-3 first:border-t-0 first:pt-0"
              >
                <span className="rotulo text-tinta-900">{outcome.teamName}</span>
                <p className="mt-1 font-caderno text-base text-tinta-900">{outcome.outcome}</p>

                {outcome.effects.length > 0 ? (
                  <p className="tabular mt-1 flex flex-wrap gap-x-4 text-sm text-tinta-700">
                    {outcome.effects.map((effect) => (
                      <span key={effect.indicator}>
                        {effect.indicator}: {effect.delta > 0 ? '+' : ''}
                        {effect.delta}
                      </span>
                    ))}
                  </p>
                ) : null}

                {outcome.notes.length > 0 ? (
                  <ul className="mt-1 flex flex-col gap-0.5">
                    {outcome.notes.map((note, index) => (
                      <li key={index} className="font-caderno text-sm text-tinta-500">
                        {note}
                      </li>
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
          title={`${view.teams.length} equipes em campo`}
          description="Visão privada do professor: aqui a decisão de cada equipe aparece assim que confirmada, mesmo com a rodada aberta."
        />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
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

      <footer className="mt-auto border-t border-dashed border-papel-300 pt-4">
        <div className="grid grid-cols-1 gap-x-10 sm:grid-cols-3">
          <LinhaRegistro label="Rodadas" value={`${game.currentRound} de ${TOTAL_ROUNDS}`} />
          <LinhaRegistro label="Jogadores" value={view.playerCount} />
          <LinhaRegistro label="Equipes" value={view.teams.length} />
        </div>
      </footer>
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
      {state?.reason ? (
        <p className="font-maquina text-xs leading-snug text-tinta-400">{state.reason}</p>
      ) : null}
    </div>
  );
}
