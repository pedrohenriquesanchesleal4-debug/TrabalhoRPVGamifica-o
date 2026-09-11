'use client';

import { useEffect, useSyncExternalStore } from 'react';
import { formatMoney } from '@/components/ui/primitives';
import type { PropertyProfile } from '@/types/game';
import { CerradoLandscape } from '@/components/game/cerrado-landscape';

/**
 * SAFRA DF · Abertura da partida — direção V6 "Amanhecer do Cerrado".
 *
 * Momento cinematográfico: o céu do Cerrado ao amanhecer, com camadas de
 * texto entrando em sequência assimétrica. A paisagem é o fundo vivo; o texto
 * sobrepõe em camadas com `animate-emergir` escalonado.
 *
 * Quatro beats: hora/local → manchete (`.titulo-amanhecer`) → orçamento →
 * propriedade. Botão de skip sempre visível (aula começou, aluno precisa
 * entrar).
 *
 * Só CSS, nenhuma biblioteca de animação.
 */

/** Duração total da sequência, em milissegundos. */
const TOTAL_MS = 4200;

/** Momento de entrada de cada camada, em milissegundos. */
const BEATS = [0, 700, 1500, 2400];

/**
 * Preferência de movimento reduzido, lida como fonte externa.
 *
 * `useSyncExternalStore` é o caminho correto para isso: assina o media query e
 * devolve o valor atual sem estado intermediário e sem setState em efeito.
 */
function subscribeReducedMotion(onChange: () => void): () => void {
  const query = window.matchMedia('(prefers-reduced-motion: reduce)');
  query.addEventListener('change', onChange);
  return () => query.removeEventListener('change', onChange);
}

function readReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function OpeningSequence({
  budget,
  property,
  onDone,
}: {
  budget: number;
  /** A propriedade da equipe, lida de `data/properties.ts`, para a última camada. */
  property: PropertyProfile | null;
  onDone: () => void;
}) {
  const reducedMotion = useSyncExternalStore(
    subscribeReducedMotion,
    readReducedMotion,
    // No servidor, assume movimento normal: o cliente corrige na hidratação.
    () => false,
  );

  /**
   * Com movimento normal, a sequência se encerra sozinha no fim do tempo. Com
   * movimento reduzido não existe temporizador: as quatro linhas aparecem de
   * uma vez e quem lê decide quando seguir.
   */
  useEffect(() => {
    if (reducedMotion) return;

    const timer = window.setTimeout(onDone, TOTAL_MS);
    return () => window.clearTimeout(timer);
  }, [reducedMotion, onDone]);

  const propertyLine = property
    ? `${property.name}: ${property.tagline}`
    : 'Cada decisão muda o futuro da propriedade.';

  /**
   * Camadas assimétricas: a manchete é o elemento visual dominante, com
   * `.titulo-amanhecer` (gradiente dourado em texto). Rótulos e dados
   * posicionados com `ml-` para criar profundidade lateral, nunca centralizados.
   */
  const layers: { text: string; className: string; style?: React.CSSProperties }[] = [
    {
      text: 'BRASÍLIA · 06:20',
      className: 'rotulo text-verde-300',
    },
    {
      text: 'Uma nova safra começa.',
      className: 'relevo-xl titulo-amanhecer',
    },
    {
      text: `Vocês têm ${formatMoney(budget)}.`,
      className: 'dado-lg text-financas-texto',
    },
    {
      text: propertyLine,
      className: 'ml-2 max-w-sm text-base text-terra-700 border-l-2 border-verde-800 pl-3',
    },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col justify-center bg-nevoa-50 overflow-hidden"
      role="dialog"
      aria-modal="true"
      aria-label="Abertura da partida"
    >
      {/* Paisagem do Cerrado ao fundo: opacidade baixa, só atmosfera, não compete com texto. */}
      <CerradoLandscape className="opacity-40" />

      {/* Camadas de texto: posicionadas com padding generoso, z acima da paisagem. */}
      <div className="relative z-10 flex flex-col items-start gap-6 px-7 py-14 sm:px-16">
        {layers.map((layer, index) => (
          <p
            key={layer.text}
            className={
              reducedMotion
                ? layer.className
                : `${layer.className} animate-emergir`
            }
            style={
              reducedMotion
                ? undefined
                : {
                    animationDelay: `${BEATS[index]}ms`,
                    ...layer.style,
                  }
            }
          >
            {layer.text}
          </p>
        ))}

        <div
          aria-hidden="true"
          className={
            reducedMotion
              ? 'filete-amanhecer mt-1 w-48'
              : 'filete-amanhecer mt-1 w-48 animate-emergir'
          }
          style={reducedMotion ? undefined : { animationDelay: '3000ms' }}
        />

        <button
          type="button"
          onClick={onDone}
          className="degrau banco pisavel terr-financas mt-1 inline-flex min-h-11 items-center px-4 text-sm font-bold text-terra-900"
        >
          {reducedMotion ? 'SEGUIR PARA A PARTIDA' : 'PULAR'}
        </button>
      </div>
    </div>
  );
}
