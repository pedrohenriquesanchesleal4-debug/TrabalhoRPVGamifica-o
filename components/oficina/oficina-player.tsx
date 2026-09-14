'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Check,
  ChevronRight,
  CircleCheck,
  HeartHandshake,
  Hourglass,
  Loader2,
  Lock,
  MessageCircle,
  PauseCircle,
  RefreshCcw,
  Search,
  Share2,
  Sprout,
  Store,
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
  type OficinaPanelResponse,
} from '@/lib/client-api';
import { playerSession, type PlayerSessionData } from '@/lib/client-session';
import { useGameChannel } from '@/hooks/use-game-channel';
import { Button, Pill, Rotulo } from '@/components/ui/primitives';
import { CerradoLandscape } from '@/components/game/cerrado-landscape';
import { OFICINA_CONTENT } from '@/data/oficina-content';
import { OFICINA_COMUNIDADE_NOME, OFICINA_IA_FALLBACKS } from '@/data/oficina-ia';
import {
  OFICINA_BLOCOS_INFO,
  OFICINA_INDICADORES_INFO,
  OFICINA_PERFIS_INFO,
  type OficinaBlocoSolucao,
  type OficinaIndicador,
  type OficinaIndicadores,
  type OficinaPerfil,
  type OficinaPista,
  type OficinaStage,
} from '@/types/oficina';

/**
 * Modo Oficina Safra DF · tela do aluno.
 *
 * Objetivo estético: o dia 06:20 do Diagnóstico vira uma "oficina em volta da
 * mesa da comunidade" — mesmo vocabulário visual (degraus, mirantes, filetes),
 * narrativa própria. Mobile-first: leitura em um toque, dois para agir.
 *
 * O navegador nunca decide nada: cada movimento chama o route handler com o
 * token da sessão, e o servidor valida/calcula (mesmo princípio do Diagnóstico).
 */

export type OficinaStageLabel = Record<OficinaStage, string>;

const STAGE_ROTULO: OficinaStageLabel = {
  briefing: 'Briefing',
  investigacao: 'Investigação',
  eventos: 'Eventos',
  solucao: 'Proposta',
  resultado: 'Resultado',
  encerrada: 'Fechamento',
};

export const MAX_ACOES_UI = 4;

const PISTA_BY_ID = new Map(OFICINA_CONTENT.pistas.map((p) => [p.id, p]));
const EVENTO_BY_KEY = new Map(OFICINA_CONTENT.eventos.map((e) => [e.key, e]));

function classes(...values: (string | false | null | undefined)[]): string {
  return values.filter(Boolean).join(' ');
}

function indicadorDePerfil(perfil: OficinaPerfil): OficinaIndicador {
  const mapa: Partial<Record<OficinaPerfil, OficinaIndicador>> = {
    produtores: 'viabilidade',
    cooperativa: 'cooperacao',
    comercializacao: 'mercado',
    logistica: 'organizacao',
    juventude_tech: 'conhecimento',
    articulacao: 'inclusao',
  };
  return mapa[perfil] ?? 'confianca';
}

export function OficinaPlayerApp({ session }: { session: PlayerSessionData }) {
  const router = useRouter();
  const [panel, setPanel] = useState<OficinaPanelResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ tipo: 'ok' | 'err'; texto: string } | null>(null);
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
    const interval = window.setInterval(() => void refresh(), 12_000);
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

  const run = useCallback(
    async (key: string, action: () => Promise<unknown>) => {
      if (busyKey) return;
      setBusyKey(key);
      setNotice(null);
      try {
        await action();
        await refresh();
      } catch (err) {
        setNotice({
          tipo: 'err',
          texto:
            err instanceof RequestError
              ? err.message
              : 'Não deu certo agora. Tente de novo em um instante.',
        });
      } finally {
        setBusyKey(null);
      }
    },
    [busyKey, refresh],
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

  if (!sessao || sessao.status === 'aguardando') {
    return (
      <Shell
        eu={eu}
        sessaoStage={'briefing'}
        statusPausado={false}
        encerrado={sessao?.status === 'encerrada'}
      >
        <BriefingAguardando eu={eu} nome={OFICINA_COMUNIDADE_NOME} />
      </Shell>
    );
  }

  if (sessao.stage === 'encerrada') {
    return (
      <Shell
        eu={eu}
        sessaoStage={'encerrada'}
        statusPausado={false}
        encerrado
      >
        <Fechamento eu={eu} view={view} />
      </Shell>
    );
  }

  const jogoPausado = sessao.status === 'pausada';

  return (
    <Shell
      eu={eu}
      sessaoStage={sessao.stage}
      statusPausado={jogoPausado}
      encerrado={false}
    >
      {jogoPausado ? (
        <PausadaOficina eu={eu} />
      ) : sessao.stage === 'briefing' ? (
        <BriefingAtivo eu={eu} narrativa={briefing?.narrativaInicial} />
      ) : sessao.stage === 'investigacao' ? (
        <Investigacao eu={eu} view={view} busyKey={busyKey} run={run} notice={notice} />
      ) : sessao.stage === 'eventos' ? (
        <EventosComunidade eu={eu} view={view} busyKey={busyKey} run={run} notice={notice} />
      ) : sessao.stage === 'solucao' ? (
        <Solucao eu={eu} busyKey={busyKey} run={run} notice={notice} />
      ) : (
        <Resultado eu={eu} view={view} notice={notice} />
      )}
    </Shell>
  );
}

function Shell({
  eu,
  sessaoStage,
  statusPausado,
  encerrado,
  children,
}: {
  eu: { teamName: string; perfil: string | null };
  sessaoStage: OficinaStage;
  statusPausado: boolean;
  encerrado: boolean;
  children: React.ReactNode;
}) {
  const perfil = (eu.perfil as OficinaPerfil | null) ?? null;

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

        {children}
      </div>
    </main>
  );
}

function Aviso({ notice }: { notice: { tipo: 'ok' | 'err'; texto: string } | null }) {
  if (!notice) return null;
  return (
    <div
      role="alert"
      className={classes(
        'degrau banco flex items-start gap-2 rounded-[5px] px-4 py-3 text-sm font-semibold',
        notice.tipo === 'ok' ? 'brightness-[0.99]' : 'bg-nevoa-100 text-alerta-texto',
      )}
    >
      {notice.tipo === 'ok' ? (
        <CircleCheck size={16} className="mt-0.5 shrink-0 text-sucesso" aria-hidden="true" />
      ) : (
        <TriangleAlert size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
      )}
      <span>{notice.texto}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Briefing
// ---------------------------------------------------------------------------

function BriefingAguardando({
  eu,
  nome,
}: {
  eu: { teamName: string; perfil: string | null };
  nome: string;
}) {
  const perfil = (eu.perfil as OficinaPerfil | null) ?? null;

  return (
    <div className="flex flex-col gap-4">
      <div className="degrau mirante terr-fundo-verde animate-emergir flex flex-col gap-2 p-5">
        <Rotulo className="text-(--cor-tinta-panel-verde)">Oficina Safra DF</Rotulo>
        <h1 className="relevo-md text-white">{nome}</h1>
        <p className="text-sm text-(--cor-tinta-panel-verde)">
          Seis equipes, seis olhares sobre a mesma comunidade.
        </p>
        <div aria-hidden="true" className="filete-amanhecer mt-1" />
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
  const indicador = indicadorDePerfil(perfil);

  return (
    <div className="degrau terraco terr-claro animate-emergir flex flex-col gap-3 p-5">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-terra-800 text-white">
          <Users size={18} aria-hidden="true" />
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <Rotulo>Perfil da equipe</Rotulo>
          <p className="relevo-md text-terra-900">{info.rotulo}</p>
        </div>
      </div>
      <p className="text-sm leading-[1.6] text-terra-700">{info.pitch}</p>
      <div className="flex items-center gap-2 text-xs font-bold text-terra-500">
        <Store size={13} aria-hidden="true" />
        Olhar que ajuda a colocar no centro:{' '}
        {OFICINA_INDICADORES_INFO[indicador].rotulo}
      </div>
    </div>
  );
}

function BriefingAtivo({
  eu,
  narrativa,
}: {
  eu: { teamName: string; perfil: string | null };
  narrativa: string | null;
}) {
  const perfil = (eu.perfil as OficinaPerfil | null) ?? null;
  const texto = narrativa ?? OFICINA_IA_FALLBACKS.narrativa_inicial;

  return (
    <div className="flex flex-col gap-4">
      <div className="degrau mirante terr-fundo-verde animate-emergir flex flex-col gap-2 p-5">
        <Rotulo className="text-(--cor-tinta-panel-verde)">Briefing · {OFICINA_COMUNIDADE_NOME}</Rotulo>
        <p className="relevo-md text-white">Bem-vindos, equipe {eu.teamName}.</p>
      </div>

      <article className="degrau terraco terr-claro animate-emergir flex flex-col gap-4 p-5">
        {texto.split('\n\n').map((paragrafo, index) => (
          <p key={index} className="text-[15px] leading-[1.75] text-terra-800">
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
  busyKey,
  run,
  notice,
}: {
  eu: OficinaPanelResponse['eu'];
  view: OficinaPanelResponse['view'];
  busyKey: string | null;
  run: (key: string, action: () => Promise<unknown>) => Promise<void>;
  notice: { tipo: 'ok' | 'err'; texto: string } | null;
}) {
  const minhasPistas = view.pistas.filter((p) => p.team_id === eu.teamId);
  const pistasCompartilhadas = view.pistas.filter(
    (p) => p.team_id !== eu.teamId && p.compartilhada_em,
  );
  const tagsEquipe = coletarTags(minhasPistas);
  const restantes = Math.max(0, MAX_ACOES_UI - eu.acoesUsadas);

  return (
    <div className="flex flex-col gap-4">
      <Aviso notice={notice} />

      <div className="degrau mirante terr-fundo-azul animate-emergir flex items-start justify-between gap-3 p-5">
        <div className="flex flex-col gap-1">
          <Rotulo className="text-(--cor-tinta-panel-azul)">Investigação</Rotulo>
          <p className="relevo-sm text-white">
            Andem pela comunidade, conversem, achem as pistas.
          </p>
        </div>
        <span className="shrink-0 rounded-[5px] bg-white/15 px-3 py-1.5 text-sm font-bold text-white">
          {restantes}/{MAX_ACOES_UI} ações
        </span>
      </div>

      <SecaoPistas minhas={minhasPistas} compartilhadas={pistasCompartilhadas} busyKey={busyKey} run={run} />

      <div className="degrau terraco terr-claro animate-emergir flex flex-col gap-3 p-5">
        <Rotulo>Mapa da comunidade</Rotulo>
        <ul className="flex flex-col divide-y divide-terra-200">
          {OFICINA_CONTENT.locais.map((local) => {
            const personagem = local.personagem_id
              ? OFICINA_CONTENT.personagens.find((p) => p.id === local.personagem_id)
              : null;
            const alvoPista = local.pista_id ? PISTA_BY_ID.get(local.pista_id) : null;
            const jaDescoberta = alvoPista
              ? minhasPistas.some((p) => p.pista_id === alvoPista.id)
              : false;

            return (
              <li key={local.id} className="flex flex-col gap-2 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <span className="relevo-sm text-terra-900">{local.nome}</span>
                    <span className="text-xs text-terra-500">{local.situacao}</span>
                  </div>
                  {jaDescoberta ? (
                    <span className="shrink-0 rounded-[5px] bg-verde-100 px-2 py-1 text-[11px] font-bold text-verde-800">
                      <Check size={11} className="mr-1 inline" aria-hidden="true" />
                      Pista achada
                    </span>
                  ) : null}
                </div>

                <p className="text-sm leading-[1.6] text-terra-700">{local.problema}</p>

                {personagem ? (
                  <p className="rounded-[5px] bg-terra-50 px-3 py-2 text-[13px] italic leading-[1.6] text-terra-600">
                    “{personagem.fala}”
                  </p>
                ) : null}

                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="secundario"
                    disabled={Boolean(busyKey) || restantes === 0 || jaDescoberta}
                    onClick={() =>
                      void run(`investigar-${local.id}`, () =>
                        executarOficinaAcao(playerSession.get()?.token ?? '', 'investigar', local.id),
                      )
                    }
                  >
                    <Search size={14} aria-hidden="true" />
                    Investigar
                  </Button>
                  {personagem ? (
                    <Button
                      type="button"
                      variant="secundario"
                      disabled={Boolean(busyKey) || restantes === 0}
                      onClick={() =>
                        void run(`conversar-${personagem.id}`, () =>
                          executarOficinaAcao(playerSession.get()?.token ?? '', 'conversar', personagem.id),
                        )
                      }
                    >
                      <MessageCircle size={14} aria-hidden="true" />
                      Conversar
                    </Button>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="degrau terraco terr-claro animate-emergir flex flex-col gap-3 p-5">
        <Rotulo>Mover a comunidade</Rotulo>
        <p className="text-xs text-terra-600">
          Ações que mudam a vida do lugar. Algumas pedem uma pista antes de serem possíveis.
        </p>
        <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {OFICINA_CONTENT.acoes
            .filter((acao) => !acao.investiga)
            .map((acao) => {
              const liberada = acao.requisito_tags.length === 0
                ? true
                : acao.requisito_tags.some((tag) => tagsEquipe.includes(tag));
              return (
                <li key={acao.key}>
                  <button
                    type="button"
                    disabled={!liberada || Boolean(busyKey) || restantes < (acao.custo_acoes ?? 1)}
                    onClick={() =>
                      void run(`acao-${acao.key}`, () =>
                        executarOficinaAcao(playerSession.get()?.token ?? '', acao.key),
                      )
                    }
                    className={classes(
                      'degrau banco pisavel flex w-full flex-col gap-1 p-3 text-left',
                      'disabled:cursor-not-allowed disabled:opacity-45',
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-bold text-terra-900">{acao.nome}</span>
                      <span className="text-xs font-bold text-terra-500">
                        {acao.custo_acoes} ação
                      </span>
                    </div>
                    <p className="text-xs leading-[1.5] text-terra-600">{acao.descricao}</p>
                    {!liberada ? (
                      <span className="flex items-center gap-1 text-[11px] font-bold text-alerta-texto">
                        <Lock size={11} aria-hidden="true" />
                        Requer uma pista com {acao.requisito_tags.join(' ou ')}
                      </span>
                    ) : null}
                  </button>
                </li>
              );
            })}
        </ul>
      </div>
    </div>
  );
}

function SecaoPistas({
  minhas,
  compartilhadas,
  busyKey,
  run,
}: {
  minhas: { pista_id: string; compartilhada_em: string | null }[];
  compartilhadas: { pista_id: string }[];
  busyKey: string | null;
  run: (key: string, action: () => Promise<unknown>) => Promise<void>;
}) {
  const itens = (lista: { pista_id: string; compartilhada_em?: string | null }[]) =>
    lista
      .map((p) => PISTA_BY_ID.get(p.pista_id))
      .filter((p): p is OficinaPista => Boolean(p));

  return (
    <div className="animate-emergir flex flex-col gap-3">
      <div className="degrau banco terr-claro flex flex-col gap-3 p-4">
        <div className="flex items-center gap-2">
          <Search size={14} className="text-terra-500" aria-hidden="true" />
          <Rotulo>Descobertas da equipe</Rotulo>
        </div>
        {itens(minhas).length === 0 ? (
          <p className="text-sm text-terra-600">
            Nenhuma pista ainda. Investigar e conversar pelo mapa é o caminho.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {itens(minhas).map((pista) => (
              <li key={pista.id} className="degrau terraco terr-claro flex flex-col gap-1 p-3">
                <span className="text-sm font-bold text-terra-900">{pista.titulo}</span>
                <p className="text-xs leading-[1.5] text-terra-600">{pista.texto}</p>
                <div className="mt-1 flex items-center justify-between gap-2">
                  <span className="text-[11px] text-terra-500">{pista.origem}</span>
                  {!minhas.find((m) => m.pista_id === pista.id)?.compartilhada_em ? (
                    <Button
                      type="button"
                      variant="secundario"
                      disabled={Boolean(busyKey)}
                      onClick={() =>
                        void run(`compartilhar-${pista.id}`, () =>
                          compartilharOficinaPista(playerSession.get()?.token ?? '', pista.id),
                        )
                      }
                    >
                      <Share2 size={13} aria-hidden="true" />
                      Compartilhar
                    </Button>
                  ) : (
                    <span className="flex items-center gap-1 text-[11px] font-bold text-verde-700">
                      <Check size={12} aria-hidden="true" />
                      Compartilhada
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {itens(compartilhadas).length > 0 ? (
        <div className="degrau terraco terr-claro flex flex-col gap-3 p-4">
          <div className="flex items-center gap-2">
            <HeartHandshake size={14} className="text-terra-500" aria-hidden="true" />
            <Rotulo>Pistas compartilhadas por outras equipes</Rotulo>
          </div>
          <ul className="flex flex-col gap-2">
            {itens(compartilhadas).map((pista) => (
              <li key={pista.id} className="flex flex-col gap-0.5 rounded-[5px] bg-terra-50 p-3">
                <span className="text-sm font-bold text-terra-900">{pista.titulo}</span>
                <p className="text-xs leading-[1.5] text-terra-600">{pista.texto}</p>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function coletarTags(pistas: { pista_id: string }[]): string[] {
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
  busyKey,
  run,
  notice,
}: {
  eu: OficinaPanelResponse['eu'];
  view: OficinaPanelResponse['view'];
  busyKey: string | null;
  run: (key: string, action: () => Promise<unknown>) => Promise<void>;
  notice: { tipo: 'ok' | 'err'; texto: string } | null;
}) {
  const sessao = view.sessao;
  if (!sessao?.evento_atual) {
    return (
      <div className="flex flex-col gap-4">
        <Aviso notice={notice} />
        <div className="degrau banco terr-claro animate-emergir flex flex-col gap-2 p-5 text-center">
          <Hourglass size={20} className="mx-auto text-terra-500" aria-hidden="true" />
          <p className="text-sm text-terra-600">
            O professor ainda não abriu o primeiro evento da comunidade.
          </p>
        </div>
      </div>
    );
  }

  const def = EVENTO_BY_KEY.get(sessao.evento_atual);
  const row = view.eventos.find((e) => e.event_key === sessao.evento_atual);
  const totalEventos = sessao.sorteio_eventos.length;
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
      <Aviso notice={notice} />

      <div className="flex items-center justify-between gap-3">
        <Pill tone={resolvido ? 'neutro' : 'ativo'}>
          EVENTO {indiceAtual} DE {totalEventos}
        </Pill>
        <span className="text-xs text-terra-500">
          {resolvido ? 'Resolvido' : 'A comunidade está decidindo'}
        </span>
      </div>

      <div className="degrau mirante terr-fundo-verde animate-emergir flex flex-col gap-2 p-5">
        <Rotulo className="text-(--cor-tinta-panel-verde)">A comunidade chamou</Rotulo>
        <h2 className="relevo-md text-white">{def.titulo}</h2>
        <p className="text-sm leading-[1.65] text-white">{def.narrativa}</p>
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
                disabled={Boolean(busyKey) || Boolean(meuVoto)}
                onClick={() =>
                  void run(`votar-${opcao.key}`, () =>
                    votarOficinaEvento(playerSession.get()?.token ?? '', eventoKey, opcao.key),
                  )
                }
                className={classes(
                  'degrau banco pisavel flex flex-col gap-1 p-4 text-left',
                  eleita ? 'terr-verde' : 'terr-claro',
                  'disabled:cursor-not-allowed',
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <span className="text-sm font-bold text-terra-900">{opcao.rotulo}</span>
                  {eleita ? (
                    <CircleCheck size={17} className="shrink-0 text-verde-700" aria-hidden="true" />
                  ) : null}
                </div>
                <p className="text-xs leading-[1.5] text-terra-600">{opcao.detalhe}</p>
              </button>
            );
          })}
          {meuVoto ? (
            <p className="flex items-center gap-1.5 py-1 text-xs font-semibold text-terra-500">
              <Check size={13} className="text-sucesso" aria-hidden="true" />
              Voto registrado. Quando a comunidade decidir, os efeitos chegam para todas as equipes.
            </p>
          ) : null}
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
                      ? 'rounded-[5px] bg-verde-100 px-3 py-2'
                      : 'rounded-[5px] bg-terra-50 px-3 py-2'
                  }
                >
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className={indice === 0 ? 'font-bold text-verde-800' : 'text-terra-700'}>
                      {rotulo}
                    </span>
                    <span className="font-bold text-terra-500">{total} voto(s)</span>
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
  busyKey,
  run,
  notice,
}: {
  eu: OficinaPanelResponse['eu'];
  busyKey: string | null;
  run: (key: string, action: () => Promise<unknown>) => Promise<void>;
  notice: { tipo: 'ok' | 'err'; texto: string } | null;
}) {
  const blocos = OFICINA_CONTENT.cartoes;
  const perfil = (eu.perfil as OficinaPerfil | null) ?? null;
  const salvo = eu.solucao;

  const [rascunho, setRascunho] = useState<Partial<Record<OficinaBlocoSolucao, { opcao: string; livre: string }>>>(
    () => {
      const inicial: Partial<Record<OficinaBlocoSolucao, { opcao: string; livre: string }>> = {};
      if (salvo) {
        for (const cartao of blocos) {
          const opcao = salvo.blocos[cartao.bloco];
          const livre = salvo.campos_livres[cartao.bloco] ?? '';
          if (opcao || livre) inicial[cartao.bloco] = { opcao: opcao ?? '', livre };
        }
      }
      return inicial;
    },
  );

  function escolherOpcao(bloco: OficinaBlocoSolucao, opcao: string) {
    setRascunho((atual) => ({ ...atual, [bloco]: { opcao, livre: atual[bloco]?.livre ?? '' } }));
  }

  function digitarLivre(bloco: OficinaBlocoSolucao, texto: string) {
    setRascunho((atual) => ({ ...atual, [bloco]: { opcao: atual[bloco]?.opcao ?? '', livre: texto } }));
  }

  async function salvar() {
    const blocosSalvar: Partial<Record<OficinaBlocoSolucao, string>> = {};
    const camposLivres: Partial<Record<OficinaBlocoSolucao, string>> = {};
    for (const cartao of blocos) {
      const valor = rascunho[cartao.bloco];
      if (valor?.opcao) blocosSalvar[cartao.bloco] = valor.opcao;
      if (valor?.livre) camposLivres[cartao.bloco] = valor.livre;
    }
    await run('salvar-solucao', () =>
      submeterOficinaSolucao(playerSession.get()?.token ?? '', { blocos: blocosSalvar, campos_livres: camposLivres }),
    );
  }

  const faltando = blocos.filter((cartao) => {
    const valor = rascunho[cartao.bloco];
    return !valor?.opcao && !valor?.livre;
  });

  return (
    <div className="flex flex-col gap-4">
      <Aviso notice={notice} />

      <div className="degrau mirante terr-fundo-azul animate-emergir flex flex-col gap-2 p-5">
        <Rotulo className="text-(--cor-tinta-panel-azul)">Hora da proposta</Rotulo>
        <p className="relevo-sm text-white">
          Montem o plano da {OFICINA_COMUNIDADE_NOME} cartão por cartão.
        </p>
        <p className="text-sm text-(--cor-tinta-panel-azul)">
          {faltando.length === 0
            ? 'Tudo preenchido. Revisem antes de enviar.'
            : `${faltando.length} cartão(ões) ainda em branco.`}
        </p>
      </div>

      <div className="degrau terraco terr-claro animate-emergir flex flex-col gap-5 p-5">
        {blocos.map((cartao, index) => (
          <fieldset key={cartao.bloco} className="flex flex-col gap-2">
            <legend className="flex flex-col gap-0.5">
              <span className="text-sm font-bold text-terra-900">
                {String(index + 1).padStart(2, '0')} · {OFICINA_BLOCOS_INFO[cartao.bloco].rotulo}
              </span>
              <span className="text-xs text-terra-500">{OFICINA_BLOCOS_INFO[cartao.bloco].ajuda}</span>
            </legend>

            <div className="flex flex-col gap-1.5">
              {cartao.opcoes.map((opcao) => {
                const selecionada = rascunho[cartao.bloco]?.opcao === opcao.key;
                return (
                  <button
                    key={opcao.key}
                    type="button"
                    onClick={() => {
                        escolherOpcao(cartao.bloco, opcao.key);
                      }}
                    className={classes(
                      'degrau banco pisavel flex w-full items-start gap-3 p-3 text-left',
                      selecionada ? 'terr-verde' : 'terr-claro',
                    )}
                  >
                    <span
                      className={classes(
                        'mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2',
                        selecionada
                          ? 'border-verde-700 bg-verde-700 text-white'
                          : 'border-terra-300',
                      )}
                    >
                      {selecionada ? <Check size={11} aria-hidden="true" /> : null}
                    </span>
                    <span className="text-sm leading-[1.5] text-terra-800">{opcao.rotulo}</span>
                  </button>
                );
              })}
            </div>

            {cartao.campo_livre ? (
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-bold uppercase tracking-wide text-terra-500" htmlFor={`livre-${cartao.bloco}`}>
                  Ou escrever do próprio jeito
                </label>
                <textarea
                  id={`livre-${cartao.bloco}`}
                  value={rascunho[cartao.bloco]?.livre ?? ''}
                  onChange={(event) => {
                    digitarLivre(cartao.bloco, event.target.value);
                  }}
                  rows={2}
                  maxLength={280}
                  placeholder="No que a equipe acredita para este bloco..."
                  className="w-full resize-y rounded-[5px] border border-terra-300 bg-white px-3 py-2 text-sm text-terra-900 outline-none placeholder:text-terra-400 focus:border-verde-600"
                />
              </div>
            ) : null}
          </fieldset>
        ))}
      </div>

      <div className="degrau banco terr-claro animate-emergir flex flex-col gap-3 p-5">
        {perfil ? (
          <p className="text-sm leading-[1.6] text-terra-700">
            Lembrem do olhar de <span className="font-bold text-terra-900">{OFICINA_PERFIS_INFO[perfil].rotulo}</span>:
            {OFICINA_PERFIS_INFO[perfil].pitch}
          </p>
        ) : null}
        <Button
          type="button"
          variant="principal"
          size="grande"
          disabled={Boolean(busyKey)}
          onClick={() => void salvar()}
        >
          {busyKey === 'salvar-solucao' ? (
            <>
              <Loader2 size={17} className="animate-spin" aria-hidden="true" />
              Salvando proposta...
            </>
          ) : (
            <>
              Salvar proposta da equipe
              <ChevronRight size={18} aria-hidden="true" />
            </>
          )}
        </Button>
        <p className="text-center text-xs text-terra-500">
          Dá para revisar e salvar de novo até o professor fechar o estágio.
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Resultado
// ---------------------------------------------------------------------------

function Resultado({
  eu,
  view,
  notice,
}: {
  eu: OficinaPanelResponse['eu'];
  view: OficinaPanelResponse['view'];
  notice: { tipo: 'ok' | 'err'; texto: string } | null;
}) {
  const meu = view.resultados.find((r) => r.team_id === eu.teamId) ?? null;

  return (
    <div className="flex flex-col gap-4">
      <Aviso notice={notice} />

      <div className="degrau mirante terr-fundo-verde animate-emergir flex flex-col gap-2 p-5">
        <Rotulo className="text-(--cor-tinta-panel-verde)">Propostas na mesa</Rotulo>
        <p className="relevo-sm text-white">
          A comunidade ouviu as seis propostas. Estes são os destaques:
        </p>
      </div>

      {meu !== null ? (
        <div className="degrau terraco terr-claro animate-emergir flex flex-col gap-3 p-5">
          <Rotulo>Destaques de {eu.teamName}</Rotulo>
          <ul className="flex flex-col gap-2">
            {meu.categorias.map((cat) => (
              <li key={cat.categoria} className="degrau banco p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-sm font-bold text-terra-900">{cat.razao}</span>
                    <span className="text-xs text-terra-500">nota {Math.round(cat.nota)}</span>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <div className="degrau banco terr-claro animate-emergir flex flex-col gap-2 p-5">
          <p className="text-sm text-terra-700">
            Os destaques aparecem aqui quando o professor abrir o resultado.
          </p>
        </div>
      )}

      <div className="degrau terraco terr-claro animate-emergir flex flex-col gap-3 p-5">
        <Rotulo>Painel da comunidade</Rotulo>
        {view.equipes.map((equipe) => (
          <div key={equipe.team_id} className="border-b border-terra-200 pb-2 last:border-0">
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="font-bold text-terra-900">{equipe.nome}</span>
              <span className="text-xs text-terra-500">
                {OFICINA_PERFIS_INFO[equipe.perfil]?.rotulo ?? ''}
              </span>
            </div>
            <IndicadoresMini indicadores={equipe.indicadores} />
          </div>
        ))}
      </div>

      <div className="flex items-center justify-center gap-2 py-1 text-sm text-terra-500">
        <Hourglass size={15} aria-hidden="true" />
        O professor conduz o fechamento quando a turma estiver pronta
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Fechamento
// ---------------------------------------------------------------------------

function Fechamento({
  eu,
  view,
}: {
  eu: OficinaPanelResponse['eu'];
  view: OficinaPanelResponse['view'];
}) {
  const router = useRouter();
  const perfil = (eu.perfil as OficinaPerfil | null) ?? null;
  const feedback = perfil ? OFICINA_IA_FALLBACKS.feedback_por_perfil[perfil] : null;
  const interessesPorIr = sortResults(view);

  return (
    <div className="flex flex-col gap-4">
      <div className="degrau mirante terr-fundo-verde animate-emergir flex flex-col gap-2 p-5">
        <Rotulo className="text-(--cor-tinta-panel-verde)">Oficina concluída</Rotulo>
        <h1 className="relevo-md text-white">
          A {OFICINA_COMUNIDADE_NOME} tem um plano com nome e sobrenome.
        </h1>
      </div>

      {view.sessao?.status === 'encerrada' ? <IndicadoresFinais eu={eu} view={view} /> : null}

      {feedback ? (
        <div className="degrau terraco terr-claro animate-emergir flex flex-col gap-2 p-5">
          <Rotulo>O que o olhar de {OFICINA_PERFIS_INFO[perfil!].rotulo} deixou</Rotulo>
          <p className="text-sm leading-[1.7] text-terra-800">{feedback}</p>
        </div>
      ) : null}

      <Destaques view={view} interessesPorIr={interessesPorIr} />

      <div className="degrau terraco terr-claro animate-emergir flex flex-col gap-3 p-5">
        <Rotulo>Para pensar com a turma</Rotulo>
        <ol className="flex list-decimal flex-col gap-2 pl-5">
          {OFICINA_CONTENT.reflexao_perguntas.slice(0, 5).map((pergunta) => (
            <li key={pergunta} className="text-sm leading-[1.6] text-terra-700">
              {pergunta}
            </li>
          ))}
        </ol>
      </div>

      <div className="degrau mirante terr-financas animate-emergir flex flex-col gap-2 p-5">
        <p className="text-base leading-[1.7] text-financas-texto">{OFICINA_IA_FALLBACKS.provocacao}</p>
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

function IndicadoresFinais({ eu, view }: { eu: OficinaPanelResponse['eu']; view: OficinaPanelResponse['view'] }) {
  const equipe = view.equipes.find((e) => e.team_id === eu.teamId);
  if (!equipe) return null;

  return (
    <div className="degrau banco terr-claro animate-emergir flex flex-col gap-3 p-4">
      <Rotulo>Indicadores finais de {equipe.nome}</Rotulo>
      <IndicadoresMini indicadores={equipe.indicadores} />
    </div>
  );
}

function Destaques({
  view,
  interessesPorIr,
}: {
  view: OficinaPanelResponse['view'];
  interessesPorIr: ReturnType<typeof sortResults>;
}) {
  if (interessesPorIr.length === 0) return null;

  return (
    <div className="degrau banco terr-claro animate-emergir flex flex-col gap-3 p-4">
      <Rotulo>Resultados da oficina</Rotulo>
      <ul className="flex flex-col gap-2">
        {interessesPorIr.map((result) => (
          <li key={result.team_id} className="rounded-[5px] bg-terra-50 p-3">
            <span className="text-sm font-bold text-terra-900">
              {view.equipes.find((e) => e.team_id === result.team_id)?.nome ?? 'Equipe'}
            </span>
            <span className="block text-xs text-terra-600">
              {result.categorias.map((c) => c.razao).join(' · ')}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function sortResults(view: OficinaPanelResponse['view']) {
  return [...view.resultados]
    .filter((r) => r.categorias.length > 0)
    .sort((a, b) => Math.max(...b.categorias.map((c) => c.nota), 0) - Math.max(...a.categorias.map((c) => c.nota), 0))
    .slice(0, 3);
}

// ---------------------------------------------------------------------------
// Estado pausado
// ---------------------------------------------------------------------------

function PausadaOficina({ eu }: { eu: { teamName: string } }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="degrau mirante terr-azul animate-emergir flex items-start gap-3 p-5">
        <PauseCircle size={22} className="mt-0.5 shrink-0 text-azul-300" aria-hidden="true" />
        <div className="flex flex-col gap-1">
          <Rotulo className="text-azul-300">Oficina pausada</Rotulo>
          <p className="text-sm font-medium text-azul-300">
            A oficina da {OFICINA_COMUNIDADE_NOME} parou por um instante. Quando o professor
            retomar, a equipe {eu.teamName} continua de onde estava.
          </p>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Indicadores mini
// ---------------------------------------------------------------------------

export function IndicadoresMini({ indicadores }: { indicadores: OficinaIndicadores | null }) {
  if (!indicadores) return null;
  const entradas = Object.entries(indicadores) as [OficinaIndicador, number][];

  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 sm:grid-cols-4">
      {entradas.map(([chave, valor]) => (
        <div key={chave} className="flex flex-col gap-0.5">
          <span className="text-[11px] text-terra-500">{OFICINA_INDICADORES_INFO[chave].rotulo}</span>
          <div className="flex items-center gap-2">
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-terra-200">
              <div
                className="h-full rounded-full bg-verde-600 transition-all duration-700"
                style={{ width: `${Math.max(0, Math.min(100, valor))}%` }}
              />
            </div>
            <span className="w-6 text-right text-[11px] font-bold text-terra-700">
              {Math.round(valor)}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}