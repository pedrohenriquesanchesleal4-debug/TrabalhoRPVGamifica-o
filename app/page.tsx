import Link from 'next/link';
import { ArrowRight, GraduationCap, Sprout } from 'lucide-react';
import { Rotulo } from '@/components/ui/primitives';

/**
 * Capa do jogo.
 *
 * Não é landing page de marketing: são duas portas claras, "sou aluno" ou
 * "sou professor", com o mínimo de leitura entre o clique e o jogo. Sem
 * mirante aqui: a hierarquia da tela já é resolvida pelo tamanho relativo das
 * duas portas, não por uma terceira altitude.
 */

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-lg flex-col justify-center gap-8 px-5 py-12 sm:px-6">
      <div className="flex flex-col gap-3">
        <Rotulo>Atividade diagnóstica · 15 a 20 minutos</Rotulo>
        <h1 className="relevo-lg text-terra-900">Safra DF</h1>
        <p className="text-base leading-relaxed text-terra-700">
          Cada equipe assume uma propriedade rural do Distrito Federal e administra um orçamento
          limitado ao longo de cinco rodadas. Ninguém enxerga o jogo inteiro sozinho: a decisão só
          fecha quando o grupo conversa em voz alta.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        <Link
          href="/entrar"
          className="degrau banco pisavel terr-fundo-verde flex min-h-16 items-center justify-center gap-2 px-6 text-lg font-bold text-white"
        >
          <Sprout size={20} aria-hidden="true" />
          Entrar na partida
          <ArrowRight size={20} aria-hidden="true" />
        </Link>

        <Link
          href="/admin"
          className="degrau banco pisavel terr-claro flex min-h-14 items-center justify-center gap-2 px-6 text-base font-bold text-terra-900"
        >
          <GraduationCap size={18} aria-hidden="true" />
          Sou professor: criar partida
        </Link>
      </div>

      <p className="text-xs text-terra-500">
        Valores e propriedades são fictícios, inspirados em núcleos rurais reais do Distrito
        Federal. As decisões alimentam o debate em sala depois, não uma nota.
      </p>
    </main>
  );
}
