-- ============================================================
-- MCC · MIGRATION v10.32 · Orçamentos comerciais (propostas)
-- Proposta comercial que NÃO vira projeto automaticamente.
-- Só vira obra quando um diretor/coord. planejamento a converte.
-- Idempotente.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.orcamentos_comerciais (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo            text,                       -- código/identificação da proposta
  cliente           text NOT NULL,
  tipo_obra         text,                        -- ex: Reforma, Construção, Linha de vida, Galpão...
  unidade_negocio   text DEFAULT 'CAPEX',        -- CAPEX | OPEX
  descricao         text,                        -- escopo/objeto da proposta
  valor             numeric DEFAULT 0,           -- valor da proposta comercial
  data_proposta     date DEFAULT current_date,
  status            text DEFAULT 'aberta',       -- aberta | enviada | negociacao | ganha | perdida | convertida
  obra_id           uuid REFERENCES public.obras(id),  -- preenchido quando convertida em projeto
  convertida_em     timestamptz,
  convertida_por    uuid,
  observacao        text,
  criado_por        uuid,
  criado_em         timestamptz DEFAULT now(),
  atualizado_em     timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_orccom_status ON public.orcamentos_comerciais (status);
CREATE INDEX IF NOT EXISTS idx_orccom_cliente ON public.orcamentos_comerciais (cliente);

NOTIFY pgrst, 'reload schema';

SELECT 'orcamentos_comerciais' AS tabela, count(*) FROM public.orcamentos_comerciais;
