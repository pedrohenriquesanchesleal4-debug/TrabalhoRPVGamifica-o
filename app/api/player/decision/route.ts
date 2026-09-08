import { z } from 'zod';
import { submitDecision } from '@/lib/game-service';
import { ok, parseBody, requireBearer, toResponse } from '@/lib/http';

/**
 * POST /api/player/decision · a equipe confirma a escolha da rodada.
 *
 * O corpo carrega apenas a chave da opção. Nada de indicador, nada de valor,
 * nada de estado: quem calcula consequência é o servidor, a partir do que está
 * gravado no banco. Confirmação é definitiva, e a segunda tentativa recebe 409.
 */

const bodySchema = z.object({
  optionKey: z.string().min(1).max(8),
});

export async function POST(request: Request) {
  try {
    const token = requireBearer(request);
    const { optionKey } = await parseBody(request, bodySchema);

    return ok(await submitDecision(token, optionKey));
  } catch (error) {
    return toResponse(error);
  }
}
