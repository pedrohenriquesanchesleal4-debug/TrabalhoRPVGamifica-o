import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/http';

/**
 * Testes de regressão para dois bugs reais encontrados por depuração
 * sistemática (ver `.agents/memoria/erros-corrigidos.md`):
 *
 * 1. `createGame` deixava vazar exceção crua (env ausente, cliente do
 *    Supabase mal configurado) para o fallback genérico de `toResponse`
 *    ("Algo falhou no servidor. Tente de novo."), sem dizer ao professor se
 *    era rede, configuração ou outra coisa.
 * 2. `authenticatePlayer`/`getPlayerView` faziam até 11 consultas ao banco em
 *    série por chamada, mesmo quando várias delas não dependiam uma da
 *    outra: cada round-trip extra custa ~250-400ms medidos contra o Supabase
 *    em us-west-2, o que explica a latência patológica vista em produção.
 *
 * Os dois testes usam um cliente Supabase falso (sem rede real): o de
 * concorrência mede quantas consultas ficam "em voo" ao mesmo tempo, o que
 * comprova paralelismo de forma determinística, sem depender de relógio.
 */

// ---------------------------------------------------------------------------
// Cliente Supabase falso
// ---------------------------------------------------------------------------

interface FakeResult {
  data: unknown;
  error: { message: string; code?: string } | null;
  delayMs?: number;
}

const CHAIN_METHODS = [
  'select',
  'eq',
  'in',
  'order',
  'insert',
  'update',
  'upsert',
  'delete',
  'single',
  'maybeSingle',
] as const;

/**
 * Cria um cliente falso onde cada `.from(table)` consome o próximo resultado
 * da fila daquela tabela. `concurrency` acumula o número de consultas
 * simultaneamente "em voo" por tabela: é o que comprova paralelismo real, e
 * não só ausência de erro.
 */
function makeFakeSupabase(queues: Record<string, FakeResult[]>) {
  let active = 0;
  let maxActive = 0;
  const callOrder: string[] = [];

  const client = {
    from(table: string) {
      const chain: Record<string, unknown> = {};
      for (const method of CHAIN_METHODS) {
        chain[method] = () => chain;
      }
      chain.then = (
        resolve: (value: FakeResult) => void,
        reject: (reason: unknown) => void,
      ) => {
        const queue = queues[table];
        if (!queue || queue.length === 0) {
          throw new Error(`fakeSupabase: fila vazia para a tabela "${table}"`);
        }
        const entry = queue.shift()!;
        callOrder.push(table);

        active += 1;
        maxActive = Math.max(maxActive, active);

        return new Promise<void>((res) => setTimeout(res, entry.delayMs ?? 5))
          .then(() => {
            active -= 1;
            resolve(entry);
          })
          .catch(reject);
      };
      return chain;
    },
  };

  return {
    client,
    callOrder,
    get maxConcurrency() {
      return maxActive;
    },
  };
}

const { adminClientMock } = vi.hoisted(() => ({ adminClientMock: vi.fn() }));

vi.mock('@/lib/supabase', () => ({
  adminClient: adminClientMock,
  browserClient: vi.fn(),
}));

beforeEach(() => {
  adminClientMock.mockReset();
});

// ---------------------------------------------------------------------------
// Problema 1 · createGame nunca deve deixar vazar exceção crua
// ---------------------------------------------------------------------------

describe('createGame · classificação de erro inesperado', () => {
  it('erro de configuração (env ausente / cliente inválido) vira ApiError acionável, não exceção crua', async () => {
    adminClientMock.mockImplementation(() => {
      // Reproduz o throw síncrono real de `createClient()` do supabase-js
      // quando a URL está ausente ou mal formada.
      throw new Error('Invalid supabaseUrl: Must be a valid HTTP or HTTPS URL.');
    });

    const { createGame } = await import('@/lib/game-service');

    await expect(createGame({})).rejects.toBeInstanceOf(ApiError);
    await expect(createGame({})).rejects.toMatchObject({
      code: 'server_error',
      message: expect.stringMatching(/configura/i),
    });
  });

  it('falha de rede transitória na escrita é reexecutada e a partida é criada normalmente', async () => {
    const { client } = makeFakeSupabase({
      games: [{ data: { id: 'g1', code: 'ABCDE', config: {} }, error: null }],
      game_secrets: [
        { data: null, error: { message: 'TypeError: fetch failed' } }, // 1ª tentativa: rede cai
        { data: {}, error: null }, // 2ª tentativa: recupera
      ],
      teams: [{ data: [{ id: 't1' }], error: null }],
    });
    adminClientMock.mockReturnValue(client);

    const { createGame } = await import('@/lib/game-service');
    const result = await createGame({});

    expect(result.game.code).toBe('ABCDE');
  });

  it('falha de rede persistente vira ApiError distinta de rede, não a mensagem genérica', async () => {
    const { client } = makeFakeSupabase({
      games: [{ data: { id: 'g1', code: 'ABCDE', config: {} }, error: null }],
      game_secrets: [
        { data: null, error: { message: 'TypeError: fetch failed' } },
        { data: null, error: { message: 'TypeError: fetch failed' } },
        { data: null, error: { message: 'TypeError: fetch failed' } },
      ],
      teams: [],
    });
    adminClientMock.mockReturnValue(client);

    const { createGame } = await import('@/lib/game-service');

    await expect(createGame({})).rejects.toMatchObject({
      code: 'server_error',
      message: expect.stringMatching(/rede|conex/i),
    });
  });

  it('erro de negócio (constraint, RLS) continua com a mensagem específica de sempre, sem retry', async () => {
    const { client, callOrder } = makeFakeSupabase({
      games: [{ data: { id: 'g1', code: 'ABCDE', config: {} }, error: null }],
      game_secrets: [{ data: {}, error: null }],
      teams: [{ data: null, error: { message: 'duplicate key value violates unique constraint' } }],
    });
    adminClientMock.mockReturnValue(client);

    const { createGame } = await import('@/lib/game-service');

    await expect(createGame({})).rejects.toMatchObject({
      code: 'server_error',
      message: 'Falha ao criar as equipes.',
    });
    // Erro de negócio não é de rede: não deve ter havido segunda tentativa.
    expect(callOrder.filter((table) => table === 'teams')).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// Problema 2 · leituras da tela do jogador em paralelo, não em série
// ---------------------------------------------------------------------------

describe('getPlayerView / authenticatePlayer · paralelismo de consultas', () => {
  it('authenticatePlayer roda em paralelo as consultas que não dependem uma da outra', async () => {
    const fake = makeFakeSupabase({
      player_secrets: [{ data: { player_id: 'p1' }, error: null, delayMs: 20 }],
      players: [
        {
          data: { id: 'p1', game_id: 'g1', name: 'Ana', connected: true, state: 'thinking', last_seen: 'x' },
          error: null,
          delayMs: 20,
        },
      ],
      team_members: [{ data: { id: 'm1', team_id: 't1', player_id: 'p1', role: 'produtor' }, error: null, delayMs: 20 }],
      teams: [
        {
          data: {
            id: 't1',
            game_id: 'g1',
            slug: 'sitio',
            name: 'Sítio',
            property_key: 'sitio-horizonte',
            order_index: 0,
            cash: 80000,
            production: 50,
            technology: 40,
            sustainability: 50,
            traits: {},
          },
          error: null,
          delayMs: 20,
        },
      ],
      games: [
        {
          data: {
            id: 'g1',
            code: 'ABCDE',
            status: 'lobby',
            current_round: 0,
            round_status: 'idle',
            round_started_at: null,
            round_ends_at: null,
            config: {},
            created_at: 'x',
            finished_at: null,
          },
          error: null,
          delayMs: 20,
        },
      ],
    });
    adminClientMock.mockReturnValue(fake.client);

    const { authenticatePlayer } = await import('@/lib/game-service');
    const session = await authenticatePlayer('qualquer-token');

    expect(session.player.id).toBe('p1');
    expect(session.team.id).toBe('t1');
    // Prova de paralelismo real: em algum momento, 2 consultas ficaram "em
    // voo" ao mesmo tempo. Se alguém reintroduzir a versão 100% em série,
    // maxConcurrency volta a 1 e este teste falha.
    expect(fake.maxConcurrency).toBeGreaterThanOrEqual(2);
  });

  it('getPlayerView busca evento e decisão da rodada em paralelo, não em série', async () => {
    const fake = makeFakeSupabase({
      player_secrets: [{ data: { player_id: 'p1' }, error: null }],
      players: [
        {
          data: { id: 'p1', game_id: 'g1', name: 'Ana', connected: true, state: 'thinking', last_seen: 'x' },
          error: null,
        },
      ],
      team_members: [
        { data: { id: 'm1', team_id: 't1', player_id: 'p1', role: 'produtor' }, error: null },
        {
          // segunda consulta a team_members: roster da equipe, com embed de players
          data: [
            {
              player_id: 'p1',
              role: 'produtor',
              players: { id: 'p1', name: 'Ana', connected: true, state: 'thinking' },
            },
          ],
          error: null,
        },
      ],
      teams: [
        {
          data: {
            id: 't1',
            game_id: 'g1',
            slug: 'sitio',
            name: 'Sítio',
            property_key: 'sitio-horizonte',
            order_index: 0,
            cash: 80000,
            production: 50,
            technology: 40,
            sustainability: 50,
            traits: {},
          },
          error: null,
        },
      ],
      games: [
        {
          data: {
            id: 'g1',
            code: 'ABCDE',
            status: 'running',
            current_round: 1,
            round_status: 'active',
            round_started_at: 'x',
            round_ends_at: 'x',
            config: {},
            created_at: 'x',
            finished_at: null,
          },
          error: null,
        },
      ],
      rounds: [
        { data: { id: 'r1', game_id: 'g1', index: 1, phase: 'preparacao', started_at: 'x', ends_at: 'x', resolved_at: null }, error: null },
      ],
      events: [
        {
          data: { id: 'e1', game_id: 'g1', round_id: 'r1', team_id: 't1', event_key: 'prep-irrigacao', options: [] },
          error: null,
          delayMs: 20,
        },
      ],
      decisions: [{ data: null, error: null, delayMs: 20 }],
      event_role_hints: [{ data: null, error: null }],
    });
    adminClientMock.mockReturnValue(fake.client);

    const { getPlayerView } = await import('@/lib/game-service');
    const view = await getPlayerView('qualquer-token');

    expect(view.event?.key).toBe('prep-irrigacao');
    expect(view.decision).toBeNull();
    expect(fake.maxConcurrency).toBeGreaterThanOrEqual(2);
  });
});
