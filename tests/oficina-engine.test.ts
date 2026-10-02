import { describe, expect, it } from 'vitest';
import { OFICINA_CONTENT } from '@/data/oficina-content';
import {
  acaoResultado,
  aplicarDelta,
  calcularResultadoOficinaResumo,
  calcularResultados,
  coerenciaSolucao,
  derivarMarcadores,
  eventoContribuicao,
  sortearEventos,
  validarAcao,
} from '@/game/oficina-engine';
import { avaliarCoerencia } from '@/lib/oficina-service';
import {
  formatarDelta,
  MAX_ACOES_POR_ESTAGIO,
  normalizarCategoria,
  OFICINA_CATEGORIAS_ORDEM,
  OFICINA_INDICADORES_INFO,
  OFICINA_MARCADORES_INFO,
  rotuloCategoria,
  temMarcador,
  type OficinaAcao,
  type OficinaAcaoKey,
  type OficinaBlocoSolucao,
  type OficinaCartao,
  type OficinaIndicador,
  type OficinaIndicadores,
  type OficinaResultadoCategoria,
  type OficinaSolucao,
  type TagOficina,
} from '@/types/oficina';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function baseIndicadores(overrides: Partial<OficinaIndicadores> = {}): OficinaIndicadores {
  return {
    cooperacao: 50,
    organizacao: 50,
    mercado: 50,
    conhecimento: 50,
    sustentabilidade: 50,
    confianca: 50,
    inclusao: 50,
    viabilidade: 50,
    ...overrides,
  };
}

function acaoBasica(overrides: Partial<OficinaAcao> = {}): OficinaAcao {
  return {
    key: 'investigar',
    nome: 'Investigar',
    icone: 'Search',
    descricao: 'Ir ao local para coletar informações.',
    custo_acoes: 1,
    requisito_tags: [],
    efeitos: { cooperacao: 5, conhecimento: 3 },
    tags: ['organizacao'],
    investiga: true,
    ...overrides,
  };
}

/** Envelopa blocos em uma solução válida (o `campos_livres` fica separado por contrato). */
function solucaoDe(blocos: Partial<Record<OficinaBlocoSolucao, string>>): OficinaSolucao {
  return { blocos, campos_livres: {} };
}

interface Equipe {
  team_id: string;
  marcadores: string[];
  indicadores: OficinaIndicadores;
}

function notaDe(resultados: OficinaResultadoCategoria[], teamId: string): number {
  const linha = resultados.find((r) => r.team_id === teamId);
  expect(linha, `nenhum destaque para a equipe "${teamId}"`).toBeDefined();
  return linha!.nota;
}

function categoriaDe(resultados: OficinaResultadoCategoria[], teamId: string): string {
  const linha = resultados.find((r) => r.team_id === teamId);
  expect(linha, `nenhum destaque para a equipe "${teamId}"`).toBeDefined();
  return linha!.categoria;
}

// ---------------------------------------------------------------------------
// aplicarDelta
// ---------------------------------------------------------------------------

describe('aplicarDelta', () => {
  it('soma delta positivo ao valor atual', () => {
    const atual = baseIndicadores({ cooperacao: 30 });
    const resultado = aplicarDelta(atual, { cooperacao: 10 });
    expect(resultado.cooperacao).toBe(40);
  });

  it('subtrai delta negativo do valor atual', () => {
    const atual = baseIndicadores({ mercado: 70 });
    const resultado = aplicarDelta(atual, { mercado: -20 });
    expect(resultado.mercado).toBe(50);
  });

  it('clampa no piso (0) quando o delta excede o limite inferior', () => {
    const atual = baseIndicadores({ viabilidade: 5 });
    const resultado = aplicarDelta(atual, { viabilidade: -20 });
    expect(resultado.viabilidade).toBe(0);
  });

  it('clampa no teto (100) quando o delta excede o limite superior', () => {
    const atual = baseIndicadores({ confianca: 95 });
    const resultado = aplicarDelta(atual, { confianca: 20 });
    expect(resultado.confianca).toBe(100);
  });

  it('arredonda valores fracionários antes do clamp', () => {
    const atual = baseIndicadores({ inclusao: 49 });
    const resultado = aplicarDelta(atual, { inclusao: 1.6 });
    expect(resultado.inclusao).toBe(51); // 49 + 1.6 = 50.6 → 51
  });

  it('preserva indicadores não mencionados no delta', () => {
    const atual = baseIndicadores({ cooperacao: 30, mercado: 80 });
    const resultado = aplicarDelta(atual, { cooperacao: 10 });
    expect(resultado.mercado).toBe(80);
    expect(resultado.cooperacao).toBe(40);
  });

  it('não altera o objeto de entrada (imutabilidade)', () => {
    const atual = baseIndicadores({ cooperacao: 30 });
    const resultado = aplicarDelta(atual, { cooperacao: 10 });
    expect(atual.cooperacao).toBe(30);
    expect(resultado.cooperacao).toBe(40);
    expect(atual).not.toBe(resultado);
  });

  it('trata delta vazio como identidade', () => {
    const atual = baseIndicadores();
    const resultado = aplicarDelta(atual, {});
    expect(resultado).toEqual(atual);
  });
});

// ---------------------------------------------------------------------------
// validarAcao
// ---------------------------------------------------------------------------

describe('validarAcao', () => {
  it('nega quando custo excede o limite de ações do estágio e diz quanto resta', () => {
    const acao = acaoBasica({ custo_acoes: 2 });
    const resultado = validarAcao({
      acao,
      indicadores: baseIndicadores(),
      pistasTags: [['producao', 'mercado']],
      acoesUsadas: 3,
      maxAcoesPorEstagio: 4,
    });
    expect(resultado.ok).toBe(false);
    expect(resultado.motivo).toBe('Esta ação custa 2 e você tem 1 restante.');
  });

  it('nega quando ação exige pista com tag e nenhuma pista corresponde', () => {
    const acao = acaoBasica({
      requisito_tags: ['tecnologia', 'conectividade'],
    });
    const resultado = validarAcao({
      acao,
      indicadores: baseIndicadores(),
      pistasTags: [['producao', 'mercado']],
      acoesUsadas: 0,
    });
    expect(resultado.ok).toBe(false);
    expect(resultado.motivo).toBe(
      'Investigue ou receba uma descoberta com essa característica antes.',
    );
  });

  it('passa quando a equipe tem pista com tag requerida', () => {
    const acao = acaoBasica({
      requisito_tags: ['tecnologia', 'conectividade'],
    });
    const resultado = validarAcao({
      acao,
      indicadores: baseIndicadores(),
      pistasTags: [['producao', 'tecnologia']],
      acoesUsadas: 0,
    });
    expect(resultado.ok).toBe(true);
    expect(resultado.motivo).toBeUndefined();
  });

  it('passa quando requisito_tags é vazio (sem pré-requisito)', () => {
    const acao = acaoBasica({ requisito_tags: [] });
    const resultado = validarAcao({
      acao,
      indicadores: baseIndicadores(),
      pistasTags: [],
      acoesUsadas: 3,
    });
    expect(resultado.ok).toBe(true);
  });

  it('passa quando custo cabe no limite', () => {
    const acao = acaoBasica({ custo_acoes: 1 });
    const resultado = validarAcao({
      acao,
      indicadores: baseIndicadores(),
      pistasTags: [],
      acoesUsadas: 3,
      maxAcoesPorEstagio: 4,
    });
    expect(resultado.ok).toBe(true);
  });

  it('aceita custo exato no limite (cabe por igualdade)', () => {
    const acao = acaoBasica({ custo_acoes: 2 });
    const resultado = validarAcao({
      acao,
      indicadores: baseIndicadores(),
      pistasTags: [],
      acoesUsadas: 2,
      maxAcoesPorEstagio: 4,
    });
    expect(resultado.ok).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// validarAcao · limite de 7 ações (regressão do contrato compartilhado)
// ---------------------------------------------------------------------------

describe('validarAcao · limite de ações do estágio (MAX_ACOES_POR_ESTAGIO)', () => {
  it('o limite compartilhado é 7, não 4', () => {
    expect(MAX_ACOES_POR_ESTAGIO).toBe(7);
  });

  it('a 7ª ação do estágio é aceita com o limite padrão', () => {
    const resultado = validarAcao({
      acao: acaoBasica({ custo_acoes: 1 }),
      indicadores: baseIndicadores(),
      pistasTags: [],
      acoesUsadas: MAX_ACOES_POR_ESTAGIO - 1,
    });
    expect(resultado.ok).toBe(true);
    expect(resultado.motivo).toBeUndefined();
  });

  it('a 8ª ação é recusada e o motivo nomeia o limite do estágio', () => {
    const resultado = validarAcao({
      acao: acaoBasica({ custo_acoes: 1 }),
      indicadores: baseIndicadores(),
      pistasTags: [],
      acoesUsadas: MAX_ACOES_POR_ESTAGIO,
    });
    expect(resultado.ok).toBe(false);
    expect(resultado.motivo).toBe('Você usou as 7 ações deste estágio.');
    expect(resultado.motivo).toContain(String(MAX_ACOES_POR_ESTAGIO));
  });

  it('a 8ª ação é recusada mesmo com o limite padrão implícito (não só com override)', () => {
    // Sem `maxAcoesPorEstagio`: prova que o default da engine é o mesmo
    // constante que o painel do professor mostra.
    const resultado = validarAcao({
      acao: acaoBasica({ custo_acoes: 1 }),
      indicadores: baseIndicadores(),
      pistasTags: [],
      acoesUsadas: 7,
    });
    expect(resultado.ok).toBe(false);
    expect(resultado.motivo).toBe('Você usou as 7 ações deste estágio.');
  });

  it('ação de custo 2 com 6 ações usadas é recusada informando o que sobra', () => {
    const resultado = validarAcao({
      acao: acaoBasica({ custo_acoes: 2 }),
      indicadores: baseIndicadores(),
      pistasTags: [],
      acoesUsadas: 6,
    });
    expect(resultado.ok).toBe(false);
    expect(resultado.motivo).toBe('Esta ação custa 2 e você tem 1 restante.');
  });

  it('ação de custo 2 cabe exatamente quando restam 2 (5 usadas, faltando 2 ações)', () => {
    const resultado = validarAcao({
      acao: acaoBasica({ custo_acoes: 2 }),
      indicadores: baseIndicadores(),
      pistasTags: [],
      acoesUsadas: 5,
    });
    expect(resultado.ok).toBe(true);
  });

  it('estado já além do limite continua sendo recusado com a mesma frase (sem crash)', () => {
    for (const usadas of [8, 12, 40]) {
      const resultado = validarAcao({
        acao: acaoBasica({ custo_acoes: 1 }),
        indicadores: baseIndicadores(),
        pistasTags: [],
        acoesUsadas: usadas,
      });
      expect(resultado.ok, `com ${usadas} ações usadas a ação passou`).toBe(false);
      expect(resultado.motivo).toBe('Você usou as 7 ações deste estágio.');
    }
  });

  it('o limite de ações é avaliado ANTES do pré-requisito de pista (motivo coerente)', () => {
    // Se o pré-requisito falhasse primeiro, o professor leria "falta uma pista"
    // numa equipe que já esgotou o estágio — o erro real é outro.
    const resultado = validarAcao({
      acao: acaoBasica({ custo_acoes: 1, requisito_tags: ['tecnologia'] }),
      indicadores: baseIndicadores(),
      pistasTags: [],
      acoesUsadas: MAX_ACOES_POR_ESTAGIO,
    });
    expect(resultado.ok).toBe(false);
    expect(resultado.motivo).toContain('7 ações');
  });
});

// ---------------------------------------------------------------------------
// acaoResultado
// ---------------------------------------------------------------------------

describe('acaoResultado', () => {
  it('retorna efeitos aplicados via aplicarDelta', () => {
    const indicadores = baseIndicadores();
    const acao = acaoBasica({ efeitos: { cooperacao: 5, conhecimento: 3 } });
    const resultado = acaoResultado(indicadores, acao);
    expect(resultado.efeitos.cooperacao).toBe(55);
    expect(resultado.efeitos.conhecimento).toBe(53);
  });

  it('gera aviso quando indicador atinge o teto', () => {
    const indicadores = baseIndicadores({ cooperacao: 98 });
    const acao = acaoBasica({ efeitos: { cooperacao: 5 } });
    const resultado = acaoResultado(indicadores, acao);
    expect(resultado.efeitos.cooperacao).toBe(100);
    expect(resultado.aviso).toContain('atingiu o valor máximo');
  });

  it('gera aviso quando indicador atinge o piso', () => {
    const indicadores = baseIndicadores({ mercado: 2 });
    const acao = acaoBasica({ efeitos: { mercado: -5 } });
    const resultado = acaoResultado(indicadores, acao);
    expect(resultado.efeitos.mercado).toBe(0);
    expect(resultado.aviso).toContain('atingiu o valor mínimo');
  });

  it('não gera aviso quando nenhum indicador satura', () => {
    const indicadores = baseIndicadores();
    const acao = acaoBasica();
    const resultado = acaoResultado(indicadores, acao);
    expect(resultado.aviso).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// sortearEventos
// ---------------------------------------------------------------------------

describe('sortearEventos', () => {
  const pool = ['ev-a', 'ev-b', 'ev-c', 'ev-d', 'ev-e', 'ev-f'];

  it('mesma semente + mesmo pool = mesma ordem (determinístico)', () => {
    const primeiro = sortearEventos('partida-42', pool, 3);
    const segundo = sortearEventos('partida-42', pool, 3);
    expect(primeiro).toEqual(segundo);
  });

  it('semente diferente = ordem diferente', () => {
    const primeiro = sortearEventos('partida-42', pool, 6);
    const segundo = sortearEventos('partida-99', pool, 6);
    // Com pool de 6 e sortear todos, é possível que sejam iguais em
    // raras colisões, mas a probabilidade é baixa. Testamos que são arrays
    // de tamanho correto no mínimo.
    expect(primeiro).toHaveLength(6);
    expect(segundo).toHaveLength(6);
    // E ao menos em algum caso as ordens divergem.
    let divergiu = false;
    for (let i = 0; i < 6; i++) {
      if (primeiro[i] !== segundo[i]) { divergiu = true; break; }
    }
    expect(divergiu).toBe(true);
  });

  it('retorna a quantidade certa de elementos', () => {
    const resultado = sortearEventos('s-1', pool, 3);
    expect(resultado).toHaveLength(3);
  });

  it('não contém duplicatas (subconjunto do pool)', () => {
    const resultado = sortearEventos('s-2', pool, 4);
    const unicos = new Set(resultado);
    expect(unicos.size).toBe(4);
    for (const item of resultado) {
      expect(pool).toContain(item);
    }
  });

  it('quantidade > pool.length retorna o pool inteiro', () => {
    const resultado = sortearEventos('s-3', pool, 10);
    expect(resultado).toHaveLength(6);
  });

  it('quantidade 0 retorna array vazio', () => {
    expect(sortearEventos('s-4', pool, 0)).toEqual([]);
  });

  it('pool vazio retorna array vazio', () => {
    expect(sortearEventos('s-5', [], 3)).toEqual([]);
  });

  it('não embaralha o pool recebido (imutabilidade)', () => {
    const original = pool.slice();
    sortearEventos('s-imutavel', pool, 4);
    expect(pool).toEqual(original);
  });
});

// ---------------------------------------------------------------------------
// eventoContribuicao
// ---------------------------------------------------------------------------

describe('eventoContribuicao', () => {
  it('combina efeitos individuais + coletivos e retorna deltas', () => {
    const indicadores = baseIndicadores();
    const opcao = {
      key: 'opt-a',
      rotulo: 'Opção A',
      detalhe: 'Detalhe',
      efeitos: { cooperacao: 10, mercado: -5 },
      tags: ['producao'] as TagOficina[],
    };
    const efeitoColetivo: Partial<OficinaIndicadores> = { confianca: 3 };

    const deltas = eventoContribuicao(indicadores, opcao, efeitoColetivo);

    expect(deltas.cooperacao).toBe(10);
    expect(deltas.mercado).toBe(-5);
    expect(deltas.confianca).toBe(3);
    expect(deltas.organizacao).toBeUndefined();
  });

  it('clampa corretamente quando a soma ultrapassa limites', () => {
    const indicadores = baseIndicadores({ cooperacao: 95 });
    const opcao = {
      key: 'opt-b',
      rotulo: 'Opção B',
      detalhe: 'Detalhe',
      efeitos: { cooperacao: 10 },
      tags: [] as TagOficina[],
    };

    const deltas = eventoContribuicao(indicadores, opcao, {});

    // 95 + 10 = 105 → clampeado para 100, delta = 5.
    expect(deltas.cooperacao).toBe(5);
  });

  it('efeito que zera um indicador retorna o delta real (2 → 0 = -2)', () => {
    const indicadores = baseIndicadores({ conhecimento: 2 });
    const opcao = {
      key: 'opt-c',
      rotulo: 'Opção C',
      detalhe: 'Detalhe',
      efeitos: { conhecimento: -2 },
      tags: [] as TagOficina[],
    };

    const deltas = eventoContribuicao(indicadores, opcao, {});

    expect(deltas.conhecimento).toBe(-2);
  });
});

// ---------------------------------------------------------------------------
// coerenciaSolucao
// ---------------------------------------------------------------------------

describe('coerenciaSolucao', () => {
  // 3 cartões de opção fechada, cobertura calculável de cabeça.
  const cartoes: OficinaCartao[] = [
    {
      bloco: 'problema_principal',
      campo_livre: false,
      opcoes: [
        { key: 'p1', rotulo: 'Falta de água', tags: ['sustentabilidade', 'producao'] },
        { key: 'p2', rotulo: 'Estrada ruim', tags: ['logistica'] },
      ],
    },
    {
      bloco: 'recursos',
      campo_livre: false,
      opcoes: [
        { key: 'r1', rotulo: 'Irrigação por gotejamento', tags: ['sustentabilidade', 'tecnologia'] },
        { key: 'r2', rotulo: 'Trator compartilhado', tags: ['organizacao', 'logistica'] },
      ],
    },
    {
      bloco: 'capacitacao',
      campo_livre: false,
      opcoes: [
        { key: 'c1', rotulo: 'Curso de manejo', tags: ['capacitacao', 'producao'] },
        { key: 'c2', rotulo: 'Feira de troca', tags: ['mercado', 'organizacao'] },
      ],
    },
  ];

  const problemaTags: TagOficina[] = ['sustentabilidade', 'producao'];

  it('solução bem alinhada e completa chega ao máximo sem estourar 100', () => {
    const resultado = coerenciaSolucao(
      solucaoDe({ problema_principal: 'p1', recursos: 'r1', capacitacao: 'c1' }),
      problemaTags,
      cartoes,
    );
    expect(resultado.alinhados).toEqual(['problema_principal', 'recursos', 'capacitacao']);
    expect(resultado.desalinhados).toEqual([]);
    expect(resultado.avisos).toEqual([]);
    // 70 × 3/3 + 30 × 3/3 = 100: o teto agora é consequência da fórmula, não clamp.
    expect(resultado.score).toBe(100);
    expect(resultado.score).toBeLessThanOrEqual(100);
  });

  it('bloco desalinhado gera aviso mas NÃO bloqueia', () => {
    const resultado = coerenciaSolucao(
      solucaoDe({ recursos: 'r2' }), // r2 = [organizacao, logistica], nada em comum com problemaTags
      problemaTags,
      cartoes,
    );
    expect(resultado.desalinhados).toContain('recursos');
    expect(resultado.avisos.length).toBeGreaterThan(0);
    expect(resultado.avisos[0]).toContain('conversam pouco');
    // Nunca rotula "certo/errado".
    expect(resultado.avisos.join(' ')).not.toMatch(/\bcerto\b/i);
    expect(resultado.avisos.join(' ')).not.toMatch(/\berrado\b/i);
  });

  it('o score respeita a proporção 70 alinhamento / 30 completude', () => {
    const doisAlinhados = coerenciaSolucao(
      solucaoDe({ problema_principal: 'p1', recursos: 'r1' }),
      problemaTags,
      cartoes,
    );
    const doisDesalinhados = coerenciaSolucao(
      solucaoDe({ problema_principal: 'p2', recursos: 'r2' }),
      problemaTags,
      cartoes,
    );
    const tresAlinhados = coerenciaSolucao(
      solucaoDe({ problema_principal: 'p1', recursos: 'r1', capacitacao: 'c1' }),
      problemaTags,
      cartoes,
    );

    expect(doisAlinhados.score).toBe(90); // 70 × 1 + 30 × 2/3
    expect(doisDesalinhados.score).toBe(20); // 70 × 0 + 30 × 2/3
    expect(tresAlinhados.score).toBe(100); // 70 × 1 + 30 × 1

    // Mesma completude, alinhamento 0 vs 1 → exatamente o peso de 70.
    expect(doisAlinhados.score - doisDesalinhados.score).toBe(70);
    // Alinhamento mantido, completude de 2/3 para 3/3 → exatamente 30 × 1/3.
    expect(tresAlinhados.score - doisAlinhados.score).toBe(10);
  });

  it('encher todos os campos sem acertar o encadeamento rende só o eixo de completude', () => {
    const resultado = coerenciaSolucao(
      solucaoDe({ problema_principal: 'p2', recursos: 'r2', capacitacao: 'c2' }),
      problemaTags,
      cartoes,
    );
    expect(resultado.alinhados).toEqual([]);
    expect(resultado.desalinhados).toHaveLength(3);
    expect(resultado.score).toBe(30); // 70 × 0 + 30 × 1
  });

  it('solução vazia pontua 0 — o score deixou de ter piso artificial de 50', () => {
    const resultado = coerenciaSolucao(solucaoDe({}), problemaTags, cartoes);
    expect(resultado.score).toBe(0);
    expect(resultado.alinhados).toEqual([]);
    expect(resultado.desalinhados).toEqual([]);
    expect(resultado.blocosDesconhecidos).toEqual([]);
    expect(resultado.camposLivres).toEqual([]);
    expect(resultado.avisos).toEqual([]);
  });

  it('sem cartões a engine devolve 0 sem lançar', () => {
    const resultado = coerenciaSolucao(solucaoDe({ recursos: 'r1' }), problemaTags, []);
    expect(resultado.score).toBe(0);
    expect(resultado.blocosDesconhecidos).toEqual(['recursos']);
  });

  it('problemaEscolhido saiu da assinatura: as tags vêm só do 2º argumento', () => {
    // Regressão do contrato antigo, que aceitava 4 parâmetros e resolvia o
    // problema por id de pista — o 4º argumento não existe mais.
    expect(coerenciaSolucao).toHaveLength(3);
  });
});

// ---------------------------------------------------------------------------
// coerenciaSolucao · diagnóstico (chave inválida e campo livre)
// ---------------------------------------------------------------------------

describe('coerenciaSolucao · diagnóstico de entrada inválida', () => {
  const cartoes: OficinaCartao[] = [
    {
      bloco: 'problema_principal',
      campo_livre: true,
      opcoes: [{ key: 'a', rotulo: 'Falta de água', tags: ['producao', 'sustentabilidade'] }],
    },
    {
      bloco: 'recursos',
      campo_livre: false,
      opcoes: [
        { key: 'r1', rotulo: 'Irrigação por gotejamento', tags: ['producao'] },
        { key: 'r2', rotulo: 'Câmara fria da cooperativa', tags: ['producao'] },
      ],
    },
  ];

  const tags: TagOficina[] = ['producao'];

  it('chave de opção inválida num cartão fechado vira diagnóstico, não exceção', () => {
    let resultado!: ReturnType<typeof coerenciaSolucao>;
    expect(() => {
      resultado = coerenciaSolucao(solucaoDe({ recursos: 'r9' }), tags, cartoes);
    }).not.toThrow();
    expect(resultado.blocosDesconhecidos).toEqual(['recursos']);
    expect(resultado.alinhados).toEqual([]);
    expect(resultado.desalinhados).toEqual([]);
    expect(resultado.avisos.join(' ')).toContain('fora dos cartões');
  });

  it('bloco que não existe em nenhum cartão também vira diagnóstico nomeado', () => {
    const resultado = coerenciaSolucao(
      solucaoDe({ transporte: 'contratar_frete', recursos: 'r1' }),
      tags,
      cartoes,
    );
    expect(resultado.blocosDesconhecidos).toEqual(['transporte']);
    expect(resultado.alinhados).toEqual(['recursos']);
    // A chave inventada não polui o alinhamento dos blocos válidos.
    expect(resultado.score).toBe(Math.round(70 * 1 + 30 * (2 / 2)));
  });

  it('chave inválida + campo livre vazio: diagnostica a chave e NÃO lança', () => {
    const solucao = solucaoDe({ problema_principal: '   ', transporte: 'contratar_frete' });
    let resultado!: ReturnType<typeof coerenciaSolucao>;
    expect(() => {
      resultado = coerenciaSolucao(solucao, tags, cartoes);
    }).not.toThrow();
    expect(resultado.blocosDesconhecidos).toEqual(['transporte']);
    expect(resultado.avisos.join(' ')).toContain('fora dos cartões');
    expect(resultado.desalinhados).toEqual([]);
  });

  it('campo livre preenchido entra em camposLivres e fica fora do julgamento por tag', () => {
    const resultado = coerenciaSolucao(
      solucaoDe({ problema_principal: 'A falta de água acaba no fim da estrada.' }),
      tags,
      cartoes,
    );
    expect(resultado.camposLivres).toEqual(['problema_principal']);
    expect(resultado.alinhados).toEqual([]);
    expect(resultado.desalinhados).toEqual([]);
    expect(resultado.blocosDesconhecidos).toEqual([]);
  });

  it('campo livre em branco é ignorado em silêncio (diferença de diagnóstico)', () => {
    const preenchido = coerenciaSolucao(
      solucaoDe({ problema_principal: 'texto qualquer' }),
      tags,
      cartoes,
    );
    const emBranco = coerenciaSolucao(solucaoDe({ problema_principal: '   ' }), tags, cartoes);
    expect(preenchido.camposLivres).toEqual(['problema_principal']);
    expect(emBranco.camposLivres).toEqual([]);
    expect(emBranco.blocosDesconhecidos).toEqual([]);
    // Nenhum dos dois joga na alinhados/desalinhados: campo livre não é julgado.
    expect(preenchido.avisos).toEqual(emBranco.avisos);
  });

  it('aviso dedicado quando nenhum cartão fechado foi preenchido', () => {
    const resultado = coerenciaSolucao(
      solucaoDe({ problema_principal: 'texto', transporte: 'x' }),
      tags,
      cartoes,
    );
    expect(resultado.avisos.join(' ')).toContain('Nenhum cartão de opção fechada foi preenchido');
    expect(resultado.avisos.join(' ')).toContain('fora dos cartões');
  });

  it('o mesmo valor inválido é tratado diferente conforme o cartão ser livre ou fechado', () => {
    // Chave que não existe em opção alguma: no cartão fechado vira diagnóstico;
    // no cartão de campo livre é aceita sem aviso. Comportamento assimétrico
    // que este teste fixa para não mudar de forma silenciosa.
    const noLivre = coerenciaSolucao(solucaoDe({ problema_principal: 'zzz' }), tags, cartoes);
    const noFechado = coerenciaSolucao(solucaoDe({ recursos: 'zzz' }), tags, cartoes);
    expect(noFechado.blocosDesconhecidos).toEqual(['recursos']);
    expect(noLivre.blocosDesconhecidos).toEqual([]);
    expect(noLivre.camposLivres).toEqual(['problema_principal']);
  });
});

// ---------------------------------------------------------------------------
// coerenciaSolucao · conteúdo real (via avaliarCoerencia do service)
// ---------------------------------------------------------------------------

describe('coerenciaSolucao · conteúdo real da oficina', () => {
  const cartoes = OFICINA_CONTENT.cartoes;

  it('escolher a opção que conversa com o problema alinha os cartões seguintes', () => {
    // 'c' em problema_principal = conectividade + tecnologia.
    const resultado = coerenciaSolucao(
      solucaoDe({ problema_principal: 'c', tecnologia_ferramenta: 'b' }),
      ['conectividade', 'tecnologia'],
      cartoes,
    );
    expect(resultado.alinhados).toContain('tecnologia_ferramenta');
    expect(resultado.desalinhados).toEqual([]);
  });

  it('descrever o problema em texto livre degrada o alinhamento de todo cartão fechado', () => {
    const porChave = avaliarCoerencia(
      solucaoDe({ problema_principal: 'c', tecnologia_ferramenta: 'b' }),
    );
    const porTexto = avaliarCoerencia(
      solucaoDe({ problema_principal: 'O sinal cai no fim da estrada', tecnologia_ferramenta: 'b' }),
    );
    expect(porChave.alinhados).toContain('tecnologia_ferramenta');
    expect(porTexto.desalinhados).toContain('tecnologia_ferramenta');
    expect(porTexto.score).toBeLessThan(porChave.score);
  });

  it('uma solução real completa e coerente com o conteúdo pontua alto', () => {
    // Problema 'c' = conectividade + tecnologia. Apenas 4 cartões têm opções
    // com essas tags: recursos(c), tecnologia_ferramenta(b), capacitacao(c),
    // risco_principal(c). problema_principal e acompanhamento são campo_livre
    // (não julgados). Total julgado: 11 blocos.
    const blocos: Partial<Record<OficinaBlocoSolucao, string>> = {
      problema_principal: 'c',
      recursos: 'c',
      transporte: 'a',
      tecnologia_ferramenta: 'b',
      comercializacao: 'b',
      capacitacao: 'c',
      politica_publica: 'a',
      risco_principal: 'c',
      impacto_ambiental: 'b',
      acompanhamento: 'a',
      publico_beneficiado: 'd',
      parceiros: 'b',
      impacto_social: 'c',
    };
    const solucao = solucaoDe(blocos);
    const resultado = avaliarCoerencia(solucao);
    expect(resultado.blocosDesconhecidos).toEqual([]);
    expect(resultado.alinhados.length).toBe(4);
    expect(resultado.desalinhados.length).toBe(7);
    expect(resultado.score).toBe(55);
  });
});

// ---------------------------------------------------------------------------
// derivarMarcadores
// ---------------------------------------------------------------------------

describe('derivarMarcadores', () => {
  const cartoes = OFICINA_CONTENT.cartoes;

  function comSolucao(
    blocos: Partial<Record<OficinaBlocoSolucao, string>>,
    extras: Partial<{
      acoesExecutadas: OficinaAcaoKey[];
      acaoTags: TagOficina[];
      compartilhou: boolean;
    }> = {},
  ): string[] {
    return derivarMarcadores({
      solucao: solucaoDe(blocos),
      cartoes,
      acoesExecutadas: extras.acoesExecutadas ?? [],
      acaoTags: extras.acaoTags ?? [],
      compartilhou: extras.compartilhou ?? false,
    });
  }

  it('não deriva nada quando a equipe não fez nada', () => {
    const marcadores = derivarMarcadores({
      solucao: null,
      cartoes,
      acoesExecutadas: [],
      acaoTags: [],
      compartilhou: false,
    });
    expect(marcadores).toEqual([]);
  });

  it('solução com tecnologia escolhida → tecnologia_usada', () => {
    const marcadores = comSolucao({ tecnologia_ferramenta: 'b' });
    expect(marcadores).toContain('tecnologia_usada');
  });

  it('opção que não é tecnológica não gera tecnologia_usada', () => {
    const marcadores = comSolucao({ comercializacao: 'a' }); // tags: [mercado]
    expect(marcadores).not.toContain('tecnologia_usada');
  });

  it('ação executada com tag de capacitação → capacitacao_feita', () => {
    const acao = OFICINA_CONTENT.acoes.find((a) => a.key === 'capacitacao');
    expect(acao, 'conteúdo sem a ação de capacitação').toBeDefined();
    const marcadores = derivarMarcadores({
      solucao: null,
      cartoes,
      acoesExecutadas: ['capacitacao'],
      acaoTags: acao!.tags,
      compartilhou: false,
    });
    expect(marcadores).toContain('capacitacao_feita');
  });

  it('ação com tag de conectividade também conta como tecnologia_usada', () => {
    const marcadores = derivarMarcadores({
      solucao: null,
      cartoes,
      acoesExecutadas: ['apoio_tecnico'],
      acaoTags: ['politicas', 'conectividade'],
      compartilhou: false,
    });
    expect(marcadores).toContain('tecnologia_usada');
  });

  it('bloco de capacitação preenchido na solução também gera o marcador', () => {
    const marcadores = comSolucao({ capacitacao: 'a' });
    expect(marcadores).toContain('capacitacao_feita');
  });

  it('bloco de Parceiros preenchido → solucao_conjunta', () => {
    const marcadores = comSolucao({ parceiros: 'c' });
    expect(marcadores).toContain('solucao_conjunta');
  });

  it('ação solucao_conjunta gera solucao_conjunta sem passar pela solução', () => {
    const marcadores = comSolucao({}, { acoesExecutadas: ['solucao_conjunta'] });
    expect(marcadores).toContain('solucao_conjunta');
  });

  it('escolha ambiental → cuidado_ambiental', () => {
    expect(comSolucao({ impacto_ambiental: 'b' })).toContain('cuidado_ambiental');
  });

  it('escolha de público inclusivo → publico_prioritario', () => {
    expect(comSolucao({ publico_beneficiado: 'd' })).toContain('publico_prioritario');
  });

  it('equipe que compartilhou pista → pista_compartilhada', () => {
    const marcadores = comSolucao({}, { compartilhou: true });
    expect(marcadores).toContain('pista_compartilhada');
  });

  it('equipe que não compartilhou não recebe o marcador de colaboração', () => {
    expect(comSolucao({})).not.toContain('pista_compartilhada');
  });

  it('solução com os 13 blocos preenchidos → plano_completo', () => {
    const blocos: Partial<Record<OficinaBlocoSolucao, string>> = {};
    for (const cartao of cartoes) {
      blocos[cartao.bloco] = cartao.campo_livre ? 'texto da equipe' : cartao.opcoes[0]!.key;
    }
    expect(Object.keys(blocos)).toHaveLength(13);
    const marcadores = comSolucao(blocos);
    expect(marcadores).toContain('plano_completo');
  });

  it('faltando um único bloco já tira o plano_completo', () => {
    const blocos: Partial<Record<OficinaBlocoSolucao, string>> = {};
    for (const cartao of cartoes) {
      blocos[cartao.bloco] = cartao.campo_livre ? 'texto da equipe' : cartao.opcoes[0]!.key;
    }
    blocos.risco_principal = '   ';
    expect(comSolucao(blocos)).not.toContain('plano_completo');
  });

  it('nunca devolve marcadores repetidos nem fora do catálogo', () => {
    const blocos: Partial<Record<OficinaBlocoSolucao, string>> = {};
    for (const cartao of cartoes) {
      blocos[cartao.bloco] = cartao.campo_livre ? 'texto da equipe' : cartao.opcoes[0]!.key;
    }
    const marcadores = derivarMarcadores({
      solucao: solucaoDe(blocos),
      cartoes,
      acoesExecutadas: ['capacitacao', 'solucao_conjunta', 'apoio_tecnico'],
      acaoTags: ['capacitacao', 'tecnologia', 'conectividade'],
      compartilhou: true,
    });
    expect(new Set(marcadores).size).toBe(marcadores.length);
    for (const marcador of marcadores) {
      expect(Object.keys(OFICINA_MARCADORES_INFO), `marcador fora do catálogo: ${marcador}`).toContain(
        marcador,
      );
    }
  });
});

// ---------------------------------------------------------------------------
// calcularResultados
// ---------------------------------------------------------------------------

describe('calcularResultados', () => {
  const cartoes: OficinaCartao[] = [];
  const tagsVazio: Record<string, TagOficina[]> = {};

  /**
   * Seis equipes desenhadas para que cada uma domine exatamente uma categoria.
   * Sem elas, todas começariam do mesmo indicador base e o desempate antigo
   * jogava as seis na mesma categoria.
   */
  const EQUIPES_DISTINTAS: Equipe[] = [
    {
      team_id: 'equipe-viavel',
      marcadores: ['plano_completo'],
      indicadores: {
        cooperacao: 30, organizacao: 90, mercado: 85, conhecimento: 30,
        sustentabilidade: 30, confianca: 30, inclusao: 30, viabilidade: 95,
      },
    },
    {
      team_id: 'equipe-colaborativa',
      marcadores: ['pista_compartilhada'],
      indicadores: {
        cooperacao: 80, organizacao: 20, mercado: 20, conhecimento: 40,
        sustentabilidade: 20, confianca: 70, inclusao: 20, viabilidade: 20,
      },
    },
    {
      team_id: 'equipe-inclusiva',
      marcadores: ['publico_prioritario'],
      indicadores: {
        cooperacao: 20, organizacao: 20, mercado: 20, conhecimento: 20,
        sustentabilidade: 20, confianca: 70, inclusao: 95, viabilidade: 20,
      },
    },
    {
      team_id: 'equipe-sustentavel',
      marcadores: ['cuidado_ambiental'],
      indicadores: {
        cooperacao: 15, organizacao: 15, mercado: 15, conhecimento: 15,
        sustentabilidade: 95, confianca: 15, inclusao: 15, viabilidade: 50,
      },
    },
    {
      team_id: 'equipe-inovadora',
      marcadores: ['tecnologia_usada'],
      indicadores: {
        cooperacao: 15, organizacao: 50, mercado: 15, conhecimento: 95,
        sustentabilidade: 15, confianca: 15, inclusao: 15, viabilidade: 15,
      },
    },
    {
      team_id: 'equipe-comunidade',
      marcadores: ['plano_completo'],
      indicadores: {
        cooperacao: 60, organizacao: 60, mercado: 60, conhecimento: 60,
        sustentabilidade: 60, confianca: 60, inclusao: 60, viabilidade: 60,
      },
    },
  ];

  function seisEquipes(
    ajustar?: (teamId: string, marcadores: string[]) => string[],
  ): Equipe[] {
    return EQUIPES_DISTINTAS.map((e) => ({
      ...e,
      marcadores: ajustar ? ajustar(e.team_id, e.marcadores) : e.marcadores,
    }));
  }

  it('retorna uma categoria por time', () => {
    const equipes = [
      { team_id: 'alpha', indicadores: baseIndicadores(), marcadores: [] },
      { team_id: 'beta', indicadores: baseIndicadores(), marcadores: [] },
    ];
    const resultado = calcularResultados(equipes, cartoes, tagsVazio);
    expect(resultado).toHaveLength(2);
    expect(resultado[0].team_id).toBe('alpha');
    expect(resultado[1].team_id).toBe('beta');
    expect(resultado[0].categoria).not.toBe(resultado[1].categoria);
  });

  it('nota está no intervalo 0..100', () => {
    const equipes = [
      { team_id: 'a', indicadores: baseIndicadores(), marcadores: [] },
    ];
    const resultado = calcularResultados(equipes, cartoes, tagsVazio);
    for (const r of resultado) {
      expect(r.nota).toBeGreaterThanOrEqual(0);
      expect(r.nota).toBeLessThanOrEqual(100);
    }
  });

  it('é determinístico: duas execuções iguais produzem mesmo resultado', () => {
    const equipes = [
      { team_id: 'gamma', indicadores: baseIndicadores({ viabilidade: 80 }), marcadores: ['tecnologia_usada'] },
      { team_id: 'delta', indicadores: baseIndicadores({ sustentabilidade: 90 }), marcadores: [] },
    ];
    const primeiro = calcularResultados(equipes, cartoes, tagsVazio);
    const segundo = calcularResultados(equipes, cartoes, tagsVazio);
    expect(primeiro).toEqual(segundo);
  });

  it('nenhuma lista de equipes produz resultado vazio com equipes presentes', () => {
    expect(calcularResultados([], cartoes, tagsVazio)).toEqual([]);
  });

  it('empates idênticos NÃO caem todos na mesma categoria (regressão do desempate antigo)', () => {
    // Seis equipes byte-a-byte iguais: era exatamente este cenário que
    // produzia seis linhas com 'mais_viability'.
    const equipes: Equipe[] = ['aaa', 'bbb', 'ccc', 'ddd', 'eee', 'fff'].map((team_id) => ({
      team_id,
      indicadores: baseIndicadores(),
      marcadores: [],
    }));
    const resultado = calcularResultados(equipes, cartoes, tagsVazio);

    expect(resultado).toHaveLength(6);
    expect(new Set(resultado.map((r) => r.categoria)).size).toBe(6);
    expect(new Set(resultado.map((r) => r.team_id)).size).toBe(6);
    expect(resultado.map((r) => r.team_id)).toEqual(['aaa', 'bbb', 'ccc', 'ddd', 'eee', 'fff']);
  });

  it('6 equipes diferentes recebem 6 categorias diferentes, uma para cada', () => {
    const resultado = calcularResultados(seisEquipes(), cartoes, tagsVazio);

    expect(resultado).toHaveLength(6);
    expect(resultado.map((r) => r.categoria)).toEqual(OFICINA_CATEGORIAS_ORDEM);
    expect(new Set(resultado.map((r) => r.team_id)).size).toBe(6);
    for (const r of resultado) {
      expect(resultado.filter((outro) => outro.team_id === r.team_id)).toHaveLength(1);
      expect(resultado.filter((outro) => outro.categoria === r.categoria)).toHaveLength(1);
    }
  });

  it('cada categoria vai para a equipe que realmente a mereceu (notas sem clamp)', () => {
    const resultado = calcularResultados(seisEquipes(), cartoes, tagsVazio);

    expect(categoriaDe(resultado, 'equipe-viavel')).toBe('mais_viavel');
    expect(notaDe(resultado, 'equipe-viavel')).toBe(93); // 95*.4 + 90*.25 + 85*.15 + 20

    expect(categoriaDe(resultado, 'equipe-colaborativa')).toBe('mais_colaborativa');
    expect(notaDe(resultado, 'equipe-colaborativa')).toBe(81); // 80*.35 + 70*.2 + 40*.1 + 35

    expect(categoriaDe(resultado, 'equipe-inclusiva')).toBe('mais_inclusiva');
    expect(notaDe(resultado, 'equipe-inclusiva')).toBe(92); // 95*.45 + 70*.2 + 35

    expect(categoriaDe(resultado, 'equipe-sustentavel')).toBe('mais_sustentavel');
    expect(notaDe(resultado, 'equipe-sustentavel')).toBe(90); // 95*.5 + 50*.15 + 35

    expect(categoriaDe(resultado, 'equipe-inovadora')).toBe('mais_inovadora');
    expect(notaDe(resultado, 'equipe-inovadora')).toBe(74); // 95*.3 + 50*.1 + 40

    expect(categoriaDe(resultado, 'equipe-comunidade')).toBe('destaque_comunidade');
    expect(notaDe(resultado, 'equipe-comunidade')).toBe(66); // 60*.85 + 15
  });

  it('o marcador tecnologia_usada vale exatamente 40 pontos em mais_inovadora', () => {
    const comMarcador = calcularResultados(seisEquipes(), cartoes, tagsVazio);
    const semMarcador = calcularResultados(
      seisEquipes((id, m) => (id === 'equipe-inovadora' ? [] : m)),
      cartoes,
      tagsVazio,
    );
    // A categoria não muda: a diferença isola o bônus do marcador.
    expect(categoriaDe(semMarcador, 'equipe-inovadora')).toBe('mais_inovadora');
    expect(notaDe(comMarcador, 'equipe-inovadora')).toBe(74);
    expect(notaDe(semMarcador, 'equipe-inovadora')).toBe(34);
    expect(notaDe(comMarcador, 'equipe-inovadora') - notaDe(semMarcador, 'equipe-inovadora')).toBe(40);
  });

  it('o marcador pista_compartilhada vale exatamente 35 pontos em mais_colaborativa', () => {
    const comMarcador = calcularResultados(seisEquipes(), cartoes, tagsVazio);
    const semMarcador = calcularResultados(
      seisEquipes((id, m) => (id === 'equipe-colaborativa' ? [] : m)),
      cartoes,
      tagsVazio,
    );
    expect(categoriaDe(semMarcador, 'equipe-colaborativa')).toBe('mais_colaborativa');
    expect(notaDe(comMarcador, 'equipe-colaborativa')).toBe(81);
    expect(notaDe(semMarcador, 'equipe-colaborativa')).toBe(46);
    expect(notaDe(comMarcador, 'equipe-colaborativa') - notaDe(semMarcador, 'equipe-colaborativa')).toBe(35);
  });

  it('mais_viavel usa viab*.4 + org*.25 + merc*.15 com bônus de plano_completo', () => {
    const semBonus = calcularResultados(
      [{ team_id: 'viab', marcadores: [], indicadores: { ...baseIndicadores(), viabilidade: 80, organizacao: 70, mercado: 60 } }],
      cartoes,
      tagsVazio,
    );
    const comBonus = calcularResultados(
      [{ team_id: 'viab', marcadores: ['plano_completo'], indicadores: { ...baseIndicadores(), viabilidade: 80, organizacao: 70, mercado: 60 } }],
      cartoes,
      tagsVazio,
    );
    expect(categoriaDe(semBonus, 'viab')).toBe('mais_viavel');
    expect(notaDe(semBonus, 'viab')).toBe(59); // 32 + 17.5 + 9 = 58.5
    expect(notaDe(comBonus, 'viab') - notaDe(semBonus, 'viab')).toBe(20);
  });

  it('menos equipes que categorias: sobram categorias sem dono, sem duplicar ninguém', () => {
    const equipes = [
      { team_id: 't1', indicadores: baseIndicadores({ viabilidade: 90 }), marcadores: [] },
      { team_id: 't2', indicadores: baseIndicadores({ cooperacao: 90 }), marcadores: ['pista_compartilhada'] },
      { team_id: 't3', indicadores: baseIndicadores({ inclusao: 90 }), marcadores: ['publico_prioritario'] },
    ];
    const resultado = calcularResultados(equipes, cartoes, tagsVazio);
    expect(resultado).toHaveLength(3);
    expect(new Set(resultado.map((r) => r.team_id)).size).toBe(3);
    expect(new Set(resultado.map((r) => r.categoria)).size).toBe(3);
    expect(resultado.map((r) => r.categoria)).toEqual([
      'mais_viavel',
      'mais_colaborativa',
      'mais_inclusiva',
    ]);
  });

  it('o mapa problemaTagsPorEquipe é aceito e hoje é inerte ({} ou populado)', () => {
    const equipes = seisEquipes();
    const vazio = calcularResultados(equipes, cartoes, {});
    const populado = calcularResultados(equipes, cartoes, {
      'equipe-viavel': ['logistica'],
      'equipe-colaborativa': ['politicas'],
      'equipe-inclusiva': ['inclusao'],
      'equipe-sustentavel': ['sustentabilidade'],
      'equipe-inovadora': ['tecnologia'],
      'equipe-comunidade': ['mercado'],
    });
    // Fixa o comportamento atual: o 3º parâmetro não muda nada. Se alguém
    // ligá-lo à pontuação, esta falha e a decisão passa a ser explícita.
    expect(populado).toEqual(vazio);
  });

  it('razão não contém palavras competitivas', () => {
    const equipes = [{ team_id: 't1', indicadores: baseIndicadores(), marcadores: [] }];
    const resultado = calcularResultados(equipes, cartoes, tagsVazio);
    for (const r of resultado) {
      expect(r.razao.toLowerCase()).not.toMatch(/\bvenceu\b/);
      expect(r.razao.toLowerCase()).not.toMatch(/\bperdeu\b/);
      expect(r.razao.toLowerCase()).not.toMatch(/\bganhou\b/);
      expect(r.razao.trim().length).toBeGreaterThan(0);
    }
  });

  it('toda razão descreve a equipe que recebeu o destaque', () => {
    const resultado = calcularResultados(seisEquipes(), cartoes, tagsVazio);
    const esperadoPorCategoria: Record<string, RegExp> = {
      mais_viavel: /plano|viáb/i,
      mais_colaborativa: /coopera|circulou|abiu o jogo/i,
      mais_inclusiva: /inclus|vulner/i,
      mais_sustentavel: /cerrado|sustenta|ambiental/i,
      mais_inovadora: /conhecimento|ferramenta|inova/i,
      destaque_comunidade: /equilíbrio/i,
    };
    for (const r of resultado) {
      expect(r.razao, `razão sem texto para "${r.categoria}"`).toMatch(esperadoPorCategoria[r.categoria]);
    }
  });
});

// ---------------------------------------------------------------------------
// calcularResultadoOficinaResumo
// ---------------------------------------------------------------------------

describe('calcularResultadoOficinaResumo', () => {
  const cartoes: OficinaCartao[] = [];
  const tagsVazio: Record<string, TagOficina[]> = {};

  it('retorna string não vazia', () => {
    const equipes = [
      { team_id: 'a', indicadores: baseIndicadores(), marcadores: [] },
    ];
    const cats = calcularResultados(equipes, cartoes, tagsVazio);
    const { resumo_para_debate } = calcularResultadoOficinaResumo(equipes, cats);
    expect(resumo_para_debate.length).toBeGreaterThan(0);
  });

  it('sem equipes devolve o texto de workshop, sem divisão por zero', () => {
    const { resumo_para_debate } = calcularResultadoOficinaResumo([], []);
    expect(resumo_para_debate).toContain('concluída');
    expect(resumo_para_debate).not.toMatch(/NaN/);
  });

  it('não contém a palavra "venceu"', () => {
    const equipes = [
      { team_id: 'a', indicadores: baseIndicadores(), marcadores: [] },
      { team_id: 'b', indicadores: baseIndicadores({ sustentabilidade: 90 }), marcadores: [] },
    ];
    const cats = calcularResultados(equipes, cartoes, tagsVazio);
    const { resumo_para_debate } = calcularResultadoOficinaResumo(equipes, cats);
    expect(resumo_para_debate.toLowerCase()).not.toMatch(/\bvenceu\b/);
    expect(resumo_para_debate.toLowerCase()).not.toMatch(/\bperdeu\b/);
    expect(resumo_para_debate.toLowerCase()).not.toMatch(/\btime vencedor\b/);
  });

  it('menciona indicadores coletivos (contém número)', () => {
    const equipes = [
      { team_id: 'a', indicadores: baseIndicadores(), marcadores: [] },
    ];
    const cats = calcularResultados(equipes, cartoes, tagsVazio);
    const { resumo_para_debate } = calcularResultadoOficinaResumo(equipes, cats);
    // O resumo deve conter pelo menos um número (média dos indicadores).
    expect(resumo_para_debate).toMatch(/\d+/);
    expect(resumo_para_debate).not.toMatch(/NaN/);
  });

  it('gera entre 3 e 4 frases (pontuações no texto)', () => {
    const equipes = [
      { team_id: 'a', indicadores: baseIndicadores(), marcadores: [] },
      { team_id: 'b', indicadores: baseIndicadores({ viabilidade: 80 }), marcadores: [] },
    ];
    const cats = calcularResultados(equipes, cartoes, tagsVazio);
    const { resumo_para_debate } = calcularResultadoOficinaResumo(equipes, cats);
    const frases = resumo_para_debate.split(/\.\s+/).filter(Boolean);
    expect(frases.length).toBeGreaterThanOrEqual(3);
    expect(frases.length).toBeLessThanOrEqual(5); // margem para pontuação final
  });

  it('nomeia cada destaque sem repetição quando há 6 equipes', () => {
    const equipes = [
      { team_id: 'a', indicadores: baseIndicadores(), marcadores: [] },
      { team_id: 'b', indicadores: baseIndicadores(), marcadores: ['pista_compartilhada'] },
      { team_id: 'c', indicadores: baseIndicadores(), marcadores: ['publico_prioritario'] },
      { team_id: 'd', indicadores: baseIndicadores(), marcadores: ['cuidado_ambiental'] },
      { team_id: 'e', indicadores: baseIndicadores(), marcadores: ['tecnologia_usada'] },
      { team_id: 'f', indicadores: baseIndicadores(), marcadores: ['plano_completo'] },
    ];
    const cats = calcularResultados(equipes, cartoes, tagsVazio);
    const { resumo_para_debate } = calcularResultadoOficinaResumo(equipes, cats);
    expect(cats).toHaveLength(6);
    for (const categoria of cats) {
      expect(
        resumo_para_debate,
        `resumo não nomeia o destaque "${categoria.categoria}"`,
      ).toContain(rotuloCategoria(categoria.categoria).toLowerCase());
    }
  });
});

// ---------------------------------------------------------------------------
// Helpers de contrato: normalizarCategoria · rotuloCategoria · formatarDelta
// ---------------------------------------------------------------------------

describe('normalizarCategoria', () => {
  it('corrige o ID legado com typo para o atual', () => {
    expect(normalizarCategoria('mais_viability')).toBe('mais_viavel');
  });

  it('mantém as 6 categorias atuais sem alteração', () => {
    for (const categoria of OFICINA_CATEGORIAS_ORDEM) {
      expect(normalizarCategoria(categoria)).toBe(categoria);
    }
  });

  it('devolve null para categoria desconhecida, vazio ou quase-certa', () => {
    for (const invalida of ['', 'mais_viavel_', 'viabilidade', 'MAIS_VIACILITY', 'destaque']) {
      expect(normalizarCategoria(invalida), `"${invalida}" não deveria normalizar`).toBeNull();
    }
  });
});

describe('rotuloCategoria', () => {
  it('o ID legado e o atual rendem o mesmo rótulo', () => {
    expect(rotuloCategoria('mais_viability')).toBe(rotuloCategoria('mais_viavel'));
    expect(rotuloCategoria('mais_viability')).toBe('Solução mais viável');
  });

  it('nunca devolve vazio nem undefined, nem com dado velho ou sujo', () => {
    for (const entrada of [
      ...OFICINA_CATEGORIAS_ORDEM,
      'mais_viability',
      'categoria_inexistente',
      '',
    ]) {
      const rotulo = rotuloCategoria(entrada);
      expect(typeof rotulo, `"${entrada}" devolveu ${typeof rotulo}`).toBe('string');
      expect(rotulo.trim().length, `rótulo vazio para "${entrada}"`).toBeGreaterThan(0);
    }
  });

  it('cai no rótulo genérico para categoria irrecuperável', () => {
    expect(rotuloCategoria('categoria_inexistente')).toBe('Destaque da proposta');
  });
});

describe('formatarDelta', () => {
  const info = { ...OFICINA_INDICADORES_INFO };

  it('delta positivo sai com sinal de mais', () => {
    expect(formatarDelta({ cooperacao: 3 }, info)).toBe('cooperação +3');
  });

  it('delta negativo sai com o sinal de menos tipográfico (U+2212)', () => {
    expect(formatarDelta({ cooperacao: -3 }, info)).toBe('cooperação −3');
  });

  it('delta zero sai como string vazia (não polui a tela com "+0")', () => {
    expect(formatarDelta({ cooperacao: 0 }, info)).toBe('');
  });

  it('delta vazio sai como string vazia', () => {
    expect(formatarDelta({}, info)).toBe('');
  });

  it('chave ausente no delta não aparece (undefined não é número)', () => {
    expect(formatarDelta({ cooperacao: undefined }, info)).toBe('');
    expect(formatarDelta({ cooperacao: 2, mercado: undefined }, info)).toBe('cooperação +2');
  });

  it('ordena do maior para o menor delta e separa por vírgula', () => {
    expect(formatarDelta({ viabilidade: 3, mercado: -1 }, info)).toBe('viabilidade +3, acesso ao mercado −1');
    expect(formatarDelta({ inclusao: 1, cooperacao: 4, organizacao: -2 }, info)).toBe(
      'cooperação +4, inclusão +1, organização −2',
    );
  });

  it('usa o rótulo já formatado do indicador, em minúsculas, sem reescrever', () => {
    // 'Acesso ao mercado' → 'acesso ao mercado': a formatação é a do catálogo.
    expect(formatarDelta({ mercado: 2 }, info)).toBe('acesso ao mercado +2');
    expect(formatarDelta({ conhecimento: 1 }, info)).toBe('conhecimento +1');
  });

  it('aceita mapa de rótulos próprio sem perder a formatação', () => {
    const infoCustom: Record<OficinaIndicador, { rotulo: string }> = {
      ...info,
      cooperacao: { rotulo: 'Trabalho em equipe' },
    };
    expect(formatarDelta({ cooperacao: 2 }, infoCustom)).toBe('trabalho em equipe +2');
  });

  it('zera e um valor negativo grande usa o módulo do número', () => {
    expect(formatarDelta({ viabilidade: -12 }, info)).toBe('viabilidade −12');
  });
});

describe('temMarcador', () => {
  it('acha marcador presente na lista', () => {
    expect(temMarcador(['tecnologia_usada', 'pista_compartilhada'], 'tecnologia_usada')).toBe(true);
  });

  it('devolve false para lista vazia ou marcador ausente', () => {
    expect(temMarcador([], 'plano_completo')).toBe(false);
    expect(temMarcador(['pista_compartilhada'], 'plano_completo')).toBe(false);
  });

  it('o nome antigo tech_usada NÃO conta como tecnologia_usada', () => {
    // Regressão do ID antigo: jsonb pode guardar linha com o nome pré-correção.
    expect(temMarcador(['tech_usada'], 'tecnologia_usada')).toBe(false);
  });
});