/**
 * Fallback de navegação (Suspense).
 *
 * Aparece em trocas de rota que demoram — nunca na primeira pintura de uma
 * rota estática. A rede da sala de aula é o cenário: celular com sinal fraco
 * não pode desenhar página em branco enquanto o servidor responde.
 *
 * A estética segue a V6: painel Degrau no meio do breu, rótulo técnico em
 * JetBrains Mono e uma pulsação discreta (só com `motion-safe`).
 */
export default function Loading() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-lg flex-col items-center justify-center gap-6 px-6">
      <div className="degrau terraco terr-neutro flex flex-col items-center gap-5 px-10 py-9">
        <p className="dado text-xs uppercase tracking-[0.22em] text-financas-texto">
          Carregando
        </p>

        <div className="flex items-end gap-1.5" aria-hidden="true">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="block h-4 w-1.5 bg-financas motion-safe:animate-pulse"
              style={{ animationDelay: `${i * 180}ms` }}
            />
          ))}
        </div>

        <p className="rotulo text-terra-500">SAFRA DF · 06:20</p>
      </div>
    </main>
  );
}