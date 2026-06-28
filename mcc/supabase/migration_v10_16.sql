-- ============================================================
-- MCC · MIGRATION v10.16 · Módulo de Orçamentos / Memorial Executivo
-- Memorial de custo por EAP (sintética + composição analítica),
-- define meta de custo real e verba de contratação (sem BDI) por item.
-- Idempotente.
-- ============================================================

-- ---------- 1. Cabeçalho do memorial (1 por item de EAP) ----------
CREATE TABLE IF NOT EXISTS public.memoriais_custo (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  obra_id         uuid REFERENCES public.obras(id),
  eap_codigo      text NOT NULL,
  tabela_ref      text,                       -- SINAPI | ORSE | PROPRIO | OUTRA
  descricao       text,
  bdi             numeric DEFAULT 0,          -- BDI informado (fracionário, ex 0.2842)
  subtotal_sbdi   numeric DEFAULT 0,          -- custo puro (= verba de contratação)
  subtotal_cbdi   numeric DEFAULT 0,          -- com BDI (preço de venda do item)
  criado_por      uuid,
  criado_em       timestamptz DEFAULT now(),
  UNIQUE (obra_id, eap_codigo)
);

-- ---------- 2. Itens analíticos da composição ----------
CREATE TABLE IF NOT EXISTS public.memoriais_itens (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  memorial_id     uuid REFERENCES public.memoriais_custo(id) ON DELETE CASCADE,
  obra_id         uuid,
  eap_codigo      text,                       -- código analítico (ex 1.3.1)
  segmento        text,                       -- MATERIAL | MAO_DE_OBRA | EQUIPAMENTO | LOCACAO
  descricao       text,
  unidade         text,
  quantidade      numeric DEFAULT 0,
  valor_unit      numeric DEFAULT 0,
  subtotal_sbdi   numeric DEFAULT 0,
  subtotal_cbdi   numeric DEFAULT 0,
  ordem           int DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_memitem_memorial ON public.memoriais_itens (memorial_id);
CREATE INDEX IF NOT EXISTS idx_memcusto_obra ON public.memoriais_custo (obra_id);

-- ---------- 3. Campos de verba na eap_itens ----------
ALTER TABLE public.eap_itens
  ADD COLUMN IF NOT EXISTS verba_contratacao numeric,   -- teto p/ Suprimentos (custo s/ BDI)
  ADD COLUMN IF NOT EXISTS tem_memorial boolean DEFAULT false;

-- ---------- 4. Recarrega schema ----------
NOTIFY pgrst, 'reload schema';

-- ---------- VERIFICAÇÃO ----------
SELECT 'memoriais_custo' AS tabela, count(*) FROM public.memoriais_custo
UNION ALL SELECT 'memoriais_itens', count(*) FROM public.memoriais_itens;
