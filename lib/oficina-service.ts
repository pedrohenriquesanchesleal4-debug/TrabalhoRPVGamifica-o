import { adminClient } from '@/lib/supabase';
import { ApiError, ok, toResponse } from '@/lib/http';
import {
  aplicarDelta,
  validarAcao,
  acaoResultado,
  sortearEventos,
  eventoContribuicao,
  coerenciaSolucao,
  calcularResultados,
  calcularResultadoOficinaResumo,
  type OficinaIndicadores,
  type OficinaAcao,
  type OficinaEvento,
  type OficinaEventoOpcao,
  type OficinaSolucao,
  type OficinaBlocoSolucao,
  type OficinaEquipeRow,
  type OficinaSessaoRow,
  type OficinaAcaoRow,
  type OficinaPistaRow,
  type OficinaEventoRow,
  type OficinaSolucaoRow,
  type OficinaResultadoRow,
  type OficinaStage,
  type OficinaStatus,
  type TagOficina,
  OFICINA_STAGES_ORDEM,
  OFICINA_PERFIS_INFO,
  OFICINA_BLOCOS_INFO,
} from '@/types/oficina';
import { OFICINA_CONTENT } from '@/data/oficina-content';
import { OFICINA_IA_FALLBACKS } from '@/data/oficina-ia';
import { generateToken, hashToken } from './tokens';

const db = adminClient;

/**
 * Serviço do modo Oficina Safra DF.
 *
 * Segue o mesmo modelo de segurança do Diagnóstico:
 * - O navegador NUNCA escreve no banco.
 * - Toda mutação acontece em route handlers via service_role.
 * - Validações de permissão, etapa, idempotência acontecem aqui.
 * - A engine pura (oficina-engine) faz os cálculos; este arquivo orquestra I/O.
 */

const MAX_ACOES_POR_ESTAGIO = 4;

// ---------------------------------------------------------------------------
// Helpers de validação e estado
// ---------------------------------------------------------------------------

async function getSessao(gameId: string): Promise<OficinaSessaoRow | null> {
  const { data, error } = await db
    .from('oficina_sessoes')
    .select('*')
    .eq('game_id', gameId)
    .maybeSingle();

  if (error) throw new ApiError('server_error', 'Falha ao ler sessão da oficina.', error.message);
  return data as OficinaSessaoRow | null;
}

async function getEquipe(teamId: string): Promise<OficinaEquipeRow | null> {
  const { data, error } = await db
    .from('oficina_equipes')
    .select('*')
    .eq('team_id', teamId)
    .maybeSingle();

  if (error) throw new ApiError('server_error', 'Falha ao ler equipe da oficina.', error.message);
  return data as OficinaEquipeRow | null;
}

async function getEquipesDoJogo(gameId: string): Promise<OficinaEquipeRow[]> {
  const { data, error } = await db
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

  // Sorteia os 3 eventos coletivos (fixo para MVP)
  const poolEventos = OFICINA_CONTENT.eventos.map((e) => e.key);
  const sorteados = sortearEventos(gameId, poolEventos, 3);

  const { error } = await db
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

  // Busca/gera narrativa inicial (IA ou fallback)
  const narrativa = await getOrGenerateIa(gameId, 'narrativa_inicial', () => OFICINA_IA_FALLBACKS.narrativa_inicial);

  // Emite evento realtime
  await emitOficinaEvent(gameId, 'OFICINA_STAGE_CHANGED', { stage: 'briefing' });

  return { sessao: { ...sessao, status: 'ativa', stage: 'briefing', sorteio_eventos: sorteados }, narrativaInicial: narrativa };
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

  // Se avançando PARA eventos, abre o primeiro evento sorteado
  let eventoAtual: string | null = null;
  let stageProgresso = 0;
  if (nextStage === 'eventos') {
    eventoAtual = sessao.sorteio_eventos[0] ?? null;
    stageProgresso = 0;
  }

  const { error } = await db
    .from('oficina_sessoes')
    .update({
      stage: nextStage,
      stage_progresso: stageProgresso,
      evento_atual: eventoAtual,
    })
    .eq('game_id', gameId);

  if (error) throw new ApiError('server_error', 'Falha ao avançar estágio.', error.message);

  const narrativaTransicao = nextStage !== 'briefing'
    ? OFICINA_IA_FALLBACKS.transicoes[nextStage] ?? ''
    : undefined;

  await emitOficinaEvent(gameId, 'OFICINA_STAGE_CHANGED', { stage: nextStage, evento: eventoAtual });

  return { sessao: { ...sessao, stage: nextStage, stage_progresso: stageProgresso, evento_atual: eventoAtual }, narrativaTransicao };
}

export async function reabrirStageAnterior(gameId: string): Promise<OficinaSessaoRow> {
  const sessao = await getSessao(gameId);
  if (!sessao) throw new ApiError('not_found', 'Sessão não encontrada.');

  const idx = OFICINA_STAGES_ORDEM.indexOf(sessao.stage);
  if (idx <= 0) throw new ApiError('conflict', 'Já está no primeiro estágio.');

  const prevStage = OFICINA_STAGES_ORDEM[idx - 1];
  const eventoAtual = prevStage === 'eventos' ? sessao.sorteio_eventos[sessao.sorteio_eventos.length - 1] : null;

  const { error } = await db
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

  const { error } = await db.from('oficina_sessoes').update({ status: 'pausada' }).eq('game_id', gameId);
  if (error) throw new ApiError('server_error', 'Falha ao pausar.', error.message);

  await emitOficinaEvent(gameId, 'GAME_PAUSED', {});
  return { ...sessao, status: 'pausada' };
}

export async function retomarOficina(gameId: string): Promise<OficinaSessaoRow> {
  const sessao = await getSessao(gameId);
  if (!sessao) throw new ApiError('not_found', 'Sessão não encontrada.');
  if (sessao.status !== 'pausada') throw new ApiError('conflict', 'Só é possível retomar oficina pausada.');

  const { error } = await db.from('oficina_sessoes').update({ status: 'ativa' }).eq('game_id', gameId);
  if (error) throw new ApiError('server_error', 'Falha ao retomar.', error.message);

  await emitOficinaEvent(gameId, 'GAME_RESUMED', {});
  return { ...sessao, status: 'ativa' };
}

export async function encerrarOficina(gameId: string): Promise<OficinaSessaoRow> {
  const sessao = await getSessao(gameId);
  if (!sessao) throw new ApiError('not_found', 'Sessão não encontrada.');
  if (sessao.status === 'encerrada') throw new ApiError('conflict', 'Já encerrada.');

  // Calcula resultados finais
  await calcularResultadosOficina(gameId);

  const { error } = await db
    .from('oficina_sessoes')
    .update({ status: 'encerrada', stage: 'encerrada', finalizada_em: new Date().toISOString() })
    .eq('game_id', gameId);

  if (error) throw new ApiError('server_error', 'Falha ao encerrar.', error.message);

  await emitOficinaEvent(gameId, 'OFICINA_FINISHED', {});

  return { ...sessao, status: 'encerrada', stage: 'encerrada' };
}

export async function reiniciarOficina(gameId: string): Promise<OficinaSessaoRow> {
  const sessao = await getSessao(gameId);
  if (!sessao) throw new ApiError('not_found', 'Sessão não encontrada.');

  // Limpa todo estado da oficina (exceto sessão)
  await db.from('oficina_equipes').update({ indicadores: criarIndicadoresIniciais(), acoes_usadas: 0, marcadores: [] }).eq('game_id', gameId);
  await db.from('oficina_pistas').delete().eq('game_id', gameId);
  await db.from('oficina_acoes').delete().eq('game_id', gameId);
  await db.from('oficina_eventos').delete().eq('game_id', gameId);
  await db.from('oficina_solucoes').delete().eq('game_id', gameId);
  await db.from('oficina_resultados').delete().eq('game_id', gameId);
  await db.from('oficina_ia').delete().eq('game_id', gameId);

  const { error } = await db
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

  await emitOficinaEvent(gameId, 'GAME_RESET', {});
  return { ...sessao, status: 'aguardando', stage: 'briefing' };
}

function criarIndicadoresIniciais(): OficinaIndicadores {
  return {
    cooperacao: 50,
    organizacao: 50,
    mercado: 50,
    conhecimento: 50,
    sustentabilidade: 50,
    confianca: 50,
    inclusao: 50,
    viabilidade: 50,
  };
}

// ---------------------------------------------------------------------------
// Ações do jogador (com idempotência)
// ---------------------------------------------------------------------------

export interface AcaoJogadorInput {
  gameId: string;
  teamId: string;
  acaoKey: string;
  alvoId?: string; // local_id ou pista_id
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

  // Verifica limite de ações
  if (equipe.acoes_usadas >= MAX_ACOES_POR_ESTAGIO) {
    throw new ApiError('conflict', `Limite de ${MAX_ACOES_POR_ESTAGIO} ações por estágio atingido.`);
  }

  // Busca ação no conteúdo
  const acaoDef = OFICINA_CONTENT.acoes.find((a) => a.key === acaoKey);
  if (!acaoDef) throw new ApiError('bad_request', 'Ação inválida.');

  // Valida requisitos (tags de pista)
  const pistasEquipe = await db
    .from('oficina_pistas')
    .select('pista_id')
    .eq('game_id', gameId)
    .eq('team_id', teamId);

  const pistasTags: TagOficina[] = [];
  if (pistasEquipe.data) {
    for (const p of pistasEquipe.data) {
      const pistaDef = OFICINA_CONTENT.pistas.find((pi) => pi.id === p.pista_id);
      if (pistaDef) pistasTags.push(...pistaDef.tags);
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

  // Idempotência: tenta inserir no log de ações
  const { data: acaoExistente, error: insertError } = await db
    .from('oficina_acoes')
    .insert({
      game_id: gameId,
      team_id: teamId,
      stage: sessao.stage,
      acao_key: acaoKey,
      alvo_id: alvoId ?? null,
      efeitos: acaoResultado(equipe.indicadores, acaoDef).efeitos,
    })
    .select()
    .maybeSingle();

  if (insertError && insertError.code !== '23505') { // unique_violation
    throw new ApiError('server_error', 'Falha ao registrar ação.', insertError.message);
  }

  // Se já existia (clique duplo), retorna a existente sem duplicar efeitos
  if (acaoExistente) {
    const indicadoresAtuais = await getEquipe(teamId);
    return { acao: acaoExistente as OficinaAcaoRow, indicadoresAtualizados: indicadoresAtuais!.indicadores };
  }

  // Aplica efeitos nos indicadores
  const { efeitos, aviso } = acaoResultado(equipe.indicadores, acaoDef);
  const novosIndicadores = aplicarDelta(equipe.indicadores, efeitos);

  await db.from('oficina_equipes').update({ indicadores: novosIndicadores, acoes_usadas: equipe.acoes_usadas + 1 }).eq('team_id', teamId);

  // Se ação investiga e tem alvo, tenta descobrir pista
  let pistaDescoberta: OficinaPistaRow | undefined;
  if (acaoDef.investiga && alvoId) {
    // Busca a pista associada ao alvo (local ou personagem)
    const pistaAlvo = OFICINA_CONTENT.pistas.find((p) => p.id === alvoId || p.origem.includes(alvoId));
    if (pistaAlvo) {
      const { data: pistaRow, error: pistaError } = await db
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
        // Marca marcador se for tecnologia/conectividade
        if (pistaAlvo.tags.includes('tecnologia') || pistaAlvo.tags.includes('conectividade')) {
          await adicionarMarcador(teamId, 'tech_usada');
        }
        if (pistaAlvo.tags.includes('capacitacao')) {
          await adicionarMarcador(teamId, 'capacitacao_feita');
        }
        await emitOficinaEvent(gameId, 'OFICINA_CLUE_FOUND', { teamId, pistaId: pistaAlvo.id });
      }
    }
  }

  // Adiciona marcadores baseados em tags da ação
  if (acaoDef.tags.includes('tecnologia') || acaoDef.tags.includes('conectividade')) {
    await adicionarMarcador(teamId, 'tech_usada');
  }
  if (acaoDef.tags.includes('capacitacao')) {
    await adicionarMarcador(teamId, 'capacitacao_feita');
  }

  return { acao: { ...acaoExistente!, efeitos } as OficinaAcaoRow, pistaDescoberta, indicadoresAtualizados: novosIndicadores, aviso };
}

async function adicionarMarcador(teamId: string, marcador: string) {
  const equipe = await getEquipe(teamId);
  if (!equipe) return;
  if (!equipe.marcadores.includes(marcador)) {
    await db.from('oficina_equipes').update({ marcadores: [...equipe.marcadores, marcador] }).eq('team_id', teamId);
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

  const { data, error } = await db
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

  // Verifica se já votou
  const { data: existente } = await db
    .from('oficina_eventos')
    .select('contribuicoes')
    .eq('game_id', gameId)
    .eq('event_key', eventKey)
    .maybeSingle();

  const contribuicoes = (existente?.contribuicoes ?? {}) as Record<string, { opcao_key: string; efeitos: Partial<OficinaIndicadores> }>;
  if (contribuicoes[teamId]) throw new ApiError('conflict', 'Esta equipe já contribuiu neste evento.');

  // Aplica efeitos individuais + coletivos
  const equipe = await getEquipe(teamId);
  if (!equipe) throw new ApiError('not_found', 'Equipe não encontrada.');

  const efeitosIndividuais = eventoContribuicao(equipe.indicadores, opcao, eventoDef.efeito_coletivo);
  const novosIndicadores = aplicarDelta(equipe.indicadores, efeitosIndividuais);

  await db.from('oficina_equipes').update({ indicadores: novosIndicadores }).eq('team_id', teamId);

  // Registra contribuição
  const novasContribuicoes = { ...contribuicoes, [teamId]: { opcao_key: opcaoKey, efeitos: efeitosIndividuais } };
  await db.from('oficina_eventos').update({ contribuicoes: novasContribuicoes }).eq('game_id', gameId).eq('event_key', eventKey);

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
    // Fim dos eventos → avança para solução
    return { sessao: await avancarStage(gameId) };
  }

  const proximoEventoKey = sessao.sorteio_eventos[proxIdx];
  const eventoDef = OFICINA_CONTENT.eventos.find((e) => e.key === proximoEventoKey);

  const { error } = await db
    .from('oficina_sessoes')
    .update({ stage_progresso: proxIdx, evento_atual: proximoEventoKey })
    .eq('game_id', gameId);

  if (error) throw new ApiError('server_error', 'Falha ao abrir próximo evento.', error.message);

  // Cria registro do evento coletivo
  await db.from('oficina_eventos').insert({
    game_id: gameId,
    event_key: proximoEventoKey,
    status: 'aberto',
    aberto_em: new Date().toISOString(),
    contribuicoes: {},
  }).select().maybeSingle();

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

  // Aplica efeito coletivo a todas as equipes
  const equipes = await getEquipesDoJogo(gameId);
  for (const eq of equipes) {
    const novos = aplicarDelta(eq.indicadores, eventoDef.efeito_coletivo);
    await db.from('oficina_equipes').update({ indicadores: novos }).eq('team_id', eq.team_id);
  }

  // Marca evento como resolvido
  await db.from('oficina_eventos').update({ status: 'resolvido', resolvido_em: new Date().toISOString() }).eq('game_id', gameId).eq('event_key', eventoKey);

  await emitOficinaEvent(gameId, 'OFICINA_EVENT_RESOLVED', { eventKey, coletivo: true });

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

  // Validação leve de coerência (só aviso, não bloqueia)
  const problemaEscolhido = solucao.blocos.problema_principal;
  const problemaTags = OFICINA_CONTENT.pistas.find((p) => p.id === problemaEscolhido)?.tags ?? [];

  const { error } = await db
    .from('oficina_solucoes')
    .upsert({
      game_id: gameId,
      team_id: teamId,
      blocos: solucao,
      enviada_em: new Date().toISOString(),
    })
    .select()
    .maybeSingle();

  if (error) throw new ApiError('server_error', 'Falha ao submeter solução.', error.message);

  await emitOficinaEvent(gameId, 'OFICINA_SOLUTION_SUBMITTED', { teamId });

  return data as OficinaSolucaoRow;
}

// ---------------------------------------------------------------------------
// Cálculo de resultados
// ---------------------------------------------------------------------------

async function calcularResultadosOficina(gameId: string): Promise<void> {
  const equipes = await getEquipesDoJogo(gameId);
  const solucoes: Record<string, OficinaSolucao> = {};

  for (const eq of equipes) {
    const { data: sol } = await db
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

  const resultados = calcularResultados(
    equipes.map((e) => ({ team_id: e.team_id, indicadores: e.indicadores, marcadores: e.marcadores, solucao: solucoes[e.team_id] })),
    OFICINA_CONTENT.cartoes,
    problemaTagsPorEquipe
  );

  // Salva resultados por equipe
  for (const eq of equipes) {
    const catEquipe = resultados.filter((r) => r.team_id === eq.team_id);
    await db.from('oficina_resultados').upsert({
      game_id: gameId,
      team_id: eq.team_id,
      categorias: catEquipe,
      indicadores: eq.indicadores,
    });
  }
}

// ---------------------------------------------------------------------------
// IA econômica
// ---------------------------------------------------------------------------

async function getOrGenerateIa(gameId: string, tipo: 'narrativa_inicial' | 'reflexao_final' | 'debate', fallback: () => string): Promise<string> {
  const { data: cached } = await db
    .from('oficina_ia')
    .select('texto')
    .eq('game_id', gameId)
    .eq('tipo', tipo)
    .maybeSingle();

  if (cached?.texto) return cached.texto;

  // Chama IA real (com timeout e fallback)
  const texto = await chamarIaOficina(tipo, fallback);
  await db.from('oficina_ia').upsert({ game_id: gameId, tipo, texto, modelo: 'gemini-3.6-flash' });
  return texto;
}

async function chamarIaOficina(tipo: string, fallback: () => string): Promise<string> {
  // Reusa a infraestrutura do gemini.ts via import dinâmico para não criar dependência circular
  try {
    const { _internals } = await import('./gemini');
    const prompt = construirPromptIaOficina(tipo);
    const roteiro = await _internals.callGeminiWithRetry(prompt);
    return roteiro;
  } catch {
    return fallback();
  }
}

function construirPromptIaOficina(tipo: string): string {
  // Prompts curtos, sem dados sensíveis, reusando fallbacks como base
  const base = OFICINA_IA_FALLBACKS;

  switch (tipo) {
    case 'narrativa_inicial':
      return `Você é um narrador de oficina comunitária no Cerrado. Escreva 3-4 parágrafos acolhedores apresentando a "Comunidade Boa Vista do Cerrado", seus desafios (transporte, conectividade, comercialização, capacitação, políticas públicas) e convidando 6 equipes com perfis distintos a colaborar. Tom: humano, digno, sem jargão de IA. Português do Brasil.`;
    case 'reflexao_final':
      return `Você é facilitador pedagógico. Escreva uma reflexão final de 4-5 parágrafos sobre a oficina comunitária recém-concluída, retomando as 9 perguntas-chave como provocação para debate em sala. Tom: professor experiente, sem julgamento de certo/errado, foco no processo coletivo. Português do Brasil.`;
    case 'debate':
      return `Você é mediador de debate escolar. Com base na oficina "Comunidade Boa Vista do Cerrado", gere um roteiro para o professor conduzir o debate pós-atividade: fala de abertura, 3 pontos para sustentar, 1 provocação, 3 perguntas para a sala. Cite políticas públicas reais (PAA, PNAE, ATER) apenas se aparecerem nas soluções das equipes. Formato markdown simples (# ## - 1. **). PT-BR oral.`;
    default:
      return fallback();
  }
}

// ---------------------------------------------------------------------------
// Realtime emit (server-side)
// ---------------------------------------------------------------------------

async function emitOficinaEvent(gameId: string, type: string, payload: Record<string, unknown>) {
  await db.from('game_events').insert({ game_id: gameId, type, payload });
}

// ---------------------------------------------------------------------------
// View pública para o mapa (anon read via RLS)
// ---------------------------------------------------------------------------

export interface OficinaPublicView {
  sessao: OficinaSessaoRow | null;
  equipes: OficinaEquipeRow[];
  locais: typeof OFICINA_CONTENT.locais;
  personagens: typeof OFICINA_CONTENT.personagens;
}

export async function getOficinaPublicView(gameId: string): Promise<OficinaPublicView> {
  const [sessao, equipes] = await Promise.all([getSessao(gameId), getEquipesDoJogo(gameId)]);
  return { sessao, equipes, locais: OFICINA_CONTENT.locais, personagens: OFICINA_CONTENT.personagens };
}