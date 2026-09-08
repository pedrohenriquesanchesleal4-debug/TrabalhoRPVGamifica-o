import { z } from 'zod';
import { joinGame } from '@/lib/game-service';
import { ok, parseBody, toResponse } from '@/lib/http';
import { ROLE_LABEL, ROLE_MISSION } from '@/types/game';

/**
 * POST /api/games/join · o aluno entra com código e nome.
 *
 * Sem cadastro e sem senha: o servidor devolve um token de sessão que o
 * navegador guarda. É o que permite estar jogando em menos de um minuto, como o
 * briefing exige, sem abrir mão de validar quem envia cada decisão.
 */

const bodySchema = z.object({
  code: z.string().min(3).max(12),
  name: z.string().min(1).max(40),
});

export async function POST(request: Request) {
  try {
    const { code, name } = await parseBody(request, bodySchema);
    const { playerToken, player, team, role, game } = await joinGame(code, name);

    return ok({
      playerToken,
      gameId: game.id,
      gameCode: game.code,
      gameStatus: game.status,
      player: { id: player.id, name: player.name },
      team: { id: team.id, name: team.name, propertyKey: team.property_key },
      role,
      roleLabel: ROLE_LABEL[role],
      roleMission: ROLE_MISSION[role],
    });
  } catch (error) {
    return toResponse(error);
  }
}
