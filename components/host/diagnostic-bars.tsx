import type { DiagnosticEntry } from '@/types/game';

/** Quantos quadrinhos a régua de diagnóstico tem. */
const TOTAL_BLOCOS = 10;

/**
 * O levantamento da turma, anotado como contagem de campo.
 *
 * Cada linha responde a uma pergunta objetiva ("quantas equipes fizeram X"),
 * nunca a um julgamento. A régua é feita de quadrinhos preenchidos, do mesmo
 * jeito que se conta no papel: quem está a seis metros lê a quantidade de
 * blocos, quem usa leitor de tela lê o `aria-label`, e o número por extenso
 * está sempre escrito ao lado. Nenhum canal sozinho carrega a informação.
 */
export function DiagnosticBars({ entries }: { entries: DiagnosticEntry[] }) {
  if (entries.length === 0) {
    return (
      <p className="font-caderno text-sm text-tinta-500">
        Ainda não há decisões suficientes para compor o diagnóstico da turma.
      </p>
    );
  }

  return (
    <ul className="flex flex-col">
      {entries.map((entry) => {
        const ratio = entry.totalTeams > 0 ? entry.teams / entry.totalTeams : 0;
        const percent = Math.round(ratio * 100);
        const cheios = Math.round(ratio * TOTAL_BLOCOS);
        // Em "1 de 6 equipes" o substantivo concorda com o TOTAL, não com a
        // contagem: "1 de 6 equipe" está errado e fica projetado na parede.
        const substantivo = entry.totalTeams === 1 ? 'equipe' : 'equipes';

        return (
          <li
            key={entry.tag}
            className="flex flex-col gap-2 border-t border-dashed border-papel-300 py-4 first:border-t-0 first:pt-0"
          >
            <div className="flex flex-wrap items-baseline justify-between gap-x-3">
              <span className="font-maquina text-lg font-bold uppercase text-tinta-900">
                {entry.label}
              </span>
              <span className="pontilhado hidden sm:block" aria-hidden="true" />
              <span className="tabular shrink-0 text-lg font-bold text-tinta-900">
                {entry.teams} de {entry.totalTeams} {substantivo}
              </span>
            </div>

            <div
              className="flex gap-1"
              role="meter"
              aria-valuenow={percent}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`${entry.label}: ${entry.teams} de ${entry.totalTeams} ${substantivo}`}
            >
              {Array.from({ length: TOTAL_BLOCOS }).map((_, index) => (
                <span
                  key={index}
                  className={[
                    'h-5 flex-1 border',
                    index < cheios
                      ? 'border-carimbo-600 bg-carimbo-500'
                      : 'border-papel-300 bg-papel-100',
                  ].join(' ')}
                />
              ))}
            </div>

            <span className="tabular text-xs text-tinta-500">
              {entry.decisions}{' '}
              {entry.decisions === 1 ? 'decisão registrada' : 'decisões registradas'} na partida
              inteira.
            </span>
          </li>
        );
      })}
    </ul>
  );
}
