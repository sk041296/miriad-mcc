-- ============================================================
-- MCC · migration_v11_14
-- Cartões de crédito + forma de pagamento na OP. Idempotente.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.cartoes_credito (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome           text NOT NULL,
  bandeira       text,
  dia_fechamento int NOT NULL DEFAULT 1,   -- dia do fechamento da fatura (1..28)
  dia_vencimento int NOT NULL DEFAULT 10,  -- dia do vencimento da fatura (1..28)
  limite         numeric DEFAULT 0,
  ativo          boolean NOT NULL DEFAULT true,
  criado_em      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ordens_pagamento
  ADD COLUMN IF NOT EXISTS forma_pagamento text,   -- pix | ted | cartao
  ADD COLUMN IF NOT EXISTS cartao_id       uuid REFERENCES public.cartoes_credito(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS data_pagamento  date;

-- Faturas de cartão usam origem_tipo = 'cartao_fatura' (coluna text já existente).

notify pgrst, 'reload schema';
