import path from 'node:path';
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  turbopack: {
    /*
     * Fixa a raiz no diretório do projeto.
     *
     * Sem isso, o Turbopack sobe a árvore procurando lockfile e encontra o
     * `package-lock.json` do diretório acima (que pertence a outro projeto),
     * emitindo aviso e correndo o risco de resolver dependência errada.
     */
    root: path.resolve(import.meta.dirname),
  },
};

export default nextConfig;
