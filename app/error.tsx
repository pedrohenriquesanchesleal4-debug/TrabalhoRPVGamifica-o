'use client';

import { useEffect } from 'react';

/**
 * Fronteira de erro global.
 *
 * O pior momento para uma tela branca é no meio da aula, com trinta alunos
 * olhando. Aqui a falha vira uma anotação na margem com instrução acionável:
 * tentar de novo remonta a árvore sem perder a sessão salva no navegador.
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
    <main className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center px-5 py-12">
      <div className="ficha ficha-margem py-6 pr-5">
        <span className="rotulo text-carimbo-600">Safra DF · ocorrência</span>
        <h1 className="mt-1 text-2xl uppercase leading-tight text-tinta-900">
          Algo falhou nesta tela
        </h1>

        <div className="regua my-4" />

        {missingEnv ? (
          <p className="font-caderno text-sm leading-relaxed text-tinta-700">
            O projeto está sem as chaves do Supabase. Copie o arquivo{' '}
            <span className="tabular text-tinta-900">.env.example</span> para{' '}
            <span className="tabular text-tinta-900">.env.local</span>, preencha com as chaves do
            projeto e reinicie o servidor.
          </p>
        ) : (
          <p className="font-caderno text-sm leading-relaxed text-tinta-700">
            A partida continua salva no servidor: nada do que a turma decidiu foi perdido. Tente
            carregar a tela de novo.
          </p>
        )}

        {error.digest ? (
          <p className="tabular mt-3 text-xs text-tinta-400">Referência: {error.digest}</p>
        ) : null}

        <button
          type="button"
          onClick={reset}
          className="mt-6 inline-flex min-h-11 w-fit items-center border border-carimbo-600 bg-carimbo-500 px-5 font-maquina text-sm font-bold uppercase tracking-[0.12em] text-papel-000 hover:bg-carimbo-600"
        >
          Tentar de novo
        </button>
      </div>
    </main>
  );
}
