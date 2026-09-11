-- SAFRA DF · roteiro de debate do professor (cache da chamada de IA)
--
-- COLE E EXECUTE no Supabase SQL Editor (ou rode via CLI: supabase db push).
-- Idempotente: pode rodar quantas vezes precisar.
--
-- O que faz: guarda o roteiro gerado pelo Gemini para cada partida ENCERRADA.
-- Motivo: 1 chamada de IA por partida, por mais que o professor reabra a tela
-- ou clique de novo no botão. Reabrir a página lê daqui, sem gastar a cota.
-- Escrita apenas via service_role (código de servidor): a tabela não é exposta
-- ao navegador.

create table if not exists public.debate_prep (
  game_id uuid primary key references public.games (id) on delete cascade,
  roteiro text not null,
  modelo text not null default 'gemini-2.5-flash',
  criado_em timestamptz not null default now()
);

-- Limpeza eventual do mais velho primeiro (partidas antigas saem do cache).
create index if not exists debate_prep_criado_em_idx
  on public.debate_prep (criado_em desc);

comment on table public.debate_prep is
  'Roteiro de debate gerado por IA para uma partida encerrada do SAFRA DF. Cache de 1 chamada por partida; escrita somente via service_role.';