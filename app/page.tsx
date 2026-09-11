'use client';

import Link from 'next/link';
import { CerradoLandscape } from '@/components/game/cerrado-landscape';
import { DfMap } from '@/components/game/df-map';
import { Rotulo, SectionHeading } from '@/components/ui/primitives';
import { GAUGE_ICON, GAUGE_INK, INDICATOR_KEY_TO_KIND } from '@/components/ui/gauges';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { PROPERTIES } from '@/data/properties';

/**
 * Home V6 — "Amanhecer do Cerrado".
 *
 * Redesign cinematográfico: hero com paisagem SVG full-bleed, título em
 * gradiente dourado, manifesto editorial, mapa do DF com as 6 propriedades
 * e chamada final. Sem card genérico, sem glassmorphism, sem imagem nova.
 */

/** Matéria do ticker do hero: os números e limites que voltam a cada rodada. */
const TICKER_ITENS = [
  '05 RODADAS',
  '06 PROPRIEDADES REAIS DO DF',
  '100 SEGUNDOS POR DECISÃO',
  'RECURSOS LIMITADOS, SEMPRE',
  '4 EQUIPES POR TURMA',
  'CERRADO VIVO, ÁGUA CURTA',
] as const;

export default function HomePage() {
  return (
    <main className="w-full">
      {/* ----------------------------------------------------------------
          1 · HERO CINEMATOGRÁFICO
          Paisagem SVG como fundo, texto editorial assimétrico à esquerda.
          ~92dvh no mobile (min-h-[92dvh]), respiração sem empurrar conteúdo.
          ---------------------------------------------------------------- */}
      <section className="paralaxe-cena relative min-h-[92dvh] overflow-hidden">
        {/* Cenário: full-bleed, por trás de tudo */}
        <CerradoLandscape className="z-0" />

        {/* Overlay escuro sutil para garantir leitura do texto (fixo nos dois temas) */}
        <div className="pointer-events-none absolute inset-0 z-[1] bg-[#0d0f0b]/45" />

        {/* Alternador de tema: canto do hero, acima da cena. */}
        <ThemeToggle className="absolute right-5 top-5 z-[3] sm:right-8 sm:top-7" />

        {/* Conteúdo: posicionado sobre o cenário */}
        <div className="relative z-[2] flex min-h-[92dvh] flex-col justify-end px-5 pb-12 pt-24 sm:px-8 sm:pb-16 sm:pt-28 lg:mx-auto lg:max-w-6xl lg:px-8">
          <div className="flex max-w-xl flex-col gap-5 lg:max-w-2xl">
            <div className="motion-safe:animate-emergir" style={{ animationDelay: '0ms' }}>
              <Rotulo className="text-(--cor-tinta-panel-dourado)">
                BRASÍLIA · DISTRITO FEDERAL · 06:20
              </Rotulo>
            </div>

            <h1 className="titulo-amanhecer text-7xl font-bold uppercase leading-[0.88] tracking-[0.004em] sm:text-8xl lg:text-[7rem] motion-safe:animate-emergir" style={{ animationDelay: '80ms' }}>
              SAFRA<br />
              DF
            </h1>

            <div className="filete-amanhecer w-full max-w-xs motion-safe:animate-emergir" style={{ animationDelay: '160ms' }} />

            <p className="max-w-[38ch] text-base leading-relaxed sobre-cena-suave sm:text-lg motion-safe:animate-emergir" style={{ animationDelay: '240ms' }}>
              Uma propriedade. Recursos limitados. Cinco decisões que alimentam.
            </p>

            <div className="mt-2 flex flex-wrap items-center gap-3">
              <Link
                href="/entrar"
                className="degrau banco pisavel bg-financas text-(--cor-tinta-escuro) inline-flex min-h-14 items-center justify-center gap-2 px-6 text-base font-bold tracking-[0.01em] motion-safe:animate-emergir"
                style={{ animationDelay: '320ms' }}
              >
                ENTRAR NA PARTIDA
              </Link>
              <Link
                href="/admin"
                className="degrau banco pisavel terr-claro text-terra-900 inline-flex min-h-14 items-center justify-center gap-2 px-6 text-base font-bold tracking-[0.01em] motion-safe:animate-emergir"
                style={{ animationDelay: '400ms' }}
              >
                CRIAR PARTIDA
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ----------------------------------------------------------------
          1.5 · TICKER DA SAFRA
          Fita de dados sob o herói: a mesma matéria do jogo em uma linha
          contínua. Laço decorativo (aria-hidden), 34s, devagar sob
          redução de movimento (64s) — texto duplicado em duas faixas para
          o loop de `translateX(-50%)` não ter emenda.
          ---------------------------------------------------------------- */}
      <div aria-hidden="true" className="relative overflow-hidden border-y border-financas/25 bg-[#0d0f0b] py-3">
        <div className="ticker-rola flex w-max items-center">
          {[0, 1].map((metade) => (
            <div key={metade} className="flex items-center" aria-hidden="true">
              {TICKER_ITENS.map((item) => (
                <span key={item} className="flex items-center gap-10 pr-10">
                  <span className="rotulo shrink-0 text-(--cor-tinta-panel)">{item}</span>
                  <span className="text-financas text-[10px]">◆</span>
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* ----------------------------------------------------------------
          2 · FAIXA MANIFESTO / RAZÃO DE EXISTIR
          Cerrado como problema real, jogo como simulação de decisão.
          ---------------------------------------------------------------- */}
      <section className="revelar mx-auto w-full max-w-6xl px-5 py-10 sm:px-8 sm:py-14 lg:py-16">
        <div className="degrau terraco terr-neutro flex flex-col gap-5 p-6 sm:p-8">
          <p className="max-w-[54ch] text-sm leading-relaxed text-terra-700">
            O Cerrado abriga a maior biodiversidade da América Latina — e cerca de
            metade de suas áreas naturais já foram desmatadas para dar lugar à
            agricultura. No Distrito Federal, a pressão é direta: loteamento irregular,
            baixa disponibilidade hídrica e mão de obra familiar que opera com
            recursos mínimos.
          </p>
          <p className="max-w-[54ch] text-sm leading-relaxed text-terra-700">
            <span className="relevo-sm text-terra-900">Safra DF</span> não é um jogo
            sobre dinheiro: é uma simulação de decisão sob escassez, onde cada equipe
            gerencia uma propriedade real do DF durante cinco rodadas. A Reflexão
            coletiva em sala de aula é o produto final — não a nota.
          </p>
        </div>
      </section>

      {/* ----------------------------------------------------------------
          3 · MAPA DO DF + 6 PROPRIEDADES
          Assimétrico: mapa à esquerda em desktop, coluna à direita com
          as 6 propriedades usando Rotulo + nome + região + foco.
          ---------------------------------------------------------------- */}
      <section className="revelar mx-auto w-full max-w-6xl px-5 py-10 sm:px-8 sm:py-14 lg:py-16">
        <div className="degrau terraco terr-claro flex flex-col gap-6 p-6 sm:p-8 lg:flex-row lg:items-start lg:gap-10">
          {/* Mapa */}
          <div className="shrink-0 lg:w-[45%]">
            <DfMap className="mx-auto max-w-xs lg:max-w-none" />
          </div>

          {/* Lista das propriedades */}
          <div className="flex flex-1 flex-col gap-5">
            <SectionHeading
              overline="6 propriedades · 1 território"
              title="Onde você vai plantar?"
              description="Cada equipe entra numa parcela diferente do mesmo Distrito Federal, com uma identidade própria."
            />

            <ul className="flex flex-col gap-3">
              {PROPERTIES.map((property) => {
                const kind = INDICATOR_KEY_TO_KIND[property.highlight.indicator];
                const Icon = GAUGE_ICON[kind];
                return (
                  <li
                    key={property.key}
                    className="degrau banco terr-neutro flex flex-col gap-1 p-3.5 sm:flex-row sm:items-center sm:gap-3"
                  >
                    <span className={`flex items-center gap-2 ${GAUGE_INK[kind]}`}>
                      <Icon size={16} strokeWidth={2.4} aria-hidden="true" />
                      <span className="text-sm font-bold text-terra-900">
                        {property.name}
                      </span>
                    </span>
                    <span className="rotulo text-terra-500">
                      {property.region}
                    </span>
                    <span className="ml-auto text-xs text-terra-700">
                      {property.highlight.label}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      </section>

      {/* ----------------------------------------------------------------
          3.5 · COMO FUNCIONA
          Banda assimétrica de três passos — o jogo cabe em uma frase por
          etapa. Colunas com deslocamento vertical (degraus de tempo), não
          uma grade de cartões iguais.
          ---------------------------------------------------------------- */}
      <section className="revelar mx-auto w-full max-w-6xl px-5 py-10 sm:px-8 sm:py-14 lg:py-16">
        <div className="flex flex-col gap-6 sm:gap-8">
          <SectionHeading
            overline="A partida em 100 segundos"
            title="Como funciona"
            description="Um código, quatro fazendas, cinco rodadas. Cada decisão cabe numa frase."
          />

          <div className="grid gap-4 lg:grid-cols-[1.15fr_1fr_1fr] lg:items-stretch">
            <article className="degrau terraco terr-verde flex flex-col gap-4 p-6 sm:p-7 lg:p-8">
              <span className="dado text-4xl text-financas-texto">01</span>
              <h3 className="relevo-sm text-verde-300">Um código de turma</h3>
              <p className="text-sm leading-relaxed text-terra-700">
                O professor abre a partida e a turma se divide em até quatro equipes.
                Cada uma entra numa propriedade real do Distrito Federal, com uma
                identidade própria — e os mesmos recursos limitados.
              </p>
            </article>

            <article className="degrau terraco terr-azul flex flex-col gap-4 p-6 sm:p-7 lg:mt-6 lg:p-8">
              <span className="dado text-4xl text-financas-texto">02</span>
              <h3 className="relevo-sm text-azul-300">Cinco rodadas</h3>
              <p className="text-sm leading-relaxed text-terra-700">
                Em cada rodada, uma decisão de plantio, irrigação, adubação,
                proteção ou venda. O orçamento não fecha: é exatamente isso que
                a escassez ensina.
              </p>
            </article>

            <article className="degrau terraco terr-claro flex flex-col gap-4 p-6 sm:p-7 lg:mt-12 lg:p-8">
              <span className="dado text-4xl text-financas-texto">03</span>
              <h3 className="relevo-sm text-terra-900">A consequência volta</h3>
              <p className="text-sm leading-relaxed text-terra-700">
                O que foi decidido muda a próxima rodada — e a reflexão em sala,
                depois da partida, é o produto final. Não é uma nota: é um debate.
              </p>
            </article>
          </div>
        </div>
      </section>

      {/* ----------------------------------------------------------------
          4 · CHAMADA FINAL
          Frase seca + CTA dourado repetido + link do professor.
          ---------------------------------------------------------------- */}
      <section className="revelar mx-auto w-full max-w-6xl px-5 py-10 sm:px-8 sm:py-14 lg:py-16">
        <div className="degrau terraco terr-fundo-verde flex flex-col items-center gap-5 p-6 text-center sm:p-10">
          <p className="relevo-lg text-white">
            A primeira decisão é entrar.
          </p>

          <Link
            href="/entrar"
            className="degrau banco pisavel bg-financas text-(--cor-tinta-escuro) inline-flex min-h-14 items-center justify-center gap-2 px-6 text-base font-bold tracking-[0.01em]"
          >
            ENTRAR NA PARTIDA
          </Link>

          <Link
            href="/admin"
            className="rotulo text-(--cor-tinta-panel-verde) hover:opacity-80"
          >
            Sou professor · criar partida
          </Link>
        </div>
      </section>

      {/* ----------------------------------------------------------------
          RODAPÉ LEGAL
          ---------------------------------------------------------------- */}
      <p className="mx-auto max-w-6xl px-5 pb-10 pt-2 text-xs text-terra-500 sm:px-8">
        Valores e propriedades são fictícios, inspirados em núcleos rurais
        reais do Distrito Federal. As decisões alimentam o debate em sala
        depois, não uma nota.
      </p>
    </main>
  );
}
