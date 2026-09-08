import Link from 'next/link';

/**
 * 404.
 *
 * Cenário real de sala: alguém digita o endereço errado no celular durante a
 * aula. A folha precisa devolver a pessoa ao jogo em um toque, não explicar
 * HTTP.
 */
export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center px-5 py-12">
      <div className="ficha ficha-margem py-6 pr-5">
        <span className="rotulo text-carimbo-600">Safra DF · página em branco</span>
        <h1 className="mt-1 text-2xl uppercase leading-tight text-tinta-900">
          Esta página não existe
        </h1>

        <div className="regua my-4" />

        <p className="font-caderno text-sm leading-relaxed text-tinta-700">
          O endereço pode ter sido digitado com um caractere trocado. Volte ao início e entre na
          partida com o código projetado na tela.
        </p>

        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/entrar"
            className="inline-flex min-h-11 items-center border border-carimbo-600 bg-carimbo-500 px-5 font-maquina text-sm font-bold uppercase tracking-[0.12em] text-papel-000 hover:bg-carimbo-600"
          >
            Entrar na partida
          </Link>
          <Link
            href="/"
            className="inline-flex min-h-11 items-center border border-tinta-900/40 px-5 font-maquina text-sm font-bold uppercase tracking-[0.12em] text-tinta-900 hover:border-tinta-900"
          >
            Voltar ao início
          </Link>
        </div>
      </div>
    </main>
  );
}
