import { getProjectionView } from '@/lib/game-service';
import { generateDebateRoteiro } from '@/lib/gemini';
import { ApiError, ok, toResponse } from '@/lib/http';

/**
 * POST /api/host/[gameId]/debate · roteiro de debate do professor.
 *
 * Sem token, igual à projeção: o professor abre o painel no computador da sala
 * e projeta; a tela de resultado já é pública por design. A guarda real é o
 * estado da partida (só `finished` gera roteiro) e o cache: 1 chamada de IA
 * por partida, aconteça o que acontecer.
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ gameId: string }> },
) {
  try {
    const { gameId } = await params;

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