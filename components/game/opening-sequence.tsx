'use client';

import { useEffect, useSyncExternalStore } from 'react';
import { formatMoney } from '@/components/ui/primitives';

/**
 * A abertura da partida.
 *
 * Quatro frases em sequência, uma vez só, na primeira rodada. Existe para dar
 * peso ao começo ("uma nova safra começa", "vocês têm R$ 80.000"), não para
 * exibir animação: passa em menos de quatro segundos e tem "Pular" sempre
 * visível, porque a atividade inteira cabe em vinte minutos de aula.
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
  onDone,
}: {
  budget: number;
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

  const lines = [
    { text: 'BRASÍLIA · 06:20', className: 'rotulo text-areia-300' },
    { text: 'Uma nova safra começa.', className: 'text-3xl text-areia-100 sm:text-4xl' },
    {
      text: `Vocês têm ${formatMoney(budget)}.`,
      className: 'tabular text-2xl text-terra-400 sm:text-3xl',
    },
    {
      text: 'Cada decisão muda o futuro da propriedade.',
      className: 'text-lg text-areia-200',
    },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-start justify-center gap-5 bg-mata-900 px-7 py-10 sm:px-16"
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
              : { animation: 'var(--animate-sobe)', animationDelay: `${BEATS[index]}ms` }
          }
        >
          {line.text}
        </p>
      ))}

      <div className="faixa-terra mt-2 w-40 opacity-40" />

      <button
        type="button"
        onClick={onDone}
        className="mt-2 inline-flex min-h-11 items-center rounded-carta border border-areia-400/40 px-4 text-sm font-medium text-areia-200 hover:border-areia-200 hover:text-areia-50"
      >
        {reducedMotion ? 'Seguir para a partida' : 'Pular'}
      </button>
    </div>
  );
}
