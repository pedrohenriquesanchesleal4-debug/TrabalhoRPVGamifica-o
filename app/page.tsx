import Link from 'next/link';
import { Sprout, ArrowRight, Clock, Users, Landmark } from 'lucide-react';

/**
 * Porta de entrada do SAFRA DF.
 *
 * Não é landing page de marketing: é uma tela de sala de aula que resolve
 * exatamente uma pergunta em cada metade da tela, "sou aluno" ou "sou
 * professor", com o mínimo de leitura entre o clique e o jogo.
 */

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-5xl flex-col px-5 py-10 sm:px-8 sm:py-16">
      <header className="flex flex-col gap-4">
        <span className="rotulo text-terra-600">Atividade diagnóstica · 15 a 20 minutos</span>
        <h1 className="text-4xl leading-[1.05] text-mata-900 sm:text-5xl">
          SAFRA DF
          <span className="mt-1 block text-xl font-normal text-mata-700 sm:text-2xl">
            Decisões que Alimentam
          </span>
        </h1>
        <p className="max-w-2xl text-base text-mata-700 sm:text-lg">
          Cada equipe assume uma propriedade rural do Distrito Federal e administra um
          orçamento limitado ao longo de cinco rodadas. Ninguém enxerga o jogo inteiro
          sozinho: a decisão só fecha quando o grupo conversa em voz alta.
        </p>
      </header>

      <div className="faixa-terra my-8 animate-faixa" />

      <div className="grid flex-1 grid-cols-1 gap-6 sm:grid-cols-[1.6fr_1fr]">
        <section className="carta flex flex-col justify-between gap-8 p-6 sm:p-8">
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-2 text-terra-600">
              <Sprout size={20} aria-hidden="true" />
              <span className="rotulo">Para quem vai jogar</span>
            </div>
            <h2 className="text-2xl text-mata-900 sm:text-3xl">Entrar na partida</h2>
            <p className="max-w-md text-sm text-mata-600 sm:text-base">
              O professor já criou a partida e está com o código na tela. Digite o código
              e o seu nome: em seguida você recebe a propriedade, a equipe e a sua função.
            </p>
            <ul className="flex flex-col gap-2 text-sm text-mata-700">
              <li className="flex items-center gap-2">
                <Users size={16} className="shrink-0 text-mata-500" aria-hidden="true" />
                Cinco funções por equipe: cada uma vê uma informação que as outras não têm.
              </li>
              <li className="flex items-center gap-2">
                <Clock size={16} className="shrink-0 text-mata-500" aria-hidden="true" />
                Cinco rodadas cronometradas, do preparo da terra à colheita.
              </li>
            </ul>
          </div>

          <Link
            href="/entrar"
            className="inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-carta border border-terra-600 bg-terra-500 px-6 text-base font-medium text-areia-50 transition-colors duration-150 hover:bg-terra-600 sm:w-auto"
          >
            Entrar na partida
            <ArrowRight size={18} aria-hidden="true" />
          </Link>
        </section>

        <section className="carta flex flex-col justify-between gap-6 bg-mata-900 p-6 text-areia-100 sm:p-8">
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-2 text-areia-300">
              <Landmark size={20} aria-hidden="true" />
              <span className="rotulo text-areia-300">Para quem conduz</span>
            </div>
            <h2 className="text-xl text-areia-50">Sou professor</h2>
            <p className="text-sm text-areia-200">
              Crie a partida, projete o código para a turma, acompanhe as equipes se
              formando e controle o ritmo das rodadas em tempo real.
            </p>
          </div>

          <Link
            href="/admin"
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-carta border border-areia-100/30 bg-transparent px-5 text-sm font-medium text-areia-50 transition-colors duration-150 hover:bg-areia-50/10"
          >
            Abrir painel do professor
            <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </section>
      </div>

      <div className="faixa-terra mt-10" />

      <footer className="mt-4 flex flex-wrap items-center justify-between gap-2 text-xs text-mata-500">
        <span>Valores e propriedades são fictícios, inspirados em núcleos rurais reais do DF.</span>
        <span>Atividade diagnóstica: as decisões alimentam o debate depois, não uma nota.</span>
      </footer>
    </main>
  );
}
