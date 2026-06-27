-- ============================================================
-- MCC · MIGRATION · Tabela ordens_pagamento (OP)
-- Fundação do fluxo financeiro: OC-i e BMP geram OP -> Kanban financeiro.
-- Status: pendente_nf -> liberada -> paga
-- Idempotente: usa IF NOT EXISTS. Pode rodar sem risco de duplicar.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.ordens_pagamento (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Origem da OP (de onde ela nasceu)
  origem_tipo      text NOT NULL,                 -- 'oc' (material) | 'bmp' (serviço)
  origem_id        uuid,                          -- id da ordens_compra ou boletins_medicao
  obra_id          uuid REFERENCES public.obras(id),

  -- Identificação para o financeiro
  numero           text,                          -- nº da OP (sequencial ou herdado)
  fornecedor       text,                          -- nome do fornecedor/prestador
  cnpj             text,
  centro_custo     text,                          -- herdado da obra
  descricao        text,

  -- Valores e vencimento
  valor            numeric NOT NULL DEFAULT 0,    -- valor a pagar
  vencimento       date,                          -- data de vencimento

  -- Nota fiscal
  nf_numero        text,
  nf_url           text,                          -- link do arquivo no Storage
  nf_valor         numeric,                       -- valor da NF (para conferência)
  nf_conferida     boolean NOT NULL DEFAULT false,

  -- Status no Kanban: pendente_nf | liberada | paga
  status           text NOT NULL DEFAULT 'pendente_nf',
  data_pagamento   date,                          -- preenchido quando vira 'paga'

  -- Rastreabilidade
  observacao       text,
  payload          jsonb,                         -- metadados livres (parcela, etc.)
  criado_por       uuid,
  criado_em        timestamptz NOT NULL DEFAULT now(),
  atualizado_em    timestamptz NOT NULL DEFAULT now()
);

-- Índices para o Kanban (filtra por status e ordena por chegada/vencimento)
CREATE INDEX IF NOT EXISTS idx_op_status      ON public.ordens_pagamento (status);
CREATE INDEX IF NOT EXISTS idx_op_obra        ON public.ordens_pagamento (obra_id);
CREATE INDEX IF NOT EXISTS idx_op_origem      ON public.ordens_pagamento (origem_tipo, origem_id);
CREATE INDEX IF NOT EXISTS idx_op_vencimento  ON public.ordens_pagamento (vencimento);

-- Evita duplicar OP da mesma origem (uma OC/BMP gera no máximo uma OP por parcela)
-- (parcela fica no payload; se não houver, origem_id basta)
CREATE UNIQUE INDEX IF NOT EXISTS uq_op_origem_parcela
  ON public.ordens_pagamento (origem_tipo, origem_id, (payload->>'parcela'))
  WHERE origem_id IS NOT NULL;

-- ============================================================
-- VERIFICAÇÃO (rode após criar)
-- ============================================================
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'ordens_pagamento'
ORDER BY ordinal_position;
