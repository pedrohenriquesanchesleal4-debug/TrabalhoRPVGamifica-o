'use client';

import { useEffect, useSyncExternalStore } from 'react';
import { Moon, Sun } from 'lucide-react';

type Tema = 'escuro' | 'claro';

const CHAVE = 'safra-tema';

/*
  Alternador de tema SAFRA DF.
  ---------------------------------------------------------------------
  Store externa mínima + `useSyncExternalStore`:
  · getSnapshot devolve sempre a mesma string (temaAtual), então não há
    loop de render (exigência do uSES);
  · nenhum setState dentro de effect — o lint do React Compiler
    (`react-hooks/set-state-in-effect`) fica quieto;
  · a persistência/pré-paint vive no script inline do layout (anti-FOUC);
    este componente SÓ aplica o valor salvo depois da montagem, então a
    hidratação casa com o HTML servido (default escuro).

  O tema claro troca superfícies e tintas, nunca a paisagem (`--cor-cena-*`)
  nem os consoles escuros (`terr-fundo-*`): são âncoras noturnas dos dois
  temas.
*/

let temaAtual: Tema = 'escuro';
const ouvintes = new Set<() => void>();

function notificar(): void {
  ouvintes.forEach((ouvinte) => ouvinte());
}

function lerStorage(): Tema {
  if (typeof window === 'undefined') return 'escuro';
  try {
    return localStorage.getItem(CHAVE) === 'claro' ? 'claro' : 'escuro';
  } catch {
    // Storage bloqueado (modo privado restrito): segue em memória, sem quebrar.
    return 'escuro';
  }
}

function aplicarTema(proximo: Tema): void {
  temaAtual = proximo;
  try {
    localStorage.setItem(CHAVE, proximo);
  } catch {
    // Idem: sem storage, o tema vale para esta sessão.
  }
  document.documentElement.setAttribute('data-tema', proximo);
  notificar();
}

function comparar(): Tema {
  return temaAtual;
}

function assinar(ouvinte: () => void): () => void {
  ouvintes.add(ouvinte);
  return () => {
    ouvintes.delete(ouvinte);
  };
}

export function ThemeToggle({ className }: { className?: string }) {
  const tema = useSyncExternalStore(assinar, comparar, () => 'escuro' as Tema);

  // Aplica o valor salvo uma única vez após a montagem: hidratação estável
  // (default escuro no servidor) e tema do aparelho no primeiro paint real.
  useEffect(() => {
    if (lerStorage() !== temaAtual) {
      aplicarTema(lerStorage());
    }
  }, []);

  const claro = tema === 'claro';

  return (
    <button
      type="button"
      aria-label={claro ? 'Usar tema escuro' : 'Usar tema claro'}
      aria-pressed={claro}
      title={claro ? 'Tema claro — clique para o escuro' : 'Tema escuro — clique para o claro'}
      onClick={() => aplicarTema(claro ? 'escuro' : 'claro')}
      className={[
        'degrau banco pisavel border border-terra-500/30 bg-[#0d0f0b]/60 text-(--cor-tinta-panel) inline-flex h-11 w-11 shrink-0 items-center justify-center',
        className ?? '',
      ].join(' ')}
    >
      {claro ? (
        <Sun size={18} strokeWidth={2.2} aria-hidden="true" />
      ) : (
        <Moon size={18} strokeWidth={2.2} aria-hidden="true" />
      )}
    </button>
  );
}