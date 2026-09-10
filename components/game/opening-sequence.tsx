'use client';

import { useEffect, useSyncExternalStore } from 'react';
import { formatMoney } from '@/components/ui/primitives';
import type { PropertyProfile } from '@/types/game';

/**
 * A abertura da partida.
 *
 * Quatro linhas em sequência, uma vez só, na primeira rodada: hora e local,
 * a manchete de abertura em `.relevo-xl` (`animate-emergir`, o degrau
 * emergindo do fundo), o orçamento e um dado concreto da própria propriedade
 * da equipe. Rápida: o aluno precisa estar jogando em menos de um minuto, e
 * por isso "Pular" fica sempre visível.
 *
 * Só CSS, nenhuma biblioteca de animação.
 */

/** Duração total da sequência, em milissegundos. */
const TOTAL_MS = 3800;

/** Momento de entrada de cada linha, em milissegundos. */
const BEATS = [0, 900, 1900, 2800];

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
  /** A propriedade da equipe, lida de `data/properties.ts`, para a última linha. */
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

  const lines: { text: string; className: string }[] = [
    {
      text: 'BRASÍLIA · 06:20',
      className: 'rotulo text-verde-300',
    },
    {
      text: 'Uma nova safra começa.',
      className: 'relevo-xl text-white',
    },
    {
      text: `Vocês têm ${formatMoney(budget)}.`,
      className: 'dado-lg text-verde-300',
    },
    {
      text: propertyLine,
      className: 'max-w-sm text-base text-nevoa-100',
    },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-start justify-center gap-5 bg-nevoa-50 px-7 py-10 sm:px-16"
      role="dialog"
      aria-modal="true"
      aria-label="Abertura da partida"
    >
      {lines.map((line, index) => (
        <p
          key={line.text}
          className={reducedMotion ? line.className : `${line.className} animate-emergir`}
          style={
            reducedMotion
              ? undefined
              : {
                  animationDelay: `${BEATS[index]}ms`,
                }
          }
        >
          {line.text}
        </p>
      ))}

      <div aria-hidden="true" className="mt-2 h-px w-40 bg-verde-800" />

      <button
        type="button"
        onClick={onDone}
        className="degrau banco pisavel terr-claro mt-2 inline-flex min-h-11 items-center px-4 text-sm font-bold text-terra-900"
      >
        {reducedMotion ? 'Seguir para a partida' : 'Pular'}
      </button>
    </div>
  );
}
