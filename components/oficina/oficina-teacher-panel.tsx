'use client';

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
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
  HeartHandshake,
  Hourglass,
  Lightbulb,
  Loader2,
  Megaphone,
  Pause,
  Play,
  Power,
  RotateCcw,
  Search,
  Share2,
  Sprout,
  Star,
  Trash2,
  Users,
} from 'lucide-react';
import {
  deleteGame,
  fetchOficinaHostView,
  RequestError,
  runOficinaHostAction,
  type OficinaHostAction,
  type OficinaHostViewResponse,
} from '@/lib/client-api';
import { useGameChannel } from '@/hooks/use-game-channel';
import { Button, Degrau, Pill, Rotulo, SectionHeading } from '@/components/ui/primitives';
import { MarkdownLite } from '@/components/ui/markdown-lite';
import { CerradoLandscape } from '@/components/game/cerrado-landscape';
import { OFICINA_CONTENT } from '@/data/oficina-content';
import { OFICINA_COMUNIDADE_NOME } from '@/data/oficina-ia';
import {
  MAX_ACOES_POR_ESTAGIO,
  OFICINA_PERFIS_INFO,
  OFICINA_STAGES_ORDEM,
  OFICINA_STAGE_META,
  rotuloCategoria,
  type OficinaEquipeComNome,
  type OficinaEventoRow,
  type OficinaPistaRow,
  type OficinaPerfil,
  type OficinaResultadoRow,
  type OficinaSessaoRow,
  type OficinaStage,
  type OficinaSolucaoRow,
} from '@/types/oficina';
import { IndicadoresMini } from '@/components/oficina/oficina-player';

/**
 * Painel do professor no modo Oficina Safra DF.
 *
 * O painel existe para tirar uma decisão do professor: ele não pode precisar
 * adivinhar o que a turma fez nem o que fazer agora. Por isso a espinha da tela
 * é `OFICINA_STAGE_META[stage].conducting` (o que fazer agora), seguida das
 * contagens que decidem se a etapa pode fechar (equipes que agiram, equipes que
 * votaram, propostas enviadas).
 *
 * Toda ação passa por `runOficinaHostAction`: o navegador nunca escreve no
 * banco, e o servidor é quem recusa estado inválido. O painel só evita o
 * disparo óbvio — botões travados durante uma mutação e motivos de bloqueio
 * mostrados apenas quando o botão está realmente travado.
 */

// ---------------------------------------------------------------------------
// Rótulos do painel
// ---------------------------------------------------------------------------

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

/** Pergunta que o professor responde olhando a faixa de métricas. */
const CONDICAO_ROTULO: Record<OficinaStage, string> = {
  briefing: 'Antes de abrir a investigação',
  investigacao: 'Antes de abrir os eventos',
  eventos: 'Antes de resolver o evento',
  solucao: 'Antes de ver o resultado',
  resultado: 'O que a turma entregou',
  encerrada: 'O que a turma entregou',
};

// ---------------------------------------------------------------------------
// Estado de bloqueio das ações do professor
// ---------------------------------------------------------------------------

/**
 * Estado de um botão do professor.
 *
 * `motivo` é a explicação do BLOQUEIO: existe só quando `bloqueado` é true. A
 * regra vem de um defeito real: havia um botão "Encerrar oficina" habilitado
 * exibindo "A oficina já foi encerrada" logo abaixo. `bloqueia()` é o único
 * construtor deste estado, então a contradição não tem como nascer.
 */
interface Bloqueio {
  bloqueado: boolean;
  motivo: string | null;
}

function bloqueia(condicao: boolean, motivo: string): Bloqueio {
  return { bloqueado: condicao, motivo: condicao ? motivo : null };
}

interface EstadoPainel {
  sessao: OficinaSessaoRow | null;
  acoes: Record<OficinaHostAction, Bloqueio>;
}

function buildEstado(view: OficinaHostViewResponse | null): EstadoPainel {
  const sessao = view?.view.sessao ?? null;
  const indice = sessao ? OFICINA_STAGES_ORDEM.indexOf(sessao.stage) : -1;
  const eventoAtual = sessao?.evento_atual
    ? view?.view.eventos.find((e) => e.event_key === sessao.evento_atual)
    : undefined;

  /**
   * `resultado` não tem próximo estágio: o servidor recusa `avancar` a partir
   * dele, e o caminho real é `encerrar` (que calcula os destaques e libera o
   * roteiro de debate). O motivo do bloqueio diz exatamente isso, para o
   * professor não ficar caçando um botão que não existe.
   */
  const motivoAvancar = !sessao
    ? 'Sem sessão de oficina.'
    : sessao.stage === 'resultado'
      ? 'Do resultado não se avança: o próximo passo é encerrar a oficina.'
      : sessao.stage === 'encerrada'
        ? 'A oficina já está no estágio de encerramento.'
        : sessao.status === 'pausada'
          ? 'A oficina está pausada. Retome para avançar de etapa.'
          : sessao.status !== 'ativa'
            ? 'Só com a oficina ativa.'
            : 'A oficina já está no último estágio.';

  const acoes: Record<OficinaHostAction, Bloqueio> = {
    iniciar: bloqueia(!sessao || sessao.status !== 'aguardando', 'Só quando a oficina ainda não começou.'),
    avancar: bloqueia(
      !sessao || sessao.status !== 'ativa' || sessao.stage === 'encerrada' || sessao.stage === 'resultado',
      motivoAvancar,
    ),
    reabrir: bloqueia(
      !sessao || sessao.status !== 'ativa' || indice <= 0,
      'Só com a oficina ativa e depois da primeira etapa.',
    ),
    pausar: bloqueia(
      !sessao || sessao.status !== 'ativa' || sessao.stage === 'encerrada',
      'Só com a oficina ativa, antes do encerramento.',
    ),
    retomar: bloqueia(
      !sessao || sessao.status !== 'pausada' || sessao.stage === 'encerrada',
      'Só com a oficina pausada e antes do encerramento.',
    ),
    encerrar: bloqueia(
      !sessao || sessao.status === 'encerrada' || sessao.stage === 'encerrada',
      'A oficina já foi encerrada.',
    ),
    reiniciar: bloqueia(!sessao, 'Sem sessão de oficina para reiniciar.'),
    abrir_evento: bloqueia(
      !sessao || sessao.stage !== 'eventos' || sessao.status !== 'ativa',
      'Só durante o estágio de eventos, com a oficina ativa.',
    ),
    resolver_evento: bloqueia(
      !sessao || sessao.stage !== 'eventos' || sessao.status !== 'ativa' || !sessao.evento_atual,
      'Só durante o estágio de eventos, com um evento aberto.',
    ),
    resumo: bloqueia(
      !sessao || (sessao.stage !== 'resultado' && sessao.stage !== 'encerrada'),
      'O roteiro de debate existe a partir do resultado.',
    ),
    reflexao: bloqueia(
      !sessao || (sessao.stage !== 'resultado' && sessao.stage !== 'encerrada'),
      'A reflexão final existe a partir do resultado.',
    ),
  };

  // Refinamento dos eventos: abrir o próximo só faz sentido com o evento atual
  // já resolvido e ainda com sorteado sobrando.
  if (sessao?.stage === 'eventos') {
    if (eventoAtual?.status === 'aberto') {
      acoes.abrir_evento = bloqueia(true, 'Resolva o evento atual antes de abrir o próximo.');
    } else if (sessao.stage_progresso + 1 >= sessao.sorteio_eventos.length) {
      acoes.abrir_evento = bloqueia(true, 'Todos os eventos sorteados já foram abertos.');
    }
    acoes.resolver_evento = bloqueia(
      !eventoAtual || eventoAtual.status !== 'aberto',
      !eventoAtual
        ? 'Nenhum evento aberto. Abra o próximo para a turma decidir.'
        : 'O evento atual já foi resolvido.',
    );
  }

  return { sessao, acoes };
}

// ---------------------------------------------------------------------------
// Leitura do território (contagens que decidem o ritmo)
// ---------------------------------------------------------------------------

/**
 * Uma pista contada UMA vez por equipe.
 *
 * `oficina_pistas` é por equipe: a mesma pista vira uma linha na equipe que
 * descobriu e outra na equipe que recebeu. Contando linhas, a turma "descobriu"
 * a mesma pista três vezes — foi o bug das contagens. Aqui as linhas viram
 * `linhas` (circulação, o que interessa para o compartilhamento) e a identidade
 * da pista fica uma só.
 */
interface PistaConsolidada {
  pistaId: string;
  linhas: number;
  publicada: boolean;
  recebida: boolean;
}

function consolidarPistas(rows: readonly OficinaPistaRow[]): PistaConsolidada[] {
  const porId = new Map<string, PistaConsolidada>();

  for (const row of rows) {
    const atual = porId.get(row.pista_id);
    if (!atual) {
      porId.set(row.pista_id, {
        pistaId: row.pista_id,
        linhas: 1,
        publicada: Boolean(row.compartilhada_em),
        recebida: Boolean(row.recebida_de),
      });
      continue;
    }
    atual.linhas += 1;
    atual.publicada = atual.publicada || Boolean(row.compartilhada_em);
    atual.recebida = atual.recebida || Boolean(row.recebida_de);
  }

  return [...porId.values()];
}

/** Quantas pistas DIFERENTES existem no conjunto de linhas. */
function contarPistasDistintas(rows: readonly OficinaPistaRow[]): number {
  return new Set(rows.map((row) => row.pista_id)).size;
}

/** Quantos cartões da solução a equipe preencheu (o mapa é `blocos.blocos`). */
function contarCartoesPreenchidos(solucao: OficinaSolucaoRow): number {
  const escolhas = solucao.blocos?.blocos ?? {};
  return Object.values(escolhas).filter((valor) => typeof valor === 'string' && valor.length > 0).length;
}

interface Metrica {
  icone: ReactNode;
  valor: string;
  texto: string;
}

interface LeituraOficina {
  equipes: OficinaEquipeComNome[];
  totalEquipes: number;
  indiceEtapa: number;
  totalEtapas: number;
  eventoAtual: OficinaEventoRow | null;
  equipeDa: (teamId: string) => OficinaEquipeComNome | undefined;
  pistasDistintas: number;
  linhasPistas: number;
  linhasCompartilhadas: number;
  equipesQueAgiram: number;
  equipesQueVotaram: number;
  equipesQueEnviaram: number;
  propostasCompletas: number;
  totalCartoes: number;
  destaques: number;
  metricas: Metrica[];
}

function lerOficina(view: OficinaHostViewResponse | null): LeituraOficina {
  const equipes = view?.view.equipes ?? [];
  const pistas = view?.view.pistas ?? [];
  const solucoes = view?.view.solucoes ?? [];
  const resultados = view?.view.resultados ?? [];
  const sessao = view?.view.sessao ?? null;
  const stage: OficinaStage = sessao?.stage ?? 'briefing';
  const indiceEtapa = sessao ? OFICINA_STAGES_ORDEM.indexOf(sessao.stage) + 1 : 1;
  const totalEtapas = OFICINA_STAGES_ORDEM.length;
  const totalEquipes = equipes.length;

  const eventoAtual = sessao?.evento_atual
    ? (view?.view.eventos.find((e) => e.event_key === sessao.evento_atual) ?? null)
    : null;

  const pistasDistintas = contarPistasDistintas(pistas);
  const linhasPistas = pistas.length;
  const linhasCompartilhadas = pistas.filter((p) => Boolean(p.compartilhada_em)).length;
  const equipesQueAgiram = equipes.filter((e) => e.acoes_usadas > 0).length;
  const equipesQueVotaram = eventoAtual ? Object.keys(eventoAtual.contribuicoes).length : 0;
  const equipesQueEnviaram = solucoes.length;
  const totalCartoes = OFICINA_CONTENT.cartoes.length;
  const propostasCompletas = solucoes.filter((s) => contarCartoesPreenchidos(s) >= totalCartoes).length;
  const destaques = resultados.reduce((total, r) => total + (r.categorias?.length ?? 0), 0);

  const nomePorEquipe = new Map(equipes.map((e) => [e.team_id, e]));
  const equipeDa = (teamId: string) => nomePorEquipe.get(teamId);

  const etapas: Record<OficinaStage, () => Metrica[]> = {
    briefing: () => [
      { icone: <Users size={18} aria-hidden />, valor: `${totalEquipes}`, texto: 'equipes no território' },
      { icone: <Search size={18} aria-hidden />, valor: `${pistasDistintas}`, texto: 'pistas já descobertas' },
      {
        icone: <Flag size={18} aria-hidden />,
        valor: `${indiceEtapa} de ${totalEtapas}`,
        texto: 'etapa da oficina',
      },
    ],
    investigacao: () => [
      {
        icone: <Activity size={18} aria-hidden />,
        valor: `${equipesQueAgiram} de ${totalEquipes}`,
        texto: 'equipes já agiram',
      },
      { icone: <Search size={18} aria-hidden />, valor: `${pistasDistintas}`, texto: 'pistas distintas descobertas' },
      {
        icone: <Share2 size={18} aria-hidden />,
        valor: `${linhasPistas}`,
        texto: 'registros circulando entre as equipes',
      },
    ],
    eventos: () => [
      {
        icone: <Megaphone size={18} aria-hidden />,
        valor: `${equipesQueVotaram} de ${totalEquipes}`,
        texto: 'equipes já votaram no evento',
      },
      {
        icone: <Flag size={18} aria-hidden />,
        valor: `${sessao ? sessao.stage_progresso + 1 : 0} de ${sessao ? sessao.sorteio_eventos.length : 0}`,
        texto: 'eventos sorteados nesta etapa',
      },
      {
        icone: <Check size={18} aria-hidden />,
        valor: `${(view?.view.eventos ?? []).filter((e) => e.status === 'resolvido').length}`,
        texto: 'eventos já resolvidos',
      },
    ],
    solucao: () => [
      {
        icone: <Check size={18} aria-hidden />,
        valor: `${equipesQueEnviaram} de ${totalEquipes}`,
        texto: 'equipes enviaram a proposta',
      },
      {
        icone: <Hourglass size={18} aria-hidden />,
        valor: `${Math.max(0, totalEquipes - equipesQueEnviaram)}`,
        texto: 'equipes ainda montando',
      },
      {
        icone: <Lightbulb size={18} aria-hidden />,
        valor: `${propostasCompletas}`,
        texto: `propostas com os ${totalCartoes} cartões`,
      },
    ],
    resultado: () => [
      {
        icone: <Check size={18} aria-hidden />,
        valor: `${equipesQueEnviaram} de ${totalEquipes}`,
        texto: 'equipes enviaram a proposta',
      },
      { icone: <Star size={18} aria-hidden />, valor: `${destaques}`, texto: 'destaques atribuídos' },
      { icone: <Users size={18} aria-hidden />, valor: `${totalEquipes}`, texto: 'equipes na galeria' },
    ],
    encerrada: () => [
      {
        icone: <Check size={18} aria-hidden />,
        valor: `${equipesQueEnviaram} de ${totalEquipes}`,
        texto: 'equipes enviaram a proposta',
      },
      { icone: <Star size={18} aria-hidden />, valor: `${destaques}`, texto: 'destaques atribuídos' },
      { icone: <Share2 size={18} aria-hidden />, valor: `${linhasCompartilhadas}`, texto: 'pistas publicadas' },
    ],
  };

  return {
    equipes,
    totalEquipes,
    indiceEtapa,
    totalEtapas,
    eventoAtual,
    equipeDa,
    pistasDistintas,
    linhasPistas,
    linhasCompartilhadas,
    equipesQueAgiram,
    equipesQueVotaram,
    equipesQueEnviaram,
    propostasCompletas,
    totalCartoes,
    destaques,
    metricas: etapas[stage](),
  };
}

// ---------------------------------------------------------------------------
// Componente
// ---------------------------------------------------------------------------

interface ConteudoAcao {
  rotulo: string;
  texto: string;
  perguntas: string[];
}

export function OficinaTeacherPanel({
  gameId,
  token,
  code,
  onDeleted,
}: {
  gameId: string;
  token: string;
  code: string;
  onDeleted?: () => void;
}) {
  const [view, setView] = useState<OficinaHostViewResponse | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [pending, setPending] = useState<OficinaHostAction | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [conteudo, setConteudo] = useState<ConteudoAcao | null>(null);
  const [confirmEncerrar, setConfirmEncerrar] = useState(false);
  const [confirmReiniciar, setConfirmReiniciar] = useState(false);
  const [confirmExcluir, setConfirmExcluir] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    try {
      const next = await fetchOficinaHostView(gameId, token);
      setView(next);
      setLoadError(null);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Não foi possível carregar a oficina.');
    }
  }, [gameId, token]);

  // Carga inicial: sem evento realtime não há por que o painel nascer vazio.
  // A IIFE assíncrona evita o setState síncrono no corpo do efeito (cascata).
  useEffect(() => {
    void (async () => {
      await load();
    })();
  }, [load]);

  useGameChannel({
    gameId,
    onEvent: () => void load(),
    onTeamUpdate: () => void load(),
  });

  const { sessao, acoes } = useMemo(() => buildEstado(view), [view]);
  const leitura = useMemo(() => lerOficina(view), [view]);

  async function run(action: OficinaHostAction) {
    setPending(action);
    setActionError(null);
    setConteudo(null);
    setConfirmEncerrar(false);
    setConfirmReiniciar(false);
    setConfirmExcluir(false);
    try {
      const result = await runOficinaHostAction(gameId, token, action);
      if (action === 'resumo' || action === 'reflexao') {
        const payload = result as {
          debate?: { resumo_para_debate: string };
          reflexao?: { reflexao: string; perguntas?: string[] };
        };
        const bloco = action === 'resumo' ? payload.debate?.resumo_para_debate : payload.reflexao?.reflexao;
        setConteudo({
          rotulo: action === 'resumo' ? 'Roteiro de debate' : 'Reflexão final',
          texto: bloco ?? '',
          perguntas: payload.reflexao?.perguntas ?? [],
        });
      }
      void load();
    } catch (err) {
      setActionError(err instanceof RequestError ? err.message : 'A ação não pôde ser concluída.');
    } finally {
      setPending(null);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    setActionError(null);
    try {
      await deleteGame(gameId, token);
      onDeleted?.();
    } catch (err) {
      setActionError(err instanceof RequestError ? err.message : 'Não foi possível excluir a oficina.');
      setDeleting(false);
      setConfirmExcluir(false);
    }
  }

  if (loadError && !view) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-xl flex-col items-center justify-center gap-4 px-6 text-center">
        <AlertTriangle className="text-alerta" size={28} aria-hidden />
        <p className="text-terra-700">{loadError}</p>
        <Button variant="secundario" size="grande" onClick={() => void load()}>
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

  const etapa = OFICINA_STAGE_META[sessao.stage];
  const aguardando = sessao.status === 'aguardando';
  /** De `resultado` não há avanço: o caminho é encerrar a oficina. */
  const encerramentoFinal = sessao.status === 'ativa' && sessao.stage === 'resultado';

  const primaria: {
    acao: OficinaHostAction;
    rotulo: string;
    icone: ReactNode;
    bloqueio: Bloqueio;
    aoClicar: () => void;
  } = aguardando
    ? {
        acao: 'iniciar',
        rotulo: 'Iniciar oficina',
        icone: <Play size={18} aria-hidden />,
        bloqueio: acoes.iniciar,
        aoClicar: () => void run('iniciar'),
      }
    : encerramentoFinal
      ? {
          acao: 'encerrar',
          rotulo: 'Encerrar oficina',
          icone: <Power size={18} aria-hidden />,
          bloqueio: acoes.encerrar,
          aoClicar: () => setConfirmEncerrar(true),
        }
      : {
          acao: 'avancar',
          rotulo: 'Avançar etapa',
          icone: <ArrowRight size={18} aria-hidden />,
          bloqueio: acoes.avancar,
          aoClicar: () => void run('avancar'),
        };

  return (
    <main className="relative mx-auto flex min-h-dvh max-w-6xl flex-col gap-6 px-6 py-8 sm:gap-8 sm:py-10">
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
              {leitura.totalEquipes} equipes no território
            </Pill>
          </div>
        </div>

        {/*
          Só a projeção é link externo aqui. O resultado da oficina NÃO tem
          página própria: a rota `/host/[gameId]/resultado` é do modo
          Diagnóstico e abre vazia numa oficina, então o resumo vive inline,
          abaixo, onde o professor já está olhando.
        */}
        <div className="flex flex-col gap-2 sm:items-end">
          <Link
            href={`/host/${gameId}`}
            target="_blank"
            className="inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-terra-700 hover:text-terra-900"
          >
            Abrir projeção <ExternalLink size={14} aria-hidden />
          </Link>
        </div>
      </header>

      {/*
        O ÚNICO mirante da tela: a instrução de condução. Aqui a hierarquia é
        altitude, e o que a oficina exige do professor agora é o bloco mais
        alto da página.
      */}
      <Degrau nivel="mirante" familia="financas" className="relative z-10 flex flex-col gap-4 p-6 animate-emergir">
        <div className="flex flex-col gap-2" aria-live="polite">
          <Rotulo className="text-financas-texto">
            Etapa {leitura.indiceEtapa} de {leitura.totalEtapas} · {STAGE_ROTULO[sessao.stage]}
          </Rotulo>
          <h2 className="relevo-lg text-terra-900">{etapa.titulo}</h2>
          <p className="text-base leading-relaxed text-terra-900">{etapa.objetivo}</p>
        </div>

        <div className="flex flex-col gap-1.5 border-t-2 border-nevoa-200 pt-4">
          <Rotulo className="text-financas-texto">O que fazer agora</Rotulo>
          <p className="relevo-md text-terra-900">{etapa.conducting}</p>
        </div>

        {etapa.meta ? (
          <p className="text-sm text-terra-700">Meta da turma: {etapa.meta}</p>
        ) : (
          <p className="text-sm text-terra-700">Esta etapa não tem contagem para a turma cumprir.</p>
        )}
      </Degrau>

      <CondicaoDeAvanco stage={sessao.stage} metricas={leitura.metricas} />

      <Degrau nivel="terraco" familia="neutro" className="relative z-10 flex flex-col gap-4 p-6">
        <SectionHeading
          overline="Ritmo da oficina"
          title={aguardando ? 'Comece quando a turma estiver reunida' : 'Controle de etapa'}
          description={
            aguardando
              ? 'As equipes já escolheram seus perfis. Iniciar distribui as perspectivas e abre o Briefing.'
              : encerramentoFinal
                ? 'Não existe etapa depois do resultado: encerrar calcula os destaques e libera o roteiro de debate.'
                : 'Você conduz o ritmo. A turma acompanha no celular e a projeção mostra o trabalho coletivo.'
          }
        />

        {actionError ? (
          <p role="alert" className="flex items-center gap-2 text-sm text-alerta-texto">
            <AlertTriangle size={16} aria-hidden />
            {actionError}
          </p>
        ) : null}

        {pending !== null ? (
          <p className="flex items-center gap-2 text-sm text-terra-700">
            <Loader2 size={15} className="animate-spin" aria-hidden />
            Uma ação está em andamento. Os botões ficam travados até ela terminar.
          </p>
        ) : null}

        <div className="flex flex-col gap-4" aria-busy={pending !== null}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <AcaoButton
              acao={primaria.acao}
              rotulo={primaria.rotulo}
              icone={primaria.icone}
              variante="principal"
              pending={pending}
              bloqueio={primaria.bloqueio}
              aoClicar={primaria.aoClicar}
            />
            <AcaoButton
              acao="reabrir"
              rotulo="Reabrir etapa anterior"
              icone={<ArrowLeft size={18} aria-hidden />}
              pending={pending}
              bloqueio={acoes.reabrir}
              aoClicar={() => void run('reabrir')}
            />
            <AcaoButton
              acao={sessao.status === 'pausada' ? 'retomar' : 'pausar'}
              rotulo={sessao.status === 'pausada' ? 'Retomar oficina' : 'Pausar oficina'}
              icone={sessao.status === 'pausada' ? <Play size={18} aria-hidden /> : <Pause size={18} aria-hidden />}
              pending={pending}
              bloqueio={sessao.status === 'pausada' ? acoes.retomar : acoes.pausar}
              aoClicar={() => void run(sessao.status === 'pausada' ? 'retomar' : 'pausar')}
            />
            <AcaoButton
              acao="resolver_evento"
              rotulo="Resolver evento atual"
              icone={<Check size={18} aria-hidden />}
              pending={pending}
              bloqueio={acoes.resolver_evento}
              aoClicar={() => void run('resolver_evento')}
            />
            <AcaoButton
              acao="abrir_evento"
              rotulo="Abrir próximo evento"
              icone={<Share2 size={18} aria-hidden />}
              pending={pending}
              bloqueio={acoes.abrir_evento}
              aoClicar={() => void run('abrir_evento')}
            />
            <AcaoButton
              acao="resumo"
              rotulo="Roteiro de debate"
              icone={<FileText size={18} aria-hidden />}
              pending={pending}
              bloqueio={acoes.resumo}
              aoClicar={() => void run('resumo')}
            />
            <AcaoButton
              acao="reflexao"
              rotulo="Reflexão final"
              icone={<Lightbulb size={18} aria-hidden />}
              pending={pending}
              bloqueio={acoes.reflexao}
              aoClicar={() => void run('reflexao')}
            />
          </div>

          <div className="h-px w-full bg-nevoa-200" />

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {encerramentoFinal ? (
              <p className="flex items-start gap-2 text-sm text-terra-700">
                <Power size={16} className="mt-0.5 shrink-0 text-alerta-texto" aria-hidden />
                O encerramento está no botão principal acima: é ele que calcula os destaques e
                fecha a oficina.
              </p>
            ) : (
              <div className="flex flex-col gap-2">
                {!confirmEncerrar ? (
                  <AcaoPerigo
                    rotulo="Encerrar oficina"
                    icone={<Power size={16} aria-hidden />}
                    pending={pending}
                    ocupada={pending !== null}
                    bloqueio={acoes.encerrar}
                    aoConfirmar={() => setConfirmEncerrar(true)}
                  />
                ) : (
                  <ConfirmacaoPerigo
                    titulo="Encerrar agora?"
                    descricao="Encerrar calcula o resultado final, trava novas ações das equipes e fecha a etapa de resultado. Dá para voltar atrás com Reabrir etapa anterior enquanto a sessão não for encerrada."
                    confirmarRotulo="Sim, encerrar"
                    pending={pending === 'encerrar'}
                    aoConfirmar={() => void run('encerrar')}
                    aoCancelar={() => setConfirmEncerrar(false)}
                  />
                )}
              </div>
            )}

            <div className="flex flex-col gap-2">
              {!confirmReiniciar ? (
                <AcaoPerigo
                  rotulo="Reiniciar oficina"
                  icone={<RotateCcw size={16} aria-hidden />}
                  pending={pending}
                  ocupada={pending !== null}
                  bloqueio={acoes.reiniciar}
                  aoConfirmar={() => setConfirmReiniciar(true)}
                />
              ) : (
                <ConfirmacaoPerigo
                  titulo="Reiniciar a oficina?"
                  descricao="Reiniciar apaga pistas, eventos, soluções e indicadores e devolve a oficina ao início. As equipes e os jogadores continuam conectados."
                  confirmarRotulo="Sim, reiniciar"
                  pending={pending === 'reiniciar'}
                  aoConfirmar={() => void run('reiniciar')}
                  aoCancelar={() => setConfirmReiniciar(false)}
                />
              )}
            </div>
          </div>

          <div className="h-px w-full bg-nevoa-200" />

          <div className="flex flex-col gap-2">
            {!confirmExcluir ? (
              <AcaoPerigo
                rotulo="Excluir partida"
                icone={deleting ? <Loader2 size={16} className="animate-spin" aria-hidden /> : <Trash2 size={16} aria-hidden />}
                pending={null}
                ocupada={pending !== null || deleting}
                bloqueio={{ bloqueado: false, motivo: null }}
                aoConfirmar={() => setConfirmExcluir(true)}
              />
            ) : (
              <ConfirmacaoPerigo
                titulo="Excluir esta oficina inteira?"
                descricao="Some com equipes, pistas, eventos, soluções e resultado, e volta para a tela de criação. Não dá para desfazer."
                confirmarRotulo="Sim, excluir"
                pending={deleting}
                aoConfirmar={() => void handleDelete()}
                aoCancelar={() => {
                  setConfirmExcluir(false);
                  setDeleting(false);
                }}
              />
            )}
          </div>
        </div>
      </Degrau>

      {sessao.stage === 'investigacao' ? <CustoDasAcoes /> : null}

      {conteudo ? (
        <Degrau nivel="terraco" familia="claro" className="relative z-10 flex flex-col gap-4 p-6 animate-emergir">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <SectionHeading
              overline="Conteúdo de apoio"
              title={conteudo.rotulo}
              description="Pronto para levar para a roda de conversa. O roteiro vem em markdown e sai formatado aqui."
            />
            <Button variant="silencioso" size="grande" onClick={() => setConteudo(null)}>
              Fechar
            </Button>
          </div>

          {conteudo.texto.trim() === '' ? (
            <p className="text-sm text-terra-700">
              O roteiro veio vazio. Gere de novo: a oficina guarda o texto por partida, então a
              segunda tentativa costuma vir completo.
            </p>
          ) : (
            <MarkdownLite text={conteudo.texto} />
          )}

          {conteudo.perguntas.length > 0 ? (
            <div className="flex flex-col gap-2 border-t-2 border-nevoa-200 pt-4">
              <Rotulo>Perguntas para fechar</Rotulo>
              <ol className="flex flex-col gap-2">
                {conteudo.perguntas.map((pergunta, index) => (
                  <li key={`${index}-${pergunta}`} className="flex items-start gap-3 text-sm leading-relaxed text-terra-700">
                    <span className="dado shrink-0 text-financas-texto">{String(index + 1).padStart(2, '0')}</span>
                    <span>{pergunta}</span>
                  </li>
                ))}
              </ol>
            </div>
          ) : null}
        </Degrau>
      ) : null}

      <EventosSection sessao={sessao} eventoAtual={leitura.eventoAtual} leitura={leitura} />

      <section className="relative z-10 flex flex-col gap-4">
        <SectionHeading
          overline="Progresso das equipes"
          title={`${leitura.totalEquipes} perfis ${OFICINA_COMUNIDADE_NOME}`}
          description="Visão privada do professor: indicadores, pistas de cada equipe e o estado da proposta antes do resultado."
        />
        <div className="flex flex-col gap-4">
          {leitura.equipes.map((equipe) => {
            const perfilInfo = OFICINA_PERFIS_INFO[equipe.perfil as OficinaPerfil];
            const pistasDa = consolidarPistas(view.view.pistas.filter((p) => p.team_id === equipe.team_id));
            const solucao = view.view.solucoes.find((s) => s.team_id === equipe.team_id);
            const acoesEsgotadas = equipe.acoes_usadas >= MAX_ACOES_POR_ESTAGIO;
            const recebidas = pistasDa.filter((p) => p.recebida).length;
            const publicadas = pistasDa.filter((p) => p.publicada).length;

            return (
              <Degrau key={equipe.team_id} nivel="terraco" familia="neutro" className="flex flex-col gap-3 p-5">
                <div className="flex flex-wrap items-center gap-3">
                  <Pill tone="ativo">{perfilInfo?.rotulo ?? equipe.perfil}</Pill>
                  <span className="text-sm font-bold text-terra-900">{equipe.nome}</span>
                  <span className="ml-auto flex flex-wrap items-center gap-3 text-xs text-terra-700">
                    <span className={acoesEsgotadas ? 'dado font-bold text-alerta-texto' : 'dado'}>
                      {equipe.acoes_usadas}/{MAX_ACOES_POR_ESTAGIO} ações
                    </span>
                    <span className="dado">
                      {pistasDa.length} {pistasDa.length === 1 ? 'pista' : 'pistas'}
                    </span>
                    {publicadas > 0 ? (
                      <span className="dado flex items-center gap-1 text-verde-700">
                        <Share2 size={12} aria-hidden />
                        {publicadas} publicada{publicadas === 1 ? '' : 's'}
                      </span>
                    ) : null}
                    {recebidas > 0 ? (
                      <span className="dado flex items-center gap-1 text-azul-700">
                        <HeartHandshake size={12} aria-hidden />
                        {recebidas} recebida{recebidas === 1 ? '' : 's'}
                      </span>
                    ) : null}
                    {solucao ? (
                      <span className="flex items-center gap-1 font-bold text-verde-700">
                        <Check size={12} aria-hidden /> proposta enviada
                      </span>
                    ) : null}
                  </span>
                </div>

                <IndicadoresMini indicadores={equipe.indicadores} />

                {pistasDa.length > 0 ? (
                  <ul className="flex flex-wrap gap-1.5">
                    {pistasDa.map((pista) => {
                      const def = OFICINA_CONTENT.pistas.find((p) => p.id === pista.pistaId);
                      return (
                        <li
                          key={pista.pistaId}
                          className="flex items-center gap-1.5 rounded-full border border-nevoa-200 bg-nevoa-50 px-2.5 py-1 text-xs text-terra-700"
                        >
                          {pista.publicada ? (
                            <Share2 size={11} className="text-verde-600" aria-hidden />
                          ) : pista.recebida ? (
                            <HeartHandshake size={11} className="text-azul-600" aria-hidden />
                          ) : (
                            <Activity size={11} className="text-terra-500" aria-hidden />
                          )}
                          {def?.titulo ?? pista.pistaId}
                          {pista.linhas > 1 ? (
                            <span className="dado text-terra-500">×{pista.linhas}</span>
                          ) : null}
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

      <section className="relative z-10 flex flex-col gap-4">
        <SectionHeading
          overline="Território da comunidade"
          title={`${leitura.pistasDistintas} pistas descobertas pela turma`}
          description="Cada descoberta vira conhecimento para qualquer equipe agir junto."
        />
        <p className="flex flex-wrap items-center gap-2 text-sm text-terra-700">
          <Share2 size={15} className="text-verde-600" aria-hidden />
          {leitura.linhasPistas} registros de descoberta entre as equipes · {leitura.linhasCompartilhadas}{' '}
          publicados para as outras equipes
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {OFICINA_CONTENT.pistas.map((pista) => {
            const linhasDa = view.view.pistas.filter((p) => p.pista_id === pista.id);
            const consolidada = consolidarPistas(linhasDa);
            const achada = consolidada.length > 0;
            const publicadaEm = linhasDa.filter((p) => Boolean(p.compartilhada_em)).length;
            return (
              <div
                key={pista.id}
                className={['degrau banco flex flex-col gap-1 p-3.5', achada ? 'terr-claro' : 'terr-neutro'].join(' ')}
              >
                <span className="flex items-center gap-2 text-xs font-bold text-terra-900">
                  {publicadaEm > 0 ? (
                    <Share2 size={13} className="text-verde-600" aria-hidden />
                  ) : achada ? (
                    <Check size={13} className="text-verde-600" aria-hidden />
                  ) : (
                    <Hourglass size={13} className="text-terra-500" aria-hidden />
                  )}
                  {pista.titulo}
                </span>
                <span className="text-xs text-terra-700">
                  {achada
                    ? `${consolidada.length} ${consolidada.length === 1 ? 'equipe tem' : 'equipes têm'} esta pista · ${publicadaEm} publicada${publicadaEm === 1 ? '' : 's'}`
                    : 'Ainda não descoberta'}
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

// ---------------------------------------------------------------------------
// Blocos de UI
// ---------------------------------------------------------------------------

function CondicaoDeAvanco({ stage, metricas }: { stage: OficinaStage; metricas: Metrica[] }) {
  return (
    <section className="relative z-10 flex flex-col gap-3" aria-live="polite">
      <Rotulo>{CONDICAO_ROTULO[stage]}</Rotulo>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {metricas.map((metrica) => (
          <Degrau
            key={metrica.texto}
            nivel="banco"
            familia="claro"
            className="flex items-center gap-3 p-4 animate-emergir"
          >
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-nevoa-200 text-terra-900">
              {metrica.icone}
            </span>
            <span className="flex min-w-0 flex-col gap-0.5">
              <span className="dado-lg text-terra-900">{metrica.valor}</span>
              <span className="text-sm text-terra-700">{metrica.texto}</span>
            </span>
          </Degrau>
        ))}
      </div>
    </section>
  );
}

/**
 * Custo real das ações do estágio de investigação.
 *
 * `acoes_usadas` é um contador, e o professor que lê "4 de 7" não sabe por que
 * a equipe parou em 4 se nenhuma ação custa mais de 1. A lista sai do mesmo
 * dado que o servidor valida (`custo_acoes`), então não existe número repetido
 * em dois lugares.
 */
function CustoDasAcoes() {
  const caras = OFICINA_CONTENT.acoes.filter((acao) => acao.custo_acoes > 1);
  if (caras.length === 0) return null;

  return (
    <Degrau nivel="banco" familia="financas" className="relative z-10 flex flex-col gap-2 p-4 animate-emergir">
      <Rotulo className="text-financas-texto">Custo real das ações</Rotulo>
      <p className="text-sm text-terra-700">
        Cada equipe tem {MAX_ACOES_POR_ESTAGIO} ações no estágio. Estas gastam mais de uma:
      </p>
      <ul className="flex flex-wrap gap-2">
        {caras.map((acao) => (
          <li
            key={acao.key}
            className="flex items-center gap-2 rounded-full border border-nevoa-200 bg-nevoa-50 px-3 py-1.5 text-sm text-terra-900"
          >
            <span className="font-bold">{acao.nome}</span>
            <span className="dado text-financas-texto">{acao.custo_acoes} ações</span>
          </li>
        ))}
      </ul>
    </Degrau>
  );
}

function AcaoButton({
  acao,
  rotulo,
  icone,
  variante = 'secundario',
  pending,
  bloqueio,
  aoClicar,
}: {
  acao: OficinaHostAction;
  rotulo: string;
  icone: ReactNode;
  variante?: 'principal' | 'secundario';
  pending: OficinaHostAction | null;
  bloqueio: Bloqueio;
  aoClicar: () => void;
}) {
  const estaRodando = pending === acao;
  // Trava global: com uma mutação em voo, nenhum outro botão dispara — era o
  // caminho para chamar `avancar` duas vezes em dois cliques seguidos.
  const desabilitado = pending !== null || bloqueio.bloqueado;
  const motivo = !estaRodando && bloqueio.bloqueado ? bloqueio.motivo : null;

  return (
    <div className="flex flex-col gap-1.5">
      <Button
        variant={variante}
        size="grande"
        onClick={aoClicar}
        disabled={desabilitado}
        aria-busy={estaRodando || undefined}
        title={motivo ?? undefined}
      >
        {estaRodando ? <Loader2 size={16} className="animate-spin" aria-hidden /> : icone}
        {estaRodando ? 'Aguarde...' : rotulo}
      </Button>
      {motivo ? <p className="text-xs text-terra-500">{motivo}</p> : null}
    </div>
  );
}

/** Botão destrutivo fora da grade de ritmo: abre a confirmação, não executa. */
function AcaoPerigo({
  rotulo,
  icone,
  pending,
  ocupada,
  bloqueio,
  aoConfirmar,
}: {
  rotulo: string;
  icone: ReactNode;
  pending: OficinaHostAction | null;
  ocupada: boolean;
  bloqueio: Bloqueio;
  aoConfirmar: () => void;
}) {
  const desabilitado = ocupada || bloqueio.bloqueado;
  const motivo = bloqueio.bloqueado ? bloqueio.motivo : null;

  return (
    <div className="flex flex-col gap-1.5">
      <Button variant="perigo" size="grande" onClick={aoConfirmar} disabled={desabilitado} title={motivo ?? undefined}>
        {pending === 'encerrar' ? <Loader2 size={16} className="animate-spin" aria-hidden /> : icone}
        {rotulo}
      </Button>
      {motivo ? <p className="text-xs text-terra-500">{motivo}</p> : null}
    </div>
  );
}

function ConfirmacaoPerigo({
  titulo,
  descricao,
  confirmarRotulo,
  pending,
  aoConfirmar,
  aoCancelar,
}: {
  titulo: string;
  descricao: string;
  confirmarRotulo: string;
  pending: boolean;
  aoConfirmar: () => void;
  aoCancelar: () => void;
}) {
  return (
    <Degrau nivel="banco" familia="alerta" className="flex flex-col gap-3 p-4">
      <p className="text-sm font-bold text-terra-900">{titulo}</p>
      <p className="text-sm leading-relaxed text-terra-700">{descricao}</p>
      <div className="flex flex-wrap gap-2">
        <Button variant="perigo" size="grande" onClick={aoConfirmar} disabled={pending} aria-busy={pending || undefined}>
          {pending ? <Loader2 size={16} className="animate-spin" aria-hidden /> : null}
          {pending ? 'Aguarde...' : confirmarRotulo}
        </Button>
        <Button variant="silencioso" size="grande" onClick={aoCancelar} disabled={pending}>
          Cancelar
        </Button>
      </div>
    </Degrau>
  );
}

function EventosSection({
  sessao,
  eventoAtual,
  leitura,
}: {
  sessao: OficinaSessaoRow;
  eventoAtual: OficinaEventoRow | null;
  leitura: LeituraOficina;
}) {
  if (sessao.stage !== 'eventos') return null;

  const def = eventoAtual ? OFICINA_CONTENT.eventos.find((e) => e.key === eventoAtual.event_key) : null;
  const resolvido = eventoAtual?.status === 'resolvido';
  const votos = eventoAtual
    ? eventoAtual.contribuicoes
    : ({} as Record<string, { opcao_key: string; efeitos: Record<string, number> }>);

  return (
    <Degrau nivel="terraco" familia="neutro" className="relative z-10 flex flex-col gap-4 p-6">
      <SectionHeading
        overline="Evento coletivo"
        title={def?.titulo ?? 'Nenhum evento aberto'}
        description={
          eventoAtual
            ? resolvido
              ? 'Resolvido: os efeitos já foram aplicados a todas as equipes.'
              : 'Em aberto. Cada equipe escolhe uma resposta e o desfecho só aparece depois da resolução.'
            : 'O evento coletivo aparece quando o professor abre o primeiro da etapa.'
        }
      />

      {/*
        O desfecho é spoiler de evento: aparece só depois de resolvido. Durante
        a votação o professor precisa ler a narrativa, não o final.
      */}
      {def ? (
        <p className="text-base leading-relaxed text-terra-900">
          {resolvido ? def.desfecho : def.narrativa}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-4 border-t-2 border-nevoa-200 pt-4">
        <span className="flex items-baseline gap-2">
          <span className="dado-lg text-terra-900">
            {leitura.equipesQueVotaram} de {leitura.totalEquipes}
          </span>
          <span className="text-sm text-terra-700">equipes já votaram neste evento</span>
        </span>
        {Object.keys(votos).length > 0 ? (
          <ul className="flex flex-wrap gap-2">
            {Object.values(votos).map((voto, index) => {
              const opcao = def?.opcoes.find((o) => o.key === voto.opcao_key);
              return (
                <li
                  key={`${voto.opcao_key}-${index}`}
                  className="flex items-center gap-2 rounded-full border border-nevoa-200 bg-nevoa-50 px-3 py-1.5 text-sm text-terra-900"
                >
                  <Check size={13} className="text-verde-600" aria-hidden />
                  {opcao?.rotulo ?? `Opção ${voto.opcao_key}`}
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-sm text-terra-500">Nenhuma equipe votou ainda.</p>
        )}
      </div>
    </Degrau>
  );
}

function ResultadoSection({ view }: { view: OficinaHostViewResponse }) {
  const resultados: OficinaResultadoRow[] = view.view.resultados;
  if (resultados.length === 0) return null;

  return (
    <section className="relative z-10 flex flex-col gap-4">
      <SectionHeading
        overline="Resultado da oficina"
        title="Destaques da comunidade"
        description="Categorias atribuídas pela avaliação ao chegar no resultado ou ao encerrar. Não há vencedor: são seis leituras da mesma comunidade."
      />
      <div className="flex flex-col gap-3">
        {resultados.map((resultado) => {
          const equipe = view.view.equipes.find((e) => e.team_id === resultado.team_id);
          const perfilInfo = equipe ? OFICINA_PERFIS_INFO[equipe.perfil as OficinaPerfil] : null;
          return (
            <Degrau key={resultado.team_id} nivel="terraco" familia="neutro" className="flex flex-col gap-3 p-5">
              <div className="flex flex-wrap items-center gap-3">
                <Star size={14} className="text-financas" aria-hidden />
                <span className="text-sm font-bold text-terra-900">{equipe?.nome ?? 'Equipe'}</span>
                {perfilInfo ? (
                  <span className="text-xs text-terra-500">{perfilInfo.rotulo}</span>
                ) : null}
              </div>
              <ul className="flex flex-col gap-2">
                {(resultado.categorias ?? []).map((categoria) => (
                  <li key={categoria.categoria} className="flex flex-col gap-1 text-sm text-terra-700">
                    <span className="flex flex-wrap items-baseline gap-2">
                      {/* Rótulo canônico: o ID persistido pode ser o legado. */}
                      <span className="font-bold text-terra-900">{rotuloCategoria(categoria.categoria)}</span>
                      <span className="dado text-terra-500">{categoria.nota.toFixed(1)}</span>
                    </span>
                    <span>{categoria.razao}</span>
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