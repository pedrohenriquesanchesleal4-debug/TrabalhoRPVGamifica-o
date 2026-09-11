import { adminClient } from '@/lib/supabase';
import { ApiError, ok, toResponse } from '@/lib/http';
import {
  executarAcao,
  compartilharPista,
  votarEvento,
  abrirProximoEvento,
  resolverEventoAtual,
  submeterSolucao,
} from '@/lib/oficina-service';

/**
 * POST /api/host/[gameId]/oficina/acao · jogador executa ação
 */
export async function POST(request: Request) {
  try {
    const { gameId, teamId, acaoKey, alvoId } = await request.json();

    if (!gameId || !teamId || !acaoKey) {
      throw new ApiError('bad_request', 'Parâmetros obrigatórios: gameId, teamId, acaoKey.');
    }

    const result = await executarAcao({ gameId, teamId, acaoKey, alvoId });
    return ok(result);
  } catch (err: any) {
    return toResponse(err);
  }
}

/**
 * POST /api/host/[gameId]/oficina/compartilhar-pista
 */
export async function compartilharPistaHandler(request: Request) {
  try {
    const { gameId, teamId, pistaId } = await request.json();

    if (!gameId || !teamId || !pistaId) {
      throw new ApiError('bad_request', 'Parâmetros obrigatórios: gameId, teamId, pistaId.');
    }

    const result = await compartilharPista(gameId, teamId, pistaId);
    return ok(result);
  } catch (err: any) {
    return toResponse(err);
  }
}

/**
 * POST /api/host/[gameId]/oficina/votar-evento
 */
export async function votarEventoHandler(request: Request) {
  try {
    const { gameId, teamId, eventKey, opcaoKey } = await request.json();

    if (!gameId || !teamId || !eventKey || !opcaoKey) {
      throw new ApiError('bad_request', 'Parâmetros obrigatórios: gameId, teamId, eventKey, opcaoKey.');
    }

    const result = await votarEvento({ gameId, teamId, eventKey, opcaoKey });
    return ok(result);
  } catch (err: any) {
    return toResponse(err);
  }
}

/**
 * POST /api/host/[gameId]/oficina/abrir-proximo-evento
 */
export async function abrirProximoEventoHandler(request: Request) {
  try {
    const { gameId } = await request.json();

    if (!gameId) throw new ApiError('bad_request', 'Parâmetro gameId é obrigatório.');

    const result = await abrirProximoEvento(gameId);
    return ok(result);
  } catch (err: any) {
    return toResponse(err);
  }
}

/**
 * POST /api/host/[gameId]/oficina/resolver-evento-atual
 */
export async function resolverEventoAtualHandler(request: Request) {
  try {
    const { gameId } = await request.json();

    if (!gameId) throw new ApiError('bad_request', 'Parâmetro gameId é obrigatório.');

    const result = await resolverEventoAtual(gameId);
    return ok(result);
  } catch (err: any) {
    return toResponse(err);
  }
}

/**
 * POST /api/host/[gameId]/oficina/solucao
 */
export async function submeterSolucaoHandler(request: Request) {
  try {
    const { gameId, teamId, solucao } = await request.json();

    if (!gameId || !teamId || !solucao) {
      throw new ApiError('bad_request', 'Parâmetros obrigatórios: gameId, teamId, solucao.');
    }

    const result = await submeterSolucao(gameId, teamId, solucao);
    return ok(result);
  } catch (err: any) {
    return toResponse(err);
  }
}

/**
 * GET /api/host/[gameId]/oficina/view · vista pública da oficina
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const gameId = searchParams.get('gameId') || '';

    if (!gameId) throw new ApiError('bad_request', 'Parâmetro gameId é obrigatório.');

    const view = await getOficinaPublicView(gameId);
    return ok(view);
  } catch (err: any) {
    return toResponse(err);
  }
}