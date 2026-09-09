import { Degrau, Rotulo } from '@/components/ui/primitives';
import { CanalTrilha } from '@/components/ui/gauges';
import type { DecisionTag, DiagnosticEntry } from '@/types/game';
import type { IndicatorKind } from '@/components/ui/gauges';

/**
 * Barras de diagnóstico agregadas, para projeção.
 *
 * Cada linha responde a uma pergunta objetiva ("quantas equipes fizeram X"),
 * nunca a um julgamento. Cada métrica é um `banco`, e o canal reaproveitado é
 * o mesmo `CanalTrilha` dos 4 indicadores: comprimento do preenchimento e
 * número impresso contam a mesma história de dois jeitos, o que ajuda quem
 * está a 6 metros de distância e quem depende de leitor de tela.
 */

/**
 * Cada tag de diagnóstico empresta a cor de UM dos quatro indicadores para
 * tingir o canal: não existe família de cor própria para diagnóstico, e
 * inventar uma quinta cor violaria a paleta fechada do contrato. A escolha
 * abaixo segue a natureza de cada tag, não sua tag de origem.
 */
const DIAGNOSTIC_KIND: Record<DecisionTag, IndicatorKind> = {
  tech_invest: 'tecnologia',
  tech_avoid: 'tecnologia',
  credit: 'financas',
  cash_conservative: 'financas',
  public_policy: 'financas',
  sustainability: 'sustentabilidade',
  production_first: 'producao',
  market_direct: 'producao',
  cooperation: 'sustentabilidade',
  training: 'tecnologia',
  risk_high: 'financas',
  risk_low: 'financas',
};

export function DiagnosticBars({ entries }: { entries: DiagnosticEntry[] }) {
  if (entries.length === 0) {
    return (
      <p className="text-sm text-terra-700">
        Ainda não há decisões suficientes para compor o diagnóstico da turma.
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-3">
      {entries.map((entry) => {
        const ratio = entry.totalTeams > 0 ? (entry.teams / entry.totalTeams) * 100 : 0;
        // Em "1 de 6 equipes" o substantivo concorda com o TOTAL, não com a
        // contagem: "1 de 6 equipe" está errado e fica projetado na parede.
        const substantivo = entry.totalTeams === 1 ? 'equipe' : 'equipes';
        const kind = DIAGNOSTIC_KIND[entry.tag];

        return (
          <li key={entry.tag}>
            <Degrau nivel="banco" familia="neutro" className="flex flex-col gap-2.5 p-4">
              <div className="flex items-baseline justify-between gap-4">
                <span className="relevo-sm text-terra-900">{entry.label}</span>
                <span className="dado-lg text-terra-900">
                  {entry.teams} de {entry.totalTeams} {substantivo}
                </span>
              </div>

              <div
                role="meter"
                aria-valuenow={Math.round(ratio)}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`${entry.label}: ${entry.teams} de ${entry.totalTeams} ${substantivo}`}
              >
                <CanalTrilha kind={kind} value={ratio} size="aluno" />
              </div>

              <Rotulo>
                {entry.decisions} {entry.decisions === 1 ? 'decisão registrada' : 'decisões registradas'} na
                partida inteira
              </Rotulo>
            </Degrau>
          </li>
        );
      })}
    </ul>
  );
}
