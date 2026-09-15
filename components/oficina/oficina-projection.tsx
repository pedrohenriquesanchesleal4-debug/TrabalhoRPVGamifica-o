'use client';

import {
  BookOpen,
  Check,
  Flag,
  HeartHandshake,
  Hourglass,
  Lightbulb,
  Megaphone,
  Search,
  Share2,
  Sprout,
  Trophy,
  Users,
} from 'lucide-react';
import type { OficinaProjecaoResponse } from '@/lib/client-api';
import { Pill, Rotulo } from '@/components/ui/primitives';
import { CerradoLandscape } from '@/components/game/cerrado-landscape';
import { OFICINA_CONTENT } from '@/data/oficina-content';
import { OFICINA_COMUNIDADE_NOME } from '@/data/oficina-ia';
import { OFICINA_PERFIS_INFO, type OficinaPerfil, type OficinaStage } from '@/types/oficina';
import type { OficinaEventoRow, OficinaSessaoRow } from '@/types/oficina';

/**
 * Projeção na parede · Oficina Safra DF.
 *
 * O telão mostra o TERRITÓRIO da comunidade, não a mesa de cada equipe: o
 * mapa de pistas descobertas, o evento coletivo em aberto e a contagem do que
 * está por vir. Sem token — é a parede da sala.
 */

const STAGE_ROTULO: Record<OficinaStage, string> = {
  briefing: 'Briefing da comunidade',
  investigacao: 'Investigação no território',
  eventos: 'Evento coletivo',
  solucao: 'Proposta de solução',
  resultado: 'Resultado',
  encerrada: 'Fechamento',
};

const STATUS_ROTULO: Record<OficinaSessaoRow['status'], string> = {
  aguardando: 'Aguardando a turma entrar',
  ativa: 'Oficina ativa',
  pausada: 'Pausada pelo professor',
  encerrada: 'Oficina encerrada',
};

function StageEmblem({ stage }: { stage: OficinaStage }) {
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
      <Trophy size={26} aria-hidden />
    ) : (
      <Flag size={26} aria-hidden />
    );
  return (
    <span className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-filete-amanhecer bg-nevoa-50 text-terra-800">
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
      <main className="relative flex min-h-dvh flex-col items-center justify-center gap-10 px-6 py-12 text-center overflow-hidden">
        <div className="paralaxe-cena pointer-events-none fixed inset-0 z-0 opacity-15">
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
                    <span className="text-xs text-terra-500">{perfil?.rotulo ?? 'Perfil'}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </main>
    );
  }

  const eventoAtual: OficinaEventoRow | undefined = sessao.evento_atual
    ? view.eventos.find((e) => e.event_key === sessao.evento_atual)
    : undefined;

  return (
    <main className="relative mx-auto flex min-h-dvh max-w-[1600px] flex-col gap-8 px-10 py-8 overflow-hidden">
      <div className="paralaxe-cena pointer-events-none fixed inset-0 z-0 opacity-10">
        <CerradoLandscape />
      </div>
      <div className="pointer-events-none fixed inset-0 z-[1] bg-nevoa-50/60" />

      <div className="relative z-[2] flex flex-col gap-8">
        <header className="flex flex-wrap items-center justify-between gap-6 pt-4 animate-emergir">
          <div className="flex flex-col gap-1">
            <Rotulo>SAFRA DF · {OFICINA_COMUNIDADE_NOME}</Rotulo>
            <h1 className="relevo-lg text-terra-900">{STAGE_ROTULO[sessao.stage]}</h1>
            <p className="text-lg text-terra-700">{descricaoEtapa(sessao)}</p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Pill tone={sessao.status === 'ativa' ? 'ativo' : sessao.status === 'pausada' ? 'alerta' : 'neutro'} className="text-sm">
              {STATUS_ROTULO[sessao.status]}
            </Pill>
            <Pill tone="neutro" className="text-sm">
              <Sprout size={14} aria-hidden />
              {equipes.length} equipes no território
            </Pill>
            <span className="dado text-2xl font-bold uppercase tracking-[0.2em] text-terra-900">
              {game.code}
            </span>
          </div>
        </header>

        <div className="flex items-center gap-5 rounded-3xl border-2 border-borda-amanhecer bg-nevoa-50 p-6 animate-emergir" style={{ animationDelay: '80ms' }}>
          <StageEmblem stage={sessao.stage} />
          <div className="flex flex-col gap-1">
            <span className="text-xs font-bold uppercase tracking-[0.14em] text-terra-500">A comunidade está neste momento</span>
            <span className="relevo-md text-terra-900">
              {sessao.status === 'pausada'
                ? 'Conversa pausada — o professor retoma em instantes.'
                : STAGE_ROTULO[sessao.stage]}
            </span>
            <span className="text-sm text-terra-700">{descricaoEtapa(sessao)}</span>
          </div>
        </div>

        {sessao.stage === 'eventos' ? <EventoProjecao evento={eventoAtual} status={sessao.status} /> : null}
        <ProjecaoPistas pistasDescobertas={view.pistas} stage={sessao.stage} />

        <section className="flex flex-col gap-3 animate-emergir" style={{ animationDelay: '160ms' }} aria-live="polite">
          <Rotulo>
            <span className="inline-flex items-center gap-1.5">
              <Users size={14} aria-hidden />
              Os {equipes.length} perfis do território
            </span>
          </Rotulo>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
            {equipes.map((equipe) => {
              const perfil = OFICINA_PERFIS_INFO[equipe.perfil as OficinaPerfil];
              const pistasDa = view.pistas.filter((p) => p.team_id === equipe.team_id).length;
              const solucao = view.solucoes.find((s) => s.team_id === equipe.team_id);
              return (
                <div key={equipe.team_id} className="degrau banco terr-verde flex flex-col gap-2 p-4">
                  <div className="flex items-center justify-between gap-2">
                    <Sprout size={15} className="text-verde-600" aria-hidden />
                    {solucao ? (
                      <span className="flex items-center gap-1 text-[11px] font-bold text-verde-600">
                        <Check size={11} aria-hidden /> solução
                      </span>
                    ) : null}
                  </div>
                  <span className="text-sm font-bold text-terra-900">{equipe.nome}</span>
                  <span className="text-xs text-terra-500">{perfil?.rotulo ?? 'Perfil'}</span>
                  <span className="mt-auto text-[11px] text-terra-600">{pistasDa} pista{pistasDa === 1 ? '' : 's'} descoberta{pistasDa === 1 ? '' : 's'}</span>
                </div>
              );
            })}
          </div>
        </section>

        <footer className="mt-auto flex items-center justify-center gap-3 border-t-2 border-nevoa-200 py-4">
          <span className="text-sm text-terra-500">O código da oficina é</span>
          <span className="dado text-3xl font-bold uppercase tracking-[0.25em] text-terra-900">
            {game.code}
          </span>
        </footer>
      </div>
    </main>
  );
}

function descricaoEtapa(sessao: OficinaSessaoRow): string {
  switch (sessao.stage) {
    case 'briefing':
      return 'A comunidade recebe o chamado e escolhe de onde partir.';
    case 'investigacao':
      return 'Cada equipe investiga o território e descobre o que ninguém viu antes.';
    case 'eventos':
      return 'O imprevisto chegou: a comunidade decide junta o que fazer.';
    case 'solucao':
      return 'As equipes propõem a solução que vai alimentar o território.';
    case 'resultado':
      return 'Os indicadores foram computados — o que a comunidade construiu até aqui.';
    default:
      return 'O círculo se fecha com a memória do que foi vivido.';
  }
}

function EventoProjecao({ evento, status }: { evento: OficinaEventoRow | undefined; status: OficinaSessaoRow['status'] }) {
  if (status === 'pausada') return null;

  const def = evento ? OFICINA_CONTENT.eventos.find((e) => e.key === evento.event_key) : null;
  const contribuidores = evento ? Object.keys(evento.contribuicoes).length : 0;
  const resolvido = evento?.status === 'resolvido';

  return (
    <section className="flex flex-col gap-3 animate-emergir" style={{ animationDelay: '120ms' }} aria-live="polite">
      <Rotulo>
        <span className="inline-flex items-center gap-1.5">
          <Megaphone size={14} aria-hidden />
          Evento coletivo
        </span>
      </Rotulo>
      <div className="flex flex-col gap-3 rounded-3xl border-2 border-borda-amanhecer bg-nevoa-50 p-6">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="relevo-md text-terra-900">{def?.titulo ?? 'Nenhum evento aberto'}</h2>
          <Pill tone={resolvido ? 'pronto' : 'ativo'} className="text-sm">
            {resolvido ? 'Resolvido' : 'Em aberto'}
          </Pill>
        </div>
        {def ? <p className="max-w-4xl text-base leading-relaxed text-terra-700">{def.desfecho}</p> : null}
        {evento ? (
          <p className="flex items-center gap-2 text-sm font-medium text-terra-600">
            <HeartHandshake size={15} className="text-verde-600" aria-hidden />
            {contribuidores} {contribuidores === 1 ? 'equipe já contribuiu' : 'equipes já contribuíram'} com a resposta da comunidade
          </p>
        ) : null}
      </div>
    </section>
  );
}

function ProjecaoPistas({
  pistasDescobertas,
  stage,
}: {
  pistasDescobertas: OficinaProjecaoResponse['view']['pistas'];
  stage: OficinaStage;
}) {
  if (stage === 'briefing' || stage === 'encerrada') return null;

  const idsDescobertas = new Set(pistasDescobertas.map((p) => p.pista_id));
  const compartilhadas = pistasDescobertas.filter((p) => p.compartilhada_em).length;

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
              className={['degrau banco flex flex-col gap-1 p-3.5', achada ? 'terr-claro' : 'opacity-40'].join(' ')}
            >
              <span className="flex items-center gap-2 text-sm font-bold text-terra-900">
                {achada ? <Check size={13} className="text-verde-600" aria-hidden /> : <Hourglass size={13} className="text-terra-400" aria-hidden />}
                {pista.titulo}
              </span>
              <span className="text-xs text-terra-500">{achada ? pista.origem : 'Ainda por descobrir'}</span>
            </div>
          );
        })}
      </div>
      <p className="flex items-center gap-2 text-sm font-medium text-terra-600">
        <Share2 size={15} className="text-verde-600" aria-hidden />
        {pistasDescobertas.length} pistas descobertas · {compartilhadas} compartilhadas no território
      </p>
    </section>
  );
}