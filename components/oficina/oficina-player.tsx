'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Check,
  ChevronRight,
  CircleCheck,
  Handshake,
  HeartHandshake,
  Hourglass,
  Loader2,
  Lock,
  PauseCircle,
  RefreshCcw,
  Search,
  Share2,
  Sprout,
  TriangleAlert,
  Users,
} from 'lucide-react';
import {
  compartilharOficinaPista,
  executarOficinaAcao,
  fetchOficinaPanel,
  RequestError,
  submeterOficinaSolucao,
  votarOficinaEvento,
  type OficinaAcaoResult,
  type OficinaEu,
  type OficinaPanelResponse,
} from '@/lib/client-api';
import { playerSession, type PlayerSessionData } from '@/lib/client-session';
import { useGameChannel } from '@/hooks/use-game-channel';
import { Button, Pill, Rotulo } from '@/components/ui/primitives';
import { CerradoLandscape } from '@/components/game/cerrado-landscape';
import { OficinaMap } from '@/components/oficina/oficina-map';
import { OFICINA_CONTENT } from '@/data/oficina-content';
import { OFICINA_COMUNIDADE_NOME, OFICINA_IA_FALLBACKS } from '@/data/oficina-ia';
import {
  formatarDelta,
  MAX_ACOES_POR_ESTAGIO,
  normalizarCategoria,
  OFICINA_BLOCOS_INFO,
  OFICINA_CATEGORIAS_INFO,
  OFICINA_INDICADOR_BASE,
  OFICINA_INDICADORES_INFO,
  OFICINA_MARCADORES_INFO,
  OFICINA_PERFIS_INFO,
  OFICINA_STAGE_META,
  OFICINA_STAGES_ORDEM,
  rotuloCategoria,
  type OficinaAlunoView,
  type OficinaBlocoSolucao,
  type OficinaIndicador,
  type OficinaIndicadores,
  type OficinaMarcador,
  type OficinaPerfil,
  type OficinaPista,
  type OficinaPistaRow,
  type OficinaSolucao,
  type OficinaStage,
} from '@/types/oficina';

/**
 * Modo Oficina Safra DF · tela do aluno.
 *
 * Objetivo estético: o dia 06:20 do Diagnóstico vira uma "oficina em volta da
 * mesa da comunidade" — mesmo vocabulário visual (degrau, mirante, filete),
 * narrativa própria. Mobile-first: leitura em um toque, dois para agir.
 *
 * Três regras estruturam o arquivo, e as três vieram de defeito observado:
 *
 * 1. O aluno SEMPRE sabe o que fazer. `OFICINA_STAGE_META` é o contrato
 *    pedagógico do estágio e o cartão de missão é renderizado no topo de
 *    todas as etapas, inclusive as que não têm meta mensurável. O progresso
 *    mostrado é derivado do estado real da equipe, nunca um número decorativo
 *    inventado para preencher a barra.
 * 2. AÇÃO DEVOLVE RETORNO. Todo movimento executado publica o delta real dos
 *    indicadores, via `formatarDelta`, e toda recusa mostra o motivo que o
 *    servidor devolveu. Um `Aviso` de tipo `ok` que nunca aparece é um aviso
 *    que não existe.
 * 3. A tela do aluno não é a parede. A parede mostra a galeria inteira; aqui
 *    só aparece o resultado da própria equipe, porque ver a proposta de quem
 *    ainda não enviou mata a etapa de solução.
 *
 * O navegador nunca decide nada: cada movimento chama o route handler com o
 * token da sessão, e o servidor valida/calcula (mesmo princípio do Diagnóstico).
 */

// ---------------------------------------------------------------------------
// Contratos internos da tela
// ---------------------------------------------------------------------------

/** Aviso de retorno da última ação: título curto + o que aconteceu. */
export interface OficinaAviso {
  tipo: 'ok' | 'err';
  titulo: string;
  texto: string;
}

/**
 * Corredor de ação da tela.
 *
 * Devolve `boolean` (deu certo?) e aceita um tradutor do retorno do servidor:
 * é ele que transforma o payload em aviso visível, sem segunda volta ao
 * servidor e sem estado adivinhado no cliente.
 */
export interface ExecutarOficina {
  <T>(
    chave: string,
    acao: () => Promise<T>,
    retorno?: (dados: T) => OficinaAviso | null,
  ): Promise<boolean>;
}

/** Saldo de ações do estágio atual, com o teto vindo do contrato. */
export interface SaldoAcoes {
  usadas: number;
  restantes: number;
  teto: number;
}

/** Rascunho local da proposta: por bloco, a opção escolhida e o texto livre. */
export type RascunhoSolucao = Partial<
  Record<OficinaBlocoSolucao, { opcao: string; livre: string }>
>;

/** Estado real da etapa, medido no payload. `percentual` null = sem meta. */
export interface ProgressoMissao {
  estado: string;
  percentual: number | null;
}

export type OficinaStageLabel = Record<OficinaStage, string>;

const STAGE_ROTULO: OficinaStageLabel = {
  briefing: 'Briefing',
  investigacao: 'Investigação',
  eventos: 'Eventos',
  solucao: 'Proposta',
  resultado: 'Resultado',
  encerrada: 'Fechamento',
};

const PISTA_BY_ID = new Map(OFICINA_CONTENT.pistas.map((p) => [p.id, p]));
const EVENTO_BY_KEY = new Map(OFICINA_CONTENT.eventos.map((e) => [e.key, e]));
const MARCADORES_CONHECIDOS = Object.keys(OFICINA_MARCADORES_INFO) as OficinaMarcador[];

function classes(...values: (string | false | null | undefined)[]): string {
  return values.filter(Boolean).join(' ');
}

// ---------------------------------------------------------------------------
// Helpers de domínio (fonte única: o mesmo número em um lugar só)
// ---------------------------------------------------------------------------

/**
 * Saldo de ações do estágio.
 *
 * O teto vem do servidor (`maxAcoes`), com `MAX_ACOES_POR_ESTAGIO` de reserva:
 * o painel do aluno precisa continuar honesto na transição em que a rota ainda
 * não manda o campo, e um `NaN` na tela é pior do que o número do contrato.
 */
export function saldoDeAcoes(eu: OficinaEu): SaldoAcoes {
  const tetoInformado = eu.maxAcoes;
  const teto =
    typeof tetoInformado === 'number' && tetoInformado > 0
      ? tetoInformado
      : MAX_ACOES_POR_ESTAGIO;
  const usadas = Number.isFinite(eu.acoesUsadas) ? Math.max(0, eu.acoesUsadas) : 0;
  return { usadas, teto, restantes: Math.max(0, teto - usadas) };
}

/** Plural correto do custo: "custa 1 ação" / "custa 2 ações". */
export function textoDeCusto(custo: number): string {
  const n = Math.max(1, Math.round(custo));
  return `custa ${n} ${n === 1 ? 'ação' : 'ações'}`;
}

/** Motivo de bloqueio por saldo, ou `null` quando a ação cabe. */
export function motivoDeSaldo(saldo: SaldoAcoes, custo: number): string | null {
  if (saldo.restantes <= 0) {
    return `A equipe usou as ${saldo.teto} ações deste estágio.`;
  }
  if (custo > saldo.restantes) {
    return `Esta ação ${textoDeCusto(custo)} e sobram ${saldo.restantes} ${
      saldo.restantes === 1 ? 'ação' : 'ações'
    }.`;
  }
  return null;
}

/**
 * Delta dos indicadores em frase.
 *
 * `formatarDelta` pressupõe chaves do contrato; um delta vindo do servidor com
 * chave fora da lista derrubaria a tela inteira no meio da aula, então a chave
 * é filtrada antes de formatar.
 */
function textoDoDelta(delta: Partial<OficinaIndicadores>): string {
  const seguro: Partial<OficinaIndicadores> = {};
  for (const chave of Object.keys(OFICINA_INDICADORES_INFO) as OficinaIndicador[]) {
    const valor = delta[chave];
    if (typeof valor === 'number' && valor !== 0) seguro[chave] = valor;
  }
  return formatarDelta(seguro);
}

/** Aviso de sucesso de uma ação, com o impacto real e nada além dele. */
function avisoDeAcao(resultado: OficinaAcaoResult, contexto: string): OficinaAviso {
  const delta = textoDoDelta(resultado.acao.efeitos);
  const linhas = [
    contexto,
    delta ? `Indicadores: ${delta}.` : 'Os indicadores da equipe não mudaram com esta ação.',
  ];
  if (resultado.aviso) linhas.push(resultado.aviso);
  return { tipo: 'ok', titulo: 'Ação registrada', texto: linhas.join(' ') };
}

/** `perfil` chega como `string` do banco; o índice só existe se for do contrato. */
function perfilDe(perfil: string | null): OficinaPerfil | null {
  return perfil !== null && perfil in OFICINA_PERFIS_INFO ? (perfil as OficinaPerfil) : null;
}

function nomeDaEquipe(
  equipes: OficinaAlunoView['equipes'],
  teamId: string | null,
): string | null {
  if (teamId === null) return null;
  return equipes.find((equipe) => equipe.team_id === teamId)?.nome ?? null;
}

/**
 * `recebida_de` é coluna nova: enquanto a migração não rodou, a linha chega sem
 * a propriedade e um `=== null` classificaria toda pista como "recebida de
 * undefined". A ausência conta como descoberta própria.
 */
function origemDaPista(row: OficinaPistaRow): string | null {
  return typeof row.recebida_de === 'string' && row.recebida_de.length > 0
    ? row.recebida_de
    : null;
}

/** Blocos da proposta com opção escolhida ou texto livre digitado. */
function contarBlocosPreenchidos(rascunho: RascunhoSolucao): number {
  return OFICINA_CONTENT.cartoes.filter((cartao) => {
    const valor = rascunho[cartao.bloco];
    return Boolean(valor?.opcao || valor?.livre);
  }).length;
}

/** Rótulo da opção escolhida num bloco, para a leitura da proposta salva. */
function rotuloDaOpcao(bloco: OficinaBlocoSolucao, chaveOpcao: string): string {
  const cartao = OFICINA_CONTENT.cartoes.find((c) => c.bloco === bloco);
  return cartao?.opcoes.find((o) => o.key === chaveOpcao)?.rotulo ?? chaveOpcao;
}

function percentual(parte: number, total: number): number | null {
  if (total <= 0) return null;
  return Math.max(0, Math.min(100, Math.round((parte / total) * 100)));
}

/**
 * Progresso do estágio, medido no payload da equipe.
 *
 * O denominador nunca é inventado: onde o contrato não tem total (as três
 * etapas sem meta mensurável), o retorno é `null` e o cartão mostra só título e
 * objetivo, como manda `OficinaStageMeta.meta`.
 */
function progressoDaMissao(
  stage: OficinaStage,
  eu: OficinaEu,
  view: OficinaAlunoView,
  rascunho: RascunhoSolucao,
): ProgressoMissao | null {
  switch (stage) {
    case 'investigacao': {
      const descobertas = view.pistas.filter(
        (pista) => pista.team_id === eu.teamId && PISTA_BY_ID.has(pista.pista_id),
      ).length;
      const totalPistas = OFICINA_CONTENT.pistas.length;
      const saldo = saldoDeAcoes(eu);
      return {
        estado: `${descobertas} de ${totalPistas} pistas · ${saldo.usadas} de ${saldo.teto} ações usadas`,
        percentual: percentual(descobertas, totalPistas),
      };
    }
    case 'eventos': {
      const respondidas = view.eventos.filter((evento) =>
        Boolean(evento.contribuicoes[eu.teamId]),
      ).length;
      const sorteadas = view.sessao?.sorteio_eventos.length ?? 0;
      const total = sorteadas > 0 ? sorteadas : view.eventos.length;
      return {
        estado: `${respondidas} de ${total} situações respondidas`,
        percentual: percentual(respondidas, total),
      };
    }
    case 'solucao': {
      const total = OFICINA_CONTENT.cartoes.length;
      const preenchidos = contarBlocosPreenchidos(rascunho);
      return {
        estado: `${preenchidos} de ${total} blocos preenchidos`,
        percentual: percentual(preenchidos, total),
      };
    }
    case 'briefing':
    case 'resultado':
    case 'encerrada':
      return null;
  }
}

/**
 * A proposta salva, no formato único que o rascunho consome.
 *
 * A linha da tabela guarda a proposta inteira na coluna `blocos`
 * (`OficinaSolucaoRow.blocos` é a `OficinaSolucao`, não o mapa de blocos), e
 * `eu.solucao` do GET já vem no mesmo formato. Duas portas, um formato só.
 */
function solucaoSalvaDe(view: OficinaAlunoView, eu: OficinaEu): OficinaSolucao | null {
  const daView = view.minhaSolucao ?? null;
  if (daView) return daView.blocos;
  return eu.solucao ?? null;
}

/** Rascunho inicial a partir do que a equipe já salvou. */
function rascunhoDoPainel(panel: OficinaPanelResponse | null): RascunhoSolucao {
  const salvo = panel ? solucaoSalvaDe(panel.view, panel.eu) : null;
  if (!salvo) return {};
  const inicial: RascunhoSolucao = {};
  for (const cartao of OFICINA_CONTENT.cartoes) {
    const opcao = salvo.blocos[cartao.bloco];
    const livre = salvo.campos_livres[cartao.bloco] ?? '';
    if (opcao || livre) inicial[cartao.bloco] = { opcao: opcao ?? '', livre };
  }
  return inicial;
}

// ---------------------------------------------------------------------------
// Tela
// ---------------------------------------------------------------------------

export function OficinaPlayerApp({ session }: { session: PlayerSessionData }) {
  const router = useRouter();
  const [panel, setPanel] = useState<OficinaPanelResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [aviso, setAviso] = useState<OficinaAviso | null>(null);
  /*
   * O rascunho da proposta sobe para cá porque o cartão de missão precisa
   * contar os blocos preenchidos ENQUANTO a equipe preenche, e o cartão é
   * desenhado pelo `Shell`. `null` = ainda não houve edição local: o rascunho
   * nasce do painel salvo, sem efeito, sem chave e sem recarregar o estado
   * depois de um `refresh`.
   */
  const [rascunhoLocal, setRascunhoLocal] = useState<RascunhoSolucao | null>(null);
  const mountedRef = useRef(false);

  const refresh = useCallback(async () => {
    try {
      const next = await fetchOficinaPanel(session.token);
      if (!mountedRef.current) return;
      setPanel(next);
      setLoadError(null);
    } catch (err) {
      if (err instanceof RequestError && (err.code === 'unauthorized' || err.code === 'not_found')) {
        playerSession.clear();
        router.replace('/entrar');
        return;
      }
      setLoadError(err instanceof Error ? err.message : 'Não foi possível carregar a oficina.');
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [session.token, router]);

  useEffect(() => {
    mountedRef.current = true;
    let cancelled = false;
    void (async () => {
      await refresh();
      if (cancelled) return;
    })();
    const interval = window.setInterval(() => void refresh(), 60_000); // fallback reconexão
    return () => {
      cancelled = true;
      mountedRef.current = false;
      window.clearInterval(interval);
    };
  }, [refresh]);

  useGameChannel({
    gameId: panel?.game.id ?? null,
    onEvent: () => void refresh(),
    onTeamUpdate: () => void refresh(),
  });

  const run = useCallback<ExecutarOficina>(
    async function executar<T>(
      chave: string,
      acao: () => Promise<T>,
      retorno?: (dados: T) => OficinaAviso | null,
    ): Promise<boolean> {
      if (busyKey) return false;
      setBusyKey(chave);
      setAviso(null);
      try {
        const dados = await acao();
        const publicado = retorno ? retorno(dados) : null;
        if (publicado) setAviso(publicado);
        await refresh();
        return true;
      } catch (err) {
        /*
         * `RequestError` carrega a mensagem que o servidor montou com o motivo
         * real da recusa ("Você usou as 7 ações deste estágio", "Equipe já
         * votou neste evento"). Trocar isso por texto genérico apagava a única
         * informação que ajuda o aluno a entender o que aconteceu.
         */
        setAviso({
          tipo: 'err',
          titulo: 'Não deu certo',
          texto:
            err instanceof RequestError
              ? err.message
              : 'Não deu certo agora. Tente de novo em um instante.',
        });
        return false;
      } finally {
        if (mountedRef.current) setBusyKey(null);
      }
    },
    [busyKey, refresh],
  );

  const setRascunho = useCallback(
    (atualizar: (anterior: RascunhoSolucao) => RascunhoSolucao) => {
      setRascunhoLocal((atual) => atualizar(atual ?? rascunhoDoPainel(panel)));
    },
    [panel],
  );

  if (loading && !panel) {
    return (
      <div className="flex min-h-dvh items-center justify-center gap-3 text-terra-500">
        <Loader2 size={28} className="animate-spin" aria-hidden="true" />
        <p className="text-sm">Carregando a oficina...</p>
      </div>
    );
  }

  if (loadError && !panel) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
        <TriangleAlert size={28} className="text-alerta" aria-hidden="true" />
        <p className="max-w-sm text-sm text-terra-700">{loadError}</p>
        <Button type="button" variant="secundario" onClick={() => void refresh()}>
          <RefreshCcw size={16} aria-hidden="true" />
          Tentar de novo
        </Button>
      </div>
    );
  }

  if (!panel) return null;

  const { eu, view, briefing } = panel;
  const sessao = view.sessao;
  const aguardando = !sessao || sessao.status === 'aguardando';
  const encerrada = sessao?.status === 'encerrada' || sessao?.stage === 'encerrada';
  const pausada = sessao?.status === 'pausada';
  /*
   * Antes da abertura, o estágio mostrado é o briefing: a equipe não está em
   * investigação, está esperando o professor abrir a oficina, e dizer o
   * contrário seria a primeira mentira da tela.
   */
  const stageTela: OficinaStage = aguardando ? 'briefing' : (sessao?.stage ?? 'briefing');
  const rascunho = rascunhoLocal ?? rascunhoDoPainel(panel);
  const progresso = aguardando ? null : progressoDaMissao(stageTela, eu, view, rascunho);

  const conteudo: React.ReactNode = aguardando ? (
    <BriefingAguardando eu={eu} nome={OFICINA_COMUNIDADE_NOME} />
  ) : pausada ? (
    <PausadaOficina eu={eu} />
  ) : (
    <TelaDoStage
      stage={stageTela}
      eu={eu}
      view={view}
      briefing={briefing}
      run={run}
      aviso={aviso}
      rascunho={rascunho}
      setRascunho={setRascunho}
    />
  );

  return (
    <Shell
      eu={eu}
      sessaoStage={stageTela}
      statusPausado={pausada}
      encerrado={encerrada}
      progresso={progresso}
    >
      {conteudo}
    </Shell>
  );
}

interface PropsTela {
  eu: OficinaEu;
  view: OficinaAlunoView;
  briefing: OficinaPanelResponse['briefing'];
  run: ExecutarOficina;
  aviso: OficinaAviso | null;
  rascunho: RascunhoSolucao;
  setRascunho: (atualizar: (anterior: RascunhoSolucao) => RascunhoSolucao) => void;
}

/**
 * Roteiro das seis etapas, sem estado intermediário e sem tela genérica.
 *
 * É um COMPONENTE, não uma função returning JSX: `run` fecha um `ref` (o
 * `mountedRef` do refresh), e o React Compiler proíbe passar ref para função
 * chamada durante a renderização — a regra pega `telaDoStage(...)` e não pega
 * `<TelaDoStage />`.
 */
function TelaDoStage({ stage, ...props }: PropsTela & { stage: OficinaStage }): React.ReactNode {
  switch (stage) {
    case 'briefing':
      return <BriefingAtivo eu={props.eu} narrativa={props.briefing.narrativaInicial} />;
    case 'investigacao':
      return (
        <Investigacao eu={props.eu} view={props.view} run={props.run} aviso={props.aviso} />
      );
    case 'eventos':
      return (
        <EventosComunidade eu={props.eu} view={props.view} run={props.run} aviso={props.aviso} />
      );
    case 'solucao':
      return (
        <Solucao
          eu={props.eu}
          view={props.view}
          run={props.run}
          aviso={props.aviso}
          rascunho={props.rascunho}
          setRascunho={props.setRascunho}
        />
      );
    case 'resultado':
      return <Resultado eu={props.eu} view={props.view} aviso={props.aviso} />;
    case 'encerrada':
      return <Fechamento eu={props.eu} view={props.view} />;
  }
}

// ---------------------------------------------------------------------------
// Casca da tela
// ---------------------------------------------------------------------------

function Shell({
  eu,
  sessaoStage,
  statusPausado,
  encerrado,
  progresso,
  children,
}: {
  eu: OficinaEu;
  sessaoStage: OficinaStage;
  statusPausado: boolean;
  encerrado: boolean;
  progresso: ProgressoMissao | null;
  children: React.ReactNode;
}) {
  const perfil = perfilDe(eu.perfil);

  return (
    <main className="relative mx-auto flex min-h-dvh w-full max-w-2xl flex-col gap-5 px-4 py-5 sm:px-6">
      <div className="pointer-events-none fixed inset-0 z-0 opacity-20">
        <CerradoLandscape />
      </div>

      <div className="relative z-10 flex flex-1 flex-col gap-5">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <Sprout size={18} className="shrink-0 text-verde-700" aria-hidden="true" />
            <div className="flex min-w-0 flex-col">
              <span className="relevo-sm truncate text-terra-900">{eu.teamName}</span>
              {perfil ? (
                <Rotulo className="truncate">{OFICINA_PERFIS_INFO[perfil].rotulo}</Rotulo>
              ) : null}
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-3">
            <Pill tone={statusPausado ? 'alerta' : encerrado ? 'neutro' : 'ativo'}>
              {statusPausado
                ? 'PAUSADA'
                : encerrado
                  ? 'OFICINA'
                  : STAGE_ROTULO[sessaoStage].toUpperCase()}
            </Pill>
          </div>
        </header>

        {/* O cartão de missão é a altitude da tela e vem antes de tudo. */}
        <CartaoMissao stage={sessaoStage} progresso={progresso} />

        {children}
      </div>
    </main>
  );
}

// ---------------------------------------------------------------------------
// Cartão de missão · o que fazer nesta etapa
// ---------------------------------------------------------------------------

function CartaoMissao({
  stage,
  progresso,
}: {
  stage: OficinaStage;
  progresso: ProgressoMissao | null;
}) {
  const meta = OFICINA_STAGE_META[stage];
  const posicao = OFICINA_STAGES_ORDEM.indexOf(stage) + 1;

  return (
    <section className="degrau mirante terr-fundo-azul animate-emergir flex flex-col gap-3 p-5">
      <Rotulo className="text-(--cor-tinta-panel-azul)">
        Etapa {posicao} de {OFICINA_STAGES_ORDEM.length} · {STAGE_ROTULO[stage]}
      </Rotulo>

      <h1 className="relevo-md text-white">{meta.titulo}</h1>
      <p className="text-[15px] leading-[1.6] text-white">{meta.objetivo}</p>

      {/* `meta === null` é o contrato dizendo que a etapa não tem como medir. */}
      {meta.meta !== null && progresso ? (
        <div className="flex flex-col gap-2">
          <div className="filete-amanhecer" aria-hidden="true" />
          <p className="text-sm leading-[1.6] text-(--cor-tinta-panel-azul)">{meta.meta}</p>
          <BarraProgresso percentual={progresso.percentual} />
          <p className="dado text-xs font-bold text-white">{progresso.estado}</p>
        </div>
      ) : null}
    </section>
  );
}

/**
 * Barra de progresso do cartão de missão.
 *
 * O contrato proíbe animar `width` (reflow por quadro): a barra cresce por
 * `scaleX` a partir da esquerda, no compositor. `transform` cobre `p` de 0 sem
 * animação de nada, então a transição some no zero em vez de esticar a trilha.
 */
function BarraProgresso({ percentual: pct }: { percentual: number | null }) {
  const valor = Math.max(0, Math.min(100, pct ?? 0));
  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(valor)}
      aria-valuetext={`${Math.round(valor)} por cento da etapa`}
      className="h-2 w-full origin-left overflow-hidden rounded-full bg-white/15"
    >
      <div
        className="h-full w-full origin-left rounded-full bg-financas transition-transform duration-700"
        style={{ transform: `scaleX(${valor / 100})` }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Aviso de retorno
// ---------------------------------------------------------------------------

function Aviso({ aviso }: { aviso: OficinaAviso | null }) {
  return (
    <>
      {/*
        Região de anúncio permanente: precisa existir desde o primeiro render
        para que o leitor de tela leia o que entra depois. `sr-only` sai do
        fluxo, então ela não abre buraco no `gap` do container. O bloco visível
        é a mesma informação para quem enxerga, marcado `aria-hidden` para não
        announcementar duas vezes.
      */}
      <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {aviso ? `${aviso.titulo}. ${aviso.texto}` : ''}
      </p>

      {aviso ? (
        <div
          aria-hidden="true"
          className={classes(
            'degrau banco flex items-start gap-2 px-4 py-3',
            aviso.tipo === 'ok' ? 'terr-claro' : 'terr-alerta',
          )}
        >
          {aviso.tipo === 'ok' ? (
            <CircleCheck size={17} className="mt-0.5 shrink-0 text-sucesso" aria-hidden="true" />
          ) : (
            <TriangleAlert size={17} className="mt-0.5 shrink-0 text-alerta-texto" aria-hidden="true" />
          )}
          <span className="flex min-w-0 flex-col gap-0.5">
            <Rotulo className={aviso.tipo === 'ok' ? 'text-verde-700' : 'text-alerta-texto'}>
              {aviso.titulo}
            </Rotulo>
            <span className="text-sm leading-[1.55] text-terra-900">{aviso.texto}</span>
          </span>
        </div>
      ) : null}
    </>
  );
}

// ---------------------------------------------------------------------------
// Briefing
// ---------------------------------------------------------------------------

function BriefingAguardando({ eu, nome }: { eu: OficinaEu; nome: string }) {
  const perfil = perfilDe(eu.perfil);

  return (
    <div className="flex flex-col gap-4">
      <div className="degrau banco terr-fundo-verde animate-emergir flex flex-col gap-2 p-5">
        <Rotulo className="text-(--cor-tinta-panel-verde)">Oficina Safra DF</Rotulo>
        <h2 className="relevo-md text-white">{nome}</h2>
        <p className="text-sm text-(--cor-tinta-panel-verde)">
          Seis equipes, seis olhares sobre a mesma comunidade.
        </p>
        <div className="filete-amanhecer mt-1" aria-hidden="true" />
        <p className="text-sm leading-[1.6] text-white">
          O professor ainda não abriu a oficina. Assim que abrir, o briefing e o mapa da
          comunidade chegam nesta tela.
        </p>
      </div>

      {perfil ? <PerfilCard perfil={perfil} /> : null}

      <div className="flex items-center justify-center gap-2 py-4 text-sm text-terra-500">
        <Hourglass size={16} aria-hidden="true" />
        Aguardando a abertura do professor
      </div>
    </div>
  );
}

function PerfilCard({ perfil }: { perfil: OficinaPerfil }) {
  const info = OFICINA_PERFIS_INFO[perfil];

  return (
    <div className="degrau terraco terr-claro animate-emergir flex flex-col gap-3 p-5">
      <div className="flex items-center gap-3">
        {/* `verde-800` é a parede de painel escuro do sistema: o badge do avatar
            fica legível com `text-white` nos dois temas. */}
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-verde-800 text-white">
          <Users size={18} aria-hidden="true" />
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <Rotulo>Perfil da equipe</Rotulo>
          <p className="relevo-md text-terra-900">{info.rotulo}</p>
        </div>
      </div>
      <p className="text-sm leading-[1.6] text-terra-700">{info.pitch}</p>
    </div>
  );
}

function BriefingAtivo({ eu, narrativa }: { eu: OficinaEu; narrativa: string | null }) {
  const perfil = perfilDe(eu.perfil);
  const texto = narrativa ?? OFICINA_IA_FALLBACKS.narrativa_inicial;

  return (
    <div className="flex flex-col gap-4">
      <article className="degrau terraco terr-claro animate-emergir flex flex-col gap-4 p-5">
        <Rotulo>Boa Vista do Cerrado</Rotulo>
        <p className="relevo-md text-terra-900">Bem-vindos, equipe {eu.teamName}.</p>
        <div className="filete-amanhecer" aria-hidden="true" />
        {texto.split('\n\n').map((paragrafo, index) => (
          <p key={index} className="text-[15px] leading-[1.75] text-terra-700">
            {paragrafo}
          </p>
        ))}
      </article>

      {perfil ? <PerfilCard perfil={perfil} /> : null}

      <div className="flex items-center justify-center gap-2 py-2 text-sm text-terra-500">
        <Hourglass size={16} aria-hidden="true" />
        O professor libera a investigação quando a turma estiver pronta
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Investigação
// ---------------------------------------------------------------------------

function Investigacao({
  eu,
  view,
  run,
  aviso,
}: {
  eu: OficinaEu;
  view: OficinaAlunoView;
  run: ExecutarOficina;
  aviso: OficinaAviso | null;
}) {
  const saldo = saldoDeAcoes(eu);
  const minhasPistas = view.pistas.filter((pista) => pista.team_id === eu.teamId);
  const tagsEquipe = coletarTags(minhasPistas);

  return (
    <div className="flex flex-col gap-4">
      <Aviso aviso={aviso} />

      <OficinaMap eu={eu} view={view} saldo={saldo} run={run} />

      <SecaoPistas eu={eu} view={view} run={run} />

      <MarcadoresEquipe marcadores={eu.marcadores} />

      <AcoesComunidade tagsEquipe={tagsEquipe} saldo={saldo} run={run} />
    </div>
  );
}

/** Ações que mudam a vida do lugar. Compartilhar pista NÃO mora aqui. */
function AcoesComunidade({
  tagsEquipe,
  saldo,
  run,
}: {
  tagsEquipe: string[];
  saldo: SaldoAcoes;
  run: ExecutarOficina;
}) {
  /*
   * A ação `compartilhar` do acervo é o mesmo gesto do botão "Compartilhar" da
   * pista: dois botões para a mesma coisa, cobrando 1 ação pelo gesto que o
   * servidor trata de graça. Compartilhar acontece em UM lugar só, na lista de
   * descobertas, que é onde a equipe enxerga o que está entregando.
   */
  const acoes = OFICINA_CONTENT.acoes.filter(
    (acao) => !acao.investiga && acao.key !== 'compartilhar',
  );

  return (
    <div className="degrau terraco terr-claro animate-emergir flex flex-col gap-3 p-5">
      <Rotulo>Mover a comunidade</Rotulo>
      <p className="text-xs leading-[1.55] text-terra-500">
        Ações que mudam a vida do lugar. Algumas pedem uma pista antes de serem possíveis.
        Compartilhar descoberta é na lista de descobertas, acima: não gasta ação.
      </p>
      <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {acoes.map((acao) => {
          const custo = Math.max(1, acao.custo_acoes);
          const liberada =
            acao.requisito_tags.length === 0 ||
            acao.requisito_tags.some((tag) => tagsEquipe.includes(tag));
          const motivoSaldo = motivoDeSaldo(saldo, custo);
          const motivoRequisito = liberada
            ? null
            : `Requer uma pista com ${acao.requisito_tags.join(' ou ')}.`;
          const bloqueada = motivoSaldo !== null || motivoRequisito !== null;

          return (
            <li key={acao.key}>
              <button
                type="button"
                disabled={bloqueada}
                onClick={() =>
                  void run(
                    `acao-${acao.key}`,
                    () => executarOficinaAcao(playerSession.get()?.token ?? '', acao.key),
                    (resultado) => avisoDeAcao(resultado, `${acao.nome}: ${acao.descricao}`),
                  )
                }
                className={classes(
                  'degrau banco pisavel flex w-full flex-col gap-1 p-3 text-left',
                  bloqueada ? 'terr-neutro cursor-not-allowed opacity-60' : 'terr-claro',
                  'focus-visible:outline-none focus-visible:shadow-[inset_0_0_0_3px_var(--color-financas)]',
                )}
              >
                <span className="flex items-start justify-between gap-2">
                  <span className="text-sm font-bold text-terra-900">{acao.nome}</span>
                  <span className="dado shrink-0 text-xs font-bold text-terra-700">
                    {textoDeCusto(custo)}
                  </span>
                </span>
                <span className="text-xs leading-[1.5] text-terra-500">{acao.descricao}</span>
                {motivoRequisito ? (
                  <span className="flex items-center gap-1 text-[11px] font-bold text-alerta-texto">
                    <Lock size={11} aria-hidden="true" />
                    {motivoRequisito}
                  </span>
                ) : null}
                {motivoSaldo ? (
                  <span className="flex items-center gap-1 text-[11px] font-bold text-terra-500">
                    <Lock size={11} aria-hidden="true" />
                    {motivoSaldo}
                  </span>
                ) : null}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** O que a equipe já fez, com os rótulos do contrato. */
function MarcadoresEquipe({ marcadores }: { marcadores: string[] }) {
  const conhecidos = marcadores.filter((marcador): marcador is OficinaMarcador =>
    (MARCADORES_CONHECIDOS as string[]).includes(marcador),
  );
  if (conhecidos.length === 0) return null;

  return (
    <div className="degrau banco terr-claro animate-emergir flex flex-col gap-2 p-4">
      <Rotulo>O que a equipe já fez</Rotulo>
      <ul className="flex flex-wrap gap-2">
        {conhecidos.map((marcador) => (
          <li
            key={marcador}
            className="inline-flex items-center gap-1.5 rounded-full bg-verde-800 px-3 py-1.5 text-[11px] font-bold text-white"
          >
            <Check size={12} aria-hidden="true" />
            {OFICINA_MARCADORES_INFO[marcador]}
          </li>
        ))}
      </ul>
    </div>
  );
}

interface PistaDaEquipe {
  row: OficinaPistaRow;
  def: OficinaPista;
}

function SecaoPistas({ eu, view, run }: { eu: OficinaEu; view: OficinaAlunoView; run: ExecutarOficina }) {
  const minhas: PistaDaEquipe[] = view.pistas
    .filter((row) => row.team_id === eu.teamId)
    .map((row) => ({ row, def: PISTA_BY_ID.get(row.pista_id) }))
    .filter((item): item is PistaDaEquipe => Boolean(item.def));

  const deOutras: PistaDaEquipe[] = view.pistas
    .filter((row) => row.team_id !== eu.teamId && row.compartilhada_em !== null)
    .map((row) => ({ row, def: PISTA_BY_ID.get(row.pista_id) }))
    .filter((item): item is PistaDaEquipe => Boolean(item.def));

  return (
    <div className="animate-emergir flex flex-col gap-3">
      <div className="degrau banco terr-claro flex flex-col gap-3 p-4">
        <div className="flex items-center gap-2">
          <Search size={14} className="text-terra-500" aria-hidden="true" />
          <Rotulo>Descobertas da equipe</Rotulo>
        </div>

        {minhas.length === 0 ? (
          <p className="text-sm leading-[1.55] text-terra-500">
            Nenhuma pista ainda. Investigar e conversar pelo mapa é o caminho.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {minhas.map(({ row, def }) => {
              const recebidaDe = origemDaPista(row);
              const nomeOrigem = nomeDaEquipe(view.equipes, recebidaDe);
              const jaCompartilhada = Boolean(row.compartilhada_em);

              return (
                <li key={row.id} className="degrau terraco terr-claro flex flex-col gap-1 p-3">
                  <span className="text-sm font-bold text-terra-900">{def.titulo}</span>
                  <p className="text-xs leading-[1.5] text-terra-500">{def.texto}</p>

                  {/* De onde veio a pista: achado nosso ou entregue por outra equipe. */}
                  <p
                    className={classes(
                      'flex items-center gap-1 text-[11px] font-bold',
                      recebidaDe === null ? 'text-verde-700' : 'text-azul-700',
                    )}
                  >
                    {recebidaDe === null ? (
                      <>
                        <Check size={12} aria-hidden="true" />
                        Descoberta por nós · {def.origem}
                      </>
                    ) : (
                      <>
                        <HeartHandshake size={12} aria-hidden="true" />
                        Recebida de {nomeOrigem ?? 'outra equipe'} · {def.origem}
                      </>
                    )}
                  </p>

                  {recebidaDe !== null ? (
                    <p className="text-[11px] leading-[1.5] text-terra-500">
                      Esta pista veio de outra equipe: ela já foi publicada e não pode ser
                      compartilhada de novo.
                    </p>
                  ) : jaCompartilhada ? (
                    <p className="flex items-center gap-1 text-[11px] font-bold text-verde-700">
                      <Handshake size={12} aria-hidden="true" />
                      Entregue às outras equipes
                    </p>
                  ) : def.compartilhavel ? (
                    <div className="mt-1 flex flex-col gap-1">
                      <Button
                        type="button"
                        variant="secundario"
                        onClick={() =>
                          void run(
                            `compartilhar-${def.id}`,
                            () =>
                              compartilharOficinaPista(
                                playerSession.get()?.token ?? '',
                                def.id,
                              ),
                            () => ({
                              tipo: 'ok',
                              titulo: 'Pista compartilhada',
                              texto: `"${def.titulo}" foi entregue às outras equipes: elas recebem o mesmo achado e a equipe não gasta ação.`,
                            }),
                          )
                        }
                      >
                        <Share2 size={13} aria-hidden="true" />
                        Compartilhar
                      </Button>
                      <p className="text-[11px] leading-[1.5] text-terra-500">
                        Compartilhar entrega esta pista às outras equipes, que passam a
                        poder agir sobre ela. Não custa ação.
                      </p>
                    </div>
                  ) : (
                    <p className="text-[11px] leading-[1.5] text-terra-500">
                      Descoberta privada: esta pista não sai da equipe.
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {deOutras.length > 0 ? (
        <div className="degrau terraco terr-claro flex flex-col gap-3 p-4">
          <div className="flex items-center gap-2">
            <HeartHandshake size={14} className="text-terra-500" aria-hidden="true" />
            <Rotulo>O que outras equipes entregaram</Rotulo>
          </div>
          <ul className="flex flex-col gap-2">
            {deOutras.map(({ row, def }) => (
              <li key={row.id} className="flex flex-col gap-0.5 rounded-[5px] bg-nevoa-100 p-3">
                <span className="text-sm font-bold text-terra-900">{def.titulo}</span>
                <p className="text-xs leading-[1.5] text-terra-500">{def.texto}</p>
                <span className="text-[11px] font-bold text-azul-700">
                  Compartilhada por {nomeDaEquipe(view.equipes, row.team_id) ?? 'outra equipe'}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function coletarTags(pistas: readonly OficinaPistaRow[]): string[] {
  const tags = new Set<string>();
  for (const p of pistas) {
    const def = PISTA_BY_ID.get(p.pista_id);
    def?.tags.forEach((tag) => tags.add(tag));
  }
  return [...tags];
}

// ---------------------------------------------------------------------------
// Eventos da comunidade
// ---------------------------------------------------------------------------

function EventosComunidade({
  eu,
  view,
  run,
  aviso,
}: {
  eu: OficinaEu;
  view: OficinaAlunoView;
  run: ExecutarOficina;
  aviso: OficinaAviso | null;
}) {
  const sessao = view.sessao;
  if (!sessao?.evento_atual) {
    return (
      <div className="flex flex-col gap-4">
        <Aviso aviso={aviso} />
        <div className="degrau banco terr-claro animate-emergir flex flex-col gap-2 p-5 text-center">
          <Hourglass size={20} className="mx-auto text-terra-500" aria-hidden="true" />
          <p className="text-sm leading-[1.55] text-terra-500">
            O professor ainda não abriu o primeiro evento da comunidade. Quando abrir, a
            situação aparece aqui e cada equipe responde.
          </p>
        </div>
      </div>
    );
  }

  const def = EVENTO_BY_KEY.get(sessao.evento_atual);
  const row = view.eventos.find((e) => e.event_key === sessao.evento_atual);
  const totalEventos = Math.max(1, sessao.sorteio_eventos.length);
  const indiceAtual = Math.min(sessao.stage_progresso, totalEventos - 1) + 1;
  const meuVoto = row?.contribuicoes?.[eu.teamId]?.opcao_key ?? null;
  const resolvido = row?.status === 'resolvido';
  const eventoKey = sessao.evento_atual;

  const votos: Record<string, number> = {};
  if (row) {
    for (const contribuicao of Object.values(row.contribuicoes)) {
      votos[contribuicao.opcao_key] = (votos[contribuicao.opcao_key] ?? 0) + 1;
    }
  }

  if (!def) {
    return (
      <div className="degrau banco terr-claro animate-emergir flex flex-col gap-2 p-5">
        <p className="text-sm text-terra-700">Evento não encontrado no acervo.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <Aviso aviso={aviso} />

      <div className="flex items-center justify-between gap-3">
        <Pill tone={resolvido ? 'neutro' : 'ativo'}>
          SITUAÇÃO {indiceAtual} DE {totalEventos}
        </Pill>
        <span className="text-xs text-terra-500">
          {resolvido ? 'Resolvida' : 'A comunidade está decidindo'}
        </span>
      </div>

      {/* `terraco`: o mirante da tela é o cartão de missão, um por tela. */}
      <div className="degrau terraco terr-verde animate-emergir flex flex-col gap-2 p-5">
        <Rotulo className="text-verde-700">A comunidade chamou</Rotulo>
        <h2 className="relevo-md text-terra-900">{def.titulo}</h2>
        <p className="text-sm leading-[1.65] text-terra-700">{def.narrativa}</p>
      </div>

      {!resolvido ? (
        <div className="flex flex-col gap-2">
          <Rotulo>O que a equipe {eu.teamName} escolhe?</Rotulo>
          {def.opcoes.map((opcao) => {
            const eleita = meuVoto === opcao.key;
            return (
              <button
                key={opcao.key}
                type="button"
                disabled={Boolean(meuVoto)}
                onClick={() =>
                  void run(
                    `votar-${opcao.key}`,
                    () =>
                      votarOficinaEvento(
                        playerSession.get()?.token ?? '',
                        eventoKey,
                        opcao.key,
                      ),
                    (resultado) => ({
                      tipo: 'ok',
                      titulo: 'Resposta registrada',
                      texto: `A equipe escolheu "${resultado.contribuicao.opcao.rotulo}". Quando a comunidade decidir a situação, os efeitos chegam para todas as equipes.`,
                    }),
                  )
                }
                className={classes(
                  'degrau banco pisavel flex min-h-12 w-full flex-col gap-1 p-4 text-left',
                  eleita ? 'terr-verde' : 'terr-claro',
                  'disabled:cursor-not-allowed disabled:opacity-70',
                  'focus-visible:outline-none focus-visible:shadow-[inset_0_0_0_3px_var(--color-financas)]',
                )}
              >
                <span className="flex items-start justify-between gap-3">
                  <span className="text-sm font-bold text-terra-900">{opcao.rotulo}</span>
                  {eleita ? (
                    <CircleCheck size={17} className="shrink-0 text-verde-700" aria-hidden="true" />
                  ) : null}
                </span>
                <span className="text-xs leading-[1.5] text-terra-500">{opcao.detalhe}</span>
              </button>
            );
          })}
          {meuVoto ? (
            <p className="flex items-center gap-1.5 py-1 text-xs font-semibold text-terra-700">
              <Check size={13} className="text-sucesso" aria-hidden="true" />
              Resposta da equipe registrada. Quando a situação terminar, os efeitos chegam
              para todas as equipes.
            </p>
          ) : (
            <p className="py-1 text-xs text-terra-500">
              A resposta é da equipe e não muda depois de enviada. O professor abre o
              próximo quando todas responderem.
            </p>
          )}
        </div>
      ) : (
        <div className="degrau terraco terr-claro animate-emergir flex flex-col gap-3 p-5">
          <Rotulo>Como a comunidade decidiu</Rotulo>
          {Object.entries(votos)
            .sort((a, b) => b[1] - a[1])
            .map(([key, total], indice) => {
              const opcao = def.opcoes.find((o) => o.key === key);
              const rotulo = opcao?.rotulo ?? key;
              return (
                <div
                  key={key}
                  className={
                    indice === 0
                      ? 'rounded-[5px] bg-verde-600/25 px-3 py-2'
                      : 'rounded-[5px] bg-nevoa-100 px-3 py-2'
                  }
                >
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className={indice === 0 ? 'font-bold text-verde-700' : 'text-terra-700'}>
                      {rotulo}
                    </span>
                    <span className="dado font-bold text-terra-500">
                      {total} {total === 1 ? 'voto' : 'votos'}
                    </span>
                  </div>
                </div>
              );
            })}
          <p className="mt-1 text-sm leading-[1.65] text-terra-700">{def.desfecho}</p>
        </div>
      )}

      <div className="flex items-center justify-center gap-2 py-1 text-sm text-terra-500">
        <ChevronRight size={15} aria-hidden="true" />
        O professor conduz o próximo evento
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Solução (proposta)
// ---------------------------------------------------------------------------

function Solucao({
  eu,
  view,
  run,
  aviso,
  rascunho,
  setRascunho,
}: {
  eu: OficinaEu;
  view: OficinaAlunoView;
  run: ExecutarOficina;
  aviso: OficinaAviso | null;
  rascunho: RascunhoSolucao;
  setRascunho: (atualizar: (anterior: RascunhoSolucao) => RascunhoSolucao) => void;
}) {
  const blocos = OFICINA_CONTENT.cartoes;
  const perfil = perfilDe(eu.perfil);
  const enviadaEm = view.minhaSolucao?.enviada_em ?? null;

  const faltando = blocos.filter((cartao) => {
    const valor = rascunho[cartao.bloco];
    return !valor?.opcao && !valor?.livre;
  });

  async function salvar() {
    const blocosSalvar: Partial<Record<OficinaBlocoSolucao, string>> = {};
    const camposLivres: Partial<Record<OficinaBlocoSolucao, string>> = {};
    for (const cartao of blocos) {
      const valor = rascunho[cartao.bloco];
      if (valor?.opcao) blocosSalvar[cartao.bloco] = valor.opcao;
      if (valor?.livre) camposLivres[cartao.bloco] = valor.livre;
    }
    const preenchidos = contarBlocosPreenchidos(rascunho);
    await run(
      'salvar-solucao',
      () =>
        submeterOficinaSolucao(playerSession.get()?.token ?? '', {
          blocos: blocosSalvar,
          campos_livres: camposLivres,
        }),
      () => ({
        tipo: 'ok',
        titulo: 'Proposta salva',
        texto:
          preenchidos === blocos.length
            ? `Os ${preenchidos} blocos da proposta da equipe ${eu.teamName} foram salvos e entram no resultado da oficina. Dá para revisar e salvar de novo.`
            : `${preenchidos} de ${blocos.length} blocos salvos. Ainda faltam ${blocos.length - preenchidos}.`,
      }),
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <Aviso aviso={aviso} />

      <div className="degrau banco terr-claro animate-emergir flex flex-col gap-2 p-5">
        <Rotulo>Montando a proposta</Rotulo>
        <p className="text-sm leading-[1.6] text-terra-700">
          Montem o plano da {OFICINA_COMUNIDADE_NOME} cartão por cartão. Cada bloco é uma
          escolha da equipe: dá para trocar até o professor fechar a etapa.
        </p>
        {enviadaEm ? (
          <p className="flex items-center gap-1.5 text-xs font-bold text-verde-700">
            <Check size={13} aria-hidden="true" />
            Proposta salva em {rotuloDeDataHora(enviadaEm)}
          </p>
        ) : null}
      </div>

      <div className="degrau terraco terr-claro animate-emergir flex flex-col gap-5 p-5">
        {blocos.map((cartao, index) => {
          const valor = rascunho[cartao.bloco];
          return (
            <fieldset key={cartao.bloco} className="flex flex-col gap-2">
              <legend className="flex flex-col gap-0.5">
                <span className="text-sm font-bold text-terra-900">
                  {String(index + 1).padStart(2, '0')} · {OFICINA_BLOCOS_INFO[cartao.bloco].rotulo}
                </span>
                <span className="text-xs text-terra-500">
                  {OFICINA_BLOCOS_INFO[cartao.bloco].ajuda}
                </span>
              </legend>

              <div className="flex flex-col gap-1.5">
                {cartao.opcoes.map((opcao) => {
                  const selecionada = valor?.opcao === opcao.key;
                  return (
                    <button
                      key={opcao.key}
                      type="button"
                      aria-pressed={selecionada}
                      onClick={() => {
                        setRascunho((atual) => ({
                          ...atual,
                          [cartao.bloco]: { opcao: opcao.key, livre: atual[cartao.bloco]?.livre ?? '' },
                        }));
                      }}
                      className={classes(
                        'degrau banco pisavel flex min-h-12 w-full items-start gap-3 p-3 text-left',
                        selecionada ? 'terr-verde' : 'terr-claro',
                        'focus-visible:outline-none focus-visible:shadow-[inset_0_0_0_3px_var(--color-financas)]',
                      )}
                    >
                      <span
                        className={classes(
                          'mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2',
                          selecionada
                            ? 'border-verde-700 bg-verde-700 text-white'
                            : 'border-nevoa-200',
                        )}
                        aria-hidden="true"
                      >
                        {selecionada ? <Check size={11} /> : null}
                      </span>
                      <span className="text-sm leading-[1.5] text-terra-900">{opcao.rotulo}</span>
                    </button>
                  );
                })}
              </div>

              {cartao.campo_livre ? (
                <div className="flex flex-col gap-1">
                  <label
                    className="text-[11px] font-bold uppercase tracking-wide text-terra-500"
                    htmlFor={`livre-${cartao.bloco}`}
                  >
                    Ou escrever do próprio jeito
                  </label>
                  {/*
                    Campo livre: a superfície e a tinta saem do mesmo tema, senão o
                    rascunho some. `min-h-11` fecha o alvo de toque de 44px.

                    O foco usa `--color-foco`, e não `--color-foco-papel`: este
                    campo deixou de ser papel fixo (era `bg-white`) e passou a ser
                    `nevoa-100`, que INVERTE com o tema. `foco-papel` é o dourado
                    escuro que só funciona sobre branco; medida em 2.43:1 sobre a
                    noite, abaixo dos 3:1 que a WCAG exige de indicador de foco.
                    `foco` dá 8.45:1 no escuro e reancora em `#7a4d0b` no claro,
                    então é o único token que fecha nos DOIS temas.
                  */}
                  <textarea
                    id={`livre-${cartao.bloco}`}
                    value={valor?.livre ?? ''}
                    onChange={(event) => {
                      const texto = event.target.value;
                      setRascunho((atual) => ({
                        ...atual,
                        [cartao.bloco]: { opcao: atual[cartao.bloco]?.opcao ?? '', livre: texto },
                      }));
                    }}
                    rows={2}
                    maxLength={280}
                    placeholder="No que a equipe acredita para este bloco..."
                    className="w-full min-h-11 resize-y rounded-[5px] border border-nevoa-200 bg-nevoa-100 px-3 py-2 text-sm text-terra-900 outline-none placeholder:text-terra-500 focus:outline-none focus-visible:shadow-[inset_0_0_0_3px_var(--color-foco)]"
                  />
                </div>
              ) : null}
            </fieldset>
          );
        })}
      </div>

      <div className="degrau banco terr-claro animate-emergir flex flex-col gap-3 p-5">
        {perfil ? (
          <p className="text-sm leading-[1.6] text-terra-700">
            Lembrem do olhar de <span className="font-bold text-terra-900">{OFICINA_PERFIS_INFO[perfil].rotulo}</span>:
            {OFICINA_PERFIS_INFO[perfil].pitch}
          </p>
        ) : null}
        <p className="text-xs text-terra-500">
          {faltando.length === 0
            ? `Os ${blocos.length} blocos estão preenchidos. Revisem antes de salvar.`
            : `Faltam ${faltando.length} ${faltando.length === 1 ? 'bloco' : 'blocos'}: ${faltando
                .map((cartao) => OFICINA_BLOCOS_INFO[cartao.bloco].rotulo.toLowerCase())
                .join(', ')}.`}
        </p>
        <Button
          type="button"
          variant="principal"
          size="grande"
          onClick={() => void salvar()}
        >
          Salvar proposta da equipe
          <ChevronRight size={18} aria-hidden="true" />
        </Button>
      </div>
    </div>
  );
}

/** `enviada_em` é ISO do servidor; data inválida não pode virar "Invalid Date". */
function rotuloDeDataHora(iso: string): string {
  const data = new Date(iso);
  if (Number.isNaN(data.getTime())) return 'um momento anterior';
  return data.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

// ---------------------------------------------------------------------------
// Resultado · a galeria é da parede, aqui só o destaque da própria equipe
// ---------------------------------------------------------------------------

function Resultado({
  eu,
  view,
  aviso,
}: {
  eu: OficinaEu;
  view: OficinaAlunoView;
  aviso: OficinaAviso | null;
}) {
  return (
    <div className="flex flex-col gap-4">
      <Aviso aviso={aviso} />

      <GaleriaDestaques view={view} eu={eu} />

      <MinhaSolucao view={view} eu={eu} />

      <PainelDaComunidade view={view} />

      <div className="flex items-center justify-center gap-2 py-1 text-sm text-terra-500">
        <Hourglass size={15} aria-hidden="true" />
        O professor conduz o fechamento quando a turma estiver pronta
      </div>
    </div>
  );
}

/**
 * Galeria de destaques, sem ordem e sem pódio.
 *
 * A oficina não ranqueia: seis equipes respondem à mesma comunidade e não há
 * Placement único. Ordenar por nota e mostrar "top 3" transformava um exercício
 * de equivalência em competição e escondia quatro das seis soluções.
 *
 * A tela do aluno recebe APENAS o próprio resultado: a galeria completa é da
 * parede da sala.
 */
function GaleriaDestaques({ view, eu }: { view: OficinaAlunoView; eu: OficinaEu }) {
  const meu = view.meuResultado;
  const equipe = view.equipes.find((e) => e.team_id === eu.teamId) ?? null;

  if (!meu || meu.categorias.length === 0) {
    return (
      <div className="degrau banco terr-claro animate-emergir flex flex-col gap-2 p-5">
        <Rotulo>Destaques da oficina</Rotulo>
        <p className="text-sm leading-[1.6] text-terra-700">
          Os destaques aparecem aqui quando o professor abrir o resultado. Não há
          vencedor: as seis equipes construíram uma resposta para a mesma comunidade.
        </p>
      </div>
    );
  }

  return (
    <div className="degrau terraco terr-claro animate-emergir flex flex-col gap-3 p-5">
      <Rotulo>Destaques de {equipe?.nome ?? eu.teamName}</Rotulo>
      <ul className="flex flex-col gap-2">
        {meu.categorias.map((categoria) => {
          const normalizada = normalizarCategoria(categoria.categoria);
          const explicacao = normalizada ? OFICINA_CATEGORIAS_INFO[normalizada].explicacao : null;
          return (
            <li key={categoria.categoria} className="degrau banco terr-claro flex flex-col gap-1 p-4">
              <span className="text-sm font-bold text-terra-900">
                {rotuloCategoria(categoria.categoria)}
              </span>
              <span className="text-sm leading-[1.6] text-terra-700">{categoria.razao}</span>
              {explicacao ? (
                <span className="text-[11px] leading-[1.5] text-terra-500">{explicacao}</span>
              ) : null}
            </li>
          );
        })}
      </ul>
      <p className="text-xs leading-[1.55] text-terra-500">
        A parede da sala mostra o destaque das seis equipes lado a lado. A oficina não
        elege vencedor: elas são ângulos diferentes do mesmo problema.
      </p>
    </div>
  );
}

/** A proposta da PRÓPRIA equipe: o que a turma construiu, em 13 blocos. */
function MinhaSolucao({ view, eu }: { view: OficinaAlunoView; eu: OficinaEu }) {
  const solucao = solucaoSalvaDe(view, eu);
  const blocos = solucao ? OFICINA_CONTENT.cartoes : [];
  const preenchidos = blocos
    .map((cartao) => {
      const opcao = solucao?.blocos[cartao.bloco];
      const livre = solucao?.campos_livres[cartao.bloco];
      if (!opcao && !livre) return null;
      return { bloco: cartao.bloco, texto: opcao ? rotuloDaOpcao(cartao.bloco, opcao) : null, livre: livre ?? '' };
    })
    .filter((item): item is { bloco: OficinaBlocoSolucao; texto: string | null; livre: string } =>
      Boolean(item),
    );

  if (preenchidos.length === 0) {
    return (
      <div className="degrau banco terr-claro animate-emergir flex flex-col gap-2 p-5">
        <Rotulo>Proposta da equipe</Rotulo>
        <p className="text-sm leading-[1.6] text-terra-700">
          {solucao
            ? `A proposta de ${eu.teamName} foi salva com nenhum bloco preenchido. A equipe pode voltar à etapa da proposta e montá-la de novo.`
            : `A proposta de ${eu.teamName} ainda não foi salva.`}
        </p>
      </div>
    );
  }

  return (
    <div className="degrau banco terr-claro animate-emergir flex flex-col gap-3 p-4">
      <Rotulo>O que a nossa equipe construiu</Rotulo>
      <ul className="flex flex-col gap-2">
        {preenchidos.map((item) => (
          <li key={item.bloco} className="flex flex-col gap-0.5">
            <span className="text-xs font-bold text-terra-500">
              {OFICINA_BLOCOS_INFO[item.bloco].rotulo}
            </span>
            <span className="text-sm leading-[1.5] text-terra-900">
              {item.texto ?? item.livre}
            </span>
            {item.texto && item.livre ? (
              <span className="text-sm leading-[1.5] text-terra-700">{item.livre}</span>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Só indicadores de todas as equipes: o suficiente para "como vão as outras".
 *
 * Sem ordem e sem pódio. A parede da sala é que mostra a galeria; aqui a equipe
 * acompanha o rumor da sala, não o ranking.
 */
function PainelDaComunidade({ view }: { view: OficinaAlunoView }) {
  if (view.equipes.length === 0) return null;
  return (
    <div className="degrau terraco terr-claro animate-emergir flex flex-col gap-3 p-5">
      <Rotulo>Painel da comunidade</Rotulo>
      <p className="text-xs leading-[1.55] text-terra-500">
        Os oito indicadores de cada equipe depois da investigação e das respostas. Toda
        equipe parte de {OFICINA_INDICADOR_BASE} e cada ação move um deles.
      </p>
      {view.equipes.map((equipe) => {
        const perfilEquipe = perfilDe(equipe.perfil);
        return (
          <div
            key={equipe.team_id}
            className="flex flex-col gap-2 border-b border-nevoa-200 pb-3 last:border-0 last:pb-0"
          >
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="font-bold text-terra-900">{equipe.nome}</span>
              <span className="dado text-xs font-bold text-terra-500">
                {perfilEquipe ? OFICINA_PERFIS_INFO[perfilEquipe].rotulo : 'Perfil a definir'}
              </span>
            </div>
            <IndicadoresMini indicadores={equipe.indicadores} />
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Fechamento · a oficina acabou, o plano tem nome e sobrenome
// ---------------------------------------------------------------------------

function Fechamento({ eu, view }: { eu: OficinaEu; view: OficinaAlunoView }) {
  const router = useRouter();
  const perfil = perfilDe(eu.perfil);
  const feedback = perfil ? OFICINA_IA_FALLBACKS.feedback_por_perfil[perfil] : null;
  const encerrada = view.sessao?.status === 'encerrada';

  return (
    <div className="flex flex-col gap-4">
      <div className="degrau mirante terr-fundo-verde animate-emergir flex flex-col gap-2 p-5">
        <Rotulo className="text-(--cor-tinta-panel-verde)">Oficina concluída</Rotulo>
        <h1 className="relevo-md text-white">
          A {OFICINA_COMUNIDADE_NOME} tem um plano com nome e sobrenome.
        </h1>
        <div className="filete-amanhecer mt-1" aria-hidden="true" />
        <p className="text-sm leading-[1.65] text-white">
          A equipe {eu.teamName} entregou a proposta e as outras cinco equipas construíram a
          mesma entrega a partir de outro ângulo. A parede da sala mostra as seis lado a
          lado.
        </p>
      </div>

      {encerrada ? <IndicadoresFinais eu={eu} view={view} /> : null}

      {perfil ? (
        <div className="degrau terraco terr-claro animate-emergir flex flex-col gap-2 p-5">
          <Rotulo>O que o olhar de {OFICINA_PERFIS_INFO[perfil].rotulo} deixou</Rotulo>
          <p className="text-sm leading-[1.7] text-terra-700">{OFICINA_PERFIS_INFO[perfil].pitch}</p>
          {feedback ? (
            <p className="text-sm leading-[1.7] text-terra-700">{feedback}</p>
          ) : null}
        </div>
      ) : null}

      <div className="degrau banco terr-claro animate-emergir flex flex-col gap-3 p-5">
        <Rotulo>Para pensar com a turma</Rotulo>
        <ol className="flex list-decimal flex-col gap-2 pl-5">
          {OFICINA_CONTENT.reflexao_perguntas.slice(0, 5).map((pergunta) => (
            <li key={pergunta} className="text-sm leading-[1.6] text-terra-700">
              {pergunta}
            </li>
          ))}
        </ol>
      </div>

      {/*
        Reflexão final: o texto do servidor quando existe, o estático do acervo
        quando não. Nenhum fetch novo — a oficina já rodou inteira sem IA.

        `terraco`, e não `mirante`: o mirante da tela encerrada é o painel de
        abertura acima, um por tela, como manda o contrato visual.
      */}
      <div className="degrau terraco terr-claro animate-emergir flex flex-col gap-2 p-5">
        <p className="text-base leading-[1.7] text-terra-900">
          {OFICINA_IA_FALLBACKS.reflexao_final}
        </p>
      </div>

      <div className="flex justify-center py-2">
        <Button
          type="button"
          variant="secundario"
          onClick={() => {
            playerSession.clear();
            router.replace('/entrar');
          }}
        >
          Voltar ao início
          <RefreshCcw size={15} aria-hidden="true" />
        </Button>
      </div>
    </div>
  );
}

function IndicadoresFinais({ eu, view }: { eu: OficinaEu; view: OficinaAlunoView }) {
  const equipe = view.equipes.find((e) => e.team_id === eu.teamId);
  if (!equipe) return null;

  return (
    <div className="degrau banco terr-claro animate-emergir flex flex-col gap-3 p-4">
      <Rotulo>Indicadores finais de {equipe.nome}</Rotulo>
      <IndicadoresMini indicadores={equipe.indicadores} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Estado pausado
// ---------------------------------------------------------------------------

function PausadaOficina({ eu }: { eu: OficinaEu }) {
  return (
    <div className="degrau banco terr-fundo-azul animate-emergir flex items-start gap-3 p-5">
      <PauseCircle size={22} className="mt-0.5 shrink-0 text-azul-300" aria-hidden="true" />
      <div className="flex flex-col gap-1">
        <Rotulo className="text-azul-300">Oficina pausada</Rotulo>
        <p className="text-sm leading-[1.6] text-azul-300">
          A oficina da {OFICINA_COMUNIDADE_NOME} parou por um instante. Quando o professor
          retomar, a equipe {eu.teamName} continua de onde parou: nada do que foi feito se
          perde.
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Indicadores mini
// ---------------------------------------------------------------------------

/**
 * Grade dos oito indicadores.
 *
 * Exportado porque `oficina-teacher-panel` desenha o mesmo componente: duas
 * implementações de "como o professor lê um indicador" divergem no primeiro
 * ajuste de paleta.
 */
export function IndicadoresMini({ indicadores }: { indicadores: OficinaIndicadores | null }) {
  if (!indicadores) return null;
  const entradas = (Object.keys(OFICINA_INDICADORES_INFO) as OficinaIndicador[])
    .map((chave) => [chave, indicadores[chave]] as [OficinaIndicador, number])
    .filter(([, valor]) => typeof valor === 'number' && Number.isFinite(valor));

  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4">
      {entradas.map(([chave, valor]) => (
        <div key={chave} className="flex flex-col gap-0.5">
          <span className="text-[11px] leading-[1.4] text-terra-500">
            {OFICINA_INDICADORES_INFO[chave].rotulo}
          </span>
          <div className="flex items-center gap-2">
            {/*
              Contrato proíbe animar `width` (reflow a cada quadro): a barra
              cresce por `scaleX` a partir da esquerda, no compositor.
              `transform` também cobre `p` de 0, então a transição dobra no zero.
            */}
            <div className="h-1.5 w-full origin-left overflow-hidden rounded-full bg-nevoa-200">
              <div
                className="h-full w-full origin-left rounded-full bg-verde-600 transition-transform duration-700"
                style={{ transform: `scaleX(${Math.max(0, Math.min(100, valor)) / 100})` }}
              />
            </div>
            <span className="dado w-6 text-right text-[11px] font-bold text-terra-700">
              {Math.round(valor)}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}