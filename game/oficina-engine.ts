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
  OficinaAcaoKey,
  OficinaBlocoSolucao,
  OficinaCartao,
  OficinaCategoriaResultado,
  OficinaEventoOpcao,
  OficinaIndicador,
  OficinaIndicadores,
  OficinaMarcador,
  OficinaResultadoCategoria,
  OficinaSolucao,
  TagOficina,
} from '@/types/oficina';
import {
  MAX_ACOES_POR_ESTAGIO,
  OFICINA_BLOCOS_INFO,
  OFICINA_CATEGORIAS_INFO,
  OFICINA_CATEGORIAS_ORDEM,
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
 * Regras, nesta ordem:
 * - custo_acoes + acoesUsadas > max → nega, dizendo quantas ações sobram
 * - requisito_tags não-vazio exige que a equipe tenha pelo menos UMA pista cuja
 *   interseção com requisito_tags não seja vazia
 * - NUNCA valida estado do banco (isso é responsabilidade do service layer)
 *
 * O `custo_acoes` é respeitado aqui e no service layer: antes a validação
 * cobrava o custo certo (`custo + usadas > max`) mas a escrita somava sempre
 * `1`, então uma ação de custo 2 nunca era cobrada.
 *
 * @returns { ok: true } quando a ação pode prosseguir, { ok: false, motivo }
 *          quando bloqueada. O motivo é frase para o jogador, não código.
 */
export function validarAcao({
  acao,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- mantido por contrato de interface
  indicadores: _indicadores,
  pistasTags,
  acoesUsadas,
  maxAcoesPorEstagio = MAX_ACOES_POR_ESTAGIO,
}: ValidarAcaoInput): ValidarAcaoResultado {
  // Limite de ações do estágio.
  const restantes = maxAcoesPorEstagio - acoesUsadas;
  if (acao.custo_acoes > restantes) {
    return {
      ok: false,
      motivo:
        restantes <= 0
          ? `Você usou as ${maxAcoesPorEstagio} ações deste estágio.`
          : `Esta ação custa ${acao.custo_acoes} e você tem ${restantes} restante${restantes === 1 ? '' : 's'}.`,
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
        motivo: 'Investigue ou receba uma descoberta com essa característica antes.',
      };
    }
  }

  return { ok: true };
}

// ---------------------------------------------------------------------------
// 3. acaoResultado
// ---------------------------------------------------------------------------

export interface AcaoResultado {
  /** Estado COMPLETO dos indicadores após aplicar a ação (não é um delta). */
  efeitos: OficinaIndicadores;
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
  /**
   * Chaves que a equipe enviou e que não existem em nenhum cartão.
   *
   * Antes estes `continue` sumiam: uma equipe podia digitar 13 chaves
   * inventadas, `blocosPreenchidos` contava 13, e o score subia como se a
   * solução estivesse completa. Agora elas são nomeadas e a UI mostra.
   */
  blocosDesconhecidos: string[];
  /** Blocos preenchidos em bloco de texto livre (não julgados por tag). */
  camposLivres: string[];
}

/**
 * Avalia a coerência da solução proposta por uma equipe em relação ao problema
 * que ela escolheu.
 *
 * Para cada bloco preenchido, localiza a opção correspondente no cartão e compara
 * as tags daquela opção com as tags do problema escolhido:
 * - 1+ tag em comum → alinhado
 * - 0 tags em comum → desalinhado (aviso suave, NUNCA bloqueio)
 * - bloco de texto livre → conta como preenchido, sem julgamento de tag
 * - chave que não existe em nenhum cartão → `blocosDesconhecidos`, não conta
 *
 * Score = 70 × taxa de alinhamento + 30 × completude.
 *
 * A fórmula antiga (`50 + 15/alinhado + 5/preenchido`, cap 100) estourava o teto
 * em qualquer proposta razoável: com 13 blocos preenchidos dava 100 para todo
 * mundo, então o número não distinguia nada. Agora os dois eixos são-explícitos
 * e a taxa de alinhamento pesa mais: acertar o encadeamento vale mais do que
 * encher todos os campos.
 *
 * Os avisos são pedagógicos e em PT-BR: NUNCA rotulam "certo/errado", apenas
 * convidam o professor a revisar com a equipe.
 */
export function coerenciaSolucao(
  solucao: OficinaSolucao,
  problemaTags: TagOficina[],
  cartoes: OficinaCartao[],
): CoerenciaResultado {
  const blocosPreenchidos = Object.keys(solucao.blocos) as OficinaBlocoSolucao[];
  const alinhados: string[] = [];
  const desalinhados: string[] = [];
  const avisos: string[] = [];
  const blocosDesconhecidos: string[] = [];
  const camposLivres: string[] = [];

  // Blocos com opção fechada: só estes são julgados por alinhamento de tag.
  let julgados = 0;

  for (const bloco of blocosPreenchidos) {
    const valor = solucao.blocos[bloco];
    if (!valor || valor.trim() === '') continue;

    const cartao = cartoes.find((c) => c.bloco === bloco);
    if (!cartao) {
      blocosDesconhecidos.push(bloco);
      continue;
    }

    if (cartao.campo_livre) {
      camposLivres.push(bloco);
      continue;
    }

    // Encontra a opção cujo key corresponde ao valor preenchido no bloco.
    const opcaoEscolhida = cartao.opcoes.find((o) => o.key === valor);
    if (!opcaoEscolhida) {
      blocosDesconhecidos.push(bloco);
      continue;
    }

    julgados += 1;

    // Compara tags da opção com tags do problema.
    const tagsEmComum = opcaoEscolhida.tags.filter((t) => problemaTags.includes(t));

    if (tagsEmComum.length > 0) {
      alinhados.push(bloco);
    } else {
      desalinhados.push(bloco);
      avisos.push(
        `Revistam o cartão "${OFICINA_BLOCOS_INFO[bloco]?.rotulo ?? bloco}": as opções escolhidas conversam pouco com o problema principal.`,
      );
    }
  }

  const totalCartoes = cartoes.length;
  const taxaAlinhamento = julgados > 0 ? alinhados.length / julgados : 0;
  const completude = totalCartoes > 0 ? blocosPreenchidos.length / totalCartoes : 0;
  const score = Math.round(70 * taxaAlinhamento + 30 * completude);

  if (julgados === 0 && blocosPreenchidos.length > 0) {
    avisos.push(
      'Nenhum cartão de opção fechada foi preenchido: revisem as escolhas e escrevam os textos livres.',
    );
  }
  if (blocosDesconhecidos.length > 0) {
    avisos.push(
      `${blocosDesconhecidos.length} bloco(s) foram preenchidos com escolhas fora dos cartões e não entram na nota de coerência.`,
    );
  }

  return { score, avisos, alinhados, desalinhados, blocosDesconhecidos, camposLivres };
}

/**
 * Deriva os marcadores da equipe a partir do que ela REALMENTE fez.
 *
 * Existe como função pura e não como campo gravado porque não é preciso
 * persistir nada: as pistas publicadas, as ações executadas e a solução enviada
 * já estão no banco, e derivar de novo é mais barato que sincronizar. A
 * `oficina_equipes.marcadores` continua sendo escrita (é a coluna que a IA e
 * a projeção leem), mas a verdade é esta função.
 *
 * Sem isso, `mais_inovadora` dependia de um marcador `tech_usada` que o engine
 * nunca produzia — a categoria era inalcançável na prática.
 */
export interface DerivarMarcadoresInput {
  /** null enquanto a equipe não enviou proposta. */
  solucao: OficinaSolucao | null;
  cartoes: OficinaCartao[];
  /** Keys das ações executadas pela equipe (qualquer estágio). */
  acoesExecutadas: OficinaAcaoKey[];
  /** Tags das ações executadas (para reconhecer opção tecnológica/capacitação). */
  acaoTags: TagOficina[];
  /** A equipe publicou ao menos uma pista para as outras? */
  compartilhou: boolean;
}

export function derivarMarcadores({
  solucao,
  cartoes,
  acoesExecutadas,
  acaoTags,
  compartilhou,
}: DerivarMarcadoresInput): OficinaMarcador[] {
  const marcadores: OficinaMarcador[] = [];

  if (compartilhou) marcadores.push('pista_compartilhada');

  const acaoTem = (tag: TagOficina) => acaoTags.includes(tag);

  if (acaoTem('capacitacao') || temBlocoPreenchido(solucao, 'capacitacao')) {
    marcadores.push('capacitacao_feita');
  }

  // Tags das OPÇÕES escolhidas na solução — é a prova de que a escolha foi feita.
  const tagsEscolhidas = tagsDasOpcoesEscolhidas(solucao, cartoes);

  if (
    acaoTem('tecnologia') ||
    acaoTem('conectividade') ||
    tagsEscolhidas.includes('tecnologia') ||
    tagsEscolhidas.includes('conectividade')
  ) {
    marcadores.push('tecnologia_usada');
  }

  if (tagsEscolhidas.includes('sustentabilidade')) {
    marcadores.push('cuidado_ambiental');
  }

  if (tagsEscolhidas.includes('inclusao')) {
    marcadores.push('publico_prioritario');
  }

  if (acoesExecutadas.includes('solucao_conjunta') || temBlocoPreenchido(solucao, 'parceiros')) {
    marcadores.push('solucao_conjunta');
  }

  if (
    solucao &&
    cartoes.every((c) => {
      const valor = solucao.blocos[c.bloco];
      return typeof valor === 'string' && valor.trim() !== '';
    })
  ) {
    marcadores.push('plano_completo');
  }

  return marcadores;
}

function temBlocoPreenchido(
  solucao: OficinaSolucao | null,
  bloco: OficinaBlocoSolucao,
): boolean {
  const valor = solucao?.blocos[bloco];
  return typeof valor === 'string' && valor.trim() !== '';
}

/** União das tags de todas as opções fechadas que a equipe escolheu. */
function tagsDasOpcoesEscolhidas(
  solucao: OficinaSolucao | null,
  cartoes: OficinaCartao[],
): TagOficina[] {
  if (!solucao) return [];
  const tags: TagOficina[] = [];
  for (const cartao of cartoes) {
    const valor = solucao.blocos[cartao.bloco];
    if (typeof valor !== 'string' || cartao.campo_livre) continue;
    const opcao = cartao.opcoes.find((o) => o.key === valor);
    if (opcao) tags.push(...opcao.tags);
  }
  return tags;
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
 * Calcula os resultados da oficina: UM destaque por equipe, sem repetição,
 * sem vencedor.
 *
 * Por que o modelo anterior não funcionava: cada equipe recebia
 * `argmax(categorias)`, e como todas partem do mesmo indicador base e recebem
 * deltas parecidos, as seis empatavam e o desempate era ordem de array — as seis
 * equipes saíam com `mais_viability`. Havia até teste certificando isso.
 *
 * Aqui a atribuição é uma alocação: as categorias são percorridas em ordem
 * fixa e cada uma leva a equipe AINDA SEM destaque que melhor a pontua. Com 6
 * equipes e 6 categorias o resultado é uma bijeção — cada equipe ganha uma e
 * cada destaque vai para uma equipe. Com menos equipes, sobram categorias sem
 * dono, que é o resultado honesto.
 *
 * Os marcadores entram na pontuação porque são o que distingue "cooperou" de
 * "terminou acima da média": ver `pontuarCategoria`.
 */
export function calcularResultados(
  equipes: EquipeInput[],
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- mantido por contrato de interface
  _cartoes: OficinaCartao[],
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- mantido por contrato de interface
  _problemaTagsPorEquipe: Record<string, TagOficina[]>,
): OficinaResultadoCategoria[] {
  // Ordem estável: define quem fica com a categoria disputada quando sobra uma.
  const jaPremiadas = new Set<string>();
  const resultados: OficinaResultadoCategoria[] = [];

  for (const categoria of OFICINA_CATEGORIAS_ORDEM) {
    let melhor: { equipe: EquipeInput; nota: number } | null = null;

    for (const equipe of equipes) {
      if (jaPremiadas.has(equipe.team_id)) continue;
      const nota = pontuarCategoria(categoria, equipe);
      // Empate interno resolve pelo team_id, que é estável e não aleatório.
      if (
        !melhor ||
        nota > melhor.nota ||
        (nota === melhor.nota && equipe.team_id < melhor.equipe.team_id)
      ) {
        melhor = { equipe, nota };
      }
    }

    if (!melhor) break; // sobraram categorias, mas não sobraram equipes
    jaPremiadas.add(melhor.equipe.team_id);
    resultados.push({
      categoria,
      team_id: melhor.equipe.team_id,
      nota: Math.max(0, Math.min(100, Math.round(melhor.nota))),
      razao: gerarRazao(categoria, melhor.equipe),
    });
  }

  return resultados;
}

/**
 * Pontuação (0..100) da equipe NA categoria.
 *
 * Cada categoria mistura os indicadores que a definem com o marcador que prova
 * que a equipe fez a coisa. Sem o marcador a categoria ainda é alcançável —
 * jogar bem os indicadores é o jogo — mas a equipe que agiu leva o destaque.
 */
function pontuarCategoria(
  categoria: OficinaCategoriaResultado,
  equipe: EquipeInput,
): number {
  const ind = equipe.indicadores;
  const m = new Set(equipe.marcadores);
  const bonus = (marcador: OficinaMarcador, pontos: number) =>
    m.has(marcador) ? pontos : 0;

  switch (categoria) {
    case 'mais_viavel':
      return (
        ind.viabilidade * 0.4 +
        ind.organizacao * 0.25 +
        ind.mercado * 0.15 +
        bonus('plano_completo', 20)
      );
    case 'mais_colaborativa':
      return (
        ind.cooperacao * 0.35 +
        ind.confianca * 0.2 +
        ind.conhecimento * 0.1 +
        bonus('pista_compartilhada', 35) +
        bonus('solucao_conjunta', 15)
      );
    case 'mais_inclusiva':
      return (
        ind.inclusao * 0.45 +
        ind.confianca * 0.2 +
        bonus('publico_prioritario', 35) +
        bonus('capacitacao_feita', 10)
      );
    case 'mais_sustentavel':
      return (
        ind.sustentabilidade * 0.5 +
        ind.viabilidade * 0.15 +
        bonus('cuidado_ambiental', 35)
      );
    case 'mais_inovadora':
      return (
        ind.conhecimento * 0.3 +
        ind.organizacao * 0.1 +
        bonus('tecnologia_usada', 40) +
        bonus('capacitacao_feita', 20)
      );
    case 'destaque_comunidade':
      return mediaSimples(ind) * 0.85 + bonus('plano_completo', 15);
  }
}

/** Média simples dos 8 indicadores. */
function mediaSimples(ind: OficinaIndicadores): number {
  const valores = Object.values(ind);
  return valores.reduce((soma, v) => soma + v, 0) / valores.length;
}

/**
 * Gera uma frase curta em PT-BR descrevendo o que a equipe fez para merecer o
 * destaque. Linguagem neutra: sem "venceu", "perdeu", "melhor", "pior" —
 * apenas o que funcionou.
 */
function gerarRazao(categoria: OficinaCategoriaResultado, equipe: EquipeInput): string {
  const m = new Set(equipe.marcadores);
  const ind = equipe.indicadores;

  switch (categoria) {
    case 'mais_viavel': {
      const base = `Proposta que se sustenta sozinha, com ${rotula(
        topDois(ind, ['viabilidade', 'organizacao', 'mercado'])[0],
      )} em destaque.`;
      return m.has('plano_completo')
        ? `Proposta completa e viável: os 13 blocos foram preenchidos e ${rotula(
            topDois(ind, ['viabilidade', 'organizacao', 'mercado'])[0],
          )} sustentam o plano.`
        : base;
    }
    case 'mais_colaborativa': {
      if (m.has('pista_compartilhada')) {
        return `Abriu o jogo para as outras equipes: ${rotula('cooperacao')} subiu porque a descoberta circulou, não porque ficou guardada.`;
      }
      return `${rotula('cooperacao')} e ${rotula('confianca')} andaram juntos ao longo da oficina.`;
    }
    case 'mais_inclusiva': {
      if (m.has('publico_prioritario')) {
        return `A proposta nomeia quem é mais vulnerável e traz ${rotula('inclusao')} como critério de escolha, não como apêndice.`;
      }
      return `${rotula('inclusao')} e ${rotula('confianca')} se reforçam: ninguém ficou de fora por acaso.`;
    }
    case 'mais_sustentavel': {
      if (m.has('cuidado_ambiental')) {
        return `Cuidado com o Cerrado entrou como pilar da proposta, não como promessa de final de linha.`;
      }
      return `${rotula('sustentabilidade')} foi o eixo da proposta, com ${rotula('viabilidade')} em apoio.`;
    }
    case 'mais_inovadora': {
      const partes: string[] = [];
      if (m.has('tecnologia_usada')) partes.push('ferramenta adequada ao problema real');
      if (m.has('capacitacao_feita')) partes.push('saber que circula na equipe');
      if (partes.length > 0) {
        return `Inovação por ${partes.join(' e ')}, com ${rotula('conhecimento')} em destaque.`;
      }
      return `Conhecimento técnico orientou as escolhas: ${rotula('conhecimento')} em destaque.`;
    }
    case 'destaque_comunidade': {
      const todos = (Object.entries(ind) as [OficinaIndicador, number][]).sort((a, b) => b[1] - a[1]);
      return `Equilíbrio geral entre todos os indicadores, com ${rotula(todos[0][0])} e ${rotula(
        todos[1][0],
      )} em destaque.`;
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
    `"${rotula(maisFraco[0])}" foi o que mais ficou para trás, com média de ${maisFraco[1]} — vale entender por quê.`,
  );

  // Frase 4: os destaques que cada equipe ganhou.
  const catsTexto = categorias
    .map((c) => OFICINA_CATEGORIAS_INFO[c.categoria].rotulo.toLowerCase())
    .join(', ');
  if (catsTexto) {
    frases.push(`Cada equipe ganhou um destaque pelo que fez de diferente: ${catsTexto}.`);
  }

  return { resumo_para_debate: frases.join(' ') };
}
