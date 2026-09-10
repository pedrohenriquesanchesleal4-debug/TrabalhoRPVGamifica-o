'use client';

import Link from 'next/link';
import { ArrowRight, GraduationCap, Sprout } from 'lucide-react';
import { Rotulo } from '@/components/ui/primitives';
import { PropertyScene } from '@/components/game/property-scene';
import { DfMap } from '@/components/game/df-map';
import { GAUGE_ICON, GAUGE_INK, INDICATOR_KEY_TO_KIND } from '@/components/ui/gauges';
import { PROPERTIES } from '@/data/properties';

/**
 * Capa do jogo.
 *
 * Não é cartão centralizado num vazio: é um mirante (a única altitude 3 desta
 * tela) com a manchete e a cena da propriedade lado a lado, seguido de duas
 * portas assimétricas ("sou aluno" maior, "sou professor" menor e deslocada)
 * e uma faixa com as seis propriedades jogáveis, para que a variedade do jogo
 * já apareça antes de qualquer clique.
 */

export default function HomePage() {
  return (
    <main className="mx-auto w-full max-w-6xl px-5 py-8 sm:px-8 sm:py-12 lg:py-16">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5 lg:gap-6">
        <section className="degrau mirante terr-fundo-verde flex flex-col gap-8 px-6 py-10 sm:px-10 sm:py-14 lg:col-span-3 lg:flex-row lg:items-center lg:gap-10 lg:py-16">
          <div className="flex flex-col gap-4 lg:flex-1">
            <Rotulo className="text-verde-300">Atividade diagnóstica · 15 a 20 minutos</Rotulo>
            <h1 className="relevo-xl text-white">Safra DF</h1>
            <p className="max-w-[46ch] text-base leading-relaxed text-white/90">
              Cada equipe assume uma propriedade rural do Distrito Federal e administra um
              orçamento limitado ao longo de cinco rodadas. Ninguém enxerga o jogo inteiro
              sozinho: a decisão só fecha quando o grupo conversa em voz alta.
            </p>
          </div>
          <div className="mx-auto w-36 shrink-0 sm:w-44 lg:w-48 xl:w-56">
            <PropertyScene propertyKey="riacho-verde" production={62} technology={48} sustainability={58} />
          </div>
        </section>

        <div className="flex flex-col gap-4 lg:col-span-2 lg:justify-center">
          <Link
            href="/entrar"
            className="degrau terraco pisavel terr-verde flex min-h-20 flex-col justify-center gap-1 px-6 py-5 text-terra-900 sm:min-h-24"
          >
            <span className="rotulo text-verde-800">Sou aluno</span>
            <span className="relevo-sm flex items-center gap-2">
              <Sprout size={20} aria-hidden="true" />
              Entrar na partida
              <ArrowRight size={18} aria-hidden="true" className="ml-auto" />
            </span>
          </Link>

          <Link
            href="/admin"
            className="degrau banco pisavel terr-claro ml-6 flex min-h-16 items-center gap-3 px-5 text-terra-900 sm:ml-10"
          >
            <GraduationCap size={18} aria-hidden="true" />
            <span className="text-sm font-bold">Sou professor: criar partida</span>
          </Link>
        </div>
      </div>

      <section className="degrau terraco terr-claro mt-6 flex flex-col gap-6 p-6 sm:p-8 lg:mt-8">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-5 lg:items-center">
          <div className="lg:col-span-2">
            <DfMap className="mx-auto max-w-xs lg:max-w-none" />
          </div>

          <div className="flex flex-col gap-4 lg:col-span-3">
            <Rotulo>6 propriedades. 1 território.</Rotulo>
            <p className="max-w-prose text-sm text-terra-700">
              Cada equipe entra numa parcela diferente do mesmo Distrito Federal, com uma
              identidade própria: passe o mouse ou navegue por tab pelos pontos do mapa para ver
              qual delas fica com você.
            </p>

            <ul className="flex flex-col gap-2">
              {PROPERTIES.map((property) => {
                const kind = INDICATOR_KEY_TO_KIND[property.highlight.indicator];
                const Icon = GAUGE_ICON[kind];
                return (
                  <li
                    key={property.key}
                    className="degrau banco terr-neutro flex items-center gap-3 py-2 pl-2.5 pr-3"
                  >
                    <div className="w-9 shrink-0">
                      <PropertyScene
                        compact
                        propertyKey={property.key}
                        production={50}
                        technology={40}
                        sustainability={50}
                      />
                    </div>
                    <span className="min-w-0 flex-1 truncate text-sm font-bold text-terra-900">
                      {property.name}
                    </span>
                    <span className={`flex items-center gap-1.5 text-xs ${GAUGE_INK[kind]}`}>
                      <Icon size={14} strokeWidth={2.4} aria-hidden="true" />
                      <span className="whitespace-nowrap">{property.highlight.label}</span>
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      </section>

      <p className="mt-6 max-w-prose text-xs text-terra-500 lg:mt-8">
        Valores e propriedades são fictícios, inspirados em núcleos rurais reais do Distrito
        Federal. As decisões alimentam o debate em sala depois, não uma nota.
      </p>
    </main>
  );
}
