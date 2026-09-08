import Link from 'next/link';
import { PropertyScene } from '@/components/game/property-scene';

/**
 * A capa do caderno de campo.
 *
 * Não é landing page de marketing: é a folha de rosto de um caderno de
 * anotação, com o quadro de identificação preenchido à máquina e duas vias de
 * entrada, aluno e professor, no formato de item de índice. Quem chega aqui
 * durante a aula tem uma pergunta só a responder ("sou aluno ou sou
 * professor"), e a resposta está a um toque.
 */

/** Linha do quadro de identificação: rótulo, pontinhos e valor datilografado. */
function LinhaCapa({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline gap-2">
      <span className="rotulo shrink-0">{label}</span>
      <span className="pontilhado" aria-hidden="true" />
      <span className="tabular shrink-0 text-sm text-tinta-900">{value}</span>
    </div>
  );
}

export default function HomePage() {
  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-8 sm:py-12">
      <div className="ficha ficha-furos relative pl-6 pr-5 py-6 sm:pl-10 sm:pr-9 sm:py-9">
        {/* Cabeçalho da capa: o que é este caderno. */}
        <header className="flex flex-col gap-1">
          <span className="rotulo text-carimbo-600">Caderno de campo · uso escolar</span>
          <h1 className="text-4xl leading-none tracking-tight text-tinta-900 sm:text-6xl">
            SAFRA DF
          </h1>
          <p className="font-maquina text-lg tracking-[0.06em] text-tinta-700 sm:text-xl">
            Decisões que Alimentam
          </p>
        </header>

        <div className="regua my-6" />

        {/* Quadro de identificação: os dados da atividade, como num caderno de verdade. */}
        <section className="grid grid-cols-1 gap-x-10 gap-y-2 sm:grid-cols-2">
          <LinhaCapa label="Atividade" value="Diagnóstica" />
          <LinhaCapa label="Duração" value="15 a 20 min" />
          <LinhaCapa label="Rodadas" value="5" />
          <LinhaCapa label="Equipes" value="até 6" />
          <LinhaCapa label="Região" value="Distrito Federal" />
          <LinhaCapa label="Orçamento" value="R$ 80.000" />
        </section>

        <p className="mt-6 max-w-2xl font-caderno text-base leading-relaxed text-tinta-700">
          Cada equipe assume uma propriedade rural do Distrito Federal e administra um orçamento
          limitado ao longo de cinco rodadas. Ninguém enxerga o jogo inteiro sozinho: cada função
          recebe uma informação que as outras não têm, e a decisão só fecha quando o grupo
          conversa em voz alta.
        </p>

        {/* O croqui colado na capa: a propriedade aparece antes de qualquer botão. */}
        <figure className="mt-6 border border-papel-300 bg-papel-000">
          <PropertyScene
            propertyKey="sitio-horizonte"
            production={58}
            technology={41}
            sustainability={73}
          />
          <figcaption className="border-t border-papel-300 px-3 py-1.5 font-maquina text-[0.6875rem] uppercase tracking-[0.14em] text-tinta-400">
            Croqui · Sítio Horizonte, núcleo rural fictício
          </figcaption>
        </figure>

        <div className="regua my-7" />

        {/*
          As duas vias de entrada. São itens de índice, com número e traço, e
          não dois cards concorrendo: a via do aluno vem primeiro e é a única
          com tinta cheia, porque é ela que trinta pessoas vão tocar.
        */}
        <nav aria-label="Entrar no jogo" className="flex flex-col">
          <Link
            href="/entrar"
            className="group flex items-baseline gap-3 border-t border-dashed border-papel-300 py-5 first:border-t-0 sm:gap-5"
          >
            <span className="tabular shrink-0 text-sm text-tinta-400">01</span>
            <span className="flex min-w-0 flex-1 flex-col gap-1">
              <span className="font-maquina text-xl font-bold uppercase tracking-tight text-tinta-900 group-hover:text-carimbo-600 sm:text-2xl">
                Entrar na partida
              </span>
              <span className="font-caderno text-sm text-tinta-500">
                Para quem vai jogar. O professor já está com o código na tela: digite o código e
                o seu nome, e você recebe propriedade, equipe e função.
              </span>
            </span>
            <span
              aria-hidden="true"
              className="shrink-0 self-center bg-carimbo-500 px-4 py-3 font-maquina text-sm font-bold uppercase tracking-[0.14em] text-papel-000 group-hover:bg-carimbo-600"
            >
              Abrir
            </span>
          </Link>

          <Link
            href="/admin"
            className="group flex items-baseline gap-3 border-t border-dashed border-papel-300 py-5 sm:gap-5"
          >
            <span className="tabular shrink-0 text-sm text-tinta-400">02</span>
            <span className="flex min-w-0 flex-1 flex-col gap-1">
              <span className="font-maquina text-xl font-bold uppercase tracking-tight text-tinta-900 group-hover:text-carimbo-600 sm:text-2xl">
                Painel do professor
              </span>
              <span className="font-caderno text-sm text-tinta-500">
                Criar a partida, projetar o código, acompanhar as equipes se formando e controlar
                o ritmo das rodadas em tempo real.
              </span>
            </span>
            <span
              aria-hidden="true"
              className="shrink-0 self-center border border-tinta-900/40 px-4 py-3 font-maquina text-sm font-bold uppercase tracking-[0.14em] text-tinta-900 group-hover:border-tinta-900"
            >
              Abrir
            </span>
          </Link>
        </nav>

        <div className="regua my-6" />

        <footer className="flex flex-col gap-1 font-maquina text-[0.6875rem] uppercase leading-relaxed tracking-[0.1em] text-tinta-400">
          <span>Valores e propriedades fictícios, inspirados em núcleos rurais reais do DF.</span>
          <span>As decisões alimentam o debate depois da partida, não uma nota.</span>
        </footer>
      </div>
    </main>
  );
}
