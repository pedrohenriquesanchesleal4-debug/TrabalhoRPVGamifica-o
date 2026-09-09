'use client';

import { useEffect, useSyncExternalStore } from 'react';
import { formatMoney } from '@/components/ui/primitives';
import type { PropertyProfile } from '@/types/game';

/**
 * A abertura da partida.
 *
 * Quatro linhas em sequência, uma vez só, na primeira rodada: hora e local,
 * a manchete de abertura (`animate-manchete`, espacejamento fechando como uma
 * chapa de impressão travando), o orçamento e um dado concreto da própria
 * propriedade da equipe. Rápida: o aluno precisa estar jogando em menos de um
 * minuto, e por isso "Pular" fica sempre visível.
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

  const lines: { text: string; className: string; animate?: boolean }[] = [
    {
      text: 'BRASÍLIA · 06:20',
      className: 'font-mono text-[0.6875rem] font-bold uppercase tracking-[0.2em] text-papel-300',
    },
    {
      text: 'Uma nova safra começa.',
      className: 'manchete-xl text-papel-50',
      animate: true,
    },
    {
      text: `Vocês têm ${formatMoney(budget)}.`,
      className: 'dado-lg text-papel-100',
    },
    {
      text: propertyLine,
      className: 'max-w-sm text-base text-papel-200',
    },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-start justify-center gap-5 bg-tinta-900 px-7 py-10 sm:px-16"
      role="dialog"
      aria-modal="true"
      aria-label="Abertura da partida"
    >
      {lines.map((line, index) => (
        <p
          key={line.text}
          className={line.className}
          style={
            reducedMotion
              ? undefined
              : {
                  animation: line.animate ? 'var(--animate-manchete)' : 'var(--animate-sobe)',
                  animationDelay: `${BEATS[index]}ms`,
                }
          }
        >
          {line.text}
        </p>
      ))}

      <div aria-hidden="true" className="mt-2 h-px w-40 bg-papel-400/40" />

      <button
        type="button"
        onClick={onDone}
        className="mt-2 inline-flex min-h-11 items-center rounded-bloco border border-papel-400/40 px-4 text-sm font-semibold text-papel-200 transition-colors duration-150 hover:border-papel-200 hover:text-papel-50"
      >
        {reducedMotion ? 'Seguir para a partida' : 'Pular'}
      </button>
    </div>
  );
}
