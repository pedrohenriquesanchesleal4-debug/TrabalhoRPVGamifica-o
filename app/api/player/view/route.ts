import { getPlayerView } from '@/lib/game-service';
import { ok, requireBearer, toResponse } from '@/lib/http';
import { createHash } from 'crypto';

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
    const view = await getPlayerView(token);
    const body = JSON.stringify(view);
    const etag = createHash('sha256').update(body).digest('hex').slice(0, 32);
    const incoming = request.headers.get('if-none-match');
    if (incoming === etag) {
      return new Response(null, {
        status: 304,
        headers: {
          'ETag': etag,
          'Cache-Control': 'private, max-age=5, must-revalidate',
        },
      });
    }
    return new Response(body, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'ETag': etag,
        'Cache-Control': 'private, max-age=5, must-revalidate',
      },
    });
  } catch (error) {
    return toResponse(error);
  }
}
