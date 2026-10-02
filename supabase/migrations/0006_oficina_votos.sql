-- ============================================================================
-- SAFRA DF — votação com dono e origem da descoberta (migração 0006)
--
-- Idempotente: pode ser executada N vezes, sem efeito na segunda.
--
-- Problema 1: `compartilhar_pista` não tinha destino.
--   A função carimbava `oficina_pistas.compartilhada_em` na linha da própria
--   equipe e não gravava mais nada. Como `validarAcao` lê apenas as pistas da
--   própria equipe, nenhuma outra equipe destravava ação nenhuma: a mecânica que
--   dá nome ao modo colaborativo era um botão sem efeito.
--   `recebida_de` responde "esta pista eu achei" de "esta pista me chegou", e
--   permitir a inserção da pista na equipe receptora é o que faz a descoberta
--   circular de verdade.
--
-- Problema 2: votação tinha lost update.
--   Os votos das equipes viviam dentro de `oficina_eventos.contribribuicoes`,
--   um jsonb atualizado por read-modify-write do objeto inteiro. Duas equipes
--   votando no mesmo instante liam o mesmo snapshot e a segunda escrita
--   apagava o voto da primeira. Com seis equipes votando juntas — que é
--   exatamente para o que este estágio existe — perder votos não é caso raro,
--   é o caminho normal.
--   `oficina_votos` dá uma linha por voto com unique (game_id, event_key,
--   team_id): o banco passa a garantir "uma equipe vota uma vez", sem
--   read-modify-write e sem corrida. `contribuicoes` continua existindo como
--   cache de leitura para a parede, mas passa a ser RECONSTRUÍDO a partir desta
--   tabela — overwritten, nunca mergeado, que é o que fecha a corrida.
-- ============================================================================

-- 1. Origem da descoberta compartilhada
-- ---------------------------------------------------------------------------
alter table public.oficina_pistas
  add column if not exists recebida_de uuid references public.teams(id) on delete set null;

comment on column public.oficina_pistas.recebida_de is
  'team_id de quem trouxe a pista (null = descoberta pela própria equipe). '
  'Indica que a linha veio de compartilhamento, não de investigação local.';

create index if not exists oficina_pistas_recebida_de_idx
  on public.oficina_pistas (recebida_de)
  where recebida_de is not null;

-- 2. Votos como linhas
-- ---------------------------------------------------------------------------
create table if not exists public.oficina_votos (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games(id) on delete cascade,
  event_key text not null,
  team_id uuid not null references public.teams(id) on delete cascade,
  opcao_key text not null,
  -- Delta já aplicado nos indicadores da equipe, guardado para auditoria e para
  -- reconstruir o cache `contribuicoes` sem recalcular nada.
  efeitos jsonb not null default '{}'::jsonb,
  criada_em timestamptz not null default now(),
  constraint oficina_votos_um_por_equipe unique (game_id, event_key, team_id)
);

comment on table public.oficina_votos is
  'Um voto por equipe por evento. Fonte da verdade da votação: o unique impede '
  'duplo voto no banco, e `oficina_eventos.contribribuicoes` é cache reconstruído '
  'a partir daqui.';

create index if not exists oficina_votos_evento_idx
  on public.oficina_votos (game_id, event_key);

-- Leitura só pelo servidor (service_role), como o resto do modo oficina.
alter table public.oficina_votos enable row level security;

revoke all on public.oficina_votos from anon, authenticated;

-- `reiniciarOficina` apaga as tabelas do modo oficina por game_id. Sem esta
-- policy a limpeza passaria batida e a partida recomeçaria com os votos da
-- rodada anterior — sem unique para barrar, porque as linhas antigas sumiriam
-- com a sessão e não com o evento.
create policy "oficina_votos_delete_server"
  on public.oficina_votos
  for delete
  to service_role
  using (true);

-- 3. Índice de apoio para a contagem de votos por opção na projeção
-- ---------------------------------------------------------------------------
create index if not exists oficina_votos_opcao_idx
  on public.oficina_votos (game_id, event_key, opcao_key);