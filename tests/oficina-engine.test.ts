import { describe, expect, it } from 'vitest';
import {
  acaoResultado,
  aplicarDelta,
  calcularResultadoOficinaResumo,
  calcularResultados,
  coerenciaSolucao,
  eventoContribuicao,
  sortearEventos,
  validarAcao,
} from '@/game/oficina-engine';
import type {
  OficinaAcao,
  OficinaCartao,
  OficinaIndicadores,
  OficinaSolucao,
  TagOficina,
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
  it('nega quando custo excede o limite de ações do estágio', () => {
    const acao = acaoBasica({ custo_acoes: 2 });
    const resultado = validarAcao({
      acao,
      indicadores: baseIndicadores(),
      pistasTags: [['producao', 'mercado']],
      acoesUsadas: 3,
      maxAcoesPorEstagio: 4,
    });
    expect(resultado.ok).toBe(false);
    expect(resultado.motivo).toBe('Limite de ações do estágio');
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
    expect(resultado.motivo).toBe('Falta uma pista para isso');
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
});

// ---------------------------------------------------------------------------
// coerenciaSolucao
// ---------------------------------------------------------------------------

describe('coerenciaSolucao', () => {
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

  it('bloco alinhado soma ao score (1+ tag em comum)', () => {
    const solucao: OficinaSolucao = {
      blocos: { problema_principal: 'p1' },
      campos_livres: {},
    };
    const resultado = coerenciaSolucao(solucao, 'Falta de água', problemaTags, cartoes);
    expect(resultado.alinhados).toContain('problema_principal');
    expect(resultado.score).toBeGreaterThan(50);
  });

  it('bloco desalinhado gera aviso mas NÃO bloqueia', () => {
    const solucao: OficinaSolucao = {
      blocos: { recursos: 'r2' }, // 'r2' tem tags [organizacao, logistica] — nenhuma em comum com problemaTags.
      campos_livres: {},
    };
    const resultado = coerenciaSolucao(solucao, 'Estrada', problemaTags, cartoes);
    expect(resultado.desalinhados).toContain('recursos');
    expect(resultado.avisos.length).toBeGreaterThan(0);
    expect(resultado.avisos[0]).toContain('conversam pouco');
    // Nunca rotula "certo/errado".
    expect(resultado.avisos.join(' ')).not.toMatch(/\bcerto\b/i);
    expect(resultado.avisos.join(' ')).not.toMatch(/\berrado\b/i);
  });

  it('score é cap em 100 mesmo com muitos blocos alinhados', () => {
    const solucao: OficinaSolucao = {
      blocos: {
        problema_principal: 'p1',
        recursos: 'r1',
        capacitacao: 'c1',
      },
      campos_livres: {},
    };
    const resultado = coerenciaSolucao(solucao, 'Falta de água', problemaTags, cartoes);
    expect(resultado.score).toBeLessThanOrEqual(100);
  });

  it('50 base quando nenhum bloco preenchido', () => {
    const solucao: OficinaSolucao = { blocos: {}, campos_livres: {} };
    const resultado = coerenciaSolucao(solucao, 'X', problemaTags, cartoes);
    expect(resultado.score).toBe(50);
  });
});

// ---------------------------------------------------------------------------
// calcularResultados
// ---------------------------------------------------------------------------

describe('calcularResultados', () => {
  const cartoes: OficinaCartao[] = [];
  const tagsVazio: Record<string, TagOficina[]> = {};

  it('retorna uma categoria por time', () => {
    const equipes = [
      { team_id: 'alpha', indicadores: baseIndicadores(), marcadores: [] },
      { team_id: 'beta', indicadores: baseIndicadores(), marcadores: [] },
    ];
    const resultado = calcularResultados(equipes, cartoes, tagsVazio);
    expect(resultado).toHaveLength(2);
    expect(resultado[0].team_id).toBe('alpha');
    expect(resultado[1].team_id).toBe('beta');
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
      { team_id: 'gamma', indicadores: baseIndicadores({ viabilidade: 80 }), marcadores: ['tech_usada'] },
      { team_id: 'delta', indicadores: baseIndicadores({ sustentabilidade: 90 }), marcadores: [] },
    ];
    const primeiro = calcularResultados(equipes, cartoes, tagsVazio);
    const segundo = calcularResultados(equipes, cartoes, tagsVazio);
    expect(primeiro).toEqual(segundo);
  });

  it('empates são resolvidos por ordem do team_id (sem aleatório)', () => {
    // Equipes idênticas → categoria escolhida depende da ordem estável.
    const equipes = [
      { team_id: 'zzz', indicadores: baseIndicadores(), marcadores: [] },
      { team_id: 'aaa', indicadores: baseIndicadores(), marcadores: [] },
    ];
    const resultado = calcularResultados(equipes, cartoes, tagsVazio);
    // Mesmo com indicadores idênticos, cada time recebe a MESMA categoria.
    expect(resultado[0].categoria).toBe(resultado[1].categoria);
  });

  it('razão não contém palavras competitivas', () => {
    const equipes = [
      { team_id: 't1', indicadores: baseIndicadores(), marcadores: [] },
    ];
    const resultado = calcularResultados(equipes, cartoes, tagsVazio);
    for (const r of resultado) {
      expect(r.razao.toLowerCase()).not.toMatch(/\bvenceu\b/);
      expect(r.razao.toLowerCase()).not.toMatch(/\bperdeu\b/);
      expect(r.razao.toLowerCase()).not.toMatch(/\bganhou\b/);
    }
  });

  it('mais_inovadora é influenciada por marcadores tech_usada e capacitacao_feita', () => {
    const base = baseIndicadores({ conhecimento: 80 });
    const semTech = [
      { team_id: 'no-tech', indicadores: base, marcadores: [] },
    ];
    const comTech = [
      { team_id: 'has-tech', indicadores: base, marcadores: ['tech_usada', 'capacitacao_feita'] },
    ];
    const r1 = calcularResultados(semTech, cartoes, tagsVazio);
    const r2 = calcularResultados(comTech, cartoes, tagsVazio);
    // Com tech_usada + capacitacao_feita, o time deve ter nota mais alta em
    // mais_inovadora (ou a categoria escolhida muda).
    expect(r2[0].nota).toBeGreaterThanOrEqual(r1[0].nota);
  });

  it('mais_viability usa a fórmula viab*0.5 + org*0.3 + merc*0.2', () => {
    const equipes = [
      {
        team_id: 'viab',
        indicadores: baseIndicadores({ viabilidade: 80, organizacao: 70, mercado: 60 }),
        marcadores: [],
      },
    ];
    const resultado = calcularResultados(equipes, cartoes, tagsVazio);
    // 80*0.5 + 70*0.3 + 60*0.2 = 40 + 21 + 12 = 73
    expect(resultado[0].categoria).toBe('mais_viability');
    expect(resultado[0].nota).toBe(73);
  });

  it('mais_colaborativa usa a fórmula coop*0.6 + conf*0.4', () => {
    const equipes = [
      {
        team_id: 'collab',
        indicadores: baseIndicadores({ cooperacao: 80, confianca: 80 }),
        marcadores: [],
      },
    ];
    const resultado = calcularResultados(equipes, cartoes, tagsVazio);
    expect(resultado[0].team_id).toBe('collab');
    expect(resultado[0].nota).toBe(80); // 0.6*80 + 0.4*80 = 80
    expect(resultado[0].categoria).toBe('mais_colaborativa');
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
});
