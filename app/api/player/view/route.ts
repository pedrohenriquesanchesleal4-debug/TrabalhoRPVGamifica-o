import { getPlayerView } from '@/lib/game-service';
import { ok, requireBearer, toResponse } from '@/lib/http';

/**
 * GET /api/player/view · tudo o que a tela do aluno precisa, em uma chamada.
 *
 * Inclui a dica da própria função e nunca a dos colegas. O cliente chama isto
 * quando entra e quando o realtime avisa que algo mudou: nunca em laço de
 * polling.
 */
export async function GET(request: Request) {
  try {
    const token = requireBearer(request);
    return ok(await getPlayerView(token));
  } catch (error) {
    return toResponse(error);
  }
}
