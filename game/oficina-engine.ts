/**
 * Engine do modo "Oficina Safra DF": regras puras, sem I/O.
 *
 * Mesmo contrato do Diagnóstico (game/engine.ts): recebe estado, devolve estado
 * novo. Nenhuma função conhece React, Supabase, HTTP ou relógio. A engine é
 * 100% determinística: mesma entrada sempre produz a mesma saída.
 *
 * A engine da Oficina é COLABORATIVA: não há competição entre equipes durante
 * o jogo — cada time joga sua própria narrativa. A classificação ao final existe
 * apenas para gerar categorias de destaque pedagógicas, não para ranquear
 * "vencedores".
 */

import type {
  OficinaAcao,
  OficinaBlocoSolucao,
  OficinaCartao,
  OficinaCategoriaResultado,
  OficinaEventoOpcao,
  OficinaIndicador,
  OficinaIndicadores,
  OficinaResultadoCategoria,
  OficinaSolucao,
  TagOficina,
} from '@/types/oficina';
import { hashSeed, mulberry32 } from './rng';

// ---------------------------------------------------------------------------
// Limites e normalização
// ---------------------------------------------------------------------------

/** Clamp rigoroso de um indicador para o intervalo 0..100. */
function clamp100(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

// ---------------------------------------------------------------------------
// 1. aplicarDelta
// ---------------------------------------------------------------------------

/**
 * Aplica um patch parcial de indicadores sobre o estado atual.
 *
 * Cada chave presente no delta é somada ao valor correspondente e clampeada
 * para 0..100. Chaves ausentes no delta não são alteradas. Valores fracionários
 * são arredondados para inteiro antes do clamp.
 *
 * @param atual - indicadores atuais da equipe
 * @param delta - deltas a aplicar (parcial)
 * @returns novo estado de indicadores (imutável)
 */
export function aplicarDelta(
  atual: OficinaIndicadores,
  delta: Partial<OficinaIndicadores>,
): OficinaIndicadores {
  const resultado: OficinaIndicadores = { ...atual };
  for (const [chave, valor] of Object.entries(delta) as [OficinaIndicador, number][]) {
    if (valor === undefined) continue;
    resultado[chave] = clamp100(resultado[chave] + valor);
  }
  return resultado;
}

// ---------------------------------------------------------------------------
// 2. validarAcao
// ---------------------------------------------------------------------------

export interface ValidarAcaoInput {
  acao: OficinaAcao;
  indicadores: OficinaIndicadores;
  pistasTags: string[][];
  acoesUsadas: number;
  maxAcoesPorEstagio?: number;
}

export interface ValidarAcaoResultado {
  ok: boolean;
  motivo?: string;
}

/**
 * Valida se uma ação pode ser executada por uma equipe.
 *
 * Regras:
 * - custo_acoes + acoes_usadas > max → nega (limite de ações do estágio)
 * - requisito_tags não-vazio exige que a equipe tenha pelo menos UMA pista cuja
 *   interseção com requisito_tags não seja vazia
 * - NUNCA valida estado do banco (isso é responsabilidade do service layer)
 *
 * @returns { ok: true } quando a ação pode prosseguir, { ok: false, motivo }
 *          quando bloqueada.
 */
export function validarAcao({
  acao,
  indicadores: _indicadores,
  pistasTags,
  acoesUsadas,
  maxAcoesPorEstagio = 4,
}: ValidarAcaoInput): ValidarAcaoResultado {
  // Limite de ações do estágio.
  if (acao.custo_acoes + acoesUsadas > maxAcoesPorEstagio) {
    return {
      ok: false,
      motivo: 'Limite de ações do estágio',
    };
  }

  // Pré-requisito de pistas.
  if (acao.requisito_tags.length > 0) {
    const temPista = pistasTags.some((tagsPista) =>
      tagsPista.some((t) => acao.requisito_tags.includes(t as TagOficina)),
    );
    if (!temPista) {
      return {
        ok: false,
        motivo: 'Falta uma pista para isso',
      };
    }
  }

  return { ok: true };
}

// ---------------------------------------------------------------------------
// 3. acaoResultado
// ---------------------------------------------------------------------------

export interface AcaoResultado {
  efeitos: Partial<OficinaIndicadores>;
  aviso?: string;
}

/**
 * Calcula os efeitos de uma ação sobre os indicadores atuais.
 *
 * Aplica os deltas declarados na ação usando `aplicarDelta` internamente.
 * Gera um aviso pedagógico quando algum indicador atinge o teto (100) ou o
 * piso (0) — sem bloquear a ação, apenas informando o professor.
 *
 * @param indicadores - estado atual dos indicadores da equipe
 * @param acao - ação a ser executada
 * @returns efeitos parciais e eventual aviso
 */
export function acaoResultado(
  indicadores: OficinaIndicadores,
  acao: OficinaAcao,
): AcaoResultado {
  const efeitos = aplicarDelta(indicadores, acao.efeitos);
  const avisos: string[] = [];

  // Detecta saturação: indicador que estava antes do teto e agora é 100, ou
  // antes do piso e agora é 0.
  for (const [chave, valor] of Object.entries(acao.efeitos) as [OficinaIndicador, number][]) {
    if (valor === undefined || valor === 0) continue;
    const antes = indicadores[chave];
    const depois = efeitos[chave];
    if (depois === 100 && antes < 100) {
      avisos.push(
        `O indicador "${chave}" atingiu o valor máximo (100).`,
      );
    }
    if (depois === 0 && antes > 0) {
      avisos.push(
        `O indicador "${chave}" atingiu o valor mínimo (0).`,
      );
    }
  }

  return {
    efeitos,
    aviso: avisos.length > 0 ? avisos.join(' ') : undefined,
  };
}

// ---------------------------------------------------------------------------
// 4. sortearEventos
// ---------------------------------------------------------------------------

/**
 * Sorteio determinístico e estável de eventos de um pool.
 *
 * Usa FNV-1a (hashSeed) sobre a semente para alimentar um PRNG mulberry32, que
 * por sua vez alimenta Fisher-Yates para embaralhar o pool. A mistura é
 * estável: mesma semente + mesmo array de entrada = mesma ordem de saída.
 * Modifica uma cópia do pool, nunca o original.
 *
 * @param semente - string que ancora o hash (ex.: gameId)
 * @param pool - array de chaves de eventos disponíveis
 * @param quantidade - quantos eventos sortear
 * @returns array com os `quantidade` primeiros após o embaralhamento
 */
export function sortearEventos(
  semente: string,
  pool: string[],
  quantidade: number,
): string[] {
  if (quantidade <= 0) return [];
  if (pool.length === 0) return [];

  const copia = pool.slice();
  const rng = mulberry32(hashSeed(semente));

  // Fisher-Yates determinístico.
  for (let i = copia.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const temp = copia[i];
    copia[i] = copia[j];
    copia[j] = temp;
  }

  return copia.slice(0, Math.min(quantidade, copia.length));
}

// ---------------------------------------------------------------------------
// 5. eventoContribuicao
// ---------------------------------------------------------------------------

/**
 * Calcula os deltas resultantes da contribuição de uma equipe a um evento.
 *
 * Combina os efeitos da opção individual escolhida com o efeito coletivo do
 * evento (aplicado a todas as equipes que participaram). A ordem de aplicação
 * (individual primeiro, coletivo depois) é irrelevante pois a operação é
 * comutativa (soma + clamp).
 *
 * @param indicadores - estado atual dos indicadores da equipe
 * @param opcao - opção escolhida pela equipe
 * @param efeitoColetivo - delta coletivo do evento (aplicado a todos)
 * @returns delta combinado (individual + coletivo)
 */
export function eventoContribuicao(
  indicadores: OficinaIndicadores,
  opcao: OficinaEventoOpcao,
  efeitoColetivo: Partial<OficinaIndicadores>,
): Partial<OficinaIndicadores> {
  const intermediario = aplicarDelta(indicadores, opcao.efeitos);
  const final = aplicarDelta(intermediario, efeitoColetivo);

  // Retorna apenas os deltas (diferença entre o estado final e o atual).
  const deltas: Partial<OficinaIndicadores> = {};
  for (const chave of Object.keys(final) as OficinaIndicador[]) {
    const diff = final[chave] - indicadores[chave];
    if (diff !== 0) {
      deltas[chave] = diff;
    }
  }
  return deltas;
}

// ---------------------------------------------------------------------------
// 6. coerenciaSolucao
// ---------------------------------------------------------------------------

export interface CoerenciaResultado {
  score: number;
  avisos: string[];
  alinhados: string[];
  desalinhados: string[];
}

/**
 * Avalia a coerência da solução proposta por uma equipe em relação ao problema
 * que ela escolheu.
 *
 * Para cada bloco preenchido, localiza a opção correspondente no cartão e compara
 * as tags daquela opção com as tags do problema escolhido:
 * - 1+ tag em comum → alinhado (+peso ao score)
 * - 0 tags em comum → desalinhado (aviso suave, NUNCA bloqueio)
 *
 * Score = 50 base + 15 por bloco alinhado + 5 por bloco preenchido (cap 100).
 *
 * Os avisos são pedagógicos e em PT-BR: NUNCA rotulam "certo/errado", apenas
 * convidam o professor a revisar com a equipe.
 */
export function coerenciaSolucao(
  solucao: OficinaSolucao,
  problemaEscolhido: string,
  problemaTags: TagOficina[],
  cartoes: OficinaCartao[],
): CoerenciaResultado {
  const blocosPreenchidos = Object.keys(solucao.blocos) as OficinaBlocoSolucao[];
  const alinhados: string[] = [];
  const desalinhados: string[] = [];
  const avisos: string[] = [];

  for (const bloco of blocosPreenchidos) {
    const valor = solucao.blocos[bloco];
    if (!valor || valor.trim() === '') continue;

    const cartao = cartoes.find((c) => c.bloco === bloco);
    if (!cartao) continue;

    // Encontra a opção cujo key corresponde ao valor preenchido no bloco.
    const opcaoEscolhida = cartao.opcoes.find((o) => o.key === valor);
    if (!opcaoEscolhida) continue;

    // Compara tags da opção com tags do problema.
    const tagsEmComum = opcaoEscolhida.tags.filter((t) => problemaTags.includes(t));

    if (tagsEmComum.length > 0) {
      alinhados.push(bloco);
    } else {
      desalinhados.push(bloco);
      avisos.push(
        `Revistam o cartão "${cartao.bloco}": as opções escolhidas conversam pouco com o problema principal.`,
      );
    }
  }

  // Score: 50 base + 15 por alinhado + 5 por preenchido (cap 100).
  const score = Math.min(
    100,
    50 + alinhados.length * 15 + blocosPreenchidos.length * 5,
  );

  return { score, avisos, alinhados, desalinhados };
}

// ---------------------------------------------------------------------------
// 7. calcularResultados
// ---------------------------------------------------------------------------

export interface EquipeInput {
  team_id: string;
  indicadores: OficinaIndicadores;
  marcadores: string[];
  solucao?: OficinaSolucao;
}

/**
 * Calcula os resultados da oficina: uma categoria de destaque por equipe,
 * sem empate, sem vencedor.
 *
 * Métricas por categoria:
 * - mais_viability: viabilidade×0.5 + organizacao×0.3 + mercado×0.2
 * - mais_colaborativa: cooperacao×0.6 + confianca×0.4
 * - mais_inclusiva: inclusao×0.6 + confianca×0.4
 * - mais_sustentavel: sustentabilidade×0.8 + viabilidade×0.2
 * - mais_inovadora: conhecimento×0.5 + 30 se 'tech_usada' + 20 se 'capacitacao_feita'
 * - destaque_comunidade: média simples dos 8 indicadores
 *
 * Cada equipe recebe a categoria para a qual obteve maior pontuação.
 * Desempate por ordem lexicográfica do team_id (nunca aleatório).
 * A razão é uma frase curta em PT-BR baseada nos dois indicadores que mais
 * contribuíram, sem linguagem competitiva agressiva.
 */
export function calcularResultados(
  equipes: EquipeInput[],
  _cartoes: OficinaCartao[],
  _problemaTagsPorEquipe: Record<string, TagOficina[]>,
): OficinaResultadoCategoria[] {
  const categorias: OficinaCategoriaResultado[] = [
    'mais_viability',
    'mais_colaborativa',
    'mais_inclusiva',
    'mais_sustentavel',
    'mais_inovadora',
    'destaque_comunidade',
  ];

  return equipes.map((equipe) => {
    // Calcula pontuação para cada categoria.
    const pontuacoes = calcularPontuacoesPorCategoria(equipe);

    // Escolhe a categoria com maior pontuação; desempate por ordem de categorias
    // (que é estável e fixa).
    let melhorCategoria: OficinaCategoriaResultado = categorias[0];
    let melhorNota = -1;

    for (const cat of categorias) {
      const nota = pontuacoes[cat];
      if (nota > melhorNota) {
        melhorNota = nota;
        melhorCategoria = cat;
      }
    }

    const nota = Math.round(melhorNota);
    const razao = gerarRazao(melhorCategoria, equipe.indicadores, equipe.marcadores);

    return {
      categoria: melhorCategoria,
      team_id: equipe.team_id,
      nota: Math.max(0, Math.min(100, nota)),
      razao,
    };
  });
}

/** Calcula a pontuação bruta (0..100) de uma equipe em cada categoria. */
function calcularPontuacoesPorCategoria(
  equipe: EquipeInput,
): Record<OficinaCategoriaResultado, number> {
  const ind = equipe.indicadores;
  const marcadores = new Set(equipe.marcadores);

  return {
    mais_viability:
      ind.viabilidade * 0.5 + ind.organizacao * 0.3 + ind.mercado * 0.2,
    mais_colaborativa:
      ind.cooperacao * 0.6 + ind.confianca * 0.4,
    mais_inclusiva:
      ind.inclusao * 0.6 + ind.confianca * 0.4,
    mais_sustentavel:
      ind.sustentabilidade * 0.8 + ind.viabilidade * 0.2,
    mais_inovadora:
      ind.conhecimento * 0.5 +
      (marcadores.has('tech_usada') ? 30 : 0) +
      (marcadores.has('capacitacao_feita') ? 20 : 0),
    destaque_comunidade:
      mediaSimples(ind),
  };
}

/** Média simples dos 8 indicadores. */
function mediaSimples(ind: OficinaIndicadores): number {
  const valores = Object.values(ind);
  return valores.reduce((soma, v) => soma + v, 0) / valores.length;
}

/**
 * Gera uma frase curta em PT-BR a partir dos dois indicadores que mais
 * contribuíram para a categoria. Linguagem neutra: sem "venceu", "perdeu",
 * "melhor", "pior" — apenas destaque do que funcionou.
 */
function gerarRazao(
  categoria: OficinaCategoriaResultado,
  indicadores: OficinaIndicadores,
  marcadores: string[],
): string {
  const marcSet = new Set(marcadores);

  switch (categoria) {
    case 'mais_viability': {
      const top2 = topDois(indicadores, ['viabilidade', 'organizacao', 'mercado']);
      return `Viabilidade sustentada por ${rotula(top2[0])} e ${rotula(top2[1])}.`;
    }
    case 'mais_colaborativa': {
      const top2 = topDois(indicadores, ['cooperacao', 'confianca']);
      return `Cooperação e confiança caminham juntas: ${rotula(top2[0])} e ${rotula(top2[1])}.`;
    }
    case 'mais_inclusiva': {
      const top2 = topDois(indicadores, ['inclusao', 'confianca']);
      return `Inclusão e confiança se reforçam: ${rotula(top2[0])} e ${rotula(top2[1])}.`;
    }
    case 'mais_sustentavel': {
      const top2 = topDois(indicadores, ['sustentabilidade', 'viabilidade']);
      return `Sustentabilidade como pilar, com ${rotula(top2[0])} e ${rotula(top2[1])}.`;
    }
    case 'mais_inovadora': {
      const inovacaoParts: string[] = [];
      if (marcSet.has('tech_usada')) inovacaoParts.push('tecnologia apropriada');
      if (marcSet.has('capacitacao_feita')) inovacaoParts.push('capacitação da equipe');
      if (inovacaoParts.length > 0) {
        return `Inovação via ${inovacaoParts.join(' e ')}, com ${rotula('conhecimento')} em destaque.`;
      }
      return `Conhecimento técnico orientou as escolhas: ${rotula('conhecimento')} em destaque.`;
    }
    case 'destaque_comunidade': {
      const todos = Object.entries(indicadores)
        .sort((a, b) => b[1] - a[1]);
      return `Equilíbrio geral entre todos os indicadores, com ${rotula(todos[0][0] as OficinaIndicador)} e ${rotula(todos[1][0] as OficinaIndicador)} em destaque.`;
    }
  }
}

/** Retorna os dois indicadores de maior valor de uma lista. */
function topDois(
  ind: OficinaIndicadores,
  chaves: OficinaIndicador[],
): OficinaIndicador[] {
  return chaves
    .slice()
    .sort((a, b) => ind[b] - ind[a])
    .slice(0, 2);
}

/** Rótulo legível de um indicador. */
function rotula(indicador: OficinaIndicador): string {
  const rotulos: Record<OficinaIndicador, string> = {
    cooperacao: 'cooperação',
    organizacao: 'organização',
    mercado: 'mercado',
    conhecimento: 'conhecimento',
    sustentabilidade: 'sustentabilidade',
    confianca: 'confiança',
    inclusao: 'inclusão',
    viabilidade: 'viabilidade',
  };
  return rotulos[indicador] ?? indicador;
}

// ---------------------------------------------------------------------------
// 8. calcularResultadoOficinaResumo
// ---------------------------------------------------------------------------

/**
 * Gera um resumo neutro em PT-BR para o professor usar no debate.
 *
 * 3 a 4 frases que mencionam os indicadores coletivos médios e as categorias
 * destacadas. NUNCA menciona "time vencedor" ou "time perdedor" — o foco é o
 * coletivo, não a competição.
 */
export function calcularResultadoOficinaResumo(
  equipes: EquipeInput[],
  categorias: OficinaResultadoCategoria[],
): { resumo_para_debate: string } {
  if (equipes.length === 0) {
    return {
      resumo_para_debate:
        'A oficina foi concluída. Use este momento para conversar com a turma sobre as escolhas e os aprendizados.',
    };
  }

  // Média coletiva dos 8 indicadores.
  const medias: Record<OficinaIndicador, number> = {
    cooperacao: 0,
    organizacao: 0,
    mercado: 0,
    conhecimento: 0,
    sustentabilidade: 0,
    confianca: 0,
    inclusao: 0,
    viabilidade: 0,
  };

  for (const eq of equipes) {
    for (const k of Object.keys(medias) as OficinaIndicador[]) {
      medias[k] += eq.indicadores[k];
    }
  }
  for (const k of Object.keys(medias) as OficinaIndicador[]) {
    medias[k] = Math.round(medias[k] / equipes.length);
  }

  // Indicador médio mais alto e mais baixo.
  const ordenados = (Object.entries(medias) as [OficinaIndicador, number][])
    .sort((a, b) => b[1] - a[1]);
  const maisForte = ordenados[0];
  const maisFraco = ordenados[ordenados.length - 1];

  // Contagem de categorias destacadas.
  const catCount = new Map<string, number>();
  for (const c of categorias) {
    catCount.set(c.categoria, (catCount.get(c.categoria) ?? 0) + 1);
  }
  const catsMaisComuns = [...catCount.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2);

  const frases: string[] = [];

  // Frase 1: média geral.
  const mediaGeral = Math.round(
    Object.values(medias).reduce((s, v) => s + v, 0) / Object.values(medias).length,
  );
  frases.push(
    `Em média, as equipes atingiram ${mediaGeral} pontos nos indicadores coletivos.`,
  );

  // Frase 2: indicador mais forte.
  frases.push(
    `O indicador "${rotula(maisForte[0])}" foi o mais forte entre as equipes, com média de ${maisForte[1]} pontos.`,
  );

  // Frase 3: indicador que precisa de atenção.
  frases.push(
    `Já "${rotula(maisFraco[0])}" foi o que ficou abaixo, com média de ${maisFraco[1]} — vale discutir como melhorar.`,
  );

  // Frase 4 (opcional): categorias que se destacaram.
  if (catsMaisComuns.length > 0) {
    const catsTexto = catsMaisComuns
      .map(([cat]) => {
        const info = categorias.find((c) => c.categoria === cat);
        return info?.categoria.replace(/_/g, ' ') ?? cat;
      })
      .join(' e ');
    frases.push(
      `As categorias de destaque que mais apareceram foram: ${catsTexto}.`,
    );
  }

  return { resumo_para_debate: frases.join(' ') };
}
