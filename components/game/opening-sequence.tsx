'use client';

import { useEffect, useRef, useSyncExternalStore } from 'react';
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
      className: 'rotulo text-(--cor-tinta-panel-verde)',
    },
    {
      text: 'Uma nova safra começa.',
      className: 'relevo-xl titulo-amanhecer',
    },
    {
      text: `Vocês têm ${formatMoney(budget)}.`,
      className: 'dado-lg text-(--cor-tinta-panel-dourado)',
    },
    {
      text: propertyLine,
      className: 'ml-2 max-w-sm text-base text-(--cor-tinta-panel-amena) border-l-2 border-verde-800 pl-3',
    },
  ];

  // Guarda o elemento que tinha foco antes de abrir o dialog para devolver depois.
  const previousActiveElementRef = useRef<HTMLElement | null>(null);
  const skipButtonRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  /**
   * Focus trap nativo: captura Tab/Shift+Tab e cicla dentro do dialog.
   * Foco inicial no botão "PULAR/SEGUIR"; Esc chama onDone().
   */
  useEffect(() => {
    previousActiveElementRef.current = document.activeElement as HTMLElement;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onDone();
        return;
      }

      if (event.key !== 'Tab') return;

      const focusableElements = dialogRef.current?.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );

      if (!focusableElements || focusableElements.length === 0) return;

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      if (event.shiftKey) {
        if (document.activeElement === firstElement) {
          event.preventDefault();
          lastElement.focus();
        }
      } else {
        if (document.activeElement === lastElement) {
          event.preventDefault();
          firstElement.focus();
        }
      }
    };

    const dialog = dialogRef.current;
    dialog?.addEventListener('keydown', handleKeyDown);

    // Foco inicial no botão de pular/seguir
    skipButtonRef.current?.focus();

    return () => {
      dialog?.removeEventListener('keydown', handleKeyDown);
      // Devolve foco ao elemento anterior ao fechar
      if (previousActiveElementRef.current) {
        previousActiveElementRef.current.focus();
      }
    };
  }, [onDone]);

  return (
    <div
      ref={dialogRef}
      className="fixed inset-0 z-50 flex flex-col justify-center bg-nevoa-50 overflow-hidden pb-[env(safe-area-inset-bottom)]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="opening-title"
    >
      {/* Paisagem do Cerrado ao fundo: opacidade baixa, só atmosfera, não compete com texto. */}
      <CerradoLandscape className="opacity-40" />

      {/* Camadas de texto: posicionadas com padding generoso, z acima da paisagem. */}
      <div className="relative z-10 flex flex-col items-start gap-6 px-7 py-14 sm:px-16">
        {layers.map((layer, index) => (
          <p
            key={layer.text}
            id={layer.text === 'Uma nova safra começa.' ? 'opening-title' : undefined}
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
          ref={skipButtonRef}
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