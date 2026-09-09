import Link from 'next/link';
import { ArrowRight, GraduationCap, Sprout } from 'lucide-react';
import { Chapeu, Filete } from '@/components/ui/primitives';

/**
 * Capa do boletim.
 *
 * Não é landing page de marketing: são duas portas claras, "sou aluno" ou
 * "sou professor", com o mínimo de leitura entre o clique e o jogo.
 */

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-lg flex-col justify-center gap-8 px-5 py-12 sm:px-6">
      <div className="filete-grosso flex flex-col gap-3 pt-3">
        <Chapeu>Atividade diagnóstica · 15 a 20 minutos</Chapeu>
        <h1 className="manchete-xl text-tinta-900">Safra DF</h1>
        <p className="olho">
          Cada equipe assume uma propriedade rural do Distrito Federal e administra um orçamento
          limitado ao longo de cinco rodadas. Ninguém enxerga o jogo inteiro sozinho: a decisão só
          fecha quando o grupo conversa em voz alta.
        </p>
      </div>

      <div className="flex flex-col gap-4">
        <Link
          href="/entrar"
          className="flex min-h-16 items-center justify-center gap-2 rounded-bloco border border-tinta-900 bg-tinta-900 px-6 text-lg font-semibold tracking-wide text-papel-50 transition-colors duration-150 hover:bg-manchete-escura hover:border-manchete-escura"
        >
          <Sprout size={20} aria-hidden="true" />
          Entrar na partida
          <ArrowRight size={20} aria-hidden="true" />
        </Link>

        <Link
          href="/admin"
          className="flex min-h-14 items-center justify-center gap-2 rounded-bloco border border-tinta-700 bg-papel-50 px-6 text-base font-semibold text-tinta-900 transition-colors duration-150 hover:border-tinta-900 hover:bg-papel-200"
        >
          <GraduationCap size={18} aria-hidden="true" />
          Sou professor: criar partida
        </Link>
      </div>

      <Filete espessura="fino" />

      <p className="text-xs text-tinta-500">
        Valores e propriedades são fictícios, inspirados em núcleos rurais reais do Distrito
        Federal. As decisões alimentam o debate em sala depois, não uma nota.
      </p>
    </main>
  );
}
