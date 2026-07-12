-- ============================================================
-- MCC · migration_v11_12
-- Folha de Pagamento: setor, vencimento de contrato e VT no colaborador.
-- Organograma de cargos fica em config ("rh_organograma") — sem tabela.
-- Idempotente. Rode UMA vez no SQL Editor do Supabase.
-- ============================================================

ALTER TABLE public.rh_colaboradores
  ADD COLUMN IF NOT EXISTS setor               text,
  ADD COLUMN IF NOT EXISTS vencimento_contrato date,
  ADD COLUMN IF NOT EXISTS vt_valor            numeric DEFAULT 0;

notify pgrst, 'reload schema';
