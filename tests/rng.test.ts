import { describe, expect, it } from 'vitest';
import { hashSeed, mulberry32, pickDeterministic, seededRandom } from '@/game/rng';

describe('hashSeed', () => {
  it('produz o mesmo hash para as mesmas partes de semente', () => {
    const a = hashSeed('jogo-1', 3, 'time-verde');
    const b = hashSeed('jogo-1', 3, 'time-verde');
    expect(a).toBe(b);
  });

  it('é sensível à ordem das partes: trocar a ordem muda o hash', () => {
    const a = hashSeed('jogo-1', 'time-verde');
    const b = hashSeed('time-verde', 'jogo-1');
    expect(a).not.toBe(b);
  });

  it('devolve sempre um inteiro de 32 bits sem sinal', () => {
    const value = hashSeed('qualquer', 42, 'coisa');
    expect(Number.isInteger(value)).toBe(true);
    expect(value).toBeGreaterThanOrEqual(0);
    expect(value).toBeLessThanOrEqual(0xffffffff);
  });
});

describe('mulberry32', () => {
  it('gera números sempre dentro do intervalo [0, 1)', () => {
    const random = mulberry32(12345);
    for (let index = 0; index < 200; index += 1) {
      const value = random();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });

  it('é reprodutível: a mesma semente gera a mesma sequência', () => {
    const sequenceA = Array.from({ length: 5 }, mulberry32(999));
    const sequenceB = Array.from({ length: 5 }, mulberry32(999));
    expect(sequenceA).toEqual(sequenceB);
  });

  it('sementes diferentes produzem sequências diferentes', () => {
    const first = mulberry32(1)();
    const second = mulberry32(2)();
    expect(first).not.toBe(second);
  });
});

describe('pickDeterministic', () => {
  const items = ['carta-a', 'carta-b', 'carta-c', 'carta-d'] as const;

  it('escolhe sempre o mesmo item para a mesma semente', () => {
    const first = pickDeterministic(items, 'jogo-1', 2, 'time-azul');
    const second = pickDeterministic(items, 'jogo-1', 2, 'time-azul');
    expect(first).toBe(second);
  });

  it('distribui a escolha entre os itens quando a semente muda', () => {
    const teams = ['time-a', 'time-b', 'time-c', 'time-d', 'time-e', 'time-f'];
    const chosen = new Set(teams.map((teamId) => pickDeterministic(items, 'jogo-1', 1, teamId)));
    // Não exige que TODOS os itens apareçam, mas exige que não caia sempre no mesmo.
    expect(chosen.size).toBeGreaterThan(1);
  });

  it('lança erro ao receber lista vazia', () => {
    expect(() => pickDeterministic([], 'jogo-1', 1, 'time-a')).toThrow();
  });
});

describe('seededRandom', () => {
  it('é equivalente a mulberry32(hashSeed(...)): mesma semente, mesmo valor', () => {
    const viaSeeded = seededRandom('jogo-1', 3, 'time-a', 'opcao-x')();
    const viaManual = mulberry32(hashSeed('jogo-1', 3, 'time-a', 'opcao-x'))();
    expect(viaSeeded).toBe(viaManual);
  });
});
