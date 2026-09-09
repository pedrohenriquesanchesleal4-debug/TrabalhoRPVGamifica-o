import Link from 'next/link';
import { Chapeu, Filete } from '@/components/ui/primitives';

/**
 * 404.
 *
 * Cenário real de sala: alguém digita o endereço errado no celular durante a
 * aula. A tela precisa devolver a pessoa ao jogo em um toque, não explicar HTTP.
 */
export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center gap-6 px-6 py-16">
      <div className="filete-grosso flex flex-col gap-2 pt-3">
        <Chapeu>Safra DF</Chapeu>
        <h1 className="manchete-md text-tinta-900">Esta página não existe</h1>
        <p className="text-sm text-tinta-500">
          O endereço pode ter sido digitado com um caractere trocado. Volte ao início e entre na
          partida com o código projetado na tela.
        </p>
      </div>

      <Filete espessura="fino" />

      <div className="flex flex-wrap gap-3">
        <Link
          href="/entrar"
          className="inline-flex min-h-11 items-center rounded-bloco border border-tinta-900 bg-tinta-900 px-4 text-sm font-semibold text-papel-50 transition-colors duration-150 hover:bg-manchete-escura hover:border-manchete-escura"
        >
          Entrar na partida
        </Link>
        <Link
          href="/"
          className="inline-flex min-h-11 items-center rounded-bloco border border-tinta-700 bg-papel-50 px-4 text-sm font-semibold text-tinta-900 transition-colors duration-150 hover:border-tinta-900 hover:bg-papel-200"
        >
          Voltar ao início
        </Link>
      </div>
    </main>
  );
}
