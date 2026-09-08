'use client';

import { useEffect } from 'react';

/**
 * Fronteira de erro global.
 *
 * O pior momento para uma tela branca é no meio da aula, com trinta alunos
 * olhando. Aqui a falha vira uma instrução acionável: tentar de novo, que
 * remonta a árvore sem perder a sessão salva no navegador.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[safra-df] erro na interface:', error);
  }, [error]);

  const missingEnv = error.message.includes('Variável de ambiente ausente');

  return (
    <main className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center gap-6 px-6 py-16">
      <div className="flex flex-col gap-2">
        <span className="rotulo">Safra DF</span>
        <h1 className="text-3xl text-mata-900">Algo falhou nesta tela</h1>

        {missingEnv ? (
          <p className="text-sm text-mata-600">
            O projeto está sem as chaves do Supabase. Copie o arquivo{' '}
            <code className="rounded bg-areia-200 px-1 py-0.5 text-xs">.env.example</code>{' '}
            para{' '}
            <code className="rounded bg-areia-200 px-1 py-0.5 text-xs">.env.local</code>,
            preencha com as chaves do projeto e reinicie o servidor.
          </p>
        ) : (
          <p className="text-sm text-mata-600">
            A partida continua salva no servidor: nada do que a turma decidiu foi
            perdido. Tente carregar a tela de novo.
          </p>
        )}

        {error.digest ? (
          <p className="tabular text-xs text-mata-600">Referência: {error.digest}</p>
        ) : null}
      </div>

      <div className="faixa-terra" />

      <button
        type="button"
        onClick={reset}
        className="inline-flex min-h-11 w-fit items-center rounded-carta border border-terra-600 bg-terra-500 px-4 text-sm font-medium text-areia-50"
      >
        Tentar de novo
      </button>
    </main>
  );
}
