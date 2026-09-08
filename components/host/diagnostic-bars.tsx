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
      <p className="text-sm text-mata-600">
        Ainda não há decisões suficientes para compor o diagnóstico da turma.
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-5">
      {entries.map((entry) => {
        const ratio = entry.totalTeams > 0 ? entry.teams / entry.totalTeams : 0;
        const percent = Math.round(ratio * 100);
        const verb = entry.teams === 1 ? 'equipe' : 'equipes';

        return (
          <li key={entry.tag} className="flex flex-col gap-2">
            <div className="flex items-baseline justify-between gap-4">
              <span className="text-lg text-mata-900">{entry.label}</span>
              <span className="tabular text-lg font-semibold text-mata-900">
                {entry.teams} de {entry.totalTeams} {verb}
              </span>
            </div>

            <div
              className="h-4 w-full overflow-hidden rounded-pill bg-areia-200"
              role="meter"
              aria-valuenow={percent}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`${entry.label}: ${entry.teams} de ${entry.totalTeams} ${verb}`}
            >
              <div
                className="h-full rounded-pill bg-terra-500 transition-[width] duration-700"
                style={{ width: `${percent}%` }}
              />
            </div>

            <span className="tabular text-xs text-mata-600">
              {entry.decisions} {entry.decisions === 1 ? 'decisão registrada' : 'decisões registradas'} na partida inteira.
            </span>
          </li>
        );
      })}
    </ul>
  );
}
