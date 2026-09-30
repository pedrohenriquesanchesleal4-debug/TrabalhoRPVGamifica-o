/**
 * Conversão de caixa em índice financeiro.
 *
 * Estas quatro peças vivem fora de `game/engine.ts` por um motivo medido: a
 * engine importa `data/events.ts` (44 KB de narrativa das cartas) na linha 1,
 * e a tela do aluno (`app/jogar/page.tsx`) e o `IndicatorPanel` precisam só
 * desta matemática para desenhar UM número. O resultado era 66 KB de JS no
 * celular de quem nunca vai ver uma carta daquele módulo.
 *
 * Módulo folha de propósito: ZERO import. Assim ele entra no bundle sozinho, e
 * a dependência de `data/events.ts` fica confineda ao servidor e à engine.
 *
 * A fórmula NÃO mudou. `game/engine.ts` reexporta daqui, então `tests/engine.test.ts`
 * e todo o resto do servidor continuam importando de `@/game/engine` sem mudar.
 */

/** Piso e teto usados para converter caixa em índice financeiro 0..100. */
export const FINANCE_FLOOR = -20_000;
export const FINANCE_CEILING = 120_000;

/** Mantém um índice dentro de 0..100 e inteiro. */
export function clampIndex(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

/** Converte caixa em reais para índice financeiro comparável aos demais. */
export function financeIndex(cash: number): number {
  const range = FINANCE_CEILING - FINANCE_FLOOR;
  return clampIndex(((cash - FINANCE_FLOOR) / range) * 100);
}
