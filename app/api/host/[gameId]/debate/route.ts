import { getProjectionView, authenticateHost } from '@/lib/game-service';
import { generateDebateRoteiro } from '@/lib/gemini';
import { ApiError, ok, requireBearer, requireUuid, toResponse } from '@/lib/http';
import { rateLimit, clientIp } from '@/lib/rate-limit';

/**
 * POST /api/host/[gameId]/debate · roteiro de debate do professor.
 *
 * Exige o token do professor (Bearer + authenticateHost). A geração de IA é
 * uma operação custosa e não pode ficar aberta: o projeto público serve apenas
 * para visualização, não para mutações que consomem cota.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ gameId: string }> },
) {
  try {
    rateLimit(`debate:${clientIp(request)}`, 5, 120_000, 'Roteiro de debate gerado recentemente. Aguarde um minuto.');
    const gameId = requireUuid((await params).gameId);
    const token = requireBearer(request);
    await authenticateHost(gameId, token);

    const view = await getProjectionView(gameId);
    if (view.game.status !== 'finished' || view.scores.length === 0) {
      throw new ApiError(
        'conflict',
        'O roteiro de debate fica disponível depois que a partida é encerrada.',
      );
    }

    return ok(await generateDebateRoteiro(gameId, view));
  } catch (error) {
    return toResponse(error);
  }
}