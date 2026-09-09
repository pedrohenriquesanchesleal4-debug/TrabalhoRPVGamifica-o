import type { DiagnosticEntry } from '@/types/game';

/**
 * Barras de diagnóstico agregadas, para projeção.
 *
 * Cada linha responde a uma pergunta objetiva ("quantas equipes fizeram X"),
 * nunca a um julgamento. A barra é HTML/CSS puro: comprimento e número contam
 * a mesma história de dois jeitos, o que ajuda quem está a 6 metros de
 * distância e quem depende de leitor de tela.
 */
export function DiagnosticBars({ entries }: { entries: DiagnosticEntry[] }) {
  if (entries.length === 0) {
    return (
      <p className="text-sm text-tinta-500">
        Ainda não há decisões suficientes para compor o diagnóstico da turma.
      </p>
    );
  }

  return (
    <ul className="flex flex-col">
      {entries.map((entry) => {
        const ratio = entry.totalTeams > 0 ? entry.teams / entry.totalTeams : 0;
        const percent = Math.round(ratio * 100);
        // Em "1 de 6 equipes" o substantivo concorda com o TOTAL, não com a
        // contagem: "1 de 6 equipe" está errado e fica projetado na parede.
        const substantivo = entry.totalTeams === 1 ? 'equipe' : 'equipes';

        return (
          <li key={entry.tag} className="filete-fino flex flex-col gap-2 py-4 first:border-t-0 first:pt-0">
            <div className="flex items-baseline justify-between gap-4">
              <span className="manchete-sm text-tinta-900">{entry.label}</span>
              <span className="dado-lg text-tinta-900">
                {entry.teams} de {entry.totalTeams} {substantivo}
              </span>
            </div>

            <div
              className="h-3 w-full overflow-hidden bg-papel-200"
              role="meter"
              aria-valuenow={percent}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`${entry.label}: ${entry.teams} de ${entry.totalTeams} ${substantivo}`}
            >
              <div
                className="h-full bg-manchete transition-[width] duration-700"
                style={{ width: `${percent}%` }}
              />
            </div>

            <span className="dado text-xs text-tinta-500">
              {entry.decisions} {entry.decisions === 1 ? 'decisão registrada' : 'decisões registradas'} na partida inteira.
            </span>
          </li>
        );
      })}
    </ul>
  );
}
