-- ============================================================================
-- SAFRA DF · schema inicial
--
-- Modelo de segurança, que é a decisão central deste arquivo:
--
--   O navegador NUNCA escreve no banco. Nenhuma. Nem para entrar na partida.
--   Todo INSERT, UPDATE e DELETE acontece em route handlers do Next.js usando a
--   service_role key, que só existe no servidor. Do lado do cliente, a chave
--   anon tem exclusivamente SELECT, e apenas nas tabelas que a interface precisa
--   ler em tempo real.
--
--   Consequência prática: abrir o DevTools e tentar mudar caixa, indicador,
--   rodada ou pontuação não funciona. Não existe política de escrita para o
--   papel anon, e os privilégios de escrita foram revogados explicitamente.
--
--   Segredos (token do professor e token de cada jogador) ficam em tabelas
--   separadas, guardados como hash SHA-256, sem nenhum privilégio para anon.
--   Assim o cliente pode ler o estado público da partida sem nunca ver
--   credencial de ninguém.
--
-- Realtime: o cliente escuta `game_events` (o barramento de eventos), mais
-- `teams`, `players` e `games` para refletir indicadores e presença. Não existe
-- polling e não se transmite estado inteiro a cada mudança.
-- ============================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Partidas
-- ---------------------------------------------------------------------------

create table if not exists public.games (
  id             uuid primary key default gen_random_uuid(),
  code           text not null unique check (code ~ '^[A-Z0-9]{4,8}$'),
  status         text not null default 'lobby'
                   check (status in ('lobby', 'running', 'paused', 'finished')),
  current_round  integer not null default 0 check (current_round between 0 and 20),
  round_status   text not null default 'idle'
                   check (round_status in ('idle', 'active', 'resolved')),
  round_started_at timestamptz,
  round_ends_at    timestamptz,
  -- Orçamento inicial, duração da rodada, número de equipes e pesos do ranking.
  config         jsonb not null,
  created_at     timestamptz not null default now(),
  finished_at    timestamptz
);

comment on table public.games is 'Uma partida (uma turma). O código é o que o professor projeta na tela.';

-- Token do professor: fora da tabela pública, para que anon nunca leia.
create table if not exists public.game_secrets (
  game_id         uuid primary key references public.games(id) on delete cascade,
  host_token_hash text not null
);

-- ---------------------------------------------------------------------------
-- Equipes
-- ---------------------------------------------------------------------------

create table if not exists public.teams (
  id             uuid primary key default gen_random_uuid(),
  game_id        uuid not null references public.games(id) on delete cascade,
  slug           text not null,
  name           text not null,
  property_key   text not null,
  order_index    integer not null,
  -- Indicadores. `cash` pode ser negativo: dívida é consequência do jogo.
  cash           numeric(12, 2) not null,
  production     integer not null check (production between 0 and 100),
  technology     integer not null check (technology between 0 and 100),
  sustainability integer not null check (sustainability between 0 and 100),
  -- Marcadores acumulados: capacitação, tecnologia parada, parcelas, programas.
  traits         jsonb not null,
  created_at     timestamptz not null default now(),
  unique (game_id, slug)
);

create index if not exists teams_game_idx on public.teams (game_id, order_index);

-- ---------------------------------------------------------------------------
-- Jogadores
-- ---------------------------------------------------------------------------

create table if not exists public.players (
  id         uuid primary key default gen_random_uuid(),
  game_id    uuid not null references public.games(id) on delete cascade,
  name       text not null check (char_length(trim(name)) between 1 and 40),
  connected  boolean not null default true,
  state      text not null default 'thinking' check (state in ('thinking', 'decided')),
  last_seen  timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists players_game_idx on public.players (game_id);

-- Token do jogador: identifica quem envia a decisão, sem login e sem cadastro.
create table if not exists public.player_secrets (
  player_id  uuid primary key references public.players(id) on delete cascade,
  token_hash text not null unique
);

create table if not exists public.team_members (
  id         uuid primary key default gen_random_uuid(),
  game_id    uuid not null references public.games(id) on delete cascade,
  team_id    uuid not null references public.teams(id) on delete cascade,
  player_id  uuid not null references public.players(id) on delete cascade,
  role       text not null
               check (role in ('produtor', 'financeiro', 'tecnologia',
                               'comercializacao', 'politicas')),
  created_at timestamptz not null default now(),
  unique (player_id),
  unique (team_id, player_id)
);

create index if not exists team_members_team_idx on public.team_members (team_id);
create index if not exists team_members_game_idx on public.team_members (game_id);

-- ---------------------------------------------------------------------------
-- Rodadas, eventos e decisões
-- ---------------------------------------------------------------------------

create table if not exists public.rounds (
  id          uuid primary key default gen_random_uuid(),
  game_id     uuid not null references public.games(id) on delete cascade,
  index       integer not null check (index between 1 and 20),
  phase       text not null
                check (phase in ('preparacao', 'producao', 'mercado',
                                 'desafio', 'colheita')),
  started_at  timestamptz not null default now(),
  ends_at     timestamptz,
  resolved_at timestamptz,
  unique (game_id, index)
);

-- Carta sorteada para uma equipe numa rodada, com as opções já filtradas pelo
-- estado da equipe no momento do sorteio.
create table if not exists public.events (
  id         uuid primary key default gen_random_uuid(),
  game_id    uuid not null references public.games(id) on delete cascade,
  round_id   uuid not null references public.rounds(id) on delete cascade,
  team_id    uuid not null references public.teams(id) on delete cascade,
  event_key  text not null,
  options    jsonb not null,
  created_at timestamptz not null default now(),
  unique (round_id, team_id)
);

create index if not exists events_game_idx on public.events (game_id);

-- Informação complementar por função. Sem privilégio para anon: cada jogador
-- recebe apenas a dica da própria função, por route handler autenticado pelo
-- token. É isso que obriga a equipe a conversar em voz alta.
create table if not exists public.event_role_hints (
  id       uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  role     text not null
             check (role in ('produtor', 'financeiro', 'tecnologia',
                             'comercializacao', 'politicas')),
  hint     text not null,
  unique (event_id, role)
);

-- Uma decisão por equipe por rodada, imutável depois de gravada.
create table if not exists public.decisions (
  id           uuid primary key default gen_random_uuid(),
  game_id      uuid not null references public.games(id) on delete cascade,
  round_id     uuid not null references public.rounds(id) on delete cascade,
  team_id      uuid not null references public.teams(id) on delete cascade,
  event_id     uuid not null references public.events(id) on delete cascade,
  option_key   text not null,
  option_label text not null,
  tags         text[] not null default '{}',
  submitted_by uuid references public.players(id) on delete set null,
  -- Tudo o que o servidor calculou: deltas, notas, sorteio e estado antes/depois.
  effects      jsonb not null,
  notes        jsonb not null default '[]',
  risk_hit     boolean,
  state_before jsonb not null,
  state_after  jsonb not null,
  created_at   timestamptz not null default now(),
  unique (round_id, team_id)
);

create index if not exists decisions_game_idx on public.decisions (game_id);
create index if not exists decisions_team_idx on public.decisions (team_id);

-- ---------------------------------------------------------------------------
-- Barramento de eventos (o canal de realtime)
-- ---------------------------------------------------------------------------

create table if not exists public.game_events (
  id         bigserial primary key,
  game_id    uuid not null references public.games(id) on delete cascade,
  type       text not null check (type in (
               'PLAYER_JOINED', 'PLAYER_LEFT', 'TEAM_READY', 'ROUND_STARTED',
               'DECISION_SUBMITTED', 'DECISION_LOCKED', 'EVENT_RESOLVED',
               'ROUND_ENDED', 'GAME_PAUSED', 'GAME_RESUMED', 'GAME_FINISHED',
               'GAME_RESET')),
  payload    jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index if not exists game_events_game_idx on public.game_events (game_id, id desc);

-- ---------------------------------------------------------------------------
-- Resultado final
-- ---------------------------------------------------------------------------

create table if not exists public.scores (
  id             uuid primary key default gen_random_uuid(),
  game_id        uuid not null references public.games(id) on delete cascade,
  team_id        uuid not null references public.teams(id) on delete cascade,
  finances       integer not null,
  production     integer not null,
  technology     integer not null,
  sustainability integer not null,
  composite      numeric(6, 2) not null,
  profile        text not null,
  awards         text[] not null default '{}',
  rank           integer not null,
  created_at     timestamptz not null default now(),
  unique (game_id, team_id)
);

create index if not exists scores_game_idx on public.scores (game_id, rank);

-- ============================================================================
-- Row Level Security
--
-- Todas as tabelas com RLS ligada. O papel anon tem SELECT apenas onde a
-- interface precisa ler, e nunca INSERT/UPDATE/DELETE. As tabelas de segredo e
-- as de conteúdo sensível (eventos, dicas por função, decisões) não têm
-- política nenhuma para anon: são servidas por route handler.
-- ============================================================================

alter table public.games            enable row level security;
alter table public.game_secrets     enable row level security;
alter table public.teams            enable row level security;
alter table public.players          enable row level security;
alter table public.player_secrets   enable row level security;
alter table public.team_members     enable row level security;
alter table public.rounds           enable row level security;
alter table public.events           enable row level security;
alter table public.event_role_hints enable row level security;
alter table public.decisions        enable row level security;
alter table public.game_events      enable row level security;
alter table public.scores           enable row level security;

-- Leitura pública do estado da partida: é o que a projeção e o celular do aluno
-- precisam para acompanhar em tempo real. Nada aqui contém segredo.
drop policy if exists games_public_read on public.games;
create policy games_public_read on public.games
  for select to anon, authenticated using (true);

drop policy if exists teams_public_read on public.teams;
create policy teams_public_read on public.teams
  for select to anon, authenticated using (true);

drop policy if exists players_public_read on public.players;
create policy players_public_read on public.players
  for select to anon, authenticated using (true);

drop policy if exists team_members_public_read on public.team_members;
create policy team_members_public_read on public.team_members
  for select to anon, authenticated using (true);

drop policy if exists rounds_public_read on public.rounds;
create policy rounds_public_read on public.rounds
  for select to anon, authenticated using (true);

drop policy if exists game_events_public_read on public.game_events;
create policy game_events_public_read on public.game_events
  for select to anon, authenticated using (true);

drop policy if exists scores_public_read on public.scores;
create policy scores_public_read on public.scores
  for select to anon, authenticated using (true);

-- Privilégios: anon lê o estado público e mais nada. service_role ignora RLS.
revoke all on all tables in schema public from anon, authenticated;

grant select on public.games        to anon, authenticated;
grant select on public.teams        to anon, authenticated;
grant select on public.players      to anon, authenticated;
grant select on public.team_members to anon, authenticated;
grant select on public.rounds       to anon, authenticated;
grant select on public.game_events  to anon, authenticated;
grant select on public.scores       to anon, authenticated;

-- Sem grant e sem policy: events, event_role_hints, decisions, game_secrets e
-- player_secrets só são acessíveis pela service_role, no servidor.

-- ============================================================================
-- Realtime
--
-- Publicação mínima: o barramento de eventos mais as três tabelas cujo estado a
-- interface espelha. Quanto menos tabela publicada, menos mensagem gasta do
-- plano gratuito.
-- ============================================================================

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    -- add table é idempotente na prática: ignora o erro de duplicata.
    begin
      alter publication supabase_realtime add table public.game_events;
    exception when duplicate_object then null;
    end;
    begin
      alter publication supabase_realtime add table public.teams;
    exception when duplicate_object then null;
    end;
    begin
      alter publication supabase_realtime add table public.players;
    exception when duplicate_object then null;
    end;
    begin
      alter publication supabase_realtime add table public.games;
    exception when duplicate_object then null;
    end;
  end if;
end
$$;
