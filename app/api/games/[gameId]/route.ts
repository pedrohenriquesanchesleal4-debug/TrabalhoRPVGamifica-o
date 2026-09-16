import { deleteGame } from '@/lib/game-service';
import { ok, requireBearer, requireUuid, toResponse } from '@/lib/http';

/**
 * DELETE /api/games/[gameId] · o professor exclui a partida e cria outra.
 *
 * Exigir o Bearer do professor impede que um aluno (ou um navegador esquecido
 * numa sala anterior) apague uma partida que não é dele. Depois do DELETE a
 * sessão local do professor é limpa pela interface e a tela de criação volta a
 * aparecer — as tabelas filhas caem em cascata no banco.
 */

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ gameId: string }> },
) {
  try {
    const gameId = requireUuid((await params).gameId);
    const token = requireBearer(request);
    await deleteGame(gameId, token);
    return ok({ deleted: true });
  } catch (error) {
    return toResponse(error);
  }
}