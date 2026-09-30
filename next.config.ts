import path from 'node:path';
import type { NextConfig } from 'next';

const securityHeaders = [
  /*
   * CSP pragmática para sala de aula:
   * - `script-src 'unsafe-inline'`: o script de tema (localStorage) em
   *   `app/layout.tsx` é inline sem nonce, e o Next injeta scripts inline
   *   próprios em produção. Não vale a pena nonce para um jogo local.
   * - `connect-src *.supabase.co` (REST + realtime WSS): única origem
   *   externa que o navegador toca. Gemini e service_role vivem no servidor
   *   (route handlers) e não precisam entrar aqui.
   * - `frame-ancestors 'self'`: a projeção do host pode ser embutida na
   *   mesma origem, nunca em site de terceiro.
   * - Sem `upgrade-insecure-requests`: a partida roda em http://localhost
   *   na sala de aula; upgrade quebraria o próprio origin.
   */
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob:",
      "font-src 'self' data:",
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
      "frame-ancestors 'self'",
      "base-uri 'self'",
      "form-action 'self'",
      "object-src 'none'",
    ]
      .join('; ')
      // O Next recomenda colapsar espaços: o header é sensível a byte-a-byte
      // e navegadores interpretam whitespace como delimitador de diretiva.
      .replace(/\s{2,}/g, ' ')
      .trim(),
  },
  // Aplicações SPA pura: não queremos que o navegador adivinhe MIME.
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  // Referrer mínimo para fora: só a origem (protege o caminho da sala).
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  // Sem geolocation/câmera/mic: nada aqui precisa deles.
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), payment=()',
  },
];

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
  /*
   * React Compiler (estável no Next 16, não ligado por padrão): memoiza
   * componentes automaticamente. Trinta celulares re-renderizando a cada
   * evento realtime é exatamente o caso de uso. Requer o devDependency
   * `babel-plugin-react-compiler`. Se algum componente violar uma regra
   * do compilador, o BUILD falha na hora — erro ruidoso, nunca silencioso.
   */
  reactCompiler: true,
  // Não anuncia a stack no header X-Powered-By: hardening de informação.
  poweredByHeader: false,
  experimental: {
    /*
     * `lucide-react` é carregado por barrel (named exports): com a
     * otimização, só os ícones realmente usados entram no bundle.
     *
     * `@supabase/supabase-js` foi medido e NÃO ganhou nada: o chunk em
     * `/jogar` ficou byte a byte igual (239,8 KB) com e sem a linha. A
     * otimização reescreve barrel em import por módulo, mas aqui o gargalo
     * não é o índice do pacote: `createClient` constrói GoTrue (auth-js) e
     * Realtime (Phoenix) no construtor, e construção de classe não é removida
     * por tree-shaking. O `exports` do pacote só expõe `.`, `./cors`,
     * `./tracing` e `./dist/*` — não existe entrada estreita e suportada.
     *
     * A linha fica porque é inofensiva e cobre o caso de o pacote virar
     * elegível; o ganho de verdade exigiria não mandar supabase-js ao cliente
     * (realtime via servidor), que é decisão de arquitetura, não de config.
     */
    optimizePackageImports: ['lucide-react', '@supabase/supabase-js'],
  },
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
};

export default nextConfig;
