-- ============================================================
-- MCC · migration_v11_09
-- Custos Fixos: cadastro que vira OP automaticamente todo mês.
-- Idempotente. Rode UMA vez no SQL Editor do Supabase.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.custos_fixos (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  descricao      text NOT NULL,
  conta_codigo   text,               -- código da conta contábil (plano de contas)
  conta_nome     text,
  conta_natureza text,
  fornecedor     text,
  cnpj           text,
  valor          numeric NOT NULL DEFAULT 0,
  dia_vencimento int NOT NULL DEFAULT 5,   -- dia do mês (1..28)
  obra_id        uuid REFERENCES public.obras(id) ON DELETE SET NULL,
  centro_custo   text,
  ativo          boolean NOT NULL DEFAULT true,
  criado_em      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_custos_fixos_ativo ON public.custos_fixos (ativo);

-- As OPs geradas usam origem_tipo = 'custo_fixo' (coluna text já existente; sem alteração de schema).

notify pgrst, 'reload schema';
