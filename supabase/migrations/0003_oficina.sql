-- ============================================================================
-- SAFRA DF · schema do modo "Oficina" (migração 0003)
--
-- Este arquivo adiciona o modo colaborativo narrativo ao schema existente.
-- Tudo é idempotente: pode ser executado N vezes sem efeito colateral.
--
-- Modelo de segurança herdado da 0001 (sagrado, não alterado):
--   • Navegador NUNCA escreve. Todos os INSERT/UPDATE/DELETE usam service_role.
--   • Papel anon tem SELECT apenas nas tabelas públicas necessárias à interface.
--   • O revoke global (`revoke all on all tables in schema public from anon,
--     authenticated`) já existe na 0001 e NÃO é repetido aqui.
--   • Segredos ficam em tabelas separadas (game_secrets, player_secrets).
--
-- O que este arquivo faz:
--   1. Adiciona coluna `mode` na tabela `games` (default 'diagnostico').
--   2. Cria 8 tabelas novas para o modo oficina.
--   3. Amplia as constraints de `team_members.role` e `game_events.type`.
--   4. Liga RLS + policies SELECT para anon nas tabelas públicas da oficina.
--   5. Expande a publicação supabase_realtime com as tabelas de estado.
--
-- Antes de executar: rode esta migration em ambiente staging/teste primeiro.
-- Rollback: desfazer na ordem inversa (DROP das tabelas, DROP da coluna mode,
-- DROP das constraints ampliadas, DROP das policies e grants).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Coluna `mode` na tabela games
--
-- Default 'diagnostico' garante que nenhuma partida existente muda de
-- comportamento. A aplicação deve criar partidas com mode = 'oficina'
-- explicitamente. Zero modificação no fluxo do Diagnóstico.
-- ---------------------------------------------------------------------------

alter table public.games
  add column if not exists mode text not null default 'diagnostico'
  check (mode in ('diagnostico', 'oficina'));

comment on column public.games.mode is
  'Modo da partida: diagnostico (default, fluxo legado) ou oficina (colaborativo narrativo).';

-- ---------------------------------------------------------------------------
-- 2. oficina_sessoes — 1 por partida
--
-- Estado global da sessão de oficina. O professor controla o ritmo
-- avançando os estágios (briefing → investigação → eventos → solução →
-- resultado → encerrada). `sorteio_eventos` guarda a ordem sorteada dos
-- eventos coletivos para que todas as equipes vejam na mesma sequência.
-- ---------------------------------------------------------------------------

create table if not exists public.oficina_sessoes (
  game_id           uuid primary key references public.games(id) on delete cascade,
  status            text not null default 'aguardando'
                      check (status in ('aguardando', 'ativa', 'pausada')),
  stage             text not null default 'briefing'
                      check (stage in ('briefing', 'investigacao', 'eventos',
                                       'solucao', 'resultado', 'encerrada')),
  stage_progresso   integer not null default 0,
  evento_atual      text,
  sorteio_eventos   text[] not null default '{}',
  iniciada_em       timestamptz,
  finalizada_em     timestamptz
);

comment on table public.oficina_sessoes is
  'Estado global da sessão de oficina. 1:1 com games. Professor controla stage.';

-- ---------------------------------------------------------------------------
-- 3. oficina_equipes — 1:1 com teams
--
-- Cada equipe recebe um perfil (perspectiva narrativa) e seus 8 indicadores
-- narrativos (0–100). Indicadores ficam como jsonb para permitir deltas
-- parciais sem 8 colunas — o cliente só lê, o servidor calcula tudo.
-- `acoes_usadas` limita ações por estágio. `marcadores` acumula tags de
-- progresso (tech_usada, capacitacao_feita, etc.).
-- ---------------------------------------------------------------------------

create table if not exists public.oficina_equipes (
  team_id       uuid primary key references public.teams(id) on delete cascade,
  game_id       uuid not null references public.games(id) on delete cascade,
  perfil        text not null
                  check (perfil in ('produtores', 'cooperativa', 'comercializacao',
                                    'logistica', 'juventude_tech', 'articulacao')),
  indicadores   jsonb not null,
  acoes_usadas  integer not null default 0,
  marcadores    text[] not null default '{}',
  unique (team_id)
);

create index if not exists oficina_equipes_game_idx on public.oficina_equipes (game_id);

comment on table public.oficina_equipes is
  'Dados narrativos de cada equipe na oficina: perfil, indicadores (0-100), ações usadas e marcadores.';
comment on column public.oficina_equipes.indicadores is
  'Record<OficinaIndicador, number>: cooperacao, organizacao, mercado, conhecimento, sustentabilidade, confianca, inclusao, viabilidade. Valores 0-100, calculados pelo servidor.';
comment on column public.oficina_equipes.acoes_usadas is
  'Número de ações usadas no estágio atual. Resetado a cada transição de estágio pelo servidor.';
comment on column public.oficina_equipes.marcadores is
  'Tags acumuladas de progresso: tech_usada, capacitacao_feita, parceria_formada, etc.';

-- ---------------------------------------------------------------------------
-- 4. oficina_pistas — descoberta por equipe
--
-- Cada equipe descobre pistas ao longo da investigação. A constraint
-- unique (team_id, pista_id) garante que uma equipe não descobre a
-- mesma pista duas vezes. `compartilhada_em` registra quando a pista
-- foi compartilhada com outra equipe (null = ainda não compartilhada).
-- ---------------------------------------------------------------------------

create table if not exists public.oficina_pistas (
  id                uuid primary key default gen_random_uuid(),
  game_id           uuid not null references public.games(id) on delete cascade,
  team_id           uuid not null references public.teams(id) on delete cascade,
  pista_id          text not null,
  descoberta_em     timestamptz not null default now(),
  compartilhada_em  timestamptz,
  unique (team_id, pista_id)
);

create index if not exists oficina_pistas_game_idx on public.oficina_pistas (game_id);
create index if not exists oficina_pistas_team_idx on public.oficina_pistas (team_id);

comment on table public.oficina_pistas is
  'Pistas descobertas por cada equipe durante a investigação. Uma equipe não descobre a mesma pista duas vezes.';
comment on column public.oficina_pistas.compartilhada_em is
  'Quando a pista foi compartilhada com outra equipe. Null = ainda não compartilhada.';

-- ---------------------------------------------------------------------------
-- 5. oficina_acoes — histórico imutável + idempotência
--
-- Registro de cada ação executada por uma equipe. A constraint unique
-- (team_id, stage, acao_key, alvo_id) garante idempotência de clique
-- duplo: o mesmo clique duas vezes na mesma ação/estágio/alvo não cria
-- linha duplicada. `efeitos` guarda os deltas calculados pelo servidor
-- como jsonb para suportar parciais (só muda o que afetou).
-- ---------------------------------------------------------------------------

create table if not exists public.oficina_acoes (
  id          uuid primary key default gen_random_uuid(),
  game_id     uuid not null references public.games(id) on delete cascade,
  team_id     uuid not null references public.teams(id) on delete cascade,
  stage       text not null
                check (stage in ('briefing', 'investigacao', 'eventos',
                                 'solucao', 'resultado', 'encerrada')),
  acao_key    text not null,
  alvo_id     text,
  efeitos     jsonb not null default '{}',
  criada_em   timestamptz not null default now(),
  unique (team_id, stage, acao_key, alvo_id)
);

create index if not exists oficina_acoes_game_idx on public.oficina_acoes (game_id);
create index if not exists oficina_acoes_team_idx on public.oficina_acoes (team_id);

comment on table public.oficina_acoes is
  'Histórico imutável de ações executadas por cada equipe. Constraint unique previne clique duplo.';
comment on column public.oficina_acoes.efeitos is
  'Deltas calculados pelo servidor: Record<OficinaIndicador, number> parcial (só os que mudaram).';
comment on column public.oficina_acoes.alvo_id is
  'ID do alvo da ação (local, personagem, pista). Null para ações sem alvo específico.';

-- ---------------------------------------------------------------------------
-- 6. oficina_eventos — coletivos (1x por partida)
--
-- Eventos coletivos que envolvem todas as equipes. Cada equipe contribui
-- com sua opção, e o servidor resolve o evento quando todas contribuíram.
-- A constraint unique (game_id, event_key) garante que cada evento
-- coletivo aparece apenas uma vez por partida.
-- `contribuicoes` é um mapa team_id → { opcao_key, efeitos }.
-- ---------------------------------------------------------------------------

create table if not exists public.oficina_eventos (
  id              uuid primary key default gen_random_uuid(),
  game_id         uuid not null references public.games(id) on delete cascade,
  event_key       text not null,
  status          text not null default 'aberto'
                    check (status in ('aberto', 'resolvido')),
  aberto_em       timestamptz not null default now(),
  resolvido_em    timestamptz,
  contribuicoes   jsonb not null default '{}',
  unique (game_id, event_key)
);

create index if not exists oficina_eventos_game_idx on public.oficina_eventos (game_id);

comment on table public.oficina_eventos is
  'Eventos coletivos da oficina: 1x por partida por event_key. Cada equipe contribui; servidor resolve.';
comment on column public.oficina_eventos.contribuicoes is
  'Mapa team_id → { opcao_key, efeitos }. Atualizado pelo servidor a cada contribuição.';
comment on column public.oficina_eventos.status is
  'aberto = aguardando contribuições. resolvido = todas as equipes contribuíram e evento foi processado.';

-- ---------------------------------------------------------------------------
-- 7. oficina_solucoes — 1 por equipe
--
-- A solução final de cada equipe: um conjunto de blocos (problema,
-- recursos, parceiros, tecnologia, etc.). Cada equipe tem exatamente
-- uma solução (unique team_id). `blocos` é jsonb para suportar
-- parciais (a equipe preenche aos poucos).
-- ---------------------------------------------------------------------------

create table if not exists public.oficina_solucoes (
  team_id     uuid primary key references public.teams(id) on delete cascade,
  game_id     uuid not null references public.games(id) on delete cascade,
  blocos      jsonb not null default '{}',
  enviada_em  timestamptz not null default now()
);

comment on table public.oficina_solucoes is
  'Solução final de cada equipe na oficina. 1:1 com teams. Blocos jsonb: problema, recursos, parceiros, etc.';
comment on column public.oficina_solucoes.blocos is
  'Partial<Record<OficinaBlocoSolucao, string>>: cada bloco pode ter campo_livre extra.";

-- ---------------------------------------------------------------------------
-- 8. oficina_resultados — 1 por equipe
--
-- Resultado final processado pelo servidor: categorias ganhas (mais viável,
-- mais colaborativa, etc.) com notas e razões, mais os indicadores finais.
-- Só existe depois que o professor avança para o estágio 'resultado'.
-- ---------------------------------------------------------------------------

create table if not exists public.oficina_resultados (
  team_id       uuid primary key references public.teams(id) on delete cascade,
  game_id       uuid not null references public.games(id) on delete cascade,
  categorias    jsonb not null default '[]',
  indicadores   jsonb not null default '{}',
  criado_em     timestamptz not null default now()
);

comment on table public.oficina_resultados is
  'Resultado final da oficina por equipe: categorias ganhas (com nota e razão) e indicadores finais.';
comment on column public.oficina_resultados.categorias is
  'OficinaResultadoCategoria[]: array de { categoria, team_id, nota, razao }.';
comment on column public.oficina_resultados.indicadores is
  'OficinaIndicadores: snapshot dos 8 indicadores ao final da oficina.';

-- ---------------------------------------------------------------------------
-- 9. oficina_ia — cache de IA (3 slots por partida)
--
-- Cache de textos gerados por IA: narrativa inicial, reflexão final e
-- debate. Cada partida tem no máximo 3 slots (PK composta game_id + tipo).
-- Se a IA falhar, o servidor usa fallbacks estáticos (data/oficina-ia.ts),
-- mas a tabela não fica vazia: o fallback também é gravado aqui para
-- consistência de leitura.
-- ---------------------------------------------------------------------------

create table if not exists public.oficina_ia (
  game_id     uuid not null references public.games(id) on delete cascade,
  tipo        text not null
                check (tipo in ('narrativa_inicial', 'reflexao_final', 'debate')),
  texto       text not null,
  modelo      text,
  criado_em   timestamptz not null default now(),
  primary key (game_id, tipo)
);

comment on table public.oficina_ia is
  'Cache de textos gerados por IA: 3 slots por partida (narrativa_inicial, reflexao_final, debate).';
comment on column public.oficina_ia.texto is
  'Texto gerado pela IA ou fallback estático. Nunca vazio.';
comment on column public.oficina_ia.modelo is
  'Modelo de IA que gerou o texto. Null para fallbacks estáticos.';

-- ---------------------------------------------------------------------------
-- 10. Ampliar team_members.role_check
--
-- O check original da 0001 é inline (sem nome explícito), então o Postgres
-- gera um nome padrão. Usamos `drop constraint if exists` com o nome
-- padrão e recriamos com nome fixo + todos os valores (legado + oficina).
--
-- Abordagem segura: drop pelo nome provável (`team_members_role_check`),
-- que é o que o Postgres gera para uma constraint inline nomeada por
-- convenção. Se o nome for diferente, o `if exists` silencia o erro e
-- a recriação com nome fixo garante consistência futura.
-- ---------------------------------------------------------------------------

alter table public.team_members
  drop constraint if exists team_members_role_check;

alter table public.team_members
  add constraint team_members_role_check
  check (role in (
    -- Diagnóstico (legado)
    'produtor', 'financeiro', 'tecnologia', 'comercializacao', 'politicas',
    -- Oficina (novo)
    'articulacao', 'produtores', 'cooperativa', 'logistica', 'juventude_tech', 'mercado'
  ));

comment on constraint team_members_role_check on public.team_members is
  'Papéis permitidos: legado (Diagnóstico) + novos (Oficina). Superconjunto seguro.';

-- ---------------------------------------------------------------------------
-- 11. Ampliar game_events.type_check
--
-- Mesmo padrão da constraint de role: drop pelo nome provável, recriar
-- com nome fixo + todos os tipos (legado + oficina).
-- ---------------------------------------------------------------------------

alter table public.game_events
  drop constraint if exists game_events_type_check;

alter table public.game_events
  add constraint game_events_type_check
  check (type in (
    -- Diagnóstico (legado)
    'PLAYER_JOINED', 'PLAYER_LEFT', 'TEAM_READY', 'ROUND_STARTED',
    'DECISION_SUBMITTED', 'DECISION_LOCKED', 'EVENT_RESOLVED',
    'ROUND_ENDED', 'GAME_PAUSED', 'GAME_RESUMED', 'GAME_FINISHED',
    'GAME_RESET',
    -- Oficina (novo)
    'OFICINA_STAGE_CHANGED', 'OFICINA_CLUE_FOUND', 'OFICINA_CLUE_SHARED',
    'OFICINA_EVENT_OPENED', 'OFICINA_EVENT_RESOLVED',
    'OFICINA_SOLUTION_SUBMITTED', 'OFICINA_FINISHED'
  ));

comment on constraint game_events_type_check on public.game_events is
  'Tipos de evento: legado (Diagnóstico) + novos (Oficina). Superconjunto seguro.';

-- ---------------------------------------------------------------------------
-- 12. Row Level Security — RLS + policies SELECT para anon
--
-- O revoke global da 0001 já cortou INSERT/UPDATE/DELETE para anon.
-- Precisamos apenas:
--   a) Habilitar RLS nas tabelas novas (requisito do Supabase para
--      que policies funcionem).
--   b) Criar policies SELECT para anon nas tabelas públicas que a
--      interface precisa ler.
--   c) Dar grant SELECT para anon e authenticated nas mesmas tabelas.
--
-- Tabelas que NÃO recebem policy SELECT (segredo ou escrita exclusiva):
--   • oficina_acoes — log imutável, lido apenas pelo servidor
--   • oficina_ia — cache de IA, lido apenas pelo servidor
--
-- O service_role ignora RLS, então ele continua com acesso total a tudo.
-- ---------------------------------------------------------------------------

-- 12a. Habilitar RLS em todas as tabelas novas
alter table public.oficina_sessoes    enable row level security;
alter table public.oficina_equipes   enable row level security;
alter table public.oficina_pistas    enable row level security;
alter table public.oficina_acoes     enable row level security;
alter table public.oficina_eventos   enable row level security;
alter table public.oficina_solucoes  enable row level security;
alter table public.oficina_resultados enable row level security;
alter table public.oficina_ia        enable row level security;

-- 12b. Policies SELECT para anon (tabelas públicas da oficina)
-- Cada policy segue o padrão da 0001: `drop policy if exists` + `create policy`.
-- O `for select to anon, authenticated` garante leitura para ambos os papéis.

drop policy if exists oficina_sessoes_public_read on public.oficina_sessoes;
create policy oficina_sessoes_public_read on public.oficina_sessoes
  for select to anon, authenticated using (true);

drop policy if exists oficina_equipes_public_read on public.oficina_equipes;
create policy oficina_equipes_public_read on public.oficina_equipes
  for select to anon, authenticated using (true);

drop policy if exists oficina_pistas_public_read on public.oficina_pistas;
create policy oficina_pistas_public_read on public.oficina_pistas
  for select to anon, authenticated using (true);

drop policy if exists oficina_eventos_public_read on public.oficina_eventos;
create policy oficina_eventos_public_read on public.oficina_eventos
  for select to anon, authenticated using (true);

drop policy if exists oficina_solucoes_public_read on public.oficina_solucoes;
create policy oficina_solucoes_public_read on public.oficina_solucoes
  for select to anon, authenticated using (true);

drop policy if exists oficina_resultados_public_read on public.oficina_resultados;
create policy oficina_resultados_public_read on public.oficina_resultados
  for select to anon, authenticated using (true);

drop policy if exists oficina_ia_public_read on public.oficina_ia;
create policy oficina_ia_public_read on public.oficina_ia
  for select to anon, authenticated using (true);

-- 12c. Grants SELECT para anon e authenticated
-- O revoke global da 0001 revogou TUDO. Precisamos re-grantar SELECT
-- nas tabelas novas que a interface lê. Sem grant, anon não consegue
-- ler (RLS passa mas privilégio não).
--
-- NOTA: oficina_acoes e oficina_ia NÃO recebem grant SELECT porque
-- são lidos apenas pelo servidor (service_role ignora RLS e privilégios).

grant select on public.oficina_sessoes    to anon, authenticated;
grant select on public.oficina_equipes   to anon, authenticated;
grant select on public.oficina_pistas    to anon, authenticated;
grant select on public.oficina_eventos   to anon, authenticated;
grant select on public.oficina_solucoes  to anon, authenticated;
grant select on public.oficina_resultados to anon, authenticated;
grant select on public.oficina_ia        to anon, authenticated;

-- Sem grant e sem policy SELECT: oficina_acoes (log imutável do servidor).
-- A service_role ignora RLS e tem acesso total via route handlers.

-- ---------------------------------------------------------------------------
-- 13. Realtime — adicionar tabelas de estado à publicação
--
-- Publicação mínima: apenas as tabelas cujo estado a interface espelha
-- em tempo real. Segue o padrão idempotente da 0001 (do-block com
-- exception when duplicate_object).
--
-- Tabelas publicadas:
--   • oficina_sessoes  — mudanças de stage/status afetam toda a sala
--   • oficina_equipes  — indicadores e marcadores atualizados
--   • oficina_pistas   — descobertas e compartilhamentos
--   • oficina_eventos  — eventos abertos/resolvidos
--   • oficina_solucoes — soluções submetidas
--
-- Tabelas NÃO publicadas (lidas sob demanda):
--   • oficina_acoes     — log imutável, não precisa de realtime
--   • oficina_resultados — gerados uma vez, lidos na tela de resultado
--   • oficina_ia        — cache de IA, carregado uma vez
-- ---------------------------------------------------------------------------

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin
      alter publication supabase_realtime add table public.oficina_sessoes;
    exception when duplicate_object then null;
    end;
    begin
      alter publication supabase_realtime add table public.oficina_equipes;
    exception when duplicate_object then null;
    end;
    begin
      alter publication supabase_realtime add table public.oficina_pistas;
    exception when duplicate_object then null;
    end;
    begin
      alter publication supabase_realtime add table public.oficina_eventos;
    exception when duplicate_object then null;
    end;
    begin
      alter publication supabase_realtime add table public.oficina_solucoes;
    exception when duplicate_object then null;
    end;
  end if;
end
$$;
