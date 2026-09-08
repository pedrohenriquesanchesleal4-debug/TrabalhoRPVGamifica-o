import { getProjectionView } from '@/lib/game-service';
import { ok, toResponse } from '@/lib/http';

/**
 * GET /api/projection/[gameId] · a tela de projeção.
 *
 * Sem token, de propósito: o professor abre o painel no computador da sala e
 * projeta. Não expõe segredo nenhum (nem token de jogador, nem dica por
 * função), apenas o que a turma inteira já está vendo na parede.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ gameId: string }> },
) {
  try {
    const { gameId } = await params;
    return ok(await getProjectionView(gameId));
  } catch (error) {
    return toResponse(error);
  }
}
