'use client';

import {
  BookOpen,
  Check,
  Flag,
  Handshake,
  Hourglass,
  Lightbulb,
  Megaphone,
  MessageCircle,
  Search,
  Share2,
  Sprout,
  Target,
  Users,
} from 'lucide-react';
import type { OficinaProjecaoResponse } from '@/lib/client-api';
import { Pill, Rotulo } from '@/components/ui/primitives';
import { CerradoLandscape } from '@/components/game/cerrado-landscape';
import { OFICINA_CONTENT } from '@/data/oficina-content';
import { OFICINA_COMUNIDADE_NOME } from '@/data/oficina-ia';
import {
  OFICINA_BLOCOS_INFO,
  OFICINA_PERFIS_INFO,
  OFICINA_STAGES_ORDEM,
  OFICINA_STAGE_META,
  rotuloCategoria,
  type OficinaBlocoSolucao,
  type OficinaEquipeComNome,
  type OficinaEventoRow,
  type OficinaPerfil,
  type OficinaPistaRow,
  type OficinaResultadoRow,
  type OficinaSessaoRow,
  type OficinaSolucaoRow,
} from '@/types/oficina';

/**
 * Projeção na parede · Oficina Safra DF.
 *
 * A parede não é a mesa do professor: é o ESPELHO do que a turma construiu.
 * Por isso, além do território e do evento em aberto, ela mostra a parede de
 * propostas (o que cada equipe montou) e a galeria de destaques (o que cada
 * equipe fez) — as duas coisas que a oficina produziu e que antes não apareciam
 * em lugar nenhum na sala.
 *
 * Duas regras desta tela vêm do contrato pedagógico, não do gosto:
 *
 * 1. **Sem pódio.** Os destaques não são ordenados por nota e não existe
 *    "primeiro lugar". Seis equipes, seis cartões para a mesma comunidade.
 * 2. **Legível de longe.** Fonte grande, número grande, alto contraste. O
 *    essencial nunca é explicado em letra pequena.
 */

const STATUS_ROTULO: Record<OficinaSessaoRow['status'], string> = {
  aguardando: 'Aguardando a turma entrar',
  ativa: 'Oficina ativa',
  pausada: 'Pausada pelo professor',
  encerrada: 'Oficina encerrada',
};

/**
 * Rótulo de uma escolha de cartão do bloco `bloco`.
 *
 * O valor gravado é a chave da opção ('a'...'d'), mas versões antigas da oficina
 * gravaram o id da pista. Os dois são resolvidos pelo MESMO dado que o motor usa
 * (`data/oficina-content.ts`), com o texto livre do aluno como último recurso.
 * Devolve `null` quando nada foi escolhido — e aí a parede diz que a equipe
 * ainda não escolheu, em vez de inventar um rótulo.
 */
function rotuloBlocoEscolhido(bloco: OficinaBlocoSolucao, solucao: OficinaSolucaoRow): string | null {
  // `OficinaSolucaoRow.blocos` é a solução (`{ blocos, campos_livres }`), não o
  // mapa de escolhas: são dois níveis, e ler o errado devolve `undefined` em
  // silêncio.
  const chave = solucao.blocos?.blocos?.[bloco];
  const livre = (solucao.blocos?.campos_livres?.[bloco] ?? '').trim();

  if (!chave) return livre === '' ? null : livre;

  const cartao = OFICINA_CONTENT.cartoes.find((c) => c.bloco === bloco);
  const opcao = cartao?.opcoes.find((o) => o.key === chave);
  if (opcao) return opcao.rotulo;

  const pista = OFICINA_CONTENT.pistas.find((p) => p.id === chave);
  if (pista) return pista.titulo;

  return livre === '' ? null : livre;
}

/** Votos por opção: o jsonb `contribuicoes` é team_id → contribuição. */
function contarVotosPorOpcao(contribuicoes: OficinaEventoRow['contribuicoes']): Map<string, number> {
  const votos = new Map<string, number>();
  for (const voto of Object.values(contribuicoes ?? {})) {
    const chave = typeof voto?.opcao_key === 'string' ? voto.opcao_key : '';
    if (chave === '') continue;
    votos.set(chave, (votos.get(chave) ?? 0) + 1);
  }
  return votos;
}

/** Quantas pistas DIFERentes a turma descobriu (a mesma pista em 3 equipes é uma). */
function contarPistasDistintas(pistas: readonly OficinaPistaRow[]): number {
  return new Set(pistas.map((p) => p.pista_id)).size;
}

function StageEmblem({ stage }: { stage: OficinaSessaoRow['stage'] }) {
  const icon =
    stage === 'briefing' ? (
      <BookOpen size={26} aria-hidden />
    ) : stage === 'investigacao' ? (
      <Search size={26} aria-hidden />
    ) : stage === 'eventos' ? (
      <Megaphone size={26} aria-hidden />
    ) : stage === 'solucao' ? (
      <Lightbulb size={26} aria-hidden />
    ) : stage === 'resultado' ? (
      <Target size={26} aria-hidden />
    ) : (
      <Flag size={26} aria-hidden />
    );
  return (
    // Disco escavado no prato do painel: sem borda nos quatro lados (o contrato
    // proíbe) e sem `filete-*`, que é separador de 1px, não cor de borda.
    <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-nevoa-50 text-terra-900">
      {icon}
    </span>
  );
}

export function OficinaProjection({ projecao }: { projecao: OficinaProjecaoResponse }) {
  const { game, view } = projecao;
  const sessao = view.sessao;
  const equipes = view.equipes;

  if (!sessao || sessao.status === 'aguardando') {
    return (
      <main className="relative flex min-h-dvh flex-col items-center justify-center gap-6 px-4 py-12 text-center sm:gap-10 sm:px-6 overflow-x-clip">
        <div className="paralaxe-cena pointer-events-none fixed inset-0 z-0 overflow-hidden opacity-15">
          <CerradoLandscape />
        </div>
        <div className="pointer-events-none fixed inset-0 z-[1] bg-nevoa-50/50" />

        <div className="relative z-[2] flex flex-col items-center gap-10">
          <div className="flex flex-col items-center gap-3 animate-emergir">
            <Rotulo>SAFRA DF · {OFICINA_COMUNIDADE_NOME}</Rotulo>
            <p className="text-lg text-terra-700">A comunidade se reuniu. Acesse com o código:</p>
            <span
              className="dado-xl text-terra-900"
              style={{ fontSize: 'clamp(4rem, 12vw, 9rem)', letterSpacing: '0.08em' }}
            >
              {game.code}
            </span>
          </div>

          <div className="filete-amanhecer w-full max-w-3xl animate-emergir" style={{ animationDelay: '100ms' }} />

          <div className="flex w-full max-w-4xl flex-col gap-4 animate-emergir" style={{ animationDelay: '200ms' }}>
            <Rotulo>
              <span className="inline-flex items-center justify-center gap-1.5">
                <Users size={14} aria-hidden />
                {equipes.length} perfis do território
              </span>
            </Rotulo>
            <div className="grid grid-cols-2 gap-4 text-left sm:grid-cols-3 lg:grid-cols-6">
              {equipes.map((equipe) => {
                const perfil = OFICINA_PERFIS_INFO[equipe.perfil as OficinaPerfil];
                return (
                  <div key={equipe.team_id} className="degrau banco terr-claro flex flex-col gap-1 p-4">
                    <Sprout size={16} className="text-verde-600" aria-hidden />
                    <span className="text-sm font-bold text-terra-900">{equipe.nome}</span>
                    <span className="text-xs text-terra-700">{perfil?.rotulo ?? 'Perfil'}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </main>
    );
  }

  const etapa = OFICINA_STAGE_META[sessao.stage];
  const indiceEtapa = OFICINA_STAGES_ORDEM.indexOf(sessao.stage) + 1;
  const eventoAtual: OficinaEventoRow | undefined = sessao.evento_atual
    ? view.eventos.find((e) => e.event_key === sessao.evento_atual)
    : undefined;

  return (
    <main className="relative mx-auto flex min-h-dvh w-full max-w-[1600px] flex-col gap-6 px-4 py-6 sm:gap-8 sm:px-6 sm:py-8 lg:gap-8 lg:px-10 overflow-x-clip">
      <div className="paralaxe-cena pointer-events-none fixed inset-0 z-0 overflow-hidden opacity-10">
        <CerradoLandscape />
      </div>
      <div className="pointer-events-none fixed inset-0 z-[1] bg-nevoa-50/60" />

      <div className="relative z-[2] flex flex-col gap-8">
        <header className="flex flex-wrap items-start justify-between gap-6 pt-4 animate-emergir">
          <div className="flex flex-col gap-2">
            <Rotulo>
              SAFRA DF · {OFICINA_COMUNIDADE_NOME} · ETAPA {indiceEtapa} DE {OFICINA_STAGES_ORDEM.length}
            </Rotulo>
            {/*
              O TÍTULO da etapa vem uma única vez, e a DESCRIÇÃO também. Antes o
              mesmo texto de descrição aparecia no cabeçalho e no bloco de
              emblema, duas vezes na mesma parede.
            */}
            <h1 className="relevo-lg text-terra-900">{etapa.titulo}</h1>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Pill tone={sessao.status === 'ativa' ? 'ativo' : sessao.status === 'pausada' ? 'alerta' : 'neutro'} className="text-sm">
              {STATUS_ROTULO[sessao.status]}
            </Pill>
            <Pill tone="neutro" className="text-sm">
              <Sprout size={14} aria-hidden />
              {equipes.length} equipes no território
            </Pill>
            <span className="dado-lg uppercase tracking-[0.06em] text-terra-900">{game.code}</span>
          </div>
        </header>

        <div
          className="degrau terraco terr-neutro flex flex-col items-start gap-5 p-6 animate-emergir sm:flex-row sm:items-center"
          style={{ animationDelay: '80ms' }}
        >
          <StageEmblem stage={sessao.stage} />
          <div className="flex min-w-0 flex-col gap-1.5">
            <span className="text-xs font-bold uppercase tracking-[0.14em] text-terra-500">
              A comunidade está neste momento
            </span>
            <span className="relevo-md text-terra-900">
              {sessao.status === 'pausada' ? 'Conversa pausada — o professor retoma em instantes.' : etapa.objetivo}
            </span>
            {etapa.meta && sessao.status !== 'pausada' ? (
              <span className="text-base text-terra-700">{etapa.meta}</span>
            ) : null}
          </div>
        </div>

        {sessao.stage === 'eventos' ? (
          <EventoProjecao sessao={sessao} evento={eventoAtual} totalEquipes={equipes.length} />
        ) : null}

        {sessao.stage === 'solucao' ? (
          <ParedeDePropostas equipes={equipes} solucoes={view.solucoes} />
        ) : null}

        {sessao.stage === 'resultado' || sessao.stage === 'encerrada' ? (
          <GaleriaDeDestaques equipes={equipes} resultados={view.resultados} />
        ) : null}

        {sessao.stage === 'resultado' || sessao.stage === 'encerrada' ? (
          <ReflexaoProjecao stage={sessao.stage} />
        ) : null}

        <ProjecaoPistas pistasDescobertas={view.pistas} stage={sessao.stage} />

        <section className="flex flex-col gap-3 animate-emergir" style={{ animationDelay: '160ms' }}>
          <Rotulo>
            <span className="inline-flex items-center gap-1.5">
              <Users size={14} aria-hidden />
              Os {equipes.length} perfis do território
            </span>
          </Rotulo>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
            {equipes.map((equipe) => {
              const perfil = OFICINA_PERFIS_INFO[equipe.perfil as OficinaPerfil];
              const pistasDa = contarPistasDistintas(view.pistas.filter((p) => p.team_id === equipe.team_id));
              const solucao = view.solucoes.some((s) => s.team_id === equipe.team_id);
              return (
                <div key={equipe.team_id} className="degrau banco terr-verde flex flex-col gap-2 p-4">
                  <div className="flex items-center justify-between gap-2">
                    <Sprout size={15} className="text-verde-600" aria-hidden />
                    {solucao ? (
                      <span className="flex items-center gap-1 text-[11px] font-bold text-verde-700">
                        <Check size={11} aria-hidden /> proposta
                      </span>
                    ) : null}
                  </div>
                  <span className="text-sm font-bold text-terra-900">{equipe.nome}</span>
                  <span className="text-xs text-terra-700">{perfil?.rotulo ?? 'Perfil'}</span>
                  <span className="mt-auto flex items-baseline gap-1.5 text-terra-900">
                    <span className="dado-lg">{pistasDa}</span>
                    <span className="text-xs text-terra-700">
                      pista{pistasDa === 1 ? '' : 's'} descoberta{pistasDa === 1 ? '' : 's'}
                    </span>
                  </span>
                </div>
              );
            })}
          </div>
        </section>

        <footer className="mt-auto flex items-center justify-center gap-3 border-t-2 border-nevoa-200 py-4">
          <span className="text-sm text-terra-500">O código da oficina é</span>
          <span className="dado text-3xl font-bold uppercase tracking-[0.25em] text-terra-900">{game.code}</span>
        </footer>
      </div>
    </main>
  );
}

/**
 * Estágio de eventos: o que a turma está respondendo agora, o que já decidiram e
 * como o grupo se dividiu.
 */
function EventoProjecao({
  sessao,
  evento,
  totalEquipes,
}: {
  sessao: OficinaSessaoRow;
  evento: OficinaEventoRow | undefined;
  totalEquipes: number;
}) {
  const def = evento ? OFICINA_CONTENT.eventos.find((e) => e.key === evento.event_key) : null;
  const resolvido = evento?.status === 'resolvido';
  const votos = contarVotosPorOpcao(evento?.contribuicoes ?? {});
  const totalVotos = [...votos.values()].reduce((soma, n) => soma + n, 0);

  return (
    <section className="flex flex-col gap-3 animate-emergir" style={{ animationDelay: '120ms' }} aria-live="polite">
      <Rotulo>
        <span className="inline-flex items-center gap-1.5">
          <Megaphone size={14} aria-hidden />
          Evento {sessao.stage_progresso + 1} de {sessao.sorteio_eventos.length}
        </span>
      </Rotulo>
      {/*
        O ÚNICO console escuro da tela (a parede da sala aponta para ele). Só o
        evento abre no estágio `eventos`, então nunca divide o foco com outro
        bloco: a regra do `mirante` por tela continua valendo.
      */}
      <div className="degrau terraco terr-fundo-azul flex flex-col gap-4 p-6">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="relevo-md text-terra-900">{def?.titulo ?? 'Nenhum evento aberto'}</h2>
          <Pill tone={resolvido ? 'pronto' : 'ativo'} className="text-sm">
            {resolvido ? 'Resolvido' : 'Em aberto'}
          </Pill>
        </div>

        {/* O desfecho é o final da história: só entra na parede depois de resolvido. */}
        {def ? (
          <p className="max-w-5xl text-lg leading-relaxed text-terra-900">
            {resolvido ? def.desfecho : def.narrativa}
          </p>
        ) : null}

        {def ? (
          <div className="flex flex-col gap-3 border-t-2 border-nevoa-200 pt-4">
            <Rotulo>Como a turma respondeu</Rotulo>
            <ul className="flex flex-col gap-2">
              {def.opcoes.map((opcao) => {
                const votosDaOpcao = votos.get(opcao.key) ?? 0;
                return (
                  <li key={opcao.key} className="flex flex-wrap items-baseline gap-3">
                    <span className="dado-lg w-12 shrink-0 text-terra-900">{votosDaOpcao}</span>
                    <span className="flex-1 text-base leading-snug text-terra-900">
                      {opcao.rotulo}
                      {votosDaOpcao === 0 ? (
                        <span className="ml-2 text-terra-700">(ninguém escolheu)</span>
                      ) : null}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        ) : null}

        <p className="flex items-baseline gap-2 text-terra-900">
          <span className="dado-lg">
            {totalVotos}/{totalEquipes}
          </span>
          <span className="text-base font-medium text-terra-700">equipes já votaram neste evento</span>
        </p>
      </div>
    </section>
  );
}

/**
 * Estágio de solução: a parede de propostas.
 *
 * Cada equipe que já enviou mostra o problema que escolheu e com quem conta. A
 * que não enviou aparece como espaço reservado — a parede precisa mostrar as
 * seis equipes em toda etapa, senão a turma lê o vazio como "ninguém
 * conseguiu".
 */
function ParedeDePropostas({
  equipes,
  solucoes,
}: {
  equipes: OficinaEquipeComNome[];
  solucoes: OficinaSolucaoRow[];
}) {
  const enviadas = solucoes.length;
  const totalCartoes = OFICINA_CONTENT.cartoes.length;

  return (
    <section className="flex flex-col gap-3 animate-emergir" style={{ animationDelay: '120ms' }} aria-live="polite">
      <Rotulo>
        <span className="inline-flex items-center gap-1.5">
          <Lightbulb size={14} aria-hidden />
          A parede de propostas
        </span>
      </Rotulo>

      <p className="flex flex-wrap items-baseline gap-3 text-terra-900">
        <span className="dado-xl">
          {enviadas}/{equipes.length}
        </span>
        <span className="relevo-md">equipes já enviaram a proposta</span>
      </p>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
        {equipes.map((equipe) => {
          const perfil = OFICINA_PERFIS_INFO[equipe.perfil as OficinaPerfil];
          const solucao = solucoes.find((s) => s.team_id === equipe.team_id);
          const problema = solucao ? rotuloBlocoEscolhido('problema_principal', solucao) : null;
          const parceiros = solucao ? rotuloBlocoEscolhido('parceiros', solucao) : null;

          return (
            <div key={equipe.team_id} className="degrau terraco terr-claro flex flex-col gap-3 p-5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="relevo-sm text-terra-900">{equipe.nome}</span>
                <Pill tone="neutro" className="text-sm">
                  {perfil?.rotulo ?? 'Perfil'}
                </Pill>
              </div>

              {solucao ? (
                <>
                  <div className="flex flex-col gap-1">
                    <Rotulo>{OFICINA_BLOCOS_INFO.problema_principal.rotulo}</Rotulo>
                    <span className="text-lg leading-snug text-terra-900">{problema ?? 'Escolha em andamento'}</span>
                  </div>
                  <div className="flex flex-col gap-1">
                    <Rotulo>
                      <span className="inline-flex items-center gap-1.5">
                        <Handshake size={13} aria-hidden />
                        {OFICINA_BLOCOS_INFO.parceiros.rotulo}
                      </span>
                    </Rotulo>
                    <span className="text-lg leading-snug text-terra-900">{parceiros ?? 'Escolha em andamento'}</span>
                  </div>
                  <p className="mt-auto flex items-center gap-1.5 pt-2 text-sm font-bold text-verde-700">
                    <Check size={14} aria-hidden />
                    proposta enviada
                  </p>
                </>
              ) : (
                <div className="flex flex-1 flex-col justify-center gap-2 py-4">
                  <span className="relevo-sm text-terra-500">Ainda montando a proposta</span>
                  <span className="text-base text-terra-700">
                    Esta equipe ainda está preenchendo os {totalCartoes} cartões da solução.
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

/**
 * Estágio de resultado e encerramento: a galeria de destaques.
 *
 * Um cartão por destaque, com o rótulo da categoria e o motivo que o motor
 * calculou. A ordem é a das equipes, nunca a da nota, e não existe pódio: o
 * modo é colaborativo por contrato, e uma parede que transforma a oficina em
 * competição desmonta a oficina.
 */
function GaleriaDeDestaques({
  equipes,
  resultados,
}: {
  equipes: OficinaEquipeComNome[];
  resultados: OficinaResultadoRow[];
}) {
  const nomePorEquipe = new Map(equipes.map((e) => [e.team_id, e]));

  const destaques = resultados.flatMap((resultado) => {
    const equipe = nomePorEquipe.get(resultado.team_id);
    return (resultado.categorias ?? []).map((categoria) => ({
      equipeId: resultado.team_id,
      equipeNome: equipe?.nome ?? 'Equipe',
      perfilRotulo: equipe ? OFICINA_PERFIS_INFO[equipe.perfil as OficinaPerfil]?.rotulo : null,
      categoria,
    }));
  });

  return (
    <section className="flex flex-col gap-3 animate-emergir" style={{ animationDelay: '120ms' }} aria-live="polite">
      <Rotulo>
        <span className="inline-flex items-center gap-1.5">
          <Check size={14} aria-hidden />
          Galeria de destaques
        </span>
      </Rotulo>

      <p className="relevo-md text-terra-900">
        {destaques.length} destaques para {equipes.length} equipes. Sem ordem: todas construíram para a mesma
        comunidade.
      </p>

      {destaques.length === 0 ? (
        <p className="text-lg text-terra-700">Os destaques são calculados ao encerrar a oficina.</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {destaques.map((destaque) => (
            <div key={`${destaque.equipeId}-${destaque.categoria.categoria}`} className="degrau banco terr-claro flex flex-col gap-2 p-5">
              <Rotulo className="text-financas-texto">{rotuloCategoria(destaque.categoria.categoria)}</Rotulo>
              <span className="relevo-md text-terra-900">{destaque.equipeNome}</span>
              {destaque.perfilRotulo ? <span className="text-sm text-terra-700">{destaque.perfilRotulo}</span> : null}
              <p className="text-base leading-relaxed text-terra-900">{destaque.categoria.razao}</p>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function ReflexaoProjecao({ stage }: { stage: OficinaSessaoRow['stage'] }) {
  const perguntas = OFICINA_CONTENT.reflexao_perguntas ?? [];
  const destaques = perguntas.slice(0, Math.min(perguntas.length, stage === 'resultado' ? 3 : 5));

  if (destaques.length === 0) return null;

  return (
    <section className="flex flex-col gap-3 animate-emergir" style={{ animationDelay: '140ms' }}>
      <Rotulo>
        <span className="inline-flex items-center gap-1.5">
          <MessageCircle size={14} aria-hidden />
          Para fechar em roda — reflexão do território
        </span>
      </Rotulo>
      {/* Lista numerada de perguntas: `banco`, o nível mais baixo de altitude. */}
      <div className="degrau banco terr-neutro flex flex-col gap-3 p-6">
        {destaques.map((pergunta, index) => (
          <div key={index} className="flex items-start gap-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-nevoa-200 text-terra-900">
              <span className="dado">{index + 1}</span>
            </span>
            <p className="text-lg leading-[1.5] text-terra-900">{pergunta}</p>
          </div>
        ))}
        <p className="mt-2 flex items-center gap-2 text-base font-medium text-terra-700">
          <Lightbulb size={16} className="text-financas" aria-hidden />
          O professor fecha o círculo com o roteiro de debate no painel da oficina.
        </p>
      </div>
    </section>
  );
}

function ProjecaoPistas({
  pistasDescobertas,
  stage,
}: {
  pistasDescobertas: OficinaProjecaoResponse['view']['pistas'];
  stage: OficinaSessaoRow['stage'];
}) {
  if (stage === 'briefing' || stage === 'encerrada') return null;

  const idsDescobertas = new Set(pistasDescobertas.map((p) => p.pista_id));
  const distintas = contarPistasDistintas(pistasDescobertas);
  const publicadas = pistasDescobertas.filter((p) => Boolean(p.compartilhada_em)).length;

  return (
    <section className="flex flex-col gap-3 animate-emergir" style={{ animationDelay: '140ms' }}>
      <Rotulo>
        <span className="inline-flex items-center gap-1.5">
          <Search size={14} aria-hidden />
          Território da comunidade
        </span>
      </Rotulo>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {OFICINA_CONTENT.pistas.map((pista) => {
          const achada = idsDescobertas.has(pista.id);
          return (
            <div
              key={pista.id}
              // Pista não descoberta escava o prato em vez de aplicar opacidade:
              // `opacity` no contêiner derruba o título a 3.4:1 e o "Ainda por
              // descobrir" a 1.9:1 — abaixo de AA. A hierarquia continua no
              // par texto apagado (5.5:1) sobre prato `terr-neutro`.
              className={['degrau banco flex flex-col gap-1 p-3.5', achada ? 'terr-claro' : 'terr-neutro'].join(' ')}
            >
              <span
                className={[
                  'flex items-center gap-2 text-sm font-bold',
                  achada ? 'text-terra-900' : 'text-terra-500',
                ].join(' ')}
              >
                {achada ? <Check size={13} className="text-verde-600" aria-hidden /> : <Hourglass size={13} className="text-terra-500" aria-hidden />}
                {pista.titulo}
              </span>
              <span className="text-xs text-terra-500">{achada ? pista.origem : 'Ainda por descobrir'}</span>
            </div>
          );
        })}
      </div>
      {/*
        Duas contagens, dois meanings: a turma descobriu N pistas DIFERENTES, e
        elas circularam em L registros entre as equipes (a mesma pista em três
        equipes é uma descoberta e três registros).
      */}
      <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-terra-900">
        <span className="flex items-baseline gap-1.5">
          <span className="dado-lg">{distintas}</span>
          <span className="text-base text-terra-700">pistas descobertas pela turma</span>
        </span>
        <span className="flex items-baseline gap-1.5">
          <span className="dado-lg">{pistasDescobertas.length}</span>
          <span className="text-base text-terra-700">registros entre as equipes</span>
        </span>
        <span className="flex items-center gap-1.5 text-base font-medium text-terra-700">
          <Share2 size={15} className="text-verde-600" aria-hidden />
          {publicadas} publicadas
        </span>
      </p>
    </section>
  );
}