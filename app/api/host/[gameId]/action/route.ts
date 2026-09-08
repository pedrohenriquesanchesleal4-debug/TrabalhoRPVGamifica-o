import { z } from 'zod';
import {
  finishGame,
  getHostView,
  pauseGame,
  resetGame,
  resolveRound,
  resumeGame,
  startRound,
} from '@/lib/game-service';
import { ok, parseBody, requireBearer, toResponse } from '@/lib/http';

/**
 * POST /api/host/[gameId]/action · o controle da partida, em um endpoint.
 *
 * Um caminho de autorização, um lugar para auditar: toda ação de professor
 * (abrir rodada, resolver, pausar, retomar, encerrar, reiniciar) passa por aqui
 * com o token de professor. Devolve sempre a visão atualizada, para o painel
 * não precisar de uma segunda chamada.
 */

const bodySchema = z.object({
  action: z.enum(['start_round', 'resolve_round', 'pause', 'resume', 'finish', 'reset']),
  /** Só para `resume`: quanto tempo restava no cronômetro quando pausou. */
  remainingSeconds: z.number().int().min(0).max(900).optional(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ gameId: string }> },
) {
  try {
    const { gameId } = await params;
    const token = requireBearer(request);
    const { action, remainingSeconds } = await parseBody(request, bodySchema);

    let outcomes: Awaited<ReturnType<typeof resolveRound>>['outcomes'] | null = null;

    switch (action) {
      case 'start_round':
        await startRound(gameId, token);
        break;
      case 'resolve_round':
        outcomes = (await resolveRound(gameId, token)).outcomes;
        break;
      case 'pause':
        await pauseGame(gameId, token);
        break;
      case 'resume':
        await resumeGame(gameId, token, remainingSeconds);
        break;
      case 'finish':
        await finishGame(gameId, token);
        break;
      case 'reset':
        await resetGame(gameId, token);
        break;
    }

    const view = await getHostView(gameId, token);
    return ok({ action, outcomes, view });
  } catch (error) {
    return toResponse(error);
  }
}
