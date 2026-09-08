import { touchPlayer } from '@/lib/game-service';
import { ok, requireBearer, toResponse } from '@/lib/http';

/**
 * POST /api/player/heartbeat · presença do jogador.
 *
 * Chamado com intervalo largo (a cada 45 segundos), só para o professor ver
 * quem está conectado. Não é canal de estado: o estado chega por realtime.
 */
export async function POST(request: Request) {
  try {
    const token = requireBearer(request);
    await touchPlayer(token);
    return ok({ ok: true });
  } catch (error) {
    return toResponse(error);
  }
}
