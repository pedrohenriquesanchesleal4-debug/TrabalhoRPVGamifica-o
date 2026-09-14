-- ============================================================================
-- SAFRA DF · correções da camada de oficina (migração 0004)
--
-- Idempotente: pode ser executado N vezes. Seguro para banco em que 0003
-- já rodou com a constraint de status sem 'encerrada' (instalações
-- anteriores). Para instalações novas onde 0003 já traz 'encerrada',
-- este arquivo cai no path-drop/if-exists e recria — resultado final
-- idêntico.
--
-- O que faz:
--   1. Reconstrói a constraint `oficina_sessoes_status_check` com o
--      valor 'encerrada' que o serviço aguarda.
-- ============================================================================

-- 1. status check de oficina_sessoes — substitui por superconjunto com 'encerrada'
alter table public.oficina_sessoes
  drop constraint if exists oficina_sessoes_status_check;

alter table public.oficina_sessoes
  add constraint oficina_sessoes_status_check
  check (status in ('aguardando', 'ativa', 'pausada', 'encerrada'));