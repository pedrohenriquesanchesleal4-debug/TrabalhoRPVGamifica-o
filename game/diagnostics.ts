import { POLICY_BY_KEY } from '@/data/policies';
import {
  DECISION_TAG_LABEL,
  DIAGNOSTIC_TAGS,
  type DecisionTag,
  type DiagnosticEntry,
  type PublicPolicy,
} from '@/types/game';

/**
 * Diagnóstico da turma.
 *
 * Esta é a parte que sobrevive à partida: o professor não precisa saber quem
 * ganhou, precisa saber O QUE A TURMA FEZ. Nenhuma função aqui classifica
 * decisão como certa ou errada. Elas contam ocorrências e devolvem números
 * comparáveis ("4 de 6 equipes investiram em tecnologia") para o professor
 * interpretar durante a exposição.
 */

export interface DecisionRecord {
  teamId: string;
  roundIndex: number;
  eventKey: string;
  optionKey: string;
  optionLabel: string;
  tags: DecisionTag[];
}

/**
 * Agrega as decisões da partida por tag.
 *
 * `teams` conta equipes distintas (quantas fizeram isso ao menos uma vez) e
 * `decisions` conta o total de escolhas, porque as duas leituras servem a
 * perguntas diferentes na aula.
 */
export function buildDiagnostics(
  records: DecisionRecord[],
  totalTeams: number,
  tags: DecisionTag[] = DIAGNOSTIC_TAGS,
): DiagnosticEntry[] {
  return tags.map((tag) => {
    const matching = records.filter((record) => record.tags.includes(tag));
    const teams = new Set(matching.map((record) => record.teamId));

    return {
      tag,
      label: DECISION_TAG_LABEL[tag],
      teams: teams.size,
      totalTeams,
      decisions: matching.length,
    };
  });
}

/** Barra de texto para projeção e para exportação em texto puro. */
export function diagnosticBar(entry: DiagnosticEntry, width = 10): string {
  if (entry.totalTeams === 0) return '░'.repeat(width);
  const filled = Math.round((entry.teams / entry.totalTeams) * width);
  return '█'.repeat(filled) + '░'.repeat(Math.max(0, width - filled));
}

/**
 * Concordância de "equipe".
 *
 * Existe porque a frase erra fácil: em "1 de 6 equipes" o substantivo concorda
 * com o TOTAL, não com a contagem, e em "1 equipe investiu" concorda com a
 * contagem. Errar isso aparece projetado na parede na frente da turma.
 */
function equipes(quantidade: number): string {
  return quantidade === 1 ? '1 equipe' : `${quantidade} equipes`;
}

/** Frase pronta do tipo "4 de 6 equipes: investiu em tecnologia". */
export function diagnosticSentence(entry: DiagnosticEntry): string {
  const substantivo = entry.totalTeams === 1 ? 'equipe' : 'equipes';
  return `${entry.teams} de ${entry.totalTeams} ${substantivo}: ${entry.label.toLowerCase()}`;
}

export interface TeamDecisionSummary {
  teamId: string;
  decisions: DecisionRecord[];
  tagCounts: Partial<Record<DecisionTag, number>>;
}

/** Histórico por equipe, para a coluna de cada grupo no painel do professor. */
export function summarizeByTeam(records: DecisionRecord[]): TeamDecisionSummary[] {
  const byTeam = new Map<string, DecisionRecord[]>();

  for (const record of records) {
    const list = byTeam.get(record.teamId) ?? [];
    list.push(record);
    byTeam.set(record.teamId, list);
  }

  return [...byTeam.entries()].map(([teamId, decisions]) => {
    const tagCounts: Partial<Record<DecisionTag, number>> = {};
    for (const decision of decisions) {
      for (const tag of decision.tags) {
        tagCounts[tag] = (tagCounts[tag] ?? 0) + 1;
      }
    }

    return {
      teamId,
      decisions: decisions.slice().sort((a, b) => a.roundIndex - b.roundIndex),
      tagCounts,
    };
  });
}

/**
 * Contrastes que rendem pergunta na aula.
 *
 * Em vez de entregar conclusão, entrega o par de fatos que gera a pergunta:
 * quem comprou tecnologia sem capacitar, quem ficou fora de programa público,
 * quem terminou endividado. O professor faz o resto.
 */
export function buildTeachingHooks(
  records: DecisionRecord[],
  totalTeams: number,
): string[] {
  const hooks: string[] = [];
  const diagnostics = buildDiagnostics(records, totalTeams);
  const byTag = new Map(diagnostics.map((entry) => [entry.tag, entry]));

  /*
   * Cada gancho só entra quando os números dele fazem sentido.
   *
   * Um painel projetado dizendo "produção veio na frente em 0 equipes e
   * sustentabilidade em 0" não é pergunta nenhuma: é ruído que o professor
   * precisa explicar. Sem dado, sem gancho.
   */
  const tech = byTag.get('tech_invest');
  const training = byTag.get('training');
  if (tech && training && tech.teams > 0 && tech.teams > training.teams) {
    const investiu = tech.teams === 1 ? 'investiu' : 'investiram';
    const capacitacao =
      training.teams === 0
        ? 'nenhuma buscou capacitação'
        : `só ${equipes(training.teams)} ${training.teams === 1 ? 'buscou' : 'buscaram'} capacitação`;

    hooks.push(
      `${equipes(tech.teams)} ${investiu} em tecnologia, mas ${capacitacao}. Pergunte ao grupo o que aconteceu com o equipamento que ficou parado.`,
    );
  }

  const policy = byTag.get('public_policy');
  if (policy && policy.teams < totalTeams) {
    const fora = totalTeams - policy.teams;
    hooks.push(
      `${equipes(fora)} não ${fora === 1 ? 'buscou' : 'buscaram'} programa público em nenhuma rodada. Pergunte por quê: falta de informação, desconfiança ou pressa?`,
    );
  }

  const credit = byTag.get('credit');
  if (credit && credit.teams > 0) {
    hooks.push(
      `${equipes(credit.teams)} ${credit.teams === 1 ? 'recorreu' : 'recorreram'} a crédito. Pergunte como a parcela apareceu nas rodadas seguintes e o que isso mudou nas escolhas.`,
    );
  }

  const sustainability = byTag.get('sustainability');
  const production = byTag.get('production_first');
  if (sustainability && production && sustainability.teams + production.teams > 0) {
    hooks.push(
      `Produção veio na frente em ${equipes(production.teams)} e sustentabilidade em ${equipes(sustainability.teams)}. Pergunte se as duas coisas estavam realmente em conflito ou se pareciam estar.`,
    );
  }

  return hooks;
}

// ---------------------------------------------------------------------------
// Ponte para política pública/assistência real, sem veredito
// ---------------------------------------------------------------------------

export interface PolicyConnection {
  /** Tag de decisão que disparou esta conexão. */
  tag: DecisionTag;
  policy: PublicPolicy;
  /**
   * Frase neutra e informativa: o que existe de verdade e para que serve.
   * NUNCA avaliativa ("vocês deveriam ter feito isso"): o jogo é diagnóstico,
   * não avaliação, e essa regra vale também para o texto gerado aqui.
   */
  note: string;
}

/**
 * Conecta o comportamento agregado da turma à política pública/assistência
 * real correspondente, sem dizer se a equipe acertou ou errou.
 *
 * Reaproveita os mesmos contrastes de `buildTeachingHooks` (mesmo critério de
 * "sem dado, sem gancho"), só que em vez de uma pergunta para o debate, entrega
 * o programa real que se conecta ao comportamento observado. O professor
 * decide como usar isso na exposição; a frase aqui nunca resolve a pergunta.
 */
export function buildPolicyConnections(
  records: DecisionRecord[],
  totalTeams: number,
): PolicyConnection[] {
  const connections: PolicyConnection[] = [];
  const diagnostics = buildDiagnostics(records, totalTeams);
  const byTag = new Map(diagnostics.map((entry) => [entry.tag, entry]));

  const tech = byTag.get('tech_invest');
  const training = byTag.get('training');
  const emater = POLICY_BY_KEY['emater-df'];
  if (tech && training && emater && tech.teams > 0 && tech.teams > training.teams) {
    connections.push({
      tag: 'tech_invest',
      policy: emater,
      note: 'Na vida real, é isso que a Emater-DF oferece: assistência técnica e extensão rural pra destravar o que a equipe comprou, não a tecnologia em si.',
    });
  }

  const policyTag = byTag.get('public_policy');
  const paa = POLICY_BY_KEY['paa'];
  if (policyTag && paa && policyTag.teams < totalTeams) {
    connections.push({
      tag: 'public_policy',
      policy: paa,
      note: 'Quem não buscou programa público deixou de considerar isto: PAA, PNAE e PAPA-DF existem justamente pra dar escoamento garantido à produção da agricultura familiar.',
    });
  }

  const credit = byTag.get('credit');
  const creditoRural = POLICY_BY_KEY['credito-rural'];
  if (credit && creditoRural && credit.teams > 0) {
    connections.push({
      tag: 'credit',
      policy: creditoRural,
      note: 'A parcela que apareceu nas rodadas seguintes representa isto: linhas de crédito rural têm prazo, taxa e regra própria, que vale estudar antes de contratar.',
    });
  }

  const sustainability = byTag.get('sustainability');
  const production = byTag.get('production_first');
  const cooperativa = POLICY_BY_KEY['cooperativismo'];
  if (
    sustainability &&
    production &&
    cooperativa &&
    sustainability.teams + production.teams > 0
  ) {
    connections.push({
      tag: 'sustainability',
      policy: cooperativa,
      note: 'É pra essa tensão que a organização coletiva existe: cooperativas e associações reduzem o risco de mercado individual entre priorizar produção e priorizar sustentabilidade.',
    });
  }

  return connections;
}
