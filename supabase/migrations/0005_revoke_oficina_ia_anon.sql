-- ============================================================================
-- SAFRA DF · correções de segurança (migração 0005)
--
-- Idempotente: pode ser executado N vezes, sem efeito na segunda.
--
-- O que faz:
--   1. Revoga a política `oficina_ia_public_read`: o cache de IA (roteiro de
--      debate e reflexão final, que são saída para o professor) não deve ser
--      legível pelo papel anon. A própria 0003 comenta "lido apenas pelo
--      servidor", mas criava policy + grant SELECT para anon. O serviço lê
--      essa tabela com service_role (route handlers), então nenhuma rota
--      depende do acesso anon: pode ser revogado sem quebrar nada.
-- ============================================================================

-- 1. Oficina IA: sem leitura pública (a interface nunca lê essa tabela)
drop policy if exists oficina_ia_public_read on public.oficina_ia;

-- Remove o privilégio que sobra do grant da 0003 (RLS passa mas privilégio
-- não: sem o grant, anon/authenticated não conseguem SELECT de jeito nenhum).
revoke select on public.oficina_ia from anon, authenticated;