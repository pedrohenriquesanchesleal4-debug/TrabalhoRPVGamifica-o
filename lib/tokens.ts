import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

/**
 * Identidade sem login.
 *
 * O briefing proíbe cadastro: o aluno digita código e nome e está jogando em
 * menos de um minuto. Então a identidade é um token aleatório emitido pelo
 * servidor, guardado no navegador e enviado em cada chamada. O banco guarda
 * apenas o hash SHA-256, em tabela sem acesso para o papel anon.
 *
 * Isso resolve o requisito de segurança sem custo nenhum: nada de provedor de
 * autenticação, nada de senha, nada de dado pessoal além do primeiro nome.
 */

/** Alfabeto sem caracteres ambíguos: nada de O/0, I/1, S/5. */
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRTUVWXYZ2346789';

/** Código da partida que o professor projeta na tela. */
export function generateGameCode(length = 5): string {
  const bytes = randomBytes(length);
  let code = '';
  for (let index = 0; index < length; index += 1) {
    code += CODE_ALPHABET[bytes[index] % CODE_ALPHABET.length];
  }
  return code;
}

/** Token opaco de 256 bits em base64url. */
export function generateToken(): string {
  return randomBytes(32).toString('base64url');
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/** Comparação em tempo constante: evita vazar o token por diferença de tempo. */
export function tokenMatches(token: string, expectedHash: string): boolean {
  const actual = Buffer.from(hashToken(token), 'hex');
  let expected: Buffer;

  try {
    expected = Buffer.from(expectedHash, 'hex');
  } catch {
    return false;
  }

  if (actual.length !== expected.length) return false;
  return timingSafeEqual(actual, expected);
}

/**
 * Normaliza o código digitado pelo aluno.
 *
 * Sobe para maiúscula, remove espaço e descarta qualquer caractere fora do
 * alfabeto de geração. Como o alfabeto já exclui os pares confundíveis
 * (O/0, I/1, S/5), não existe mapeamento de "letra parecida" a fazer: o que
 * sobra ou é um código válido ou não é código nenhum.
 */
export function normalizeGameCode(input: string): string {
  const upper = input.trim().toUpperCase();
  let normalized = '';

  for (const character of upper) {
    if (CODE_ALPHABET.includes(character)) normalized += character;
  }

  return normalized;
}
