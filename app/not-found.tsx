import Link from 'next/link';

/**
 * 404.
 *
 * Cenário real de sala: alguém digita o endereço errado no celular durante a
 * aula. A tela precisa devolver a pessoa ao jogo em um toque, não explicar HTTP.
 */
export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center gap-6 px-6 py-16">
      <div className="flex flex-col gap-2">
        <span className="rotulo">Safra DF</span>
        <h1 className="text-3xl text-mata-900">Esta página não existe</h1>
        <p className="text-sm text-mata-600">
          O endereço pode ter sido digitado com um caractere trocado. Volte ao
          início e entre na partida com o código projetado na tela.
        </p>
      </div>

      <div className="faixa-terra" />

      <div className="flex flex-wrap gap-3">
        <Link
          href="/entrar"
          className="inline-flex min-h-11 items-center rounded-carta border border-terra-600 bg-terra-500 px-4 text-sm font-medium text-areia-50"
        >
          Entrar na partida
        </Link>
        <Link
          href="/"
          className="inline-flex min-h-11 items-center rounded-carta border border-areia-300 bg-areia-50 px-4 text-sm font-medium text-mata-800"
        >
          Voltar ao início
        </Link>
      </div>
    </main>
  );
}
