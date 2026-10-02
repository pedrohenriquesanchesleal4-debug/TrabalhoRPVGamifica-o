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

export type OficinaStatus = 'aguardando' | 'ativa' | 'pausada' | 'encerrada';

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

/**
 * Objetivo de cada estágio, escrito para ser lido em tela.
 *
 * Motivo existencial: sem isso o aluno nunca sabe o que tem que fazer, e o
 * professor só tem o botão "Avançar etapa". O objetivo é o contrato pedagógico
 * do estágio — a UI mostra, o painel do professor conduz por ele.
 */
export interface OficinaStageMeta {
  /** Nome curto da etapa (1 linha). */
  titulo: string;
  /** O que a equipe DEVE fazer aqui, em 1 frase. */
  objetivo: string;
  /** Como o aluno sabe que cumpriu (ou não). `null` = sem meta mensurável. */
  meta: string | null;
  /** Frase que o professor diz para abrir a etapa. */
  abertura: string;
  /** Frase curta que explica o que o professor precisa fazer agora. */
  conducting: string;
}

export const OFICINA_STAGE_META: Record<OficinaStage, OficinaStageMeta> = {
  briefing: {
    titulo: 'Boa Vista do Cerrado',
    objetivo: 'Descobrir quem é essa comunidade e por que ela precisa de vocês.',
    meta: null,
    abertura:
      'Cada equipe representa um setor da Boa Vista do Cerrado. Escute o personagem e descubra o que já existe de bom aqui.',
    conducting: 'Abra a leitura do cenário. Só avance quando todas as equipes estiverem no mapa.',
  },
  investigacao: {
    titulo: 'Investigação',
    objetivo: 'Achar as pistas que travam a comunidade e agir sobre elas.',
    meta: 'Investigue lugares e execute ações para mudar os indicadores da sua equipe.',
    abertura:
      'Cada equipe tem 7 ações. Investigue o que interessa ao seu setor, converse com quem sabe e compartilhe o que descobrir com o resto.',
    conducting:
      'Deixe as equipes jogarem. Só avance quando a maioria já agir (ou as 7 ações acabarem).',
  },
  eventos: {
    titulo: 'Situações coletivas',
    objetivo: 'Responder às situações que a comunidade precisa enfrentar.',
    meta: 'Escolher 1 resposta para cada situação que aparecer na parede.',
    abertura:
      'A Boa Vista passou por uma situação. A parede mostra o evento e cada equipe escolhe como responder.',
    conducting:
      'Abra um evento por vez. Só abra o próximo quando todas as equipes tiverem voted.',
  },
  solucao: {
    titulo: 'Proposta de solução',
    objetivo: 'Montar a solução da sua equipe em 13 cartões.',
    meta: 'Preencher os 13 blocos da solução e enviar.',
    abertura:
      'Agora cada equipe escreve a solução: qual problema ela resolve, com quem, usando o que já existe na comunidade.',
    conducting:
      'Deixe as equipes montarem os 13 cartões. Só avance quando todas enviarem (ou o tempo acabar).',
  },
  resultado: {
    titulo: 'Resultado',
    objetivo: 'Ver o que a oficina construiu e o que cada equipe aprendeu.',
    meta: null,
    abertura:
      'A parede mostra o que cada equipe construiu e qual foi seu destaque. Não há vencedor: há seis soluções para a mesma comunidade.',
    conducting: 'Mostre os destaques e chame cada equipe para contar o que aprendeu.',
  },
  encerrada: {
    titulo: 'Encerramento',
    objetivo: 'Fechar a oficina e levar a conversa para a comunidade real.',
    meta: null,
    abertura:
      'Oficina encerrada. Use o roteiro de debate para conversar com a turma sobre o que dá para fazer no DF.',
    conducting: 'Rode o roteiro de debate. Encerre a sessão quando terminar.',
  },
};

/**
 * Limite de ações por estágio (reinicia a cada estágio, ver `avancarStage`).
 *
 * Fica AQUI e não no serviço nem no componente: o painel do professor exibia
 * "/4" hardcoded enquanto o servidor validava outro número — o mesmo número em
 * três lugares sempre diverge.
 */
export const MAX_ACOES_POR_ESTAGIO = 7;

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

/**
 * Indicador inicial: 42, não 50.
 *
 * 50 é "metade" — um número que não quer dizer nada, porque não existe 50% de
 * comunidade. 42 diz "aqui existe base, mas ainda não dá conta". Como
 * cada ação move de 1 a 4 pontos e cabem 7 ações por estágio, uma boa jogada
 * fecha o estágio entre 55 e 70: arco visível na barra, em vez das seis
 * equipes empatadas em 50.
 */
export const OFICINA_INDICADOR_BASE = 42;

export function criarOficinaIndicadores(): OficinaIndicadores {
  return {
    cooperacao: OFICINA_INDICADOR_BASE,
    organizacao: OFICINA_INDICADOR_BASE,
    mercado: OFICINA_INDICADOR_BASE,
    conhecimento: OFICINA_INDICADOR_BASE,
    sustentabilidade: OFICINA_INDICADOR_BASE,
    confianca: OFICINA_INDICADOR_BASE,
    inclusao: OFICINA_INDICADOR_BASE,
    viabilidade: OFICINA_INDICADOR_BASE,
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
  /**
   * Se false, a pista NÃO pode ser compartilhada entre equipes (fica como
   * descoberta privada). Honrado por `compartilharPista` — antes o campo era
   * lido só por teste, e todas as pistas eram true mesmo assim.
   */
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

/**
 * Categorias de resultado.
 *
 * `mais_viability` era o ID persistido — "viability" é inglês, o resto do jogo
 * é PT-BR, e o ID errado sobrevivia no `oficina_resultados.categorias` jsonb.
 * O `OFICINA_CATEGORIAS_INFO[cat]` com fallback em `calcularResultados` tolera
 * linha antiga sem quebrar a tela.
 */
export type OficinaCategoriaResultado =
  | 'mais_viavel'
  | 'mais_colaborativa'
  | 'mais_inclusiva'
  | 'mais_sustentavel'
  | 'mais_inovadora'
  | 'destaque_comunidade';

/** ID legado, aceito só na LEITURA de dados antigos. */
export const OFICINA_CATEGORIA_LEGADA = 'mais_viability';

export const OFICINA_CATEGORIAS_ORDEM: OficinaCategoriaResultado[] = [
  'mais_viavel',
  'mais_colaborativa',
  'mais_inclusiva',
  'mais_sustentavel',
  'mais_inovadora',
  'destaque_comunidade',
];

export const OFICINA_CATEGORIAS_INFO: Record<
  OficinaCategoriaResultado,
  { rotulo: string; icone: string; explicacao: string }
> = {
  mais_viavel: {
    rotulo: 'Solução mais viável',
    icone: 'Compass',
    explicacao: 'Se sustenta sozinha: equilíbrio entre organização, mercado e viabilidade.',
  },
  mais_colaborativa: {
    rotulo: 'Solução mais colaborativa',
    icone: 'HeartHandshake',
    explicacao: 'A comunidade inteira agiu junta: cooperação e confiança.',
  },
  mais_inclusiva: {
    rotulo: 'Solução mais inclusiva',
    icone: 'Accessibility',
    explicacao: 'Ninguém ficou de fora: inclusão e confiança.',
  },
  mais_sustentavel: {
    rotulo: 'Solução mais sustentável',
    icone: 'Leaf',
    explicacao: 'Cuidado com o Cerrado como pilar da proposta.',
  },
  mais_inovadora: {
    rotulo: 'Solução mais inovadora',
    icone: 'Cpu',
    explicacao: 'Uso inteligente de conhecimento e tecnologia apropriada.',
  },
  destaque_comunidade: {
    rotulo: 'Destaque da comunidade',
    icone: 'Star',
    explicacao: 'Equilíbrio geral entre todos os indicadores.',
  },
};

export interface OficinaResultadoCategoria {
  categoria: OficinaCategoriaResultado;
  team_id: string;
  nota: number;
  razao: string;
}

// ---------------------------------------------------------------------------
// Marcadores
//
// O motor antigo dava categoria só por indicador, e como todas as equipes
// começam iguais e recebem deltas parecidos, as seis caíam no mesmo desempate.
// O marcador é o que a equipe FEZ, não o que ela ficou: é ele que separa as
// categorias de verdade.
// ---------------------------------------------------------------------------

export type OficinaMarcador =
  /** Publicou ao menos uma pista para as outras equipes. */
  | 'pista_compartilhada'
  /** Executou ação com tag `capacitacao` ou preencheu o bloco de capacitação. */
  | 'capacitacao_feita'
  /** Executou ação com tag `tecnologia`/`conectividade` ou escolheu opção tecnológica. */
  | 'tecnologia_usada'
  /** Escolheu na solução opção com tag `sustentabilidade`. */
  | 'cuidado_ambiental'
  /** Escolheu na solução opção com tag `inclusao`. */
  | 'publico_prioritario'
  /** Preencheu o bloco `parceiros` ou executou a ação `solucao_conjunta`. */
  | 'solucao_conjunta'
  /** Enviou a solução com os 13 blocos preenchidos. */
  | 'plano_completo';

export const OFICINA_MARCADORES_INFO: Record<OficinaMarcador, string> = {
  pista_compartilhada: 'Compartilhou descoberta com outra equipe',
  capacitacao_feita: 'Trabalhou capacitação',
  tecnologia_usada: 'Usou tecnologia ou ferramenta',
  cuidado_ambiental: 'Cuidou do Cerrado',
  publico_prioritario: 'Atendeu quem é mais vulnerável',
  solucao_conjunta: 'Montou solução com parceiros',
  plano_completo: 'Entregou a proposta completa',
};

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
  /**
   * Instante em que a equipe PUBLICAU esta pista. Preenchido apenas na equipe
   * descobridora.
   */
  compartilhada_em: string | null;
  /**
* team_id de quem trouxe a pista (null = descoberta pela própria equipe).
      *
      * Sem esta coluna não existe como dizer "esta pista eu achei" de "esta
      * pista me chegou", e o compartilhamento não tinha destino: a tabela é
      * per-team, então inserir a pista na equipe receptora é o que faz a
      * descoberta unlockar ação lá.
   */
  recebida_de: string | null;
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
// Visões: pública (tela da sala) vs. escopada (aluno)
// ---------------------------------------------------------------------------

export interface OficinaEquipeComNome extends OficinaEquipeRow {
  nome: string;
}

/** Tudo que a parede da sala pode mostrar. */
export interface OficinaPublicView {
  gameId: string;
  sessao: OficinaSessaoRow | null;
  equipes: OficinaEquipeComNome[];
  pistas: OficinaPistaRow[];
  eventos: OficinaEventoRow[];
  solucoes: OficinaSolucaoRow[];
  resultados: OficinaResultadoRow[];
}

/**
 * O que a equipe do aluno recebe.
 *
 * Não é a visão pública com campos a menos: é outra consulta. A visão pública
 * carrega `solucoes` e `resultados` de TODAS as equipes porque a parede precisa
 * mostrar a galeria; entregar isso ao painel do aluno dava spoiler da proposta
 * de quem ainda não enviou e matava a etapa de solução.
 */
export interface OficinaAlunoView {
  gameId: string;
  /** null = spectator (entrou pela URL de projeção sem ser equipe). */
  equipeId: string | null;
  sessao: OficinaSessaoRow | null;
  equipe: OficinaEquipeComNome | null;
  /** Só as equipes, só os indicadores: o suficiente para "como vão as outras". */
  equipes: Pick<OficinaEquipeComNome, 'team_id' | 'nome' | 'perfil' | 'indicadores'>[];
  /** Pistas da própria equipe + as publicadas por outras. */
  pistas: OficinaPistaRow[];
  /** Eventos: o atual e os resolvidos, para a equipe ver a própria história. */
  eventos: OficinaEventoRow[];
  /** A SOLUÇÃO DA PRÓPRIA EQUIPE — nunca a de outra. */
  minhaSolucao: OficinaSolucaoRow | null;
  /** Só o resultado da própria equipe. A galeria completa é da parede. */
  meuResultado: OficinaResultadoRow | null;
}

// ---------------------------------------------------------------------------
// Realtime (extensão do barramento existente)
// ---------------------------------------------------------------------------

export type OficinaRealtimeEventType =
  | 'OFICINA_STAGE_CHANGED'
  | 'OFICINA_CLUE_FOUND'
  | 'OFICINA_CLUE_SHARED'
  | 'OFICINA_EVENT_OPENED'
  /** Uma equipe votou no evento aberto. Distinto de RESOLVED: o evento continua. */
  | 'OFICINA_EVENT_VOTED'
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
  reflexao_final: string;
  transicoes: Record<OficinaStage, string>;
  feedback_por_perfil: Record<OficinaPerfil, string>;
  reflexao_perguntas: string[];
  provocacao: string;
}

// ---------------------------------------------------------------------------
// Helpers compartilhados por engine, serviço e UI
//
// Ficam aqui porque os três precisam concordar. Duas implementação de "como
// calculo a nota desta equipe" é uma implementação errada esperando um bug.
// ---------------------------------------------------------------------------

/** `marcadores` vem de jsonb: é `string[]` do ponto de vista do servidor. */
export function temMarcador(marcadores: readonly string[], marcador: OficinaMarcador): boolean {
  return marcadores.includes(marcador);
}

/**
 * Aceita o ID legado gravado antes da correção do typo e devolve o atual.
 * Sem isso, uma partida já jogada renderiza `undefined` no lugar do rótulo.
 */
export function normalizarCategoria(cat: string): OficinaCategoriaResultado | null {
  if (cat === OFICINA_CATEGORIA_LEGADA) return 'mais_viavel';
  return (OFICINA_CATEGORIAS_ORDEM as string[]).includes(cat)
    ? (cat as OficinaCategoriaResultado)
    : null;
}

/**
 * Rótulo seguro de categoria: nunca `undefined` na tela, mesmo com dado velho.
 */
export function rotuloCategoria(cat: string): string {
  const normal = normalizarCategoria(cat);
  return normal ? OFICINA_CATEGORIAS_INFO[normal].rotulo : 'Destaque da proposta';
}

/** `[{viabilidade: 3, mercado: -1}]` → `"viabilidade +3, mercado −1"`. */
export function formatarDelta(
  delta: Partial<OficinaIndicadores>,
  info: Record<OficinaIndicador, { rotulo: string }> = OFICINA_INDICADORES_INFO,
): string {
  const partes = (Object.keys(delta) as OficinaIndicador[])
    .filter((k) => typeof delta[k] === 'number' && delta[k] !== 0)
    .sort((a, b) => (delta[b] ?? 0) - (delta[a] ?? 0))
    .map((k) => `${info[k].rotulo.toLowerCase()} ${(delta[k] ?? 0) > 0 ? '+' : '−'}${Math.abs(delta[k] ?? 0)}`);
  return partes.join(', ');
}