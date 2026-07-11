-- ============================================================
-- MCC · migration_v11_10
-- Folha de Pagamento (v1): Colaboradores + Folha CLT + Resumo.
-- Idempotente. Rode UMA vez no SQL Editor do Supabase.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.rh_colaboradores (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome              text NOT NULL,
  cpf               text,
  cargo             text,
  area              text,
  tipo_contrato     text NOT NULL DEFAULT 'CLT',   -- CLT | Estagiário | MEI/Sócio | Prestador
  salario_base      numeric NOT NULL DEFAULT 0,
  horas_mensais     int NOT NULL DEFAULT 220,
  vt_dia            numeric DEFAULT 0,
  va_mensal         numeric DEFAULT 0,
  periculosidade_pct numeric DEFAULT 0,
  insalubridade_pct  numeric DEFAULT 0,
  admissao          date,
  ativo             boolean NOT NULL DEFAULT true,
  criado_em         timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.rh_folha (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mes            text NOT NULL,                    -- "YYYY-MM"
  colaborador_id uuid REFERENCES public.rh_colaboradores(id) ON DELETE CASCADE,
  dados          jsonb NOT NULL DEFAULT '{}',       -- lançamentos editáveis da linha
  bruto          numeric NOT NULL DEFAULT 0,
  descontos      numeric NOT NULL DEFAULT 0,
  liquido        numeric NOT NULL DEFAULT 0,
  criado_em      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_rh_folha_mes ON public.rh_folha (mes);
CREATE UNIQUE INDEX IF NOT EXISTS uq_rh_folha_mes_colab ON public.rh_folha (mes, colaborador_id);

notify pgrst, 'reload schema';
