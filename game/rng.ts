/**
 * Aleatoriedade determinística.
 *
 * O jogo tem incerteza (uma tecnologia pode falhar, uma feira pode ser fraca),
 * mas a incerteza precisa ser REPRODUZÍVEL: mesma partida, mesma rodada, mesma
 * equipe e mesma opção sempre produzem o mesmo resultado. Isso permite testar a
 * engine, reexecutar uma resolução sem divergir do que o aluno já viu e provar
 * que o servidor não sorteou de novo para "corrigir" nada.
 *
 * Nada aqui usa Math.random nem Date.now.
 */

/** Hash xfnv1a: string arbitrária para semente inteira de 32 bits. */
export function hashSeed(...parts: (string | number)[]): number {
  const input = parts.join('|');
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  // >>> 0 mantém o valor em 32 bits sem sinal.
  return hash >>> 0;
}

/** Gerador mulberry32: rápido, estável e suficiente para sorteio de jogo. */
export function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return function next(): number {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

/** Gerador pronto a partir de partes de semente legíveis. */
export function seededRandom(...parts: (string | number)[]): () => number {
  return mulberry32(hashSeed(...parts));
}

/**
 * Escolhe um item de forma determinística.
 *
 * Usado para distribuir cartas de evento: equipes diferentes na mesma rodada
 * recebem situações diferentes, e a mesma equipe sempre recebe a mesma carta se
 * a partida for reexecutada.
 */
export function pickDeterministic<T>(items: readonly T[], ...seed: (string | number)[]): T {
  if (items.length === 0) {
    throw new Error('pickDeterministic: lista vazia');
  }
  const index = hashSeed(...seed) % items.length;
  return items[index];
}
