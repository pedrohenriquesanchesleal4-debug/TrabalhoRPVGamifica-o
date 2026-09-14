import { ok, toResponse, requireBearer, ApiError } from '@/lib/http';
import { authenticatePlayer } from '@/lib/game-service';
import { adminClient } from '@/lib/supabase';
import {
  executarAcao,
  compartilharPista,
  votarEvento,
  submeterSolucao,
  getOficinaPublicView,
} from '@/lib/oficina-service';
import type { OficinaIndicadores, OficinaPerfil, OficinaSolucao } from '@/types/oficina';

/**
 * /api/player/oficina · superfície do aluno no modo Oficina.
 *
 * O `teamId` do jogador é sempre derivado da SESSÃO (token Bearer), nunca do
 * corpo da requisição: um aluno não pode agir como outra equipe.
 *
 * GET  → { game, eu, view }  (perfil, indicadores, pista da equipe via view)
 * POST → { action } com 'acao' | 'compartilhar' | 'votar' | 'solucao'
 */
export async function GET(request: Request) {
  try {
    const session = await authenticatePlayer(requireBearer(request));

    if (session.game.mode !== 'oficina') {
      throw new ApiError('bad_request', 'Esta partida não é uma Oficina.');
    }

    return ok(await carregarPainelOficina(session));
  } catch (err) {
    return toResponse(err);
  }
}

export async function POST(request: Request) {
  try {
    const session = await authenticatePlayer(requireBearer(request));

    if (session.game.mode !== 'oficina') {
      throw new ApiError('bad_request', 'Esta partida não é uma Oficina.');
    }

    const gameId = session.game.id;
    const teamId = session.member.team_id;

    const { action } = await request.json().catch(() => ({ action: undefined }));
    if (typeof action !== 'string' || action.length === 0) {
      throw new ApiError('bad_request', 'Ação ausente na requisição.');
    }

    switch (action) {
      case 'acao': {
        const body = await request.json();
        const { acaoKey, alvoId } = body;
        if (typeof acaoKey !== 'string') throw new ApiError('bad_request', 'Chave da ação ausente.');
        const resultado = await executarAcao({ gameId, teamId, acaoKey, alvoId: typeof alvoId === 'string' ? alvoId : undefined });
        return ok(resultado);
      }
      case 'compartilhar': {
        const body = await request.json();
        if (typeof body?.pistaId !== 'string') throw new ApiError('bad_request', 'Pista ausente.');
        const pista = await compartilharPista(gameId, teamId, body.pistaId);
        return ok({ pista });
      }
      case 'votar': {
        const body = await request.json();
        if (typeof body?.eventKey !== 'string' || typeof body?.opcaoKey !== 'string') {
          throw new ApiError('bad_request', 'Evento ou opção ausente.');
        }
        const contribuicao = await votarEvento({ gameId, teamId, eventKey: body.eventKey, opcaoKey: body.opcaoKey });
        return ok({ contribuicao });
      }
      case 'solucao': {
        const body = await request.json();
        const solucao = body?.solucao as OficinaSolucao | undefined;
        if (!solucao || typeof solucao !== 'object' || typeof solucao.blocos !== 'object') {
          throw new ApiError('bad_request', 'Solução inválida.');
        }
        const salva = await submeterSolucao(gameId, teamId, {
          blocos: solucao.blocos ?? {},
          campos_livres: solucao.campos_livres ?? {},
        });
        return ok({ solucao: salva });
      }
      default:
        throw new ApiError('bad_request', 'Ação desconhecida.');
    }
  } catch (err) {
    return toResponse(err);
  }
}

async function carregarPainelOficina(session: Awaited<ReturnType<typeof authenticatePlayer>>) {
  const { player, member, team, game } = session;
  const [equipe, solucao, view, narrativa] = await Promise.all([
    queryEquipe(member.team_id),
    querySolucao(member.team_id),
    getOficinaPublicView(game.id),
    queryNarrativaInicial(game.id),
  ]);

  return {
    game: { id: game.id, code: game.code, status: game.status },
    briefing: { narrativaInicial: narrativa },
    eu: {
      playerId: player.id,
      name: player.name,
      teamId: team.id,
      teamName: team.name,
      perfil: (member.role as OficinaPerfil) ?? null,
      indicadores: (equipe?.indicadores ?? null) as OficinaIndicadores | null,
      marcadores: equipe?.marcadores ?? [],
      acoesUsadas: equipe?.acoes_usadas ?? 0,
      solucao: solucao ?? null,
    },
    view,
  };
}

async function queryNarrativaInicial(gameId: string) {
  const { data, error } = await adminClient()
    .from('oficina_ia')
    .select('texto')
    .eq('game_id', gameId)
    .eq('tipo', 'narrativa_inicial')
    .maybeSingle();
  if (error) throw new ApiError('server_error', 'Falha ao carregar o briefing.', error.message);
  return (data?.texto as string | undefined) ?? null;
}

async function queryEquipe(teamId: string) {
  const { data, error } = await adminClient().from('oficina_equipes').select('*').eq('team_id', teamId).maybeSingle();
  if (error) throw new ApiError('server_error', 'Falha ao carregar a equipe da oficina.', error.message);
  return data as { indicadores: OficinaIndicadores; marcadores: string[]; acoes_usadas: number } | null;
}

async function querySolucao(teamId: string) {
  const { data, error } = await adminClient().from('oficina_solucoes').select('blocos').eq('team_id', teamId).maybeSingle();
  if (error) throw new ApiError('server_error', 'Falha ao carregar a solução.', error.message);
  return (data?.blocos as OficinaSolucao | undefined) ?? null;
}