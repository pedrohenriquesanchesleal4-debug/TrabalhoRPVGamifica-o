import { describe, expect, it } from 'vitest';
import { buildCorpusDocs } from '@/lib/corpus';
import { POLICIES } from '@/data/policies';
import { TECHNOLOGIES } from '@/data/technologies';

/**
 * O corpus é a fonte de citação do roteiro: as fichas derivam literalmente
 * dos dados existentes do app (sem texto novo, sem número inventado), e cada
 * uma carrega a sua fonte. Os testes são puros: nenhum toca rede nem banco.
 */

describe('buildCorpusDocs', () => {
  it('gera uma ficha por política e por tecnologia, sem duplicar slug', () => {
    const docs = buildCorpusDocs();

    expect(docs).toHaveLength(POLICIES.length + TECHNOLOGIES.length);
    const slugs = docs.map((doc) => doc.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    expect(docs.filter((doc) => doc.tipo === 'politica')).toHaveLength(POLICIES.length);
    expect(docs.filter((doc) => doc.tipo === 'tecnologia')).toHaveLength(TECHNOLOGIES.length);
  });

  it('toda ficha tem título, fonte e trecho não vazios', () => {
    for (const doc of buildCorpusDocs()) {
      expect(doc.titulo.trim().length).toBeGreaterThan(0);
      expect(doc.fonte.trim().length).toBeGreaterThan(0);
      expect(doc.trecho.trim().length).toBeGreaterThan(0);
    }
  });

  it('política carrega finalidade + simulação; tecnologia carrega requisito', () => {
    const docs = buildCorpusDocs();

    const paa = docs.find((doc) => doc.slug === 'paa');
    expect(paa?.titulo).toContain('Programa de Aquisição de Alimentos');
    expect(paa?.trecho).toContain('Compra pública de alimentos');
    expect(paa?.trecho).toContain('escoamento garantido');

    const irrigacao = docs.find((doc) => doc.slug === 'irrigacao-inteligente');
    expect(irrigacao?.trecho).toContain('Requisito:');
    expect(irrigacao?.trecho).toMatch(/precisa saber programar e manter o sistema/i);
  });

  it('nenhuma ficha afirma número, percentual ou teto de programa real', () => {
    const trechos = buildCorpusDocs()
      .filter((doc) => doc.tipo === 'politica')
      .map((doc) => doc.trecho);

    for (const trecho of trechos) {
      expect(trecho).not.toMatch(/\bR\$\s?\d/);
      expect(trecho).not.toMatch(/\d{2,}%/);
      expect(trecho).toMatch(/^.+(simulado|simula|aparece)/mi);
    }
  });
});