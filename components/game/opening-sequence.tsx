'use client';

import { useEffect, useSyncExternalStore } from 'react';
import { formatMoney } from '@/components/ui/primitives';

/**
 * A abertura da partida: a primeira página do caderno sendo datilografada.
 *
 * Quatro linhas em sequência, uma vez só, na primeira rodada. Existe para dar
 * peso ao começo ("uma nova safra começa", "vocês têm R$ 80.000"), não para
 * exibir animação: passa em menos de quatro segundos e tem "Pular" sempre
 * visível, porque a atividade inteira cabe em vinte minutos de aula.
 *
 * A tela é a folha vista sob a luz da manhã: papel escuro, tinta clara, e cada
 * linha revelada por `clip-path` em passos, como caractere saindo do carro da
 * máquina. Só CSS, nenhuma biblioteca de animação.
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
    {
      text: 'BRASÍLIA · 06:20',
      className: 'font-maquina text-sm tracking-[0.28em] text-papel-400',
    },
    {
      text: 'Uma nova safra começa.',
      className: 'font-maquina text-3xl font-bold text-papel-000 sm:text-4xl',
    },
    {
      text: `Vocês têm ${formatMoney(budget)}.`,
      className: 'tabular text-2xl font-bold text-carimbo-400 sm:text-3xl',
    },
    {
      text: 'Cada decisão muda o futuro da propriedade.',
      className: 'font-caderno text-lg text-papel-200',
      cursor: true,
    },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-start justify-center gap-5 bg-tinta-900 px-7 py-10 sm:px-16"
      role="dialog"
      aria-modal="true"
      aria-label="Abertura da partida"
    >
      {/* A pauta da folha continua visível no escuro: é o mesmo caderno. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-[0.13]"
        style={{
          backgroundImage:
            'repeating-linear-gradient(to bottom, transparent 0, transparent 27px, var(--color-papel-200) 27px, var(--color-papel-200) 28px)',
        }}
      />

      <div className="relative flex flex-col gap-5">
        {lines.map((line, index) => (
          <p
            key={line.text}
            className={`${line.className}${line.cursor && !reducedMotion ? ' cursor-maquina' : ''}`}
            style={
              reducedMotion
                ? undefined
                : {
                    animation: 'var(--animate-escreve)',
                    animationDelay: `${BEATS[index]}ms`,
                  }
            }
          >
            {line.text}
          </p>
        ))}

        <button
          type="button"
          onClick={onDone}
          className="mt-3 inline-flex min-h-11 w-fit items-center border border-papel-400/50 px-4 font-maquina text-sm font-bold uppercase tracking-[0.14em] text-papel-200 hover:border-papel-200 hover:text-papel-000"
        >
          {reducedMotion ? 'Seguir para a partida' : 'Pular'}
        </button>
      </div>
    </div>
  );
}
