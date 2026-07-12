-- ============================================================
-- MCC · migration_v11_15
-- Fluxo de Caixa: operações de antecipação de recebíveis. Idempotente.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.antecipacoes (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  obra_id       uuid REFERENCES public.obras(id) ON DELETE SET NULL,
  medicao_ref   text,                 -- qual medição (ex.: "Medição mai/2026")
  valor_bruto   numeric NOT NULL DEFAULT 0,
  taxa          numeric NOT NULL DEFAULT 0,   -- % ao mês
  instituicao   text,
  data_operacao date NOT NULL,
  vencimento    date NOT NULL,
  observacao    text,
  criado_em     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_antecipacoes_obra ON public.antecipacoes (obra_id);

notify pgrst, 'reload schema';
