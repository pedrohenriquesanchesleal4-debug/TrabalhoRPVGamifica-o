'use client';

import { useCallback, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Check,
  ExternalLink,
  FileText,
  Flag,
  Lightbulb,
  Loader2,
  Pause,
  Play,
  Power,
  Repeat,
  RotateCcw,
  Share2,
  Sprout,
  Star,
  Users,
} from 'lucide-react';
import {
  fetchOficinaHostView,
  RequestError,
  runOficinaHostAction,
  type OficinaHostAction,
  type OficinaHostViewResponse,
} from '@/lib/client-api';
import { useGameChannel } from '@/hooks/use-game-channel';
import { Button, Degrau, Pill, Rotulo, SectionHeading } from '@/components/ui/primitives';
import { CerradoLandscape } from '@/components/game/cerrado-landscape';
import { OFICINA_CONTENT } from '@/data/oficina-content';
import { OFICINA_COMUNIDADE_NOME } from '@/data/oficina-ia';
import {
  OFICINA_INDICADORES_INFO,
  OFICINA_PERFIS_INFO,
  OFICINA_STAGES_ORDEM,
  type OficinaEventoRow,
  type OficinaIndicadores,
  type OficinaPerfil,
  type OficinaStage,
} from '@/types/oficina';
import type { OficinaSessaoRow } from '@/types/oficina';
import { IndicadoresMini } from '@/components/oficina/oficina-player';

/**
 * Painel do professor no modo Oficina Safra DF.
 *
 * Simples de propósito (a spec pede "não criar um painel administrativo
 * complexo"): uma faixa de controle de ritmo, a etapa atual destacada e a
 * leitura do que a comunidade já produziu — pistas, eventos, indicadores e
 * soluções. Toda ação passa por `runOficinaHostAction`, que valida estado e
 * idempotência no servidor.
 */

const STAGE_ROTULO: Record<OficinaStage, string> = {
  briefing: 'Briefing',
  investigacao: 'Investigação',
  eventos: 'Eventos coletivos',
  solucao: 'Proposta de solução',
  resultado: 'Resultado',
  encerrada: 'Fechamento',
};

const STATUS_ROTULO: Record<OficinaSessaoRow['status'], string> = {
  aguardando: 'Aguardando a turma entrar',
  ativa: 'Oficina ativa',
  pausada: 'Pausada',
  encerrada: 'Encerrada',
};

interface Disabled {
  disabled: boolean;
  reason: string | null;
}

interface EstadoPainel {
  sessao: OficinaSessaoRow | null;
  actionStates: Record<OficinaHostAction, Disabled>;
}

function buildEstado(view: OficinaHostViewResponse | null): EstadoPainel {
  const sessao = view?.view.sessao ?? null;

  const disabled = (condicao: boolean, reason: string | null): Disabled => ({
    disabled: condicao,
    reason,
  });

  const estados: Record<OficinaHostAction, Disabled> = {
    iniciar: disabled(!sessao || sessao.status !== 'aguardando', 'Só quando a oficina ainda não começou.'),
    avancar: disabled(
      !sessao ||
        sessao.status !== 'ativa' ||
        sessao.stage === 'encerrada' ||
        OFICINA_STAGES_ORDEM.indexOf(sessao.stage) === OFICINA_STAGES_ORDEM.length - 1,
      'Só com a oficina ativa e antes do último estágio.',
    ),
    reabrir: disabled(
      !sessao ||
        sessao.status !== 'ativa' ||
        OFICINA_STAGES_ORDEM.indexOf(sessao.stage) <= 0,
      'Só com a oficina ativa e após o primeiro estágio.',
    ),
    pausar: disabled(!sessao || sessao.status !== 'ativa' || sessao.stage === 'encerrada', 'Só com a oficina ativa.'),
    retomar: disabled(!sessao || sessao.status !== 'pausada' || sessao.stage === 'encerrada', 'Só com a oficina pausada.'),
    encerrar: disabled(!sessao || sessao.status === 'encerrada' || sessao.stage === 'encerrada', 'A oficina já foi encerrada.'),
    reiniciar: disabled(!sessao, 'Sem sessão.'),
    abrir_evento: disabled(
      !sessao || sessao.stage !== 'eventos' || sessao.status !== 'ativa',
      'Só durante o estágio de eventos, com a oficina ativa.',
    ),
    resolver_evento: disabled(
      !sessao || sessao.stage !== 'eventos' || sessao.status !== 'ativa' || !sessao.evento_atual,
      'Só durante o estágio de eventos, com um evento aberto.',
    ),
    resumo: disabled(!sessao || (sessao.stage !== 'resultado' && sessao.stage !== 'encerrada'), 'Disponível após o resultado.'),
    reflexao: disabled(!sessao || (sessao.stage !== 'resultado' && sessao.stage !== 'encerrada'), 'Disponível após o resultado.'),
  };

  // Refinamento dos eventos: o botão de abrir o próximo só faz sentido quando
  // o evento atual já foi resolvido e ainda resta algum sorteado.
  const eventoAtual = sessao?.evento_atual ? view?.view.eventos.find((e) => e.event_key === sessao.evento_atual) : null;
  if (sessao && sessao.stage === 'eventos') {
    if (eventoAtual?.status === 'aberto') {
      estados.abrir_evento = disabled(true, 'Resolva o evento atual antes de abrir o próximo.');
    } else if ((sessao.stage_progresso + 1) >= sessao.sorteio_eventos.length) {
      estados.abrir_evento = disabled(true, 'Todos os eventos sorteados já foram abertos.');
    } else {
      estados.abrir_evento = disabled(false, null);
    }
    estados.resolver_evento = disabled(
      !eventoAtual || eventoAtual.status !== 'aberto',
      !eventoAtual ? 'Nenhum evento aberto.' : 'O evento atual já foi resolvido.',
    );
  }

  return { sessao, actionStates: estados };
}

export function OficinaTeacherPanel({
  gameId,
  token,
  code,
}: {
  gameId: string;
  token: string;
  code: string;
}) {
  const [view, setView] = useState<OficinaHostViewResponse | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [pending, setPending] = useState<OficinaHostAction | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [resultadoAcao, setResultadoAcao] = useState<{ rotulo: string; texto: string } | null>(null);
  const [confirmEncerrar, setConfirmEncerrar] = useState(false);
  const [confirmReiniciar, setConfirmReiniciar] = useState(false);

  const load = useCallback(async () => {
    try {
      const next = await fetchOficinaHostView(gameId, token);
      setView(next);
      setLoadError(null);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Não foi possível carregar a oficina.');
    }
  }, [gameId, token]);

  useGameChannel({
    gameId,
    onEvent: () => void load(),
    onTeamUpdate: () => void load(),
  });

  const { sessao, actionStates } = useMemo(() => buildEstado(view), [view]);

  async function run(action: OficinaHostAction) {
    setPending(action);
    setActionError(null);
    setResultadoAcao(null);
    setConfirmEncerrar(false);
    setConfirmReiniciar(false);
    try {
      const result = await runOficinaHostAction(gameId, token, action);
      if (action === 'resumo' || action === 'reflexao') {
        const payload = result as {
          debate?: { resumo_para_debate: string };
          reflexao?: { reflexao: string; perguntas: string[] };
        };
        const bloco = payload.debate?.resumo_para_debate ?? payload.reflexao?.reflexao;
        setResultadoAcao({
          rotulo: action === 'resumo' ? 'Resumo para o debate' : 'Reflexão final',
          texto: bloco ?? '',
        });
      }
      void load();
    } catch (err) {
      setActionError(err instanceof RequestError ? err.message : 'A ação não pôde ser concluída.');
    } finally {
      setPending(null);
    }
  }

  if (loadError && !view) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-xl flex-col items-center justify-center gap-4 px-6 text-center">
        <AlertTriangle className="text-alerta" size={28} aria-hidden />
        <p className="text-terra-700">{loadError}</p>
        <Button variant="secundario" onClick={() => void load()}>
          <RotateCcw size={16} aria-hidden />
          Tentar de novo
        </Button>
      </main>
    );
  }

  if (!view || !sessao) {
    return (
      <main className="flex min-h-dvh items-center justify-center">
        <p className="dado-lg text-terra-700">Carregando a oficina...</p>
      </main>
    );
  }

  const equipes = view.view.equipes;
  const pistas = view.view.pistas;
  const compartilhadas = pistas.filter((p) => p.compartilhada_em).length;
  const eventoAtual = sessao.evento_atual
    ? view.view.eventos.find((e) => e.event_key === sessao.evento_atual)
    : null;

  return (
    <main className="relative mx-auto flex min-h-dvh max-w-6xl flex-col gap-8 px-6 py-10">
      <div className="pointer-events-none absolute inset-x-0 top-0 z-0 h-64 opacity-10">
        <CerradoLandscape />
      </div>

      <header className="relative z-10 flex flex-col gap-6 border-t-2 border-nevoa-200 pt-4 sm:flex-row sm:items-start sm:justify-between animate-emergir">
        <div className="flex flex-col gap-2">
          <Rotulo>SAFRA DF · Oficina comunitária</Rotulo>
          <div className="flex items-baseline gap-4">
            <Rotulo>Código</Rotulo>
            <span className="dado-xl uppercase tracking-[0.1em] text-(--cor-tinta-panel)">{code}</span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Pill tone="pronto">
              <Sprout size={13} aria-hidden />
              Oficina
            </Pill>
            <Pill tone={sessao.status === 'ativa' ? 'ativo' : sessao.status === 'pausada' ? 'alerta' : 'neutro'}>
              {STATUS_ROTULO[sessao.status]}
            </Pill>
            <Pill tone="neutro">
              <Flag size={13} aria-hidden />
              {STAGE_ROTULO[sessao.stage]}
            </Pill>
            <Pill tone="neutro">
              <Users size={13} aria-hidden />
              {equipes.length} equipes no território
            </Pill>
          </div>
        </div>

        <div className="flex flex-col gap-2 sm:items-end">
          <Link
            href={`/host/${gameId}`}
            target="_blank"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-terra-700 hover:text-terra-900"
          >
            Abrir projeção <ExternalLink size={14} aria-hidden />
          </Link>
          <Link
            href={`/host/${gameId}/resultado`}
            target="_blank"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-terra-700 hover:text-terra-900"
          >
            Abrir resultado <ExternalLink size={14} aria-hidden />
          </Link>
        </div>
      </header>

      <Degrau nivel="terraco" familia="neutro" className="relative z-10 flex flex-col gap-4 p-6">
        <SectionHeading
          overline="Ritmo da oficina"
          title={sessao.status === 'aguardando' ? 'Comece quando a turma estiver reunida' : `Estágio: ${STAGE_ROTULO[sessao.stage]}`}
          description={
            sessao.status === 'aguardando'
              ? 'As equipes já escolheram seus perfis. Iniciar distribui as perspectivas e abre o Briefing.'
              : 'Você conduz cada etapa. A turma acompanha no celular e a projeção mostra o coletivo.'
          }
        />

        {actionError ? (
          <p role="alert" className="flex items-center gap-2 text-sm text-alerta-texto">
            <AlertTriangle size={16} aria-hidden />
            {actionError}
          </p>
        ) : null}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <AccionButton
            label={sessao.status === 'aguardando' ? 'Iniciar oficina' : 'Avançar etapa'}
            icon={sessao.status === 'aguardando' ? <Play size={18} aria-hidden /> : <ArrowRight size={18} aria-hidden />}
            variant="principal"
            pending={pending === 'iniciar' || pending === 'avancar'}
            state={sessao.status === 'aguardando' ? actionStates.iniciar : actionStates.avancar}
            onClick={() => void run(sessao.status === 'aguardando' ? 'iniciar' : 'avancar')}
          />
          <AccionButton
            label="Reabrir etapa anterior"
            icon={<ArrowLeft size={18} aria-hidden />}
            variant="secundario"
            pending={pending === 'reabrir'}
            state={actionStates.reabrir}
            onClick={() => void run('reabrir')}
          />
          <AccionButton
            label={sessao.status === 'pausada' ? 'Retomar oficina' : 'Pausar oficina'}
            icon={sessao.status === 'pausada' ? <Play size={18} aria-hidden /> : <Pause size={18} aria-hidden />}
            variant="secundario"
            pending={pending === 'retomar' || pending === 'pausar'}
            state={sessao.status === 'pausada' ? actionStates.retomar : actionStates.pausar}
            onClick={() => void run(sessao.status === 'pausada' ? 'retomar' : 'pausar')}
          />
          <AccionButton
            label="Resolver evento atual"
            icon={<Check size={18} aria-hidden />}
            variant="principal"
            pending={pending === 'resolver_evento'}
            state={actionStates.resolver_evento}
            onClick={() => void run('resolver_evento')}
          />
          <AccionButton
            label="Abrir próximo evento"
            icon={<Share2 size={18} aria-hidden />}
            variant="secundario"
            pending={pending === 'abrir_evento'}
            state={actionStates.abrir_evento}
            onClick={() => void run('abrir_evento')}
          />
          <AccionButton
            label="Resumo para debate"
            icon={<FileText size={18} aria-hidden />}
            variant="secundario"
            pending={pending === 'resumo'}
            state={actionStates.resumo}
            onClick={() => void run('resumo')}
          />
          <AccionButton
            label="Reflexão final"
            icon={<Lightbulb size={18} aria-hidden />}
            variant="secundario"
            pending={pending === 'reflexao'}
            state={actionStates.reflexao}
            onClick={() => void run('reflexao')}
          />
        </div>

        <div className="h-px w-full bg-nevoa-200" />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            {!confirmEncerrar ? (
              <Button
                variant="perigo"
                onClick={() => setConfirmEncerrar(true)}
                disabled={actionStates.encerrar.disabled}
                title={actionStates.encerrar.reason ?? undefined}
              >
                <Power size={16} aria-hidden />
                Encerrar oficina
              </Button>
            ) : (
              <Degrau nivel="banco" familia="alerta" className="flex flex-col gap-2 p-4">
                <p className="text-sm text-terra-700">
                  Encerrar calcula o resultado final e trava novas ações das equipes. Confirma?
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="perigo"
                    onClick={() => {
                      setConfirmEncerrar(false);
                      void run('encerrar');
                    }}
                  >
                    Sim, encerrar
                  </Button>
                  <Button variant="silencioso" onClick={() => setConfirmEncerrar(false)}>
                    Cancelar
                  </Button>
                </div>
              </Degrau>
            )}
            {actionStates.encerrar.reason ? (
              <p className="text-xs text-terra-500">{actionStates.encerrar.reason}</p>
            ) : null}
          </div>

          <div className="flex flex-col gap-2">
            {!confirmReiniciar ? (
              <Button variant="perigo" onClick={() => setConfirmReiniciar(true)}>
                <RotateCcw size={16} aria-hidden />
                Reiniciar oficina
              </Button>
            ) : (
              <Degrau nivel="banco" familia="alerta" className="flex flex-col gap-2 p-4">
                <p className="text-sm text-terra-700">
                  Reiniciar apaga pistas, eventos, soluções e indicadores; devolve a oficina ao
                  início. As equipes e os jogadores continuam conectados. Confirma?
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="perigo"
                    onClick={() => {
                      setConfirmReiniciar(false);
                      void run('reiniciar');
                    }}
                  >
                    Sim, reiniciar
                  </Button>
                  <Button variant="silencioso" onClick={() => setConfirmReiniciar(false)}>
                    Cancelar
                  </Button>
                </div>
              </Degrau>
            )}
          </div>
        </div>
      </Degrau>

      {resultadoAcao ? (
        <Degrau nivel="terraco" familia="neutro" className="relative z-10 flex flex-col gap-4 p-6 animate-emergir">
          <div className="flex items-center justify-between gap-3">
            <SectionHeading overline="Conteúdo de apoio" title={resultadoAcao.rotulo} />
            <button
              type="button"
              onClick={() => setResultadoAcao(null)}
              className="text-sm font-medium text-terra-500 hover:text-terra-900"
            >
              Fechar
            </button>
          </div>
          <div className="prose prose-sm max-w-none text-sm leading-relaxed text-terra-700">
            {resultadoAcao.texto.split('\n').filter(Boolean).map((linha, index) => (
              <p key={index} className="mb-3">
                {linha}
              </p>
            ))}
          </div>
        </Degrau>
      ) : null}

      <EventosSection
        sessao={sessao}
        eventoAtual={eventoAtual}
        totalEquipes={equipes.length}
        view={view}
      />

      <section className="relative z-10 flex flex-col gap-4 revelar">
        <SectionHeading
          overline="Progresso das equipes"
          title={`${equipes.length} perfis ${OFICINA_COMUNIDADE_NOME}`}
          description="Visão privada do professor: indicadores, pistas e soluções de cada equipe antes do final."
        />
        <div className="flex flex-col gap-4">
          {equipes.map((equipe) => {
            const perfil = equipe.perfil as OficinaPerfil;
            const perfilInfo = OFICINA_PERFIS_INFO[perfil];
            const pistasDa = view.view.pistas.filter((p) => p.team_id === equipe.team_id);
            const solucaoEnviada = view.view.solucoes.some((s) => s.team_id === equipe.team_id);
            return (
              <Degrau key={equipe.team_id} nivel="terraco" familia="neutro" className="flex flex-col gap-3 p-5">
                <div className="flex flex-wrap items-center gap-3">
                  <Pill tone="ativo">{perfilInfo?.rotulo ?? equipe.nome}</Pill>
                  <span className="text-sm font-bold text-terra-900">{equipe.nome}</span>
                  <span className="ml-auto flex items-center gap-2 text-xs text-terra-500">
                    {sessao.stage === 'investigacao' ? (
                      <span className={equipe.acoes_usadas >= 4 ? 'font-bold text-alerta-texto' : ''}>
                        {equipe.acoes_usadas}/4 ações
                      </span>
                    ) : null}
                    <span>{pistasDa.length} pistas</span>
                    {solucaoEnviada ? (
                      <span className="flex items-center gap-1 font-bold text-verde-600">
                        <Check size={12} aria-hidden /> solução enviada
                      </span>
                    ) : null}
                  </span>
                </div>
                <IndicadoresMini indicadores={equipe.indicadores as OficinaIndicadores} />
                {pistasDa.length > 0 ? (
                  <ul className="flex flex-wrap gap-1.5">
                    {pistasDa.map((pista) => {
                      const def = OFICINA_CONTENT.pistas.find((p) => p.id === pista.pista_id);
                      return (
                        <li
                          key={pista.id}
                          className="flex items-center gap-1.5 rounded-full border border-nevoa-200 bg-nevoa-50 px-2.5 py-1 text-xs text-terra-700"
                        >
                          {pista.compartilhada_em ? (
                            <Share2 size={11} className="text-verde-600" aria-hidden />
                          ) : (
                            <Activity size={11} className="text-terra-400" aria-hidden />
                          )}
                          {def?.titulo ?? 'Pista'}
                        </li>
                      );
                    })}
                  </ul>
                ) : null}
              </Degrau>
            );
          })}
        </div>
      </section>

      <section className="relative z-10 flex flex-col gap-4 revelar">
        <SectionHeading
          overline="Território da comunidade"
          title={`${pistas.length} pistas descobertas · ${compartilhadas} compartilhadas`}
          description="Cada descoberta vira conhecimento para qualquer equipe agir junto."
        />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {OFICINA_CONTENT.pistas.map((pista) => {
            const achada = pistas.some((p) => p.pista_id === pista.id);
            const compartilhadaNa = pistas.some((p) => p.pista_id === pista.id && p.compartilhada_em);
            return (
              <div
                key={pista.id}
                className={[
                  'degrau banco flex flex-col gap-1 p-3.5',
                  achada ? 'terr-claro' : 'opacity-45',
                ].join(' ')}
              >
                <span className="flex items-center gap-2 text-xs font-bold text-terra-900">
                  {compartilhadaNa ? (
                    <Share2 size={13} className="text-verde-600" aria-hidden />
                  ) : achada ? (
                    <Check size={13} className="text-verde-600" aria-hidden />
                  ) : (
                    <Activity size={13} className="text-terra-400" aria-hidden />
                  )}
                  {pista.titulo}
                </span>
                <span className="text-xs text-terra-500">
                  {achada ? pista.origem : 'Ainda não descoberta'}
                </span>
              </div>
            );
          })}
        </div>
      </section>

      <ResultadoSection view={view} />
    </main>
  );
}

function AccionButton({
  label,
  icon,
  variant,
  pending,
  state,
  onClick,
}: {
  label: string;
  icon: React.ReactNode;
  variant: 'principal' | 'secundario';
  pending: boolean;
  state?: Disabled;
  onClick: () => void;
}) {
  const disabled = pending || state?.disabled === true;
  return (
    <div className="flex flex-col gap-1.5">
      <Button variant={variant} size="grande" onClick={onClick} disabled={disabled} title={state?.reason ?? undefined}>
        {pending ? <Loader2 size={16} className="animate-spin" aria-hidden /> : icon}
        {pending ? 'Aguarde...' : label}
      </Button>
      {state?.reason ? <p className="text-xs text-terra-500">{state.reason}</p> : null}
    </div>
  );
}

function EventosSection({
  sessao,
  eventoAtual,
  totalEquipes,
  view,
}: {
  sessao: OficinaSessaoRow;
  eventoAtual: OficinaEventoRow | null | undefined;
  totalEquipes: number;
  view: OficinaHostViewResponse;
}) {
  if (sessao.stage !== 'eventos') return null;

  const def = eventoAtual ? OFICINA_CONTENT.eventos.find((e) => e.key === eventoAtual.event_key) : null;
  const contribuidores = eventoAtual ? Object.keys(eventoAtual.contribuicoes).length : 0;

  return (
    <Degrau nivel="terraco" familia="neutro" className="relative z-10 flex flex-col gap-3 p-6">
      <SectionHeading
        overline="Evento coletivo"
        title={def?.titulo ?? 'Nenhum evento aberto'}
        description={
          eventoAtual
            ? eventoAtual.status === 'aberto'
              ? `Em aberto · ${contribuidores} de ${totalEquipes} equipes já contribuíram`
              : 'Resolvido — os efeitos foram aplicados a todas as equipes'
            : 'O evento coletivo surge no estágio de eventos.'
        }
      />
      {def ? <p className="text-sm leading-relaxed text-terra-700">{def.desfecho}</p> : null}
    </Degrau>
  );
}

function ResultadoSection({ view }: { view: OficinaHostViewResponse }) {
  const resultados = view.view.resultados;
  if (resultados.length === 0) return null;

  return (
    <section className="relative z-10 flex flex-col gap-4 revelar">
      <SectionHeading
        overline="Resultados calculados"
        title="Destaques da comunidade"
        description="Categorias atribuídas pela avaliação ao encerrar ou ao chegar no estágio de resultado."
      />
      <div className="flex flex-col gap-3">
        {resultados.map((resultado) => {
          const equipe = view.view.equipes.find((e) => e.team_id === resultado.team_id);
          return (
            <Degrau key={resultado.team_id} nivel="terraco" familia="neutro" className="flex flex-col gap-2 p-4">
              <div className="flex flex-wrap items-center gap-3">
                <Star size={14} className="text-financas" aria-hidden />
                <span className="text-sm font-bold text-terra-900">{equipe?.nome ?? 'Equipe'}</span>
                <span className="text-xs text-terra-500">{equipe?.perfil ? OFICINA_PERFIS_INFO[equipe.perfil as OficinaPerfil]?.rotulo : ''}</span>
              </div>
              <ul className="flex flex-col gap-1.5">
                {resultado.categorias.map((categoria) => (
                  <li key={categoria.categoria} className="flex items-start gap-2 text-sm text-terra-700">
                    <span className="rotulo w-40 shrink-0 pt-0.5">{categoria.categoria}</span>
                    <span className="flex-1">{categoria.razao}</span>
                    <span className="shrink-0 text-xs font-bold text-terra-900">{categoria.nota.toFixed(1)}</span>
                  </li>
                ))}
              </ul>
            </Degrau>
          );
        })}
      </div>
    </section>
  );
}