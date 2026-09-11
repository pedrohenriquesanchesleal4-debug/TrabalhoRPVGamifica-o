import { describe, expect, it } from 'vitest';
import { OFICINA_CONTENT } from '@/data/oficina-content';
import { OFICINA_IA_FALLBACKS } from '@/data/oficina-ia';
import {
  OFICINA_ACAO_KEYS,
  OFICINA_BLOCOS_INFO,
  OFICINA_INDICADORES_INFO,
  OFICINA_PERFIS_INFO,
  OFICINA_STAGES_ORDEM,
  type OficinaAcaoKey,
  type OficinaBlocoSolucao,
  type OficinaIndicador,
  type TagOficina,
} from '@/types/oficina';

/**
 * Validação do conteúdo do modo Oficina Safra DF (data/oficina-content.ts e
 * data/oficina-ia.ts). Protege regras estruturais do conteúdo: referências que
 * resolvem, contagens exatas, tags dentro do vocabulário e textos com a voz da
 * oficina (sem palavras de julgamento ou de IA-slop).
 */

const TAGS_VALIDAS: TagOficina[] = [
  'producao',
  'mercado',
  'logistica',
  'tecnologia',
  'conectividade',
  'organizacao',
  'capacitacao',
  'politicas',
  'sustentabilidade',
  'inclusao',
];

const INDICADORES_VALIDOS: OficinaIndicador[] = Object.keys(
  OFICINA_INDICADORES_INFO,
) as OficinaIndicador[];

const ACAO_KEYS_VALIDAS: OficinaAcaoKey[] = [
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

const BLOCOS_VALIDOS: OficinaBlocoSolucao[] = Object.keys(
  OFICINA_BLOCOS_INFO,
) as OficinaBlocoSolucao[];

function tagsValidas(tags: readonly TagOficina[], contexto: string): void {
  for (const tag of tags) {
    expect(TAGS_VALIDAS, `${contexto} tem tag inválida: "${tag}"`).toContain(tag);
  }
}

function efeitosValidos(
  efeitos: Partial<Record<OficinaIndicador, number>>,
  contexto: string,
): void {
  const entries = Object.entries(efeitos);
  expect(entries.length, `${contexto} não declara nenhum efeito`).toBeGreaterThan(0);
  for (const [indicador, delta] of entries) {
    expect(INDICADORES_VALIDOS, `${contexto} mexe em indicador desconhecido: "${indicador}"`).toContain(
      indicador as OficinaIndicador,
    );
    expect(typeof delta, `${contexto}.${indicador} deveria ser número`).toBe('number');
  }
  const algumPositivo = entries.some(([, delta]) => (delta as number) > 0);
  expect(algumPositivo, `${contexto} não tem nenhum delta positivo`).toBe(true);
}

describe('locais da oficina', () => {
  it('tem exatamente 10 locais com ids únicos', () => {
    expect(OFICINA_CONTENT.locais).toHaveLength(10);
    const ids = OFICINA_CONTENT.locais.map((local) => local.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('toda referência de personagem e de pista resolve', () => {
    const personagemIds = new Set(OFICINA_CONTENT.personagens.map((p) => p.id));
    const pistaIds = new Set(OFICINA_CONTENT.pistas.map((p) => p.id));
    for (const local of OFICINA_CONTENT.locais) {
      if (local.personagem_id !== null) {
        expect(personagemIds, `local "${local.id}" aponta para personagem inexistente`).toContain(
          local.personagem_id,
        );
      }
      if (local.pista_id !== null) {
        expect(pistaIds, `local "${local.id}" aponta para pista inexistente`).toContain(
          local.pista_id,
        );
      }
      expect(ACAO_KEYS_VALIDAS, `local "${local.id}" sugere ação inválida`).toContain(
        local.acao_sugerida as OficinaAcaoKey,
      );
    }
  });

  it('todo local tem nome, situação e problema preenchidos', () => {
    for (const local of OFICINA_CONTENT.locais) {
      expect(local.nome.trim().length, `local "${local.id}" sem nome`).toBeGreaterThan(0);
      expect(local.situacao.trim().length, `local "${local.id}" sem situação`).toBeGreaterThan(0);
      expect(local.problema.trim().length, `local "${local.id}" sem problema`).toBeGreaterThan(0);
    }
  });
});

describe('personagens da oficina', () => {
  it('tem exatamente 9 personagens com ids únicos', () => {
    expect(OFICINA_CONTENT.personagens).toHaveLength(9);
    const ids = OFICINA_CONTENT.personagens.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('todo local_id resolve e toda pista prometida existe', () => {
    const localIds = new Set(OFICINA_CONTENT.locais.map((l) => l.id));
    const pistaIds = new Set(OFICINA_CONTENT.pistas.map((p) => p.id));
    for (const personagem of OFICINA_CONTENT.personagens) {
      expect(localIds, `personagem "${personagem.id}" está em local inexistente`).toContain(
        personagem.local_id,
      );
      if (personagem.pista_id !== null) {
        expect(pistaIds, `personagem "${personagem.id}" promete pista inexistente`).toContain(
          personagem.pista_id,
        );
      }
      tagsValidas(personagem.tags, `personagem "${personagem.id}"`);
    }
  });

  it('todo personagem tem fala e problema preenchidos', () => {
    for (const personagem of OFICINA_CONTENT.personagens) {
      expect(personagem.fala.trim().length, `personagem "${personagem.id}" sem fala`).toBeGreaterThan(0);
      expect(personagem.problema.trim().length, `personagem "${personagem.id}" sem problema`).toBeGreaterThan(0);
      expect(personagem.papel.trim().length, `personagem "${personagem.id}" sem papel`).toBeGreaterThan(0);
    }
  });
});

describe('pistas da oficina', () => {
  it('tem exatamente 13 pistas com ids únicos', () => {
    expect(OFICINA_CONTENT.pistas).toHaveLength(13);
    const ids = OFICINA_CONTENT.pistas.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('toda pista usa tags do vocabulário e declara origem, título e texto', () => {
    for (const pista of OFICINA_CONTENT.pistas) {
      tagsValidas(pista.tags, `pista "${pista.id}"`);
      expect(pista.origem.trim().length, `pista "${pista.id}" sem origem`).toBeGreaterThan(0);
      expect(pista.titulo.trim().length, `pista "${pista.id}" sem título`).toBeGreaterThan(0);
      expect(pista.texto.trim().length, `pista "${pista.id}" sem texto`).toBeGreaterThan(0);
      expect(pista.unica, `pista "${pista.id}" deveria ser única`).toBe(true);
      expect(pista.compartilhavel, `pista "${pista.id}" deveria ser compartilhável`).toBe(true);
    }
  });
});

describe('ações da oficina', () => {
  it('tem exatamente 10 ações, uma para cada chave do contrato', () => {
    expect(OFICINA_CONTENT.acoes).toHaveLength(10);
    const keys = OFICINA_CONTENT.acoes.map((acao) => acao.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const key of ACAO_KEYS_VALIDAS) {
      expect(keys, `falta a ação "${key}"`).toContain(key);
    }
  });

  it('toda ação custa 1 ou 2, tem efeitos válidos e requisito só com tags válidas', () => {
    for (const acao of OFICINA_CONTENT.acoes) {
      expect(acao.custo_acoes, `ação "${acao.key}" com custo fora de 1-2`).toBeGreaterThanOrEqual(1);
      expect(acao.custo_acoes).toBeLessThanOrEqual(2);
      efeitosValidos(acao.efeitos, `ação "${acao.key}"`);
      tagsValidas(acao.requisito_tags, `ação "${acao.key}" (requisito)`);
      tagsValidas(acao.tags, `ação "${acao.key}"`);
      expect(acao.nome.trim().length, `ação "${acao.key}" sem nome de botão`).toBeGreaterThan(0);
      expect(acao.icone.trim().length, `ação "${acao.key}" sem ícone`).toBeGreaterThan(0);
    }
  });
});

describe('eventos coletivos da oficina', () => {
  it('tem exatamente 5 eventos, cada um com 3 opções', () => {
    expect(OFICINA_CONTENT.eventos).toHaveLength(5);
    const keys = OFICINA_CONTENT.eventos.map((evento) => evento.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const evento of OFICINA_CONTENT.eventos) {
      expect(evento.opcoes, `evento "${evento.key}" deveria ter 3 opções`).toHaveLength(3);
      const opcaoKeys = evento.opcoes.map((opcao) => opcao.key);
      expect(new Set(opcaoKeys).size, `evento "${evento.key}" repete chave de opção`).toBe(
        opcaoKeys.length,
      );
      expect(['a', 'b', 'c'], `evento "${evento.key}" com chaves fora de a/b/c`).toEqual(
        expect.arrayContaining(opcaoKeys),
      );
    }
  });

  it('toda opção e o efeito coletivo têm efeitos válidos; narrativa e desfecho preenchidos', () => {
    const chaves = ['feira_comunitaria', 'semana_capacitacao', 'problema_logistico', 'oportunidade_institucional', 'falha_conectividade'];
    for (const evento of OFICINA_CONTENT.eventos) {
      expect(chaves, `evento "${evento.key}" fora da lista combinada`).toContain(evento.key);
      expect(evento.titulo.trim().length).toBeGreaterThan(0);
      expect(evento.narrativa.trim().length).toBeGreaterThan(0);
      expect(evento.desfecho.trim().length).toBeGreaterThan(0);
      efeitosValidos(evento.efeito_coletivo, `evento "${evento.key}" (efeito coletivo)`);
      for (const opcao of evento.opcoes) {
        expect(opcao.rotulo.trim().length).toBeGreaterThan(0);
        expect(opcao.detalhe.trim().length).toBeGreaterThan(0);
        efeitosValidos(opcao.efeitos, `evento "${evento.key}" opção "${opcao.key}"`);
        tagsValidas(opcao.tags, `evento "${evento.key}" opção "${opcao.key}"`);
      }
    }
  });
});

describe('cartões da solução', () => {
  it('tem exatamente 13 cartões, um para cada bloco do contrato', () => {
    expect(OFICINA_CONTENT.cartoes).toHaveLength(13);
    const blocos = OFICINA_CONTENT.cartoes.map((cartao) => cartao.bloco);
    expect(new Set(blocos).size).toBe(blocos.length);
    for (const bloco of BLOCOS_VALIDOS) {
      expect(blocos, `falta o cartão do bloco "${bloco}"`).toContain(bloco);
    }
  });

  it('todo cartão tem 4 opções com chaves únicas e tags válidas', () => {
    for (const cartao of OFICINA_CONTENT.cartoes) {
      expect(cartao.opcoes, `cartão "${cartao.bloco}" deveria ter 4 opções`).toHaveLength(4);
      const keys = cartao.opcoes.map((opcao) => opcao.key);
      expect(new Set(keys).size, `cartão "${cartao.bloco}" repete chave de opção`).toBe(keys.length);
      expect(['a', 'b', 'c', 'd']).toEqual(expect.arrayContaining(keys));
      for (const opcao of cartao.opcoes) {
        expect(opcao.rotulo.trim().length, `cartão "${cartao.bloco}" com opção sem rótulo`).toBeGreaterThan(0);
        tagsValidas(opcao.tags, `cartão "${cartao.bloco}" opção "${opcao.key}"`);
      }
    }
  });

  it('cita pelo menos uma política pública real (PAA) nos rótulos', () => {
    const todosRotulos = OFICINA_CONTENT.cartoes
      .flatMap((cartao) => cartao.opcoes.map((opcao) => opcao.rotulo))
      .join(' | ');
    expect(todosRotulos, 'nenhum rótulo de cartão cita o PAA').toContain('PAA');
  });

  it('blocos de problema principal e acompanhamento aceitam campo livre', () => {
    const problema = OFICINA_CONTENT.cartoes.find((c) => c.bloco === 'problema_principal');
    const acompanhamento = OFICINA_CONTENT.cartoes.find((c) => c.bloco === 'acompanhamento');
    expect(problema?.campo_livre, 'problema_principal deveria ter campo livre').toBe(true);
    expect(acompanhamento?.campo_livre, 'acompanhamento deveria ter campo livre').toBe(true);
  });
});

describe('perguntas de reflexão do conteúdo', () => {
  it('tem exatamente 9 perguntas preenchidas', () => {
    expect(OFICINA_CONTENT.reflexao_perguntas).toHaveLength(9);
    for (const pergunta of OFICINA_CONTENT.reflexao_perguntas) {
      expect(pergunta.trim().length).toBeGreaterThan(0);
      expect(pergunta.trim().endsWith('?')).toBe(true);
    }
  });
});

describe('fallback de IA da oficina', () => {
  const PROIBIDAS = ['certo', 'errado', 'vencedor', 'perdedor'];

  it('narrativa inicial fala da comunidade Boa Vista e não usa palavra de julgamento', () => {
    const narrativa = OFICINA_IA_FALLBACKS.narrativa_inicial;
    expect(narrativa.trim().length, 'narrativa inicial vazia').toBeGreaterThan(0);
    expect(narrativa, 'narrativa inicial não cita a comunidade').toContain('Boa Vista');
    for (const palavra of PROIBIDAS) {
      expect(narrativa, `narrativa inicial contém a palavra "${palavra}"`).not.toMatch(
        new RegExp(`\\b${palavra}\\b`, 'i'),
      );
    }
  });

  it('transições cobrem exatamente as 6 etapas do contrato', () => {
    const transicoes = OFICINA_IA_FALLBACKS.transicoes;
    for (const stage of OFICINA_STAGES_ORDEM) {
      expect(transicoes[stage]?.trim().length, `sem transição para o estágio "${stage}"`).toBeGreaterThan(0);
    }
    expect(Object.keys(transicoes)).toHaveLength(OFICINA_STAGES_ORDEM.length);
  });

  it('feedback cobre os 6 perfis de equipe', () => {
    const feedback = OFICINA_IA_FALLBACKS.feedback_por_perfil;
    for (const perfil of Object.keys(OFICINA_PERFIS_INFO)) {
      expect(feedback[perfil as keyof typeof feedback]?.trim().length, `sem feedback para o perfil "${perfil}"`).toBeGreaterThan(0);
    }
    expect(Object.keys(feedback)).toHaveLength(Object.keys(OFICINA_PERFIS_INFO).length);
  });

  it('reflexão do professor tem 9 perguntas e provocação preenchida', () => {
    expect(OFICINA_IA_FALLBACKS.reflexao_perguntas).toHaveLength(9);
    for (const pergunta of OFICINA_IA_FALLBACKS.reflexao_perguntas) {
      expect(pergunta.trim().length).toBeGreaterThan(0);
      expect(pergunta.trim().endsWith('?')).toBe(true);
    }
    expect(OFICINA_IA_FALLBACKS.provocacao.trim().length).toBeGreaterThan(0);
  });
});