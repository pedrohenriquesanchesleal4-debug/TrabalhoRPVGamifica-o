import { adminClient } from '@/lib/supabase';
import { ApiError, ok, requireUuid, toResponse } from '@/lib/http';
import { getOficinaPublicView, type OficinaPublicView } from '@/lib/oficina-service';
import type { GameMode } from '@/types/oficina';

/**
 * GET /api/oficina/[gameId]/projecao · o telão da Oficina Safra DF.
 *
 * Sem token, como a projeção do Diagnóstico: o professor projeta na parede e
 * qualquer um com o link acompanha. Só valida que a partida É do modo oficina
 * e devolve o que a turma inteira já tem direito de ver — sessão, equipes,
 * pistas, eventos e soluções — nunca segredos de estratégia.
 */

export interface OficinaProjecaoResponse {
  game: {
    id: string;
    code: string;
    status: string;
    mode: GameMode;
  };
  view: OficinaPublicView;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ gameId: string }> },
) {
  try {
    const gameId = requireUuid((await params).gameId);

    const { data: game, error } = await adminClient()
      .from('games')
      .select('id, code, status, mode')
      .eq('id', gameId)
      .maybeSingle();

    if (error) {
      throw new ApiError('server_error', 'Falha ao ler a partida.', error.message);
    }
    if (!game || game.mode !== 'oficina') {
      throw new ApiError('not_found', 'Partida não encontrada ou sem modo oficina.');
    }

    return ok<OficinaProjecaoResponse>({
      game: { id: game.id, code: game.code, status: game.status, mode: game.mode },
      view: await getOficinaPublicView(gameId),
    });
  } catch (error) {
    return toResponse(error);
  }
}