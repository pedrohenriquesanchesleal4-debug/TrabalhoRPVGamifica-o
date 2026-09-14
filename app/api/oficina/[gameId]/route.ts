import { ok, toResponse, requireBearer, ApiError } from '@/lib/http';
import {
  iniciarOficina,
  avancarStage,
  reabrirStageAnterior,
  pausarOficina,
  retomarOficina,
  encerrarOficina,
  reiniciarOficina,
  abrirProximoEvento,
  resolverEventoAtual,
  reflexaoFinalOficina,
  resumoParaDebate,
  getOficinaPublicView,
} from '@/lib/oficina-service';
import { authenticateHost } from '@/lib/game-service';

/**
 * /api/oficina/[gameId] · controle do professor sobre a oficina.
 *
 * Segue o modelo de segurança de todo o resto: somente o token do professor
 * (Bearer) autentica qualquer mutação ou leitura. O navegador nunca escreve
 * direto no banco.
 *
 * GET  → { game, view } (sessão + equipes + pistas + eventos + soluções + resultados)
 * POST → { action } com:
 *   'iniciar' | 'avancar' | 'reabrir' | 'pausar' | 'retomar' | 'encerrar' |
 *   'reiniciar' | 'abrir_evento' | 'resolver_evento' | 'resumo' | 'reflexao'
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ gameId: string }> },
) {
  try {
    const { gameId } = await params;
    const game = await authenticateHost(gameId, requireBearer(request));
    const view = await getOficinaPublicView(gameId);
    return ok({ game, view });
  } catch (err) {
    return toResponse(err);
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ gameId: string }> },
) {
  try {
    const { gameId } = await params;
    const game = await authenticateHost(gameId, requireBearer(request));

    const { action } = await request.json().catch(() => ({ action: undefined }));
    if (typeof action !== 'string' || action.length === 0) {
      throw new ApiError('bad_request', 'Ação ausente na requisição.');
    }

    switch (action) {
      case 'iniciar':
        return ok({ game, oficinaInicial: await iniciarOficina(gameId) });
      case 'avancar':
        return ok({ game, avancada: await avancarStage(gameId) });
      case 'reabrir':
        return ok({ game, sessao: await reabrirStageAnterior(gameId) });
      case 'pausar':
        return ok({ game, sessao: await pausarOficina(gameId) });
      case 'retomar':
        return ok({ game, sessao: await retomarOficina(gameId) });
      case 'encerrar':
        return ok({ game, sessao: await encerrarOficina(gameId) });
      case 'reiniciar':
        return ok({ game, sessao: await reiniciarOficina(gameId) });
      case 'abrir_evento':
        return ok({ game, eventoAberto: await abrirProximoEvento(gameId) });
      case 'resolver_evento':
        return ok({ game, evento: await resolverEventoAtual(gameId) });
      case 'resumo':
        return ok({ game, debate: await resumoParaDebate(gameId) });
      case 'reflexao':
        return ok({ game, reflexao: await reflexaoFinalOficina(gameId) });
      default:
        throw new ApiError('bad_request', 'Ação desconhecida.');
    }
  } catch (err) {
    return toResponse(err);
  }
}