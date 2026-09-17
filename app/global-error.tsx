'use client';

import { useEffect } from 'react';

/**
 * Fronteira de erro RAIZ: substitui o layout inteiro quando a falha acontece
 * dentro dele (fonte, CSS, hidratação do <html>). O `app/error.tsx` já cobre
 * o corpo das páginas; este aqui é o último bastião — caso raro, mas é o que
 * impede tela branca total no meio da aula.
 *
 * Client component por obrigação (API `reset`), então não usa next/font: a
 * pilha de fontes do sistema cobre a eventualidade.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[safra-df] falha irrecuperável no layout:', error);
  }, [error]);

  return (
    <html lang="pt-BR">
      <body style={{ margin: 0, backgroundColor: '#0d0f0b' }}>
        <main
          style={{
            minHeight: '100dvh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1.5rem',
            fontFamily:
              "ui-monospace, 'Cascadia Code', 'JetBrains Mono', Consolas, monospace",
          }}
        >
          <div
            style={{
              maxWidth: '28rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '1.25rem',
              padding: '2rem',
              border: '1px solid #22281d',
              background: '#161a13',
              boxShadow: '5px 5px 0 #22281d',
            }}
          >
            <p
              style={{
                margin: 0,
                fontSize: '0.6875rem',
                letterSpacing: '0.22em',
                textTransform: 'uppercase',
                color: '#f2c968',
              }}
            >
              Safra DF
            </p>

            <h1
              style={{
                margin: 0,
                fontSize: '1.375rem',
                fontFamily: "'Oswald', 'Arial Narrow', sans-serif",
                textTransform: 'uppercase',
                color: '#f1e9d8',
              }}
            >
              Falha na base da página
            </h1>

            <p style={{ margin: 0, fontSize: '0.875rem', lineHeight: 1.6, color: '#c4b89e' }}>
              Nada do que a turma decidiu foi perdido. Recarregue a página —
              a partida continua salva no servidor.
            </p>

            {error.digest ? (
              <p style={{ margin: 0, fontSize: '0.75rem', color: '#9a8f76' }}>
                Referência: {error.digest}
              </p>
            ) : null}

            <button
              type="button"
              onClick={reset}
              style={{
                alignSelf: 'flex-start',
                padding: '0.625rem 1rem',
                border: 'none',
                background: '#e5a93c',
                color: '#0d0f0b',
                fontWeight: 700,
                fontFamily: 'inherit',
                cursor: 'pointer',
              }}
            >
              Tentar de novo
            </button>
          </div>
        </main>
      </body>
    </html>
  );
}