import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

/**
 * Configuração de testes do SAFRA DF.
 *
 * Ambiente `node`: a engine é pura (sem DOM, sem React, sem I/O), então não há
 * necessidade de jsdom nem de plugin de framework de UI aqui. O alias `@/`
 * espelha o `tsconfig.json` para que os testes importem `@/types/game`,
 * `@/game/engine` etc. exatamente como o resto do projeto.
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    watch: false,
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('.', import.meta.url)),
    },
  },
});
