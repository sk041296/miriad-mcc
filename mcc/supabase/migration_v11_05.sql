-- ============================================================
-- MCC · migration_v11_05
-- Aprovação de Boletim de Medição (BMP) + geração de OP pelo líquido.
-- Idempotente. Rode UMA vez no SQL Editor do Supabase.
-- ============================================================

ALTER TABLE public.boletins_medicao
  ADD COLUMN IF NOT EXISTS aprovado_por    uuid REFERENCES public.usuarios(id),
  ADD COLUMN IF NOT EXISTS aprovado_em     timestamptz,
  ADD COLUMN IF NOT EXISTS rejeicao_motivo text,
  ADD COLUMN IF NOT EXISTS op_gerada       boolean NOT NULL DEFAULT false;

notify pgrst, 'reload schema';
