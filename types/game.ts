/**
 * Domínio do SAFRA DF.
 *
 * Contrato único entre engine (regras puras), banco (Supabase) e UI.
 * A engine nunca importa React, Supabase ou I/O: recebe estado e devolve estado.
 */

// ---------------------------------------------------------------------------
// Papéis e identidade
// ---------------------------------------------------------------------------

/** As 5 funções cooperativas dentro de uma equipe. */
export const ROLES = [
  'produtor',
  'financeiro',
  'tecnologia',
  'comercializacao',
  'politicas',
] as const;

export type Role = (typeof ROLES)[number];

export const ROLE_LABEL: Record<Role, string> = {
  produtor: 'Produtor',
  financeiro: 'Financeiro',
  tecnologia: 'Tecnologia',
  comercializacao: 'Comercialização',
  politicas: 'Políticas Públicas',
};

export const ROLE_MISSION: Record<Role, string> = {
  produtor: 'Você enxerga o impacto na safra e no trabalho da família.',
  financeiro: 'Você enxerga o caixa, o custo real e o que sobra depois.',
  tecnologia: 'Você enxerga o que o equipamento exige para funcionar.',
  comercializacao: 'Você enxerga preço, comprador e risco de mercado.',
  politicas: 'Você enxerga programas públicos e assistência disponível.',
};

/** Ordem de distribuição: times pequenos cobrem o essencial primeiro. */
export const ROLE_ASSIGNMENT_ORDER: Role[] = [
  'produtor',
  'financeiro',
  'tecnologia',
  'comercializacao',
  'politicas',
];

// ---------------------------------------------------------------------------
// Ciclo de vida da partida
// ---------------------------------------------------------------------------

export type GameStatus = 'lobby' | 'running' | 'paused' | 'finished';

/** Estado da rodada corrente dentro de uma partida em andamento. */
export type RoundStatus = 'idle' | 'active' | 'resolved';

export type PlayerState = 'thinking' | 'decided';

/** As 5 fases fixas da partida. O índice da rodada é 1-based. */
export const ROUND_PHASES = [
  'preparacao',
  'producao',
  'mercado',
  'desafio',
  'colheita',
] as const;

export type RoundPhase = (typeof ROUND_PHASES)[number];

export const ROUND_META: Record<
  RoundPhase,
  { index: number; title: string; subtitle: string }
> = {
  preparacao: {
    index: 1,
    title: 'Preparação',
    subtitle: 'O que a propriedade precisa antes de plantar',
  },
  producao: {
    index: 2,
    title: 'Produção',
    subtitle: 'A safra em pé e os custos que aparecem',
  },
  mercado: {
    index: 3,
    title: 'Mercado',
    subtitle: 'Para quem vender e a que preço',
  },
  desafio: {
    index: 4,
    title: 'Desafio',
    subtitle: 'O imprevisto que testa o caixa',
  },
  colheita: {
    index: 5,
    title: 'Colheita',
    subtitle: 'Fechar a safra e decidir o próximo ciclo',
  },
};

export const TOTAL_ROUNDS = ROUND_PHASES.length;

/** Fase da rodada a partir do índice 1-based. */
export function phaseForRound(index: number): RoundPhase {
  return ROUND_PHASES[Math.min(Math.max(index, 1), TOTAL_ROUNDS) - 1];
}

// ---------------------------------------------------------------------------
// Indicadores
// ---------------------------------------------------------------------------

/**
 * Estado material de uma equipe.
 *
 * `cash` é dinheiro em reais (fictício) e pode ficar negativo: dívida é uma
 * consequência legítima do jogo, não um erro de validação.
 * `production`, `technology` e `sustainability` são índices 0..100.
 */
export interface TeamIndicators {
  cash: number;
  production: number;
  technology: number;
  sustainability: number;
}

export type IndicatorKey = keyof TeamIndicators;

export const INDICATOR_LABEL: Record<IndicatorKey, string> = {
  cash: 'Finanças',
  production: 'Produção',
  technology: 'Tecnologia',
  sustainability: 'Sustentabilidade',
};

/**
 * Marcadores acumulados que separam "ter tecnologia" de "conseguir adotar
 * tecnologia": o ponto pedagógico central do jogo.
 */
export interface TeamTraits {
  /** Recebeu capacitação ou assistência técnica: destrava o ganho pleno das tecnologias. */
  trained: boolean;
  /** Pontos de tecnologia comprados e ainda não convertidos em produção por falta de capacitação. */
  idleTech: number;
  /** Parcelas de crédito em aberto: descontadas ao fim de cada rodada. */
  debtInstallments: number;
  /** Valor de cada parcela em aberto. */
  debtPerRound: number;
  /** Está em programa público de compra institucional: escoamento garantido a preço estável. */
  inPublicProgram: boolean;
  /** Vende via cooperativa: menos margem por unidade, menos exposição ao mercado. */
  inCooperative: boolean;
  /** Tem irrigação instalada: reduz perda em estiagem. */
  irrigation: boolean;
  /** Tem armazenamento: reduz perda pós-colheita. */
  storage: boolean;
  /** Rodadas encerradas com caixa negativo. */
  cashCrises: number;
  /** Oportunidades aceitas ao longo da partida (para o prêmio de aproveitamento). */
  opportunitiesTaken: number;
}

export const INITIAL_TRAITS: TeamTraits = {
  trained: false,
  idleTech: 0,
  debtInstallments: 0,
  debtPerRound: 0,
  inPublicProgram: false,
  inCooperative: false,
  irrigation: false,
  storage: false,
  cashCrises: 0,
  opportunitiesTaken: 0,
};

export interface TeamState extends TeamIndicators {
  traits: TeamTraits;
}

// ---------------------------------------------------------------------------
// Conteúdo pedagógico (data/*)
// ---------------------------------------------------------------------------

/**
 * Tags de diagnóstico. Não existe tag "certa": elas descrevem o que a turma
 * fez, para o professor interpretar durante a aula.
 */
export const DECISION_TAGS = [
  'tech_invest',
  'tech_avoid',
  'credit',
  'cash_conservative',
  'public_policy',
  'sustainability',
  'production_first',
  'market_direct',
  'cooperation',
  'training',
  'risk_high',
  'risk_low',
] as const;

export type DecisionTag = (typeof DECISION_TAGS)[number];

export const DECISION_TAG_LABEL: Record<DecisionTag, string> = {
  tech_invest: 'Investiu em tecnologia',
  tech_avoid: 'Evitou tecnologia',
  credit: 'Buscou crédito',
  cash_conservative: 'Preservou caixa',
  public_policy: 'Buscou política pública',
  sustainability: 'Priorizou sustentabilidade',
  production_first: 'Priorizou produção',
  market_direct: 'Vendeu por conta própria',
  cooperation: 'Buscou cooperação',
  training: 'Buscou capacitação',
  risk_high: 'Assumiu risco alto',
  risk_low: 'Escolheu o caminho seguro',
};

/** Tags destacadas no painel de diagnóstico da turma, nesta ordem. */
export const DIAGNOSTIC_TAGS: DecisionTag[] = [
  'tech_invest',
  'credit',
  'public_policy',
  'sustainability',
  'production_first',
  'training',
  'cooperation',
  'cash_conservative',
  'risk_high',
];

/**
 * Efeito declarado de uma opção: reais para `cash`, pontos de índice (0..100)
 * para os demais.
 *
 * `productionIfTrained` representa tecnologia que só entrega produção com
 * capacitação. Sem `trained`, esse ganho vira `idleTech` e fica esperando.
 */
export interface DecisionEffects {
  cash?: number;
  production?: number;
  technology?: number;
  sustainability?: number;
  productionIfTrained?: number;
  traits?: Partial<TeamTraits>;
}

/**
 * Faixa de incerteza aplicada sobre os efeitos.
 *
 * `chance` é a probabilidade do resultado favorável. O sorteio é determinístico
 * (semente derivada de partida + rodada + equipe + opção), então a partida é
 * reproduzível e testável.
 */
export interface DecisionRisk {
  chance: number;
  bonus?: DecisionEffects;
  penalty?: DecisionEffects;
  /** Mostrado apenas DEPOIS da resolução. */
  bonusNote?: string;
  penaltyNote?: string;
}

export interface DecisionOption {
  key: string;
  /** Rótulo curto: "Comprar à vista". */
  label: string;
  /** O que o grupo lê antes de decidir. Nunca revela o resultado. */
  detail: string;
  /** Custo exibido na interface (0 quando não há custo direto). */
  displayCost: number;
  effects: DecisionEffects;
  risk?: DecisionRisk;
  tags: DecisionTag[];
  /** Quando true, a opção exige caixa suficiente e é bloqueada sem ele. */
  requiresCash?: boolean;
  /** Só aparece quando a equipe já possui estes marcadores. */
  requiresTraits?: (keyof TeamTraits)[];
}

/** Informação complementar entregue a UMA função: obriga a equipe a conversar. */
export type RoleHints = Partial<Record<Role, string>>;

export interface GameEventCard {
  key: string;
  phase: RoundPhase;
  /** Manchete curta. */
  title: string;
  /** A situação, em 2 a 4 frases, sem linguagem de prova escolar. */
  narrative: string;
  options: DecisionOption[];
  roleHints: RoleHints;
  /** Gancho que o professor usa no debriefing. */
  debriefPrompt: string;
}

export interface Technology {
  key: string;
  name: string;
  cost: number;
  /** O que promete. */
  benefit: string;
  /** O que precisa existir para funcionar de verdade. */
  requirement: string;
  risk: string;
}

export interface PublicPolicy {
  key: string;
  name: string;
  acronym: string;
  scope: string;
  /** Descrição institucional. Nenhum valor ou regra numérica é afirmado aqui. */
  description: string;
  /** O que o jogo simula, com valores fictícios e declarados como tal. */
  simulatedIn: string;
}

/**
 * Atributo de destaque visual da propriedade: qual dos 4 indicadores essa
 * propriedade "veste" como identidade própria (mapa do DF, faixa de
 * propriedades e selo na cena). É conteúdo, não lógica: reaproveita a cor e o
 * ícone que o indicador já tem em `components/ui/gauges.tsx`, então não
 * introduz nenhuma cor nova fora da paleta fechada do contrato visual.
 */
export interface PropertyHighlight {
  indicator: IndicatorKey;
  /** Rótulo curto da identidade, ex: "Recursos hídricos" (nem sempre igual ao nome do indicador). */
  label: string;
}

export interface PropertyProfile {
  key: string;
  name: string;
  region: string;
  /** Uma linha de identidade. */
  tagline: string;
  focus: string;
  /** Vantagem inicial concreta. */
  strength: string;
  /** Dificuldade inicial concreta. */
  weakness: string;
  /** Ajuste aplicado sobre o estado inicial padrão. */
  modifiers: Partial<TeamIndicators> & { traits?: Partial<TeamTraits> };
  /** Identidade visual: qual indicador esta propriedade projeta como marca própria. */
  highlight: PropertyHighlight;
}

// ---------------------------------------------------------------------------
// Configuração da partida
// ---------------------------------------------------------------------------

export interface ScoreWeights {
  finances: number;
  production: number;
  technology: number;
  sustainability: number;
}

export interface GameConfig {
  initialBudget: number;
  roundSeconds: number;
  teamCount: number;
  maxPlayersPerTeam: number;
  weights: ScoreWeights;
}

export const DEFAULT_CONFIG: GameConfig = {
  initialBudget: 80_000,
  roundSeconds: 180,
  teamCount: 6,
  maxPlayersPerTeam: 6,
  weights: { finances: 25, production: 25, technology: 20, sustainability: 30 },
};

// ---------------------------------------------------------------------------
// Resultado e diagnóstico
// ---------------------------------------------------------------------------

export interface ResolvedEffect {
  indicator: IndicatorKey;
  delta: number;
}

export interface DecisionResolution {
  optionKey: string;
  effects: ResolvedEffect[];
  next: TeamState;
  /** O que a equipe lê como consequência. */
  outcome: string;
  /** Notas extra: dívida cobrada, tecnologia parada, capacitação destravada. */
  notes: string[];
  /** true = sorte favorável, false = desfavorável, null = opção sem risco. */
  riskHit: boolean | null;
}

export const TEAM_PROFILES = [
  'sustentavel',
  'inovacao_agressiva',
  'conservacao_caixa',
  'equilibrada',
  'produtiva',
  'articulada',
] as const;

export type TeamProfile = (typeof TEAM_PROFILES)[number];

export const PROFILE_META: Record<
  TeamProfile,
  { label: string; description: string }
> = {
  sustentavel: {
    label: 'Estratégia Sustentável',
    description: 'Preservou solo, água e vegetação mesmo quando custou caixa.',
  },
  inovacao_agressiva: {
    label: 'Inovação Agressiva',
    description: 'Apostou alto em tecnologia e conviveu com o aperto financeiro.',
  },
  conservacao_caixa: {
    label: 'Conservação de Caixa',
    description: 'Evitou compromissos e chegou ao fim com dinheiro no bolso.',
  },
  equilibrada: {
    label: 'Estratégia Equilibrada',
    description: 'Distribuiu o orçamento sem deixar nenhum indicador desabar.',
  },
  produtiva: {
    label: 'Foco em Produção',
    description: 'Colocou a energia toda na safra e no volume colhido.',
  },
  articulada: {
    label: 'Articulação Institucional',
    description: 'Usou programas públicos e cooperação como base do negócio.',
  },
};

export const AWARDS = [
  'best_finance',
  'best_production',
  'best_technology',
  'best_sustainability',
  'most_balanced',
  'best_recovery',
  'best_opportunist',
] as const;

export type Award = (typeof AWARDS)[number];

export const AWARD_META: Record<Award, { label: string; description: string }> = {
  best_finance: {
    label: 'Melhor desempenho financeiro',
    description: 'Terminou com o caixa mais saudável da turma.',
  },
  best_production: {
    label: 'Maior produção',
    description: 'Colheu o maior volume da turma.',
  },
  best_technology: {
    label: 'Maior evolução tecnológica',
    description: 'Avançou mais em tecnologia efetivamente adotada.',
  },
  best_sustainability: {
    label: 'Maior sustentabilidade',
    description: 'Cuidou melhor do solo, da água e da vegetação.',
  },
  most_balanced: {
    label: 'Estratégia mais equilibrada',
    description: 'Menor distância entre os quatro indicadores.',
  },
  best_recovery: {
    label: 'Maior capacidade de recuperação',
    description: 'Passou por crise de caixa e se reergueu.',
  },
  best_opportunist: {
    label: 'Melhor aproveitamento de oportunidades',
    description: 'Converteu mais oportunidades em resultado concreto.',
  },
};

export interface TeamScore {
  teamId: string;
  finances: number;
  production: number;
  technology: number;
  sustainability: number;
  composite: number;
  profile: TeamProfile;
  awards: Award[];
  rank: number;
}

/** Contagem agregada de tags para o painel de diagnóstico da turma. */
export interface DiagnosticEntry {
  tag: DecisionTag;
  label: string;
  /** Quantas equipes tomaram ao menos uma decisão com esta tag. */
  teams: number;
  totalTeams: number;
  /** Total de decisões com esta tag na partida. */
  decisions: number;
}

// ---------------------------------------------------------------------------
// Barramento de eventos realtime
// ---------------------------------------------------------------------------

export const REALTIME_EVENTS = [
  'PLAYER_JOINED',
  'PLAYER_LEFT',
  'TEAM_READY',
  'ROUND_STARTED',
  'DECISION_SUBMITTED',
  'DECISION_LOCKED',
  'EVENT_RESOLVED',
  'ROUND_ENDED',
  'GAME_PAUSED',
  'GAME_RESUMED',
  'GAME_FINISHED',
  'GAME_RESET',
] as const;

export type RealtimeEventType = (typeof REALTIME_EVENTS)[number];

export interface RealtimeEvent<P = Record<string, unknown>> {
  id: number;
  gameId: string;
  type: RealtimeEventType;
  payload: P;
  createdAt: string;
}
