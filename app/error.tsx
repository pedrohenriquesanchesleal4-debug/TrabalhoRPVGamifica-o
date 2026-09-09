'use client';

import { useEffect } from 'react';
import { Chapeu, Filete } from '@/components/ui/primitives';

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
      <div className="filete-grosso flex flex-col gap-2 pt-3">
        <Chapeu>Safra DF</Chapeu>
        <h1 className="manchete-md text-tinta-900">Algo falhou nesta tela</h1>

        {missingEnv ? (
          <p className="text-sm text-tinta-500">
            O projeto está sem as chaves do Supabase. Copie o arquivo{' '}
            <code className="rounded-bloco bg-papel-200 px-1 py-0.5 text-xs">.env.example</code>{' '}
            para{' '}
            <code className="rounded-bloco bg-papel-200 px-1 py-0.5 text-xs">.env.local</code>,
            preencha com as chaves do projeto e reinicie o servidor.
          </p>
        ) : (
          <p className="text-sm text-tinta-500">
            A partida continua salva no servidor: nada do que a turma decidiu foi perdido. Tente
            carregar a tela de novo.
          </p>
        )}

        {error.digest ? (
          <p className="dado text-xs text-tinta-500">Referência: {error.digest}</p>
        ) : null}
      </div>

      <Filete espessura="fino" />

      <button
        type="button"
        onClick={reset}
        className="inline-flex min-h-11 w-fit items-center rounded-bloco border border-tinta-900 bg-tinta-900 px-4 text-sm font-semibold text-papel-50 transition-colors duration-150 hover:bg-manchete-escura hover:border-manchete-escura"
      >
        Tentar de novo
      </button>
    </main>
  );
}
