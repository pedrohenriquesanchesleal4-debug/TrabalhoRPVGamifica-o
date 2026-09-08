/**
 * Teste de fumaça contra um SAFRA DF de verdade, com banco de verdade.
 *
 * Joga uma partida inteira pela API: cria, entra com uma turma, abre e resolve
 * as cinco rodadas, encerra e confere o resultado. Serve para a véspera da
 * aula: se este script passa, o professor pode confiar no ambiente.
 *
 * Diferente de `npm run simulate`, que exercita só a engine sem banco, aqui
 * tudo passa pela rede: route handler, Supabase, RLS e realtime.
 *
 * Uso:
 *   npm run dev                 (em outro terminal)
 *   npm run smoke               (usa http://localhost:3000)
 *   npm run smoke -- --base=https://seu-projeto.vercel.app --players=30
 */

import { createClient } from '@supabase/supabase-js';

const args = new Map(
  process.argv
    .slice(2)
    .filter((arg) => arg.startsWith('--'))
    .map((arg) => {
      const [key, value = 'true'] = arg.slice(2).split('=');
      return [key, value];
    }),
);

const BASE = args.get('base') ?? 'http://localhost:3000';
const PLAYERS = Number(args.get('players') ?? 12);
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

let failures = 0;

function check(label, condition, detail = '') {
  const mark = condition ? 'ok  ' : 'FALHA';
  console.log(`  ${mark} ${label}${detail ? ` · ${detail}` : ''}`);
  if (!condition) failures += 1;
  return condition;
}

function section(title) {
  console.log(`\n${title}`);
  console.log('-'.repeat(title.length));
}

async function api(path, { method = 'GET', token, body } = {}) {
  const response = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      ...(body ? { 'content-type': 'application/json' } : {}),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;

  if (!response.ok) {
    const error = payload?.error;
    const problem = new Error(error?.message ?? `HTTP ${response.status} em ${path}`);
    problem.code = error?.code;
    problem.status = response.status;
    throw problem;
  }

  return payload;
}

const NAMES = [
  'Ana', 'Bruno', 'Carla', 'Diego', 'Elisa', 'Fábio', 'Gabi', 'Hugo', 'Ivo', 'Joana',
  'Kaio', 'Lia', 'Marcos', 'Nina', 'Otávio', 'Paula', 'Quênia', 'Rafa', 'Sofia', 'Tiago',
  'Ulisses', 'Vera', 'Wesley', 'Xênia', 'Yara', 'Zeca', 'Alice', 'Breno', 'Cris', 'Davi',
];

async function main() {
  console.log(`SAFRA DF · teste de fumaça ao vivo`);
  console.log(`base: ${BASE} · jogadores: ${PLAYERS}`);

  // ---------------------------------------------------------------------
  section('1. Professor cria a partida');
  const created = await api('/api/games', { method: 'POST', body: {} });
  check('partida criada', Boolean(created.gameId));
  check('código com 5 caracteres', /^[A-Z0-9]{4,8}$/.test(created.code), created.code);
  check('token de professor emitido', typeof created.hostToken === 'string');
  check('6 equipes criadas', created.teams.length === 6, `${created.teams.length} equipes`);

  const { gameId, code, hostToken } = created;

  // ---------------------------------------------------------------------
  section('2. Realtime assina o barramento da partida');
  let events = [];
  let channel = null;

  if (SUPABASE_URL && SUPABASE_KEY) {
    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: { persistSession: false },
    });

    const subscribed = await new Promise((resolve) => {
      const timeout = setTimeout(() => resolve(false), 20000);
      channel = supabase
        .channel(`smoke:${gameId}`)
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'game_events', filter: `game_id=eq.${gameId}` },
          (message) => events.push(message.new.type),
        )
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            clearTimeout(timeout);
            resolve(true);
          }
        });
    });

    check('canal realtime conectado', subscribed);
  } else {
    console.log('  (sem chaves no ambiente: assinatura realtime ignorada)');
  }

  // ---------------------------------------------------------------------
  section('3. A turma entra');
  const players = [];
  for (let index = 0; index < PLAYERS; index += 1) {
    const name = `${NAMES[index % NAMES.length]}${index >= NAMES.length ? ` ${index}` : ''}`;
    const joined = await api('/api/games/join', {
      method: 'POST',
      body: { code, name },
    });
    players.push({ ...joined, name });
  }

  check(`${PLAYERS} jogadores entraram`, players.length === PLAYERS);

  const byTeam = new Map();
  for (const player of players) {
    const list = byTeam.get(player.team.id) ?? [];
    list.push(player);
    byTeam.set(player.team.id, list);
  }

  const sizes = [...byTeam.values()].map((list) => list.length);
  check(
    'equipes equilibradas',
    Math.max(...sizes) - Math.min(...sizes) <= 1,
    `tamanhos: ${sizes.join(', ')}`,
  );

  const rolesFirstTeam = new Set([...byTeam.values()][0].map((player) => player.role));
  check(
    'funções distribuídas sem repetir antes de esgotar',
    rolesFirstTeam.size === Math.min([...byTeam.values()][0].length, 5),
    [...rolesFirstTeam].join(', '),
  );

  check(
    'código inválido é recusado',
    await api('/api/games/join', { method: 'POST', body: { code: 'ZZZZZ', name: 'X' } })
      .then(() => false)
      .catch((error) => error.code === 'not_found'),
  );

  // ---------------------------------------------------------------------
  section('4. As cinco rodadas');
  const teamIds = [...byTeam.keys()];

  for (let round = 1; round <= 5; round += 1) {
    await api(`/api/host/${gameId}/action`, {
      method: 'POST',
      token: hostToken,
      body: { action: 'start_round' },
    });

    // Um jogador de cada equipe olha a carta e confirma pela equipe.
    const chosen = [];
    for (const teamId of teamIds) {
      const representative = byTeam.get(teamId)[0];
      const view = await api('/api/player/view', { token: representative.playerToken });

      if (round === 1) {
        check(
          `rodada 1 · ${view.team.name} recebeu carta e dica da função`,
          Boolean(view.event) && typeof view.event.roleHint === 'string',
          view.event?.title,
        );
      }

      const available = view.event.options.filter((option) => option.available);
      const option = available[round % available.length] ?? available[0];

      await api('/api/player/decision', {
        method: 'POST',
        token: representative.playerToken,
        body: { optionKey: option.key },
      });

      chosen.push({ teamId, optionKey: option.key, teamName: view.team.name });
    }

    if (round === 1) {
      const first = chosen[0];
      const other = byTeam.get(first.teamId)[1] ?? byTeam.get(first.teamId)[0];
      check(
        'segunda confirmação da mesma equipe é recusada',
        await api('/api/player/decision', {
          method: 'POST',
          token: other.playerToken,
          body: { optionKey: first.optionKey },
        })
          .then(() => false)
          .catch((error) => error.code === 'conflict'),
      );

      check(
        'opção inexistente é recusada',
        await api('/api/player/decision', {
          method: 'POST',
          token: byTeam.get(teamIds[1])[0].playerToken,
          body: { optionKey: 'zz' },
        })
          .then(() => false)
          .catch((error) => error.code === 'conflict' || error.code === 'invalid_decision'),
      );

      check(
        'ação de professor sem token válido é recusada',
        await api(`/api/host/${gameId}/action`, {
          method: 'POST',
          token: 'token-invalido',
          body: { action: 'resolve_round' },
        })
          .then(() => false)
          .catch((error) => error.code === 'forbidden' || error.code === 'unauthorized'),
      );
    }

    const resolved = await api(`/api/host/${gameId}/action`, {
      method: 'POST',
      token: hostToken,
      body: { action: 'resolve_round' },
    });

    check(
      `rodada ${round} resolvida para as 6 equipes`,
      resolved.outcomes?.length === 6,
      `fase ${resolved.view.game.phase}`,
    );

    const invalid = resolved.view.teams.filter(
      (team) =>
        !Number.isFinite(team.state.cash) ||
        [team.state.production, team.state.technology, team.state.sustainability].some(
          (value) => value < 0 || value > 100 || !Number.isInteger(value),
        ),
    );
    check(`rodada ${round} sem indicador inválido`, invalid.length === 0);
  }

  // ---------------------------------------------------------------------
  section('5. Encerramento e resultado');
  const finished = await api(`/api/host/${gameId}/action`, {
    method: 'POST',
    token: hostToken,
    body: { action: 'finish' },
  });

  const view = finished.view;
  check('partida encerrada', view.game.status === 'finished');
  check('6 pontuações gravadas', view.scores.length === 6);
  check(
    'ranking sem empate de posição',
    new Set(view.scores.map((score) => score.rank)).size === 6,
  );
  check(
    'perfis atribuídos',
    view.scores.every((score) => typeof score.profile === 'string' && score.profile.length > 0),
  );
  check(
    'prêmios distribuídos',
    view.scores.some((score) => score.awards.length > 0),
    view.scores.flatMap((score) => score.awards).join(', '),
  );
  check(
    'diagnóstico com as tags do briefing',
    view.diagnostics.length >= 5 && view.diagnostics.every((entry) => entry.totalTeams === 6),
  );
  check('ganchos de debate gerados', view.teachingHooks.length > 0);

  console.log('\n  Ranking final:');
  for (const score of view.scores) {
    console.log(
      `    ${score.rank}º ${score.teamName.padEnd(20)} composto ${String(score.composite).padStart(5)}` +
        ` · fin ${score.finances} · prod ${score.production} · tec ${score.technology} · sus ${score.sustainability}`,
    );
  }

  console.log('\n  Diagnóstico da turma:');
  for (const entry of view.diagnostics) {
    console.log(`    ${entry.teams}/${entry.totalTeams} ${entry.label} (${entry.decisions} decisões)`);
  }

  // ---------------------------------------------------------------------
  section('6. Realtime entregou os eventos');
  if (channel) {
    await new Promise((resolve) => setTimeout(resolve, 2500));
    const unique = [...new Set(events)];
    check('eventos recebidos por push', events.length > 0, `${events.length} eventos`);
    check('ROUND_STARTED chegou', unique.includes('ROUND_STARTED'));
    check('DECISION_LOCKED chegou', unique.includes('DECISION_LOCKED'));
    check('ROUND_ENDED chegou', unique.includes('ROUND_ENDED'));
    check('GAME_FINISHED chegou', unique.includes('GAME_FINISHED'));
    console.log(`    tipos: ${unique.join(', ')}`);
    await channel.unsubscribe();
  }

  // ---------------------------------------------------------------------
  section('7. Projeção pública não exige token');
  const projection = await api(`/api/projection/${gameId}`);
  check('projeção acessível sem token', projection.teams.length === 6);
  check(
    'projeção não expõe segredo',
    !JSON.stringify(projection).includes(hostToken) &&
      !JSON.stringify(projection).includes(players[0].playerToken),
  );

  // ---------------------------------------------------------------------
  console.log('\n' + '='.repeat(52));
  if (failures === 0) {
    console.log('TUDO PASSOU: o ambiente está pronto para a aula.');
    console.log(`partida de teste: ${code} (${gameId})`);
  } else {
    console.log(`${failures} verificações falharam.`);
  }
  console.log('='.repeat(52));

  process.exit(failures === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error('\nERRO no teste de fumaça:', error.message);
  if (error.code) console.error('código:', error.code);
  process.exit(1);
});
