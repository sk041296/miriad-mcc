-- ============================================================
-- MCC · migration_v11_13
-- Folha vira OP (uma por colaborador e por tipo) + segmentação macro do Kanban.
-- Empréstimos entram como custo fixo categorizado. Idempotente.
-- ============================================================

ALTER TABLE public.custos_fixos
  ADD COLUMN IF NOT EXISTS categoria text NOT NULL DEFAULT 'custo_fixo';  -- custo_fixo | emprestimo | imposto

-- As OPs de folha usam origem_tipo = 'folha' (coluna text já existente; sem alteração de schema).

notify pgrst, 'reload schema';
