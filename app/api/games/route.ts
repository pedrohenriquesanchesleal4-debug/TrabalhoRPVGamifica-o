import { z } from 'zod';
import { createGame } from '@/lib/game-service';
import { ok, parseBody, toResponse } from '@/lib/http';

/**
 * POST /api/games · o professor cria a partida.
 *
 * Devolve o código para projetar e o token de professor, que é a credencial de
 * controle da partida. O cliente guarda esse token no navegador; o banco guarda
 * apenas o hash.
 */

const bodySchema = z
  .object({
    initialBudget: z.number().int().min(10_000).max(1_000_000).optional(),
    roundSeconds: z.number().int().min(30).max(900).optional(),
    teamCount: z.number().int().min(1).max(6).optional(),
    maxPlayersPerTeam: z.number().int().min(1).max(12).optional(),
    weights: z
      .object({
        finances: z.number().int().min(0).max(100),
        production: z.number().int().min(0).max(100),
        technology: z.number().int().min(0).max(100),
        sustainability: z.number().int().min(0).max(100),
      })
      .optional(),
  })
  .default({});

export async function POST(request: Request) {
  try {
    const config = await parseBody(request, bodySchema);
    const { game, hostToken, teams } = await createGame(config);

    return ok({
      gameId: game.id,
      code: game.code,
      hostToken,
      config: game.config,
      teams: teams
        .slice()
        .sort((a, b) => a.order_index - b.order_index)
        .map((team) => ({ id: team.id, name: team.name, propertyKey: team.property_key })),
    });
  } catch (error) {
    return toResponse(error);
  }
}
