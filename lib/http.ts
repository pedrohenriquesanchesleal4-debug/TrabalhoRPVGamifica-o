import { ZodError, type ZodType } from 'zod';
import { InvalidDecisionError } from '@/game/engine';

/**
 * Camada HTTP dos route handlers.
 *
 * Um formato de erro para todo o sistema, e nenhuma mensagem interna vazando
 * para o cliente: o aluno recebe uma frase em português que explica o que fazer,
 * e o servidor guarda o resto no log.
 */

export type ApiErrorCode =
  | 'bad_request'
  | 'unauthorized'
  | 'forbidden'
  | 'not_found'
  | 'conflict'
  | 'game_full'
  | 'invalid_decision'
  | 'server_error';

const STATUS: Record<ApiErrorCode, number> = {
  bad_request: 400,
  unauthorized: 401,
  forbidden: 403,
  not_found: 404,
  conflict: 409,
  game_full: 409,
  invalid_decision: 422,
  server_error: 500,
};

export class ApiError extends Error {
  constructor(
    readonly code: ApiErrorCode,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export function ok<T>(data: T, init?: ResponseInit): Response {
  return Response.json(data as object, { status: 200, ...init });
}

export function fail(error: ApiError): Response {
  return Response.json(
    { error: { code: error.code, message: error.message, details: error.details } },
    { status: STATUS[error.code] },
  );
}

/**
 * Converte qualquer exceção em resposta previsível.
 *
 * Erro de validação da engine (`InvalidDecisionError`) chega como 422 com a
 * razão, porque o cliente precisa distinguir "caixa insuficiente" de
 * "requisito não atendido". Erro inesperado vira 500 genérico e vai para o log.
 */
export function toResponse(error: unknown): Response {
  if (error instanceof ApiError) {
    return fail(error);
  }

  if (error instanceof InvalidDecisionError) {
    return fail(new ApiError('invalid_decision', error.message, { reason: error.reason }));
  }

  if (error instanceof ZodError) {
    return fail(
      new ApiError('bad_request', 'Dados inválidos na requisição.', {
        issues: error.issues.map((issue) => ({
          path: issue.path.join('.'),
          message: issue.message,
        })),
      }),
    );
  }

  console.error('[safra-df] erro não tratado:', error);
  return fail(new ApiError('server_error', 'Algo falhou no servidor. Tente de novo.'));
}

/** Lê e valida o corpo JSON com um schema Zod. */
export async function parseBody<T>(request: Request, schema: ZodType<T>): Promise<T> {
  let raw: unknown;

  try {
    raw = await request.json();
  } catch {
    throw new ApiError('bad_request', 'Corpo da requisição não é JSON válido.');
  }

  return schema.parse(raw);
}

/** Token do jogador ou do professor, enviado como Bearer. */
export function bearerToken(request: Request): string | null {
  const header = request.headers.get('authorization');
  if (!header?.startsWith('Bearer ')) return null;

  const token = header.slice('Bearer '.length).trim();
  return token === '' ? null : token;
}

export function requireBearer(request: Request): string {
  const token = bearerToken(request);
  if (!token) {
    throw new ApiError('unauthorized', 'Sessão não identificada. Entre na partida de novo.');
  }
  return token;
}
