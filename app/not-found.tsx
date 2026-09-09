import Link from 'next/link';
import { Rotulo } from '@/components/ui/primitives';

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
        <Rotulo>Safra DF</Rotulo>
        <h1 className="relevo-md text-terra-900">Esta página não existe</h1>
        <p className="text-sm text-terra-700">
          O endereço pode ter sido digitado com um caractere trocado. Volte ao início e entre na
          partida com o código projetado na tela.
        </p>
      </div>

      <div className="flex flex-wrap gap-3">
        <Link
          href="/entrar"
          className="degrau banco pisavel terr-fundo-verde inline-flex min-h-11 items-center px-4 text-sm font-bold text-white"
        >
          Entrar na partida
        </Link>
        <Link
          href="/"
          className="degrau banco pisavel terr-claro inline-flex min-h-11 items-center px-4 text-sm font-bold text-terra-900"
        >
          Voltar ao início
        </Link>
      </div>
    </main>
  );
}
