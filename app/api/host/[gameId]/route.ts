import { getHostView } from '@/lib/game-service';
import { ok, requireBearer, toResponse } from '@/lib/http';

/**
 * GET /api/host/[gameId] · painel do professor.
 *
 * Exige o token de professor. Devolve equipes, jogadores, decisões da rodada,
 * diagnóstico agregado da turma e os ganchos de debate já prontos.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ gameId: string }> },
) {
  try {
    const { gameId } = await params;
    const token = requireBearer(request);

    return ok(await getHostView(gameId, token));
  } catch (error) {
    return toResponse(error);
  }
}
