/**
 * Oficina Safra DF · contrato de domínio (modo colaborativo narrativo).
 *
 * Todo conteúdo, engine e serviço do novo modo conversa por estes tipos.
 * Nenhum deles tem direção visual: dados e regras vivem fora da UI, e a UI
 * nunca modifica estado (mesmo modelo de segurança do Diagnóstico: o
 * navegador só envia intenção, o servidor calcula tudo).
 */

// ---------------------------------------------------------------------------
// Modo e partida
// ---------------------------------------------------------------------------

export type GameMode = 'diagnostico' | 'oficina';

export type OficinaStatus = 'aguardando' | 'ativa' | 'pausada';

/** Estágios da oficina, na ordem. O professor controla o ritmo. */
export type OficinaStage =
  | 'briefing'
  | 'investigacao'
  | 'eventos'
  | 'solucao'
  | 'resultado'
  | 'encerrada';

export const OFICINA_STAGES_ORDEM: OficinaStage[] = [
  'briefing',
  'investigacao',
  'eventos',
  'solucao',
  'resultado',
  'encerrada',
];

// ---------------------------------------------------------------------------
// Perfis (perspectivas de equipe — não limitam, apenas orientam)
// ---------------------------------------------------------------------------

export type OficinaPerfil =
  | 'produtores'
  | 'cooperativa'
  | 'comercializacao'
  | 'logistica'
  | 'juventude_tech'
  | 'articulacao';

export const OFICINA_PERFIS_INFO: Record<
  OficinaPerfil,
  { rotulo: string; icone: string; pitch: string }
> = {
  produtores: {
    rotulo: 'Produtores',
    icone: 'Sprout',
    pitch: 'Quem planta e colhe: prioriza produção, custo e renda no campo.',
  },
  cooperativa: {
    rotulo: 'Cooperativa',
    icone: 'Users',
    pitch: 'Quem organiza: prioriza união, regras comuns e escala.',
  },
  comercializacao: {
    rotulo: 'Comercialização',
    icone: 'ShoppingBag',
    pitch: 'Quem vende: prioriza mercado, qualidade e regularidade.',
  },
  logistica: {
    rotulo: 'Logística',
    icone: 'Truck',
    pitch: 'Quem transporta: prioriza estrada, horários e perdas.',
  },
  juventude_tech: {
    rotulo: 'Juventude e tecnologia',
    icone: 'Cpu',
    pitch: 'Quem conecta: prioriza ferramentas digitais e capacitação.',
  },
  articulacao: {
    rotulo: 'Articulação comunitária',
    icone: 'Handshake',
    pitch: 'Quem costura: prioriza parcerias, escola e políticas públicas.',
  },
};

// ---------------------------------------------------------------------------
// Indicadores narrativos (0–100, determinísticos no servidor)
// ---------------------------------------------------------------------------

export type OficinaIndicador =
  | 'cooperacao'
  | 'organizacao'
  | 'mercado'
  | 'conhecimento'
  | 'sustentabilidade'
  | 'confianca'
  | 'inclusao'
  | 'viabilidade';

export const OFICINA_INDICADORES_INFO: Record<
  OficinaIndicador,
  { rotulo: string; icone: string; descricao: string }
> = {
  cooperacao: { rotulo: 'Cooperação', icone: 'HeartHandshake', descricao: 'Equipes e comunidade agindo juntas.' },
  organizacao: { rotulo: 'Organização', icone: 'ListChecks', descricao: 'Regras, prazos e divisão de tarefas.' },
  mercado: { rotulo: 'Acesso ao mercado', icone: 'Store', descricao: 'Produto chegando a quem compra.' },
  conhecimento: { rotulo: 'Conhecimento', icone: 'GraduationCap', descricao: 'Capacitação e saber técnico circulando.' },
  sustentabilidade: { rotulo: 'Sustentabilidade', icone: 'Leaf', descricao: 'Solo, água e recursos preservados.' },
  confianca: { rotulo: 'Confiança comunitária', icone: 'ShieldCheck', descricao: 'Compromissos honrados entre todos.' },
  inclusao: { rotulo: 'Inclusão', icone: 'Accessibility', descricao: 'Ninguém importante ficou de fora.' },
  viabilidade: { rotulo: 'Viabilidade', icone: 'Compass', descricao: 'A solução se sustenta sozinha.' },
};

export type OficinaIndicadores = Record<OficinaIndicador, number>;

export function criarOficinaIndicadores(): OficinaIndicadores {
  return {
    cooperacao: 50,
    organizacao: 50,
    mercado: 50,
    conhecimento: 50,
    sustentabilidade: 50,
    confianca: 50,
    inclusao: 50,
    viabilidade: 50,
  };
}

// ---------------------------------------------------------------------------
// Conteúdo narrativo (data/oficina-content.ts preenche estruturas destas)
// ---------------------------------------------------------------------------

export type TagOficina =
  | 'producao'
  | 'mercado'
  | 'logistica'
  | 'tecnologia'
  | 'conectividade'
  | 'organizacao'
  | 'capacitacao'
  | 'politicas'
  | 'sustentabilidade'
  | 'inclusao';

export interface OficinaLocal {
  id: string;
  nome: string;
  tipo: 'producao' | 'organizacao' | 'mercado' | 'servico' | 'infraestrutura';
  situacao: string;
  problema: string;
  personagem_id: string | null;
  pista_id: string | null;
  acao_sugerida: string;
}

export interface OficinaPersonagem {
  id: string;
  nome: string;
  papel: string;
  local_id: string;
  fala: string;
  problema: string;
  pista_id: string | null;
  tags: TagOficina[];
}

export interface OficinaPista {
  id: string;
  titulo: string;
  texto: string;
  origem: string;
  tags: TagOficina[];
  unica: boolean;
  compartilhavel: boolean;
}

export type OficinaAcaoKey =
  | 'investigar'
  | 'conversar'
  | 'compartilhar'
  | 'apoio_tecnico'
  | 'parceria'
  | 'transporte'
  | 'comercializacao'
  | 'capacitacao'
  | 'divulgacao'
  | 'solucao_conjunta';

export const OFICINA_ACAO_KEYS: OficinaAcaoKey[] = [
  'investigar',
  'conversar',
  'compartilhar',
  'apoio_tecnico',
  'parceria',
  'transporte',
  'comercializacao',
  'capacitacao',
  'divulgacao',
  'solucao_conjunta',
];

export interface OficinaAcao {
  key: OficinaAcaoKey;
  nome: string;
  icone: string;
  descricao: string;
  custo_acoes: number;
  /** Ação exige que a equipe já tenha uma pista com pelo menos UMA destas tags. */
  requisito_tags: TagOficina[];
  efeitos: Partial<OficinaIndicadores>;
  tags: TagOficina[];
  /** true = ação de investigação (pode revelar pista do alvo). */
  investiga: boolean;
}

export interface OficinaEventoOpcao {
  key: string;
  rotulo: string;
  detalhe: string;
  efeitos: Partial<OficinaIndicadores>;
  tags: TagOficina[];
}

export interface OficinaEvento {
  key: string;
  titulo: string;
  narrativa: string;
  desfecho: string;
  opcoes: OficinaEventoOpcao[];
  /** Delta aplicado em TODAS as equipes ao resolver (não é seleção). */
  efeito_coletivo: Partial<OficinaIndicadores>;
}

// ---------------------------------------------------------------------------
// Solução (cartões)
// ---------------------------------------------------------------------------

export type OficinaBlocoSolucao =
  | 'problema_principal'
  | 'publico_beneficiado'
  | 'recursos'
  | 'parceiros'
  | 'tecnologia_ferramenta'
  | 'comercializacao'
  | 'transporte'
  | 'capacitacao'
  | 'politica_publica'
  | 'risco_principal'
  | 'impacto_social'
  | 'impacto_ambiental'
  | 'acompanhamento';

export const OFICINA_BLOCOS_INFO: Record<
  OficinaBlocoSolucao,
  { rotulo: string; ajuda: string }
> = {
  problema_principal: { rotulo: 'Problema principal', ajuda: 'O que a comunidade enfrenta de mais urgente.' },
  publico_beneficiado: { rotulo: 'Público beneficiado', ajuda: 'Quem ganha com a solução.' },
  recursos: { rotulo: 'Recursos disponíveis', ajuda: 'O que já existe e pode ser usado.' },
  parceiros: { rotulo: 'Parceiros', ajuda: 'Quem entra junto na solução.' },
  tecnologia_ferramenta: { rotulo: 'Tecnologia ou ferramenta', ajuda: 'Ferramenta certa — pode ser baixa tecnologia.' },
  comercializacao: { rotulo: 'Forma de comercialização', ajuda: 'Como o produto chega ao consumidor.' },
  transporte: { rotulo: 'Estratégia de transporte', ajuda: 'Como a logística deixa de ser gargalo.' },
  capacitacao: { rotulo: 'Ação de capacitação', ajuda: 'Quem aprende o quê, e como o saber circula.' },
  politica_publica: { rotulo: 'Apoio de política pública', ajuda: 'Programa (ex: PAA, PNAE, ATER) que apoia a ideia.' },
  risco_principal: { rotulo: 'Risco principal', ajuda: 'O que pode dar errado — e como o time lida.' },
  impacto_social: { rotulo: 'Impacto social', ajuda: 'Mudança na vida da comunidade.' },
  impacto_ambiental: { rotulo: 'Impacto ambiental', ajuda: 'Efeito no Cerrado, solo e água.' },
  acompanhamento: { rotulo: 'Acompanhamento', ajuda: 'Como medir se deu certo.' },
};

export interface OficinaOpcaoCartao {
  key: string;
  rotulo: string;
  tags: TagOficina[];
}

export interface OficinaCartao {
  bloco: OficinaBlocoSolucao;
  opcoes: OficinaOpcaoCartao[];
  campo_livre: boolean;
}

export interface OficinaSolucao {
  blocos: Partial<Record<OficinaBlocoSolucao, string>>;
  campos_livres: Partial<Record<OficinaBlocoSolucao, string>>;
}

// ---------------------------------------------------------------------------
// Resultados
// ---------------------------------------------------------------------------

export type OficinaCategoriaResultado =
  | 'mais_viability'
  | 'mais_colaborativa'
  | 'mais_inclusiva'
  | 'mais_sustentavel'
  | 'mais_inovadora'
  | 'destaque_comunidade';

export const OFICINA_CATEGORIAS_INFO: Record<
  OficinaCategoriaResultado,
  { rotulo: string; icone: string; explicacao: string }
> = {
  mais_viability: { rotulo: 'Solução mais viável', icone: 'Compass', explicacao: 'Se sustenta sozinha: equilíbrio entre organização, mercado e viabilidade.' },
  mais_colaborativa: { rotulo: 'Solução mais colaborativa', icone: 'HeartHandshake', explicacao: 'A comunidade inteira agiu junta: cooperação e confiança.' },
  mais_inclusiva: { rotulo: 'Solução mais inclusiva', icone: 'Accessibility', explicacao: 'Ninguém ficou de fora: inclusão e confiança.' },
  mais_sustentavel: { rotulo: 'Solução mais sustentável', icone: 'Leaf', explicacao: 'Cuidado com o Cerrado como pilar da proposta.' },
  mais_inovadora: { rotulo: 'Solução mais inovadora', icone: 'Cpu', explicacao: 'Uso inteligente de conhecimento e tecnologia apropriada.' },
  destaque_comunidade: { rotulo: 'Destaque da comunidade', icone: 'Star', explicacao: 'Equilíbrio geral entre todos os indicadores.' },
};

export interface OficinaResultadoCategoria {
  categoria: OficinaCategoriaResultado;
  team_id: string;
  nota: number;
  razao: string;
}

// ---------------------------------------------------------------------------
// Linhas do banco (modo oficina)
// ---------------------------------------------------------------------------

export interface OficinaSessaoRow {
  game_id: string;
  status: OficinaStatus;
  stage: OficinaStage;
  /** Posição dentro do estágio eventos (índice do evento atual). */
  stage_progresso: number;
  evento_atual: string | null;
  sorteio_eventos: string[];
  iniciada_em: string | null;
  finalizada_em: string | null;
}

export interface OficinaEquipeRow {
  team_id: string;
  game_id: string;
  perfil: OficinaPerfil;
  indicadores: OficinaIndicadores;
  /** Ações usadas no estágio atual (limite por estágio). */
  acoes_usadas: number;
  /** Marcadores acumulados: tech_usada, capacitacao_feita, etc. */
  marcadores: string[];
}

export interface OficinaPistaRow {
  id: string;
  game_id: string;
  team_id: string;
  pista_id: string;
  descoberta_em: string;
  compartilhada_em: string | null;
}

export interface OficinaAcaoRow {
  id: string;
  game_id: string;
  team_id: string;
  stage: OficinaStage;
  acao_key: string;
  alvo_id: string | null;
  efeitos: Partial<OficinaIndicadores>;
  criada_em: string;
}

export interface OficinaEventoRow {
  id: string;
  game_id: string;
  event_key: string;
  status: 'aberto' | 'resolvido';
  aberto_em: string;
  resolvido_em: string | null;
  /** team_id → { opcao_key, efeitos } por equipe. */
  contribuicoes: Record<string, { opcao_key: string; efeitos: Partial<OficinaIndicadores> }>;
}

export interface OficinaSolucaoRow {
  team_id: string;
  game_id: string;
  blocos: OficinaSolucao;
  enviada_em: string;
}

export interface OficinaResultadoRow {
  team_id: string;
  game_id: string;
  categorias: OficinaResultadoCategoria[];
  indicadores: OficinaIndicadores;
  criado_em: string;
}

// ---------------------------------------------------------------------------
// Realtime (extensão do barramento existente)
// ---------------------------------------------------------------------------

export type OficinaRealtimeEventType =
  | 'OFICINA_STAGE_CHANGED'
  | 'OFICINA_CLUE_FOUND'
  | 'OFICINA_CLUE_SHARED'
  | 'OFICINA_EVENT_OPENED'
  | 'OFICINA_EVENT_RESOLVED'
  | 'OFICINA_SOLUTION_SUBMITTED'
  | 'OFICINA_FINISHED';

// ---------------------------------------------------------------------------
// IA (cache por partida — 3 slots no máximo: narrativa, reflexão, debate)
// ---------------------------------------------------------------------------

export type OficinaIaTipo = 'narrativa_inicial' | 'reflexao_final' | 'debate';

export interface OficinaIaRow {
  game_id: string;
  tipo: OficinaIaTipo;
  texto: string;
  modelo: string;
  criado_em: string;
}

// ---------------------------------------------------------------------------
// Fallback estático da IA (data/oficina-ia.ts) — jogo roda 100% sem IA
// ---------------------------------------------------------------------------

export interface OficinaIaFallbacks {
  narrativa_inicial: string;
  transicoes: Record<OficinaStage, string>;
  feedback_por_perfil: Record<OficinaPerfil, string>;
  reflexao_perguntas: string[];
  provocacao: string;
}