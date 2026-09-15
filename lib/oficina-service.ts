import { SupabaseClient } from '@supabase/supabase-js';
import { ApiError } from './http';
import {
  aplicarDelta,
  validarAcao,
  acaoResultado,
  sortearEventos,
  eventoContribuicao,
  coerenciaSolucao,
  calcularResultados,
  calcularResultadoOficinaResumo,
  type EquipeInput,
} from '@/game/oficina-engine';
import { OFICINA_CONTENT } from '@/data/oficina-content';
import { OFICINA_IA_FALLBACKS } from '@/data/oficina-ia';
import {
  criarOficinaIndicadores,
  OFICINA_STAGES_ORDEM,
  type OficinaAcaoRow,
  type OficinaEquipeRow,
  type OficinaEvento,
  type OficinaEventoOpcao,
  type OficinaEventoRow,
  type OficinaIndicadores,
  type OficinaPistaRow,
  type OficinaPerfil,
  type OficinaResultadoCategoria,
  type OficinaResultadoRow,
  type OficinaSessaoRow,
  type OficinaSolucao,
  type OficinaSolucaoRow,
  type OficinaStage,
  type TagOficina,
} from '@/types/oficina';
import { adminClient } from './supabase';

/**
 * Serviço do modo Oficina Safra DF.
 *
 * Segue o mesmo modelo de segurança do Diagnóstico:
 * - O navegador NUNCA escreve no banco.
 * - Toda mutação acontece em route handlers via service_role.
 * - Validações de permissão, etapa, idempotência acontecem aqui.
 * - A engine pura (game/oficina-engine) faz os cálculos; este arquivo orquestra I/O.
 */

const MAX_ACOES_POR_ESTAGIO = 4;

function db(): SupabaseClient {
  return adminClient();
}

/** Ordem fixa de perfis para distribuição às equipes (1 perfil por equipe). */
export const OFICINA_PERFIS_ORDEM: OficinaPerfil[] = [
  'produtores',
  'cooperativa',
  'comercializacao',
  'logistica',
  'juventude_tech',
  'articulacao',
];

// ---------------------------------------------------------------------------
// Helpers de validação e estado
// ---------------------------------------------------------------------------

async function getSessao(gameId: string): Promise<OficinaSessaoRow | null> {
  const { data, error } = await db()
    .from('oficina_sessoes')
    .select('*')
    .eq('game_id', gameId)
    .maybeSingle();

  if (error) throw new ApiError('server_error', 'Falha ao ler sessão da oficina.', error.message);
  return data as OficinaSessaoRow | null;
}

async function getEquipe(teamId: string): Promise<OficinaEquipeRow | null> {
  const { data, error } = await db()
    .from('oficina_equipes')
    .select('*')
    .eq('team_id', teamId)
    .maybeSingle();

  if (error) throw new ApiError('server_error', 'Falha ao ler equipe da oficina.', error.message);
  return data as OficinaEquipeRow | null;
}

async function getEquipesDoJogo(gameId: string): Promise<OficinaEquipeRow[]> {
  const { data, error } = await db()
    .from('oficina_equipes')
    .select('*')
    .eq('game_id', gameId)
    .order('team_id');

  if (error) throw new ApiError('server_error', 'Falha ao listar equipes da oficina.', error.message);
  return (data ?? []) as OficinaEquipeRow[];
}

function requireStage(sessao: OficinaSessaoRow, expected: OficinaStage | OficinaStage[]) {
  const stages = Array.isArray(expected) ? expected : [expected];
  if (!stages.includes(sessao.stage)) {
    throw new ApiError('conflict', `Ação só permitida no estágio ${stages.join(' ou ')}. Atual: ${sessao.stage}`);
  }
}

function requireActive(sessao: OficinaSessaoRow) {
  if (sessao.status !== 'ativa') {
    throw new ApiError('conflict', `Oficina não está ativa (status: ${sessao.status}).`);
  }
}

// ---------------------------------------------------------------------------
// Criação da estrutura (usada pelo createGame quando mode = 'oficina')
// ---------------------------------------------------------------------------

/**
 * Cria as linhas mínimas para uma partida em modo oficina:
 * a sessão (aguardando, estágio briefing) e uma equipe da oficina por time,
 * cada uma com um perfil próprio e indicadores iniciais.
 *
 * Idempotente: se a sessão já existir, apenas preenche as equipes faltantes.
 */
export async function criarEstruturaOficina(gameId: string, teamIds: string[]): Promise<void> {
  const { data: sessaoExistente } = await db()
    .from('oficina_sessoes')
    .select('game_id')
    .eq('game_id', gameId)
    .maybeSingle();

  if (!sessaoExistente) {
    const { error } = await db().from('oficina_sessoes').insert({
      game_id: gameId,
      status: 'aguardando',
      stage: 'briefing',
      stage_progresso: 0,
      evento_atual: null,
      sorteio_eventos: [],
      iniciada_em: null,
      finalizada_em: null,
    });
    if (error) throw new ApiError('server_error', 'Falha ao criar a sessão da oficina.', error.message);
  }

  const { data: existentes } = await db()
    .from('oficina_equipes')
    .select('team_id')
    .eq('game_id', gameId);

  const jaExistem = new Set((existentes ?? []).map((row) => row.team_id));

  const linhas = teamIds
    .filter((teamId) => !jaExistem.has(teamId))
    .map((teamId, index) => ({
      game_id: gameId,
      team_id: teamId,
      perfil: OFICINA_PERFIS_ORDEM[index % OFICINA_PERFIS_ORDEM.length],
      indicadores: criarOficinaIndicadores(),
      acoes_usadas: 0,
      marcadores: [],
    }));

  if (linhas.length === 0) return;

  const { error } = await db().from('oficina_equipes').insert(linhas);
  if (error) throw new ApiError('server_error', 'Falha ao criar as equipes da oficina.', error.message);
}

// ---------------------------------------------------------------------------
// Professor: controle de ritmo da oficina
// ---------------------------------------------------------------------------

export interface IniciarOficinaResult {
  sessao: OficinaSessaoRow;
  narrativaInicial: string;
}

export async function iniciarOficina(gameId: string): Promise<IniciarOficinaResult> {
  const sessao = await getSessao(gameId);
  if (!sessao) throw new ApiError('not_found', 'Sessão da oficina não existe para esta partida.');
  if (sessao.status !== 'aguardando') throw new ApiError('conflict', 'Oficina já iniciada.');

  // Sorteia os eventos coletivos (até 3, determinístico por partida).
  const poolEventos = OFICINA_CONTENT.eventos.map((e) => e.key);
  const sorteados = sortearEventos(gameId, poolEventos, 3);

  const { error } = await db()
    .from('oficina_sessoes')
    .update({
      status: 'ativa',
      stage: 'briefing',
      stage_progresso: 0,
      evento_atual: null,
      sorteio_eventos: sorteados,
      iniciada_em: new Date().toISOString(),
    })
    .eq('game_id', gameId);

  if (error) throw new ApiError('server_error', 'Falha ao iniciar oficina.', error.message);

  await db().from('games').update({ status: 'running' }).eq('id', gameId);

  const narrativa = await getOrGenerateIa(gameId, 'narrativa_inicial', () => OFICINA_IA_FALLBACKS.narrativa_inicial);

  await emitOficinaEvent(gameId, 'OFICINA_STAGE_CHANGED', { stage: 'briefing' });

  const sessaoAtualizada: OficinaSessaoRow = { ...sessao, status: 'ativa', stage: 'briefing', sorteio_eventos: sorteados };
  return { sessao: sessaoAtualizada, narrativaInicial: narrativa };
}

export async function avancarStage(gameId: string): Promise<{ sessao: OficinaSessaoRow; narrativaTransicao?: string }> {
  const sessao = await getSessao(gameId);
  if (!sessao) throw new ApiError('not_found', 'Sessão não encontrada.');
  requireActive(sessao);

  const idx = OFICINA_STAGES_ORDEM.indexOf(sessao.stage);
  if (idx === -1 || idx === OFICINA_STAGES_ORDEM.length - 1) {
    throw new ApiError('conflict', 'Já está no último estágio.');
  }

  const nextStage = OFICINA_STAGES_ORDEM[idx + 1];
  const stageProgresso = 0;
  let eventoAtual: string | null = null;

  if (nextStage === 'eventos') {
    eventoAtual = sessao.sorteio_eventos[0] ?? null;
    if (eventoAtual) await abrirEventoColetivo(gameId, eventoAtual);
  }

  const { error } = await db()
    .from('oficina_sessoes')
    .update({ stage: nextStage, stage_progresso: stageProgresso, evento_atual: eventoAtual })
    .eq('game_id', gameId);

  if (error) throw new ApiError('server_error', 'Falha ao avançar estágio.', error.message);

  // O estágio resultado precisa dos cálculos de avaliação prontos na tela.
  if (nextStage === 'resultado') {
    await calcularResultadosOficina(gameId);
  }

  // Um novo estágio recomeça o limite de ações de todas as equipes.
  if (nextStage === 'investigacao') {
    await db()
      .from('oficina_equipes')
      .update({ acoes_usadas: 0 })
      .eq('game_id', gameId);
  }

  const narrativaTransicao = nextStage !== 'briefing'
    ? OFICINA_IA_FALLBACKS.transicoes[nextStage] ?? ''
    : undefined;

  await emitOficinaEvent(gameId, 'OFICINA_STAGE_CHANGED', { stage: nextStage, evento: eventoAtual });

  return { sessao: { ...sessao, stage: nextStage, stage_progresso: stageProgresso, evento_atual: eventoAtual }, narrativaTransicao };
}

/** Cria a linha aberta de um evento coletivo (uma única vez, por partida). */
async function abrirEventoColetivo(gameId: string, eventKey: string): Promise<void> {
  const { data: existente } = await db()
    .from('oficina_eventos')
    .select('id')
    .eq('game_id', gameId)
    .eq('event_key', eventKey)
    .maybeSingle();

  if (existente) return;

  const { error } = await db().from('oficina_eventos').insert({
    game_id: gameId,
    event_key: eventKey,
    status: 'aberto',
    aberto_em: new Date().toISOString(),
    contribuicoes: {},
  });
  if (error) throw new ApiError('server_error', 'Falha ao abrir o evento coletivo.', error.message);
}

export async function reabrirStageAnterior(gameId: string): Promise<OficinaSessaoRow> {
  const sessao = await getSessao(gameId);
  if (!sessao) throw new ApiError('not_found', 'Sessão não encontrada.');

  const idx = OFICINA_STAGES_ORDEM.indexOf(sessao.stage);
  if (idx <= 0) throw new ApiError('conflict', 'Já está no primeiro estágio.');

  const prevStage = OFICINA_STAGES_ORDEM[idx - 1];
  const eventoAtual = prevStage === 'eventos' ? sessao.sorteio_eventos[sessao.sorteio_eventos.length - 1] : null;

  const { error } = await db()
    .from('oficina_sessoes')
    .update({ stage: prevStage, stage_progresso: 0, evento_atual: eventoAtual })
    .eq('game_id', gameId);

  if (error) throw new ApiError('server_error', 'Falha ao reabrir estágio anterior.', error.message);

  await emitOficinaEvent(gameId, 'OFICINA_STAGE_CHANGED', { stage: prevStage });

  return { ...sessao, stage: prevStage, stage_progresso: 0, evento_atual: eventoAtual };
}

export async function pausarOficina(gameId: string): Promise<OficinaSessaoRow> {
  const sessao = await getSessao(gameId);
  if (!sessao) throw new ApiError('not_found', 'Sessão não encontrada.');
  if (sessao.status !== 'ativa') throw new ApiError('conflict', 'Só é possível pausar oficina ativa.');

  const { error } = await db().from('oficina_sessoes').update({ status: 'pausada' }).eq('game_id', gameId);
  if (error) throw new ApiError('server_error', 'Falha ao pausar.', error.message);

  await db().from('games').update({ status: 'paused' }).eq('id', gameId);

  await emitOficinaEvent(gameId, 'GAME_PAUSED', {});
  return { ...sessao, status: 'pausada' };
}

export async function retomarOficina(gameId: string): Promise<OficinaSessaoRow> {
  const sessao = await getSessao(gameId);
  if (!sessao) throw new ApiError('not_found', 'Sessão não encontrada.');
  if (sessao.status !== 'pausada') throw new ApiError('conflict', 'Só é possível retomar oficina pausada.');
  if (sessao.stage === 'encerrada') throw new ApiError('conflict', 'Oficina encerrada não pode ser retomada.');

  const { error } = await db().from('oficina_sessoes').update({ status: 'ativa' }).eq('game_id', gameId);
  if (error) throw new ApiError('server_error', 'Falha ao retomar.', error.message);

  await db().from('games').update({ status: 'running' }).eq('id', gameId);

  await emitOficinaEvent(gameId, 'GAME_RESUMED', {});
  return { ...sessao, status: 'ativa' };
}

export async function encerrarOficina(gameId: string): Promise<OficinaSessaoRow> {
  const sessao = await getSessao(gameId);
  if (!sessao) throw new ApiError('not_found', 'Sessão não encontrada.');
  if (sessao.status === 'encerrada' || sessao.stage === 'encerrada') {
    throw new ApiError('conflict', 'Oficina já encerrada.');
  }

  await calcularResultadosOficina(gameId);

  const { error } = await db()
    .from('oficina_sessoes')
    .update({ status: 'encerrada', stage: 'encerrada', finalizada_em: new Date().toISOString() })
    .eq('game_id', gameId);

  if (error) throw new ApiError('server_error', 'Falha ao encerrar.', error.message);

  await db().from('games').update({ status: 'finished', finished_at: new Date().toISOString() }).eq('id', gameId);

  await emitOficinaEvent(gameId, 'OFICINA_FINISHED', {});
  return { ...sessao, status: 'encerrada', stage: 'encerrada', finalizada_em: new Date().toISOString() };
}

export async function reiniciarOficina(gameId: string): Promise<OficinaSessaoRow> {
  const sessao = await getSessao(gameId);
  if (!sessao) throw new ApiError('not_found', 'Sessão não encontrada.');

  // Limpa todo estado da oficina (exceto sessão e equipes).
  await db().from('oficina_pistas').delete().eq('game_id', gameId);
  await db().from('oficina_acoes').delete().eq('game_id', gameId);
  await db().from('oficina_eventos').delete().eq('game_id', gameId);
  await db().from('oficina_solucoes').delete().eq('game_id', gameId);
  await db().from('oficina_resultados').delete().eq('game_id', gameId);
  await db().from('oficina_ia').delete().eq('game_id', gameId);
  await db()
    .from('oficina_equipes')
    .update({ indicadores: criarOficinaIndicadores(), acoes_usadas: 0, marcadores: [] })
    .eq('game_id', gameId);

  const { error } = await db()
    .from('oficina_sessoes')
    .update({
      status: 'aguardando',
      stage: 'briefing',
      stage_progresso: 0,
      evento_atual: null,
      sorteio_eventos: [],
      iniciada_em: null,
      finalizada_em: null,
    })
    .eq('game_id', gameId);

  if (error) throw new ApiError('server_error', 'Falha ao reiniciar.', error.message);

  await db().from('games').update({ status: 'lobby' }).eq('id', gameId);

  await emitOficinaEvent(gameId, 'GAME_RESET', {});
  return { ...sessao, status: 'aguardando', stage: 'briefing' };
}

// ---------------------------------------------------------------------------
// Ações do jogador (com idempotência)
// ---------------------------------------------------------------------------

export interface AcaoJogadorInput {
  gameId: string;
  teamId: string;
  acaoKey: string;
  /** Local ou personagem alvo (para ações de investigação). */
  alvoId?: string;
}

export interface AcaoJogadorResult {
  acao: OficinaAcaoRow;
  pistaDescoberta?: OficinaPistaRow;
  indicadoresAtualizados: OficinaIndicadores;
  aviso?: string;
}

export async function executarAcao(input: AcaoJogadorInput): Promise<AcaoJogadorResult> {
  const { gameId, teamId, acaoKey, alvoId } = input;

  const sessao = await getSessao(gameId);
  if (!sessao) throw new ApiError('not_found', 'Sessão não encontrada.');
  requireActive(sessao);
  requireStage(sessao, 'investigacao');

  const equipe = await getEquipe(teamId);
  if (!equipe) throw new ApiError('not_found', 'Equipe não encontrada na oficina.');

  const acaoDef = OFICINA_CONTENT.acoes.find((a) => a.key === acaoKey);
  if (!acaoDef) throw new ApiError('bad_request', 'Ação inválida.');

  // Valida requisitos (tags de pista): vetor de tags por pista da equipe.
  const pistasTags: string[][] = [];
  const { data: pistasEquipe } = await db()
    .from('oficina_pistas')
    .select('pista_id')
    .eq('game_id', gameId)
    .eq('team_id', teamId);

  if (pistasEquipe) {
    for (const p of pistasEquipe) {
      const pistaDef = OFICINA_CONTENT.pistas.find((pi) => pi.id === p.pista_id);
      if (pistaDef) pistasTags.push(pistaDef.tags);
    }
  }

  const validacao = validarAcao({
    acao: acaoDef,
    indicadores: equipe.indicadores,
    pistasTags,
    acoesUsadas: equipe.acoes_usadas,
    maxAcoesPorEstagio: MAX_ACOES_POR_ESTAGIO,
  });

  if (!validacao.ok) throw new ApiError('conflict', validacao.motivo!);

  // `acaoResultado` devolve o NOVO estado completo em `efeitos`. Guardamos no
  // log o delta (o que mudou de fato), mas aplicamos o estado final completo.
  const resultadoAcao = acaoResultado(equipe.indicadores, acaoDef);
  const novosIndicadores = resultadoAcao.efeitos;
  const deltas = deltaOf(equipe.indicadores, novosIndicadores);
  const aviso = resultadoAcao.aviso;

  // Idempotência: a constraint unique (team_id, stage, acao_key, alvo_id)
  // impede o clique duplo. Se já rodou antes, devolve a ação registrada sem
  // aplicar efeitos de novo.
  const { data: acaoInserida, error: insertError } = await db()
    .from('oficina_acoes')
    .insert({
      game_id: gameId,
      team_id: teamId,
      stage: sessao.stage,
      acao_key: acaoKey,
      alvo_id: alvoId ?? null,
      efeitos: deltas,
    })
    .select()
    .maybeSingle();

  if (insertError) {
    if (insertError.code === '23505') {
      const { data: existente } = await db()
        .from('oficina_acoes')
        .select('*')
        .eq('game_id', gameId)
        .eq('team_id', teamId)
        .eq('stage', sessao.stage)
        .eq('acao_key', acaoKey)
        .eq('alvo_id', alvoId ?? null)
        .maybeSingle();

      const { data: equipeAtual } = await db()
        .from('oficina_equipes')
        .select('indicadores')
        .eq('team_id', teamId)
        .maybeSingle();

      return {
        acao: existente as OficinaAcaoRow,
        indicadoresAtualizados: (equipeAtual?.indicadores ?? equipe.indicadores) as OficinaIndicadores,
      };
    }
    throw new ApiError('server_error', 'Falha ao registrar ação.', insertError.message);
  }

  // Aplica efeitos nos indicadores (só na primeira execução).
  const { data: acaoRow } = await db()
    .from('oficina_equipes')
    .update({ indicadores: novosIndicadores, acoes_usadas: equipe.acoes_usadas + 1 })
    .eq('team_id', teamId)
    .select()
    .single();

  // Ação de investigação com alvo: tenta descobrir a pista associada ao alvo.
  let pistaDescoberta: OficinaPistaRow | undefined;
  if (acaoDef.investiga && alvoId) {
    const pistaAlvo = OFICINA_CONTENT.pistas.find((p) => p.id === alvoId || p.origem.includes(alvoId));
    if (pistaAlvo) {
      const { data: pistaRow, error: pistaError } = await db()
        .from('oficina_pistas')
        .insert({
          game_id: gameId,
          team_id: teamId,
          pista_id: pistaAlvo.id,
          descoberta_em: new Date().toISOString(),
        })
        .select()
        .maybeSingle();

      if (!pistaError && pistaRow) {
        pistaDescoberta = pistaRow as OficinaPistaRow;
        await marcarTagsPista(teamId, pistaAlvo.tags);
        await emitOficinaEvent(gameId, 'OFICINA_CLUE_FOUND', { teamId, pistaId: pistaAlvo.id });
      }
    }
  }

  await marcarTagsPista(teamId, acaoDef.tags);

  return {
    acao: (acaoInserida ?? acaoRow) as OficinaAcaoRow,
    pistaDescoberta,
    indicadoresAtualizados: novosIndicadores,
    aviso,
  };
}

/** Calcula o delta (diff) entre dois estados de indicadores. */
function deltaOf(de: OficinaIndicadores, para: OficinaIndicadores): Partial<OficinaIndicadores> {
  const delta: Partial<OficinaIndicadores> = {};
  for (const chave of Object.keys(para) as (keyof OficinaIndicadores)[]) {
    const diff = para[chave] - de[chave];
    if (diff !== 0) delta[chave] = diff;
  }
  return delta;
}

async function marcarTagsPista(teamId: string, tags: TagOficina[]) {
  const equipe = await getEquipe(teamId);
  if (!equipe) return;

  const novosMarcadores = new Set(equipe.marcadores);
  if (tags.includes('tecnologia') || tags.includes('conectividade')) novosMarcadores.add('tech_usada');
  if (tags.includes('capacitacao')) novosMarcadores.add('capacitacao_feita');

  if (novosMarcadores.size !== equipe.marcadores.length) {
    await db()
      .from('oficina_equipes')
      .update({ marcadores: [...novosMarcadores] })
      .eq('team_id', teamId);
  }
}

// ---------------------------------------------------------------------------
// Compartilhar pista
// ---------------------------------------------------------------------------

export async function compartilharPista(gameId: string, teamId: string, pistaId: string): Promise<OficinaPistaRow> {
  const sessao = await getSessao(gameId);
  if (!sessao) throw new ApiError('not_found', 'Sessão não encontrada.');
  requireActive(sessao);
  requireStage(sessao, 'investigacao');

  const { data, error } = await db()
    .from('oficina_pistas')
    .update({ compartilhada_em: new Date().toISOString() })
    .eq('game_id', gameId)
    .eq('team_id', teamId)
    .eq('pista_id', pistaId)
    .select()
    .maybeSingle();

  if (error) throw new ApiError('server_error', 'Falha ao compartilhar pista.', error.message);
  if (!data) throw new ApiError('not_found', 'Pista não encontrada para esta equipe.');

  await emitOficinaEvent(gameId, 'OFICINA_CLUE_SHARED', { teamId, pistaId });
  return data as OficinaPistaRow;
}

// ---------------------------------------------------------------------------
// Eventos coletivos
// ---------------------------------------------------------------------------

export interface VotarEventoInput {
  gameId: string;
  teamId: string;
  eventKey: string;
  opcaoKey: string;
}

export async function votarEvento(input: VotarEventoInput): Promise<{ opcao: OficinaEventoOpcao; efeitos: Partial<OficinaIndicadores> }> {
  const { gameId, teamId, eventKey, opcaoKey } = input;

  const sessao = await getSessao(gameId);
  if (!sessao) throw new ApiError('not_found', 'Sessão não encontrada.');
  requireActive(sessao);
  requireStage(sessao, 'eventos');
  if (sessao.evento_atual !== eventKey) throw new ApiError('conflict', 'Evento não é o atual.');

  const eventoDef = OFICINA_CONTENT.eventos.find((e) => e.key === eventKey);
  if (!eventoDef) throw new ApiError('bad_request', 'Evento inválido.');

  const opcao = eventoDef.opcoes.find((o) => o.key === opcaoKey);
  if (!opcao) throw new ApiError('bad_request', 'Opção inválida.');

  const { data: existente } = await db()
    .from('oficina_eventos')
    .select('contribuicoes')
    .eq('game_id', gameId)
    .eq('event_key', eventKey)
    .maybeSingle();

  const contribuicoes = (existente?.contribuicoes ?? {}) as Record<string, { opcao_key: string; efeitos: Partial<OficinaIndicadores> }>;
  if (contribuicoes[teamId]) throw new ApiError('conflict', 'Esta equipe já contribuiu neste evento.');

  const equipe = await getEquipe(teamId);
  if (!equipe) throw new ApiError('not_found', 'Equipe não encontrada.');

  const efeitosIndividuais = eventoContribuicao(equipe.indicadores, opcao, eventoDef.efeito_coletivo);
  const novosIndicadores = aplicarDelta(equipe.indicadores, efeitosIndividuais);

  await db().from('oficina_equipes').update({ indicadores: novosIndicadores }).eq('team_id', teamId);

  const novasContribuicoes = { ...contribuicoes, [teamId]: { opcao_key: opcaoKey, efeitos: efeitosIndividuais } };

  // Guarda otimista contra clique duplo: o update só casa se a equipe ainda
  // NÃO estiver nas contribuições. Se outro clique já gravou, o filter não
  // casa, data vem null e tratamos como conflito (idempotente, sem duplo delta).
  const { data: atualizado } = await db()
    .from('oficina_eventos')
    .update({ contribuicoes: novasContribuicoes })
    .eq('game_id', gameId)
    .eq('event_key', eventKey)
    .not('contribuicoes', 'contains', { [teamId]: { opcao_key: opcaoKey, efeitos: efeitosIndividuais } })
    .select('id')
    .maybeSingle();

  if (!atualizado) {
    return {
      opcao,
      efeitos: {},
    };
  }

  await emitOficinaEvent(gameId, 'OFICINA_EVENT_RESOLVED', { teamId, eventKey, opcaoKey });

  return { opcao, efeitos: efeitosIndividuais };
}

export async function abrirProximoEvento(gameId: string): Promise<{ sessao: OficinaSessaoRow; evento?: OficinaEvento }> {
  const sessao = await getSessao(gameId);
  if (!sessao) throw new ApiError('not_found', 'Sessão não encontrada.');
  requireActive(sessao);
  requireStage(sessao, 'eventos');

  const proxIdx = sessao.stage_progresso + 1;
  if (proxIdx >= sessao.sorteio_eventos.length) {
    const avancado = await avancarStage(gameId);
    return { sessao: avancado.sessao };
  }

  const proximoEventoKey = sessao.sorteio_eventos[proxIdx];
  const eventoDef = OFICINA_CONTENT.eventos.find((e) => e.key === proximoEventoKey);

  await abrirEventoColetivo(gameId, proximoEventoKey);

  const { error } = await db()
    .from('oficina_sessoes')
    .update({ stage_progresso: proxIdx, evento_atual: proximoEventoKey })
    .eq('game_id', gameId);

  if (error) throw new ApiError('server_error', 'Falha ao abrir próximo evento.', error.message);

  await emitOficinaEvent(gameId, 'OFICINA_EVENT_OPENED', { eventKey: proximoEventoKey, idx: proxIdx });

  return { sessao: { ...sessao, stage_progresso: proxIdx, evento_atual: proximoEventoKey }, evento: eventoDef };
}

export async function resolverEventoAtual(gameId: string): Promise<{ sessao: OficinaSessaoRow; efeitosColetivos: Partial<OficinaIndicadores> }> {
  const sessao = await getSessao(gameId);
  if (!sessao) throw new ApiError('not_found', 'Sessão não encontrada.');
  requireActive(sessao);
  requireStage(sessao, 'eventos');

  const eventoKey = sessao.evento_atual;
  if (!eventoKey) throw new ApiError('conflict', 'Nenhum evento aberto.');

  const eventoDef = OFICINA_CONTENT.eventos.find((e) => e.key === eventoKey);
  if (!eventoDef) throw new ApiError('bad_request', 'Evento inválido.');

  // Quem já contribuiu recebeu individual + coletivo na hora do voto
  // (eventoContribuicao combina os dois). Só quem faltou recebe agora o
  // coletivo — evita aplicar o mesmo delta duas vezes.
  const { data: eventRow } = await db()
    .from('oficina_eventos')
    .select('contribuicoes')
    .eq('game_id', gameId)
    .eq('event_key', eventoKey)
    .maybeSingle();

  const contribuicoes = (eventRow?.contribuicoes ?? {}) as Record<string, unknown>;

  const equipes = await getEquipesDoJogo(gameId);
  for (const eq of equipes) {
    if (contribuicoes[eq.team_id]) continue;
    const novos = aplicarDelta(eq.indicadores, eventoDef.efeito_coletivo);
    await db().from('oficina_equipes').update({ indicadores: novos }).eq('team_id', eq.team_id);
  }

  await db()
    .from('oficina_eventos')
    .update({ status: 'resolvido', resolvido_em: new Date().toISOString() })
    .eq('game_id', gameId)
    .eq('event_key', eventoKey);

  await emitOficinaEvent(gameId, 'OFICINA_EVENT_RESOLVED', { eventKey: eventoKey, coletivo: true });

  return { sessao: { ...sessao }, efeitosColetivos: eventoDef.efeito_coletivo };
}

// ---------------------------------------------------------------------------
// Solução final
// ---------------------------------------------------------------------------

export async function submeterSolucao(gameId: string, teamId: string, solucao: OficinaSolucao): Promise<OficinaSolucaoRow> {
  const sessao = await getSessao(gameId);
  if (!sessao) throw new ApiError('not_found', 'Sessão não encontrada.');
  requireActive(sessao);
  requireStage(sessao, 'solucao');

  const { data, error } = await db()
    .from('oficina_solucoes')
    .upsert(
      {
        game_id: gameId,
        team_id: teamId,
        blocos: solucao,
        enviada_em: new Date().toISOString(),
      },
      { onConflict: 'team_id' },
    )
    .select()
    .maybeSingle();

  if (error) throw new ApiError('server_error', 'Falha ao submeter solução.', error.message);
  if (!data) throw new ApiError('server_error', 'Falha ao salvar solução.');

  await emitOficinaEvent(gameId, 'OFICINA_SOLUTION_SUBMITTED', { teamId });

  return data as OficinaSolucaoRow;
}

// ---------------------------------------------------------------------------
// Avaliação de coerência da solução (apoio ao professor, não bloqueio)
// ---------------------------------------------------------------------------

export function avaliarCoerencia(solucao: OficinaSolucao): { score: number; avisos: string[]; alinhados: string[]; desalinhados: string[] } {
  const problemaEscolhido = solucao.blocos.problema_principal;
  const problemaTags = OFICINA_CONTENT.pistas.find((p) => p.id === problemaEscolhido)?.tags ?? [];
  return coerenciaSolucao(solucao, problemaEscolhido ?? '', problemaTags, OFICINA_CONTENT.cartoes);
}

// ---------------------------------------------------------------------------
// Cálculo de resultados
// ---------------------------------------------------------------------------

export async function calcularResultadosOficina(gameId: string): Promise<void> {
  const equipes = await getEquipesDoJogo(gameId);

  const solucoes: Record<string, OficinaSolucao> = {};
  for (const eq of equipes) {
    const { data: sol } = await db()
      .from('oficina_solucoes')
      .select('blocos')
      .eq('game_id', gameId)
      .eq('team_id', eq.team_id)
      .maybeSingle();
    if (sol) solucoes[eq.team_id] = sol.blocos as OficinaSolucao;
  }

  const problemaTagsPorEquipe: Record<string, TagOficina[]> = {};
  for (const [teamId, sol] of Object.entries(solucoes)) {
    const probKey = sol.blocos.problema_principal;
    const prob = OFICINA_CONTENT.pistas.find((p) => p.id === probKey);
    problemaTagsPorEquipe[teamId] = prob?.tags ?? [];
  }

  const inputs: EquipeInput[] = equipes.map((e) => ({
    team_id: e.team_id,
    indicadores: e.indicadores,
    marcadores: e.marcadores,
    solucao: solucoes[e.team_id],
  }));

  const resultados = calcularResultados(inputs, OFICINA_CONTENT.cartoes, problemaTagsPorEquipe);

  for (const eq of equipes) {
    const catEquipe = resultados.filter((r) => r.team_id === eq.team_id);
    await db().from('oficina_resultados').upsert(
      {
        game_id: gameId,
        team_id: eq.team_id,
        categorias: catEquipe,
        indicadores: eq.indicadores,
        criado_em: new Date().toISOString(),
      },
      { onConflict: 'team_id' },
    );
  }
}

export async function resumoParaDebate(gameId: string): Promise<{ resumo_para_debate: string }> {
  const equipes = await getEquipesDoJogo(gameId);

  const { data: resultados, error } = await db()
    .from('oficina_resultados')
    .select('categorias')
    .eq('game_id', gameId);

  if (error) throw new ApiError('server_error', 'Falha ao ler resultados.', error.message);

  const categorias = (resultados ?? []).flatMap((row) =>
    Array.isArray(row.categorias) ? (row.categorias as OficinaResultadoCategoria[]) : [],
  );

  const inputs: EquipeInput[] = equipes.map((e) => ({
    team_id: e.team_id,
    indicadores: e.indicadores,
    marcadores: e.marcadores,
    solucao: undefined,
  }));

  // IA gera o roteiro completo (fala de abertura, pontos com soluções reais,
  // provocação e perguntas). Sem IA, cai no resumo determinístico neutro.
  const roteiro = await getOrGenerateIa(gameId, 'debate', () => {
    const { resumo_para_debate } = calcularResultadoOficinaResumo(inputs, categorias);
    return resumo_para_debate;
  });

  return { resumo_para_debate: roteiro };
}

// ---------------------------------------------------------------------------
// IA econômica (cache por partida — 3 slots no máximo)
// ---------------------------------------------------------------------------

type OficinaIaTipo = 'narrativa_inicial' | 'reflexao_final' | 'debate';

async function getOrGenerateIa(gameId: string, tipo: OficinaIaTipo, fallback: () => string): Promise<string> {
  const { data: cached } = await db()
    .from('oficina_ia')
    .select('texto')
    .eq('game_id', gameId)
    .eq('tipo', tipo)
    .maybeSingle();

  if (cached?.texto) return cached.texto;

  const texto = await chamarIaOficina(gameId, tipo, fallback);
  await db().from('oficina_ia').upsert({ game_id: gameId, tipo, texto, modelo: 'gemini-3.6-flash' });
  return texto;
}

async function chamarIaOficina(gameId: string, tipo: OficinaIaTipo, fallback: () => string): Promise<string> {
  try {
    const { _internals } = await import('./gemini');
    const snapshot = await construirSnapshotOficina(gameId, tipo);
    const system = construirPromptIaOficina(tipo);
    const roteiro = await _internals.callGeminiText(system, snapshot);
    return roteiro;
  } catch {
    return fallback();
  }
}

/**
 * Snapshot compacto da oficina para a IA: tudo que ela pode citar, sem ruído.
 * `narrativa_inicial` não precisa dos dados; os demais tipos leem o estado real.
 */
async function construirSnapshotOficina(gameId: string, tipo: OficinaIaTipo): Promise<string> {
  if (tipo === 'narrativa_inicial') {
    return 'Oficina colaborativa da Comunidade Boa Vista do Cerrado. Voz de quem convida: humana, digna, sem jargão de IA.';
  }

  const [equipes, solucoes, resultados, pistas, eventos] = await Promise.all([
    getEquipesDoJogo(gameId),
    db().from('oficina_solucoes').select('*').eq('game_id', gameId),
    db().from('oficina_resultados').select('*').eq('game_id', gameId),
    db().from('oficina_pistas').select('*').eq('game_id', gameId),
    db().from('oficina_eventos').select('*').eq('game_id', gameId),
  ]);

  const nomePorTeam = new Map<string, string>();
  if (pistas.data && pistas.data.length > 0) {
    // Nomes reais das equipes vêm da tabela teams.
  }
  const teamRows = await db().from('teams').select('id, name').eq('game_id', gameId);
  for (const t of teamRows.data ?? []) {
    nomePorTeam.set(t.id, t.name as string);
  }

  const rotuloBloco = (bloco: string, chave: string | undefined): string => {
    if (!chave) return '';
    const cartao = OFICINA_CONTENT.cartoes.find((c) => c.bloco === bloco);
    const opcao = cartao?.opcoes.find((o) => o.key === chave);
    return opcao?.rotulo ?? chave;
  };

  /** Lê blocos/campos livres de uma solução com segurança, sem depender do tipo do banco. */
  const lerSolucao = (solucao: unknown): Record<string, string> => {
    const out: Record<string, string> = {};
    if (!solucao || typeof solucao !== 'object') return out;
    const s = solucao as {
      blocos?: Record<string, string> | null;
      campos_livres?: Record<string, string> | null;
    };
    for (const [bloco, chave] of Object.entries(s.blocos ?? {})) {
      const rotulo = rotuloBloco(bloco, chave);
      if (rotulo) out[bloco] = rotulo;
    }
    for (const [bloco, livre] of Object.entries(s.campos_livres ?? {})) {
      if (typeof livre === 'string' && livre.trim()) out[`${bloco}_livre`] = livre.trim().slice(0, 120);
    }
    return out;
  };

  const compact = {
    oficina: gameId,
    equipes: (equipes ?? []).map((eq) => {
      const sol = (solucoes.data ?? []).find((s) => s.team_id === eq.team_id);
      const solucao = lerSolucao(sol?.blocos);
      return {
        nome: nomePorTeam.get(eq.team_id) ?? 'Equipe',
        perfil: eq.perfil,
        indicadores: eq.indicadores,
        solucao,
      };
    }),
    categorias: (resultados.data ?? []).flatMap((row) =>
      Array.isArray(row.categorias) ? (row.categorias as { categoria: string; razao: string }[]) : [],
    ).map((c) => ({ categoria: c.categoria, razao: c.razao.slice(0, 160) })),
    pistasCompartilhadas: (pistas.data ?? []).filter((p) => p.compartilhada_em).length,
    eventosResolvidos: (eventos.data ?? []).filter((e) => e.status === 'resolvido').length,
  };

  return JSON.stringify(compact);
}

function construirPromptIaOficina(tipo: OficinaIaTipo): string {
  switch (tipo) {
    case 'narrativa_inicial':
      return 'Você é um narrador de oficina comunitária no Cerrado. Escreva 3-4 parágrafos acolhedores apresentando a "Comunidade Boa Vista do Cerrado", seus desafios (transporte, conectividade, comercialização, capacitação, políticas públicas) e convidando 6 equipes com perfis distintos a colaborar. Tom: humano, digno, sem jargão de IA. Português do Brasil.';
    case 'reflexao_final':
      return 'Você é facilitador pedagógico. Escreva uma reflexão final de 4-5 parágrafos sobre a oficina comunitária recém-concluída, retomando as 9 perguntas-chave como provocação para debate em sala. Use APENAS os dados reais da oficina fornecidos (indicadores das equipes, soluções, categorias de destaque, pistas compartilhadas, eventos resolvidos). Tom: professor experiente, sem julgamento de certo/errado, foco no processo coletivo. Português do Brasil.';
    case 'debate':
      return 'Você é mediador de debate escolar. De POSSE dos dados reais da oficina fornecidos (soluções das equipes, indicadores, categorias de destaque), gere um roteiro completo para o professor conduzir o debate pós-atividade: fala de abertura acolhedora ancorada em um fato real da oficina, 3 pontos para sustentar — cada um citando uma solução concreta de equipe (problema, parceiro, política pública, transporte ou tecnologia que a equipe escolheu) —, 1 provocação forte e 3 perguntas para a sala. Não invente solução que não esteja nos dados. Cite políticas públicas reais (PAA, PNAE, ATER/Emater-DF) apenas se aparecerem nas soluções das equipes. Formato markdown: # título, ## subtítulo, - listas, 1. listas. PT-BR oral, completo, sem cortar.';
  }
}

export async function reflexaoFinalOficina(gameId: string): Promise<{ reflexao: string; perguntas: string[] }> {
  const reflexao = await getOrGenerateIa(gameId, 'reflexao_final', () => OFICINA_IA_FALLBACKS.reflexao_final);
  return { reflexao, perguntas: OFICINA_IA_FALLBACKS.reflexao_perguntas };
}

// ---------------------------------------------------------------------------
// Realtime emit (server-side)
// ---------------------------------------------------------------------------

async function emitOficinaEvent(gameId: string, type: string, payload: Record<string, unknown>) {
  const { error } = await db().from('game_events').insert({ game_id: gameId, type, payload });
  if (error) {
    console.error(`[safra-df] falha ao emitir ${type}:`, error.message);
  }
}

// ---------------------------------------------------------------------------
// View pública (leitura RLS anon + conteúdo estático)
// ---------------------------------------------------------------------------

export interface OficinaEquipeComNome extends OficinaEquipeRow {
  nome: string;
}

export interface OficinaPublicView {
  gameId: string;
  sessao: OficinaSessaoRow | null;
  equipes: OficinaEquipeComNome[];
  pistas: OficinaPistaRow[];
  eventos: OficinaEventoRow[];
  solucoes: OficinaSolucaoRow[];
  resultados: OficinaResultadoRow[];
}

export async function getOficinaPublicView(gameId: string): Promise<OficinaPublicView> {
  const [sessao, equipes, pistas, eventos, solucoes, resultados, teamRows] = await Promise.all([
    getSessao(gameId),
    getEquipesDoJogo(gameId),
    db().from('oficina_pistas').select('*').eq('game_id', gameId).order('descoberta_em'),
    db().from('oficina_eventos').select('*').eq('game_id', gameId).order('aberto_em'),
    db().from('oficina_solucoes').select('*').eq('game_id', gameId).order('enviada_em'),
    db().from('oficina_resultados').select('*').eq('game_id', gameId).order('criado_em'),
    db().from('teams').select('id, name').eq('game_id', gameId),
  ]);

  const nomePorTeam = new Map((teamRows.data ?? []).map((t) => [t.id, t.name]));

  const equipesComNome: OficinaEquipeComNome[] = equipes.map((e) => ({
    ...e,
    nome: nomePorTeam.get(e.team_id) ?? 'Equipe',
  }));

  return {
    gameId,
    sessao: sessao as OficinaSessaoRow | null,
    equipes: equipesComNome,
    pistas: (pistas.data ?? []) as OficinaPistaRow[],
    eventos: (eventos.data ?? []) as OficinaEventoRow[],
    solucoes: (solucoes.data ?? []) as OficinaSolucaoRow[],
    resultados: (resultados.data ?? []) as OficinaResultadoRow[],
  };
}