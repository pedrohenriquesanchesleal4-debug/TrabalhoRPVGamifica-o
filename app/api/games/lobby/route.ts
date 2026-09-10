import { z } from 'zod';
import { getGameLobby } from '@/lib/game-service';
import { ok, toResponse } from '@/lib/http';
import { ApiError } from '@/lib/http';
import { ROLE_LABEL } from '@/types/game';

/**
 * GET /api/games/lobby?code=XXXXX · leitura pública de pré-entrada.
 *
 * Sem token: é chamada ANTES de o jogador existir, para a tela de entrada
 * mostrar as 6 propriedades com vaga e papel disponíveis, e permitir escolher
 * em vez de só receber o que o auto-assign sortear. Nenhum dado sensível: só
 * nome e papel de quem já entrou, o mesmo que a projeção do professor expõe.
 */

const querySchema = z.object({
  code: z.string().min(3, 'Código da partida incompleto.').max(12),
});

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const parsed = querySchema.safeParse({ code: url.searchParams.get('code') ?? '' });

    if (!parsed.success) {
      throw new ApiError('bad_request', 'Código da partida incompleto.');
    }

    const lobby = await getGameLobby(parsed.data.code);

    return ok({
      gameId: lobby.gameId,
      gameCode: lobby.gameCode,
      gameStatus: lobby.gameStatus,
      teams: lobby.teams.map((team) => ({
        id: team.id,
        name: team.name,
        propertyKey: team.propertyKey,
        slotsUsed: team.slotsUsed,
        slotsMax: team.slotsMax,
        roles: team.roles.map((entry) => ({
          role: entry.role,
          roleLabel: ROLE_LABEL[entry.role],
          taken: entry.taken,
          playerName: entry.playerName,
        })),
      })),
    });
  } catch (error) {
    return toResponse(error);
  }
}
