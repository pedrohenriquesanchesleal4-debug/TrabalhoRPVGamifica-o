import { adminClient } from '@/lib/supabase';
import { ApiError, ok, toResponse } from '@/lib/http';
import {
  iniciarOficina,
  avancarStage,
  reabrirStageAnterior,
  pausarOficina,
  retomarOficina,
  encerrarOficina,
  reiniciarOficina,
  executarAcao,
  compartilharPista,
  votarEvento,
  abrirProximoEvento,
  resolverEventoAtual,
  submeterSolucao,
  getOficinaPublicView,
} from '@/lib/oficina-service';

/**
 * POST /api/oficina/[gameId] · criar/retomar/encerrar oficina
 * Corpo JSON opcional: { action: 'iniciar' | 'avançar' | 'pausar' | 'retomar' | 'encerrar' | 'reiniciar' }
 */
export async function POST(request: Request) {
  try {
    const { action } = await request.json();
    const { searchParams } = new URL(request.url);
    const gameId = searchParams.get('gameId') || '';

    if (!gameId) throw new ApiError('bad_request', 'Parâmetro gameId é obrigatório.');

    let result: any;

    switch (action) {
      case 'iniciar':
        result = await iniciarOficina(gameId);
        break;
      case 'avançar':
        result = await avancarStage(gameId);
        break;
      case 'reabrir':
        result = await reabrirStageAnterior(gameId);
        break;
      case 'pausar':
        result = await pausarOficina(gameId);
        break;
      case 'retomar':
        result = await retomarOficina(gameId);
        break;
      case 'encerrar':
        result = await encerrarOficina(gameId);
        break;
      case 'reiniciar':
        result = await reiniciarOficina(gameId);
        break;
      default:
        throw new ApiError('bad_request', 'Ação desconhecida.');
    }

    return ok(result);
  } catch (err: any) {
    return toResponse(err);
  }
}