-- ============================================================
-- MCC · MIGRATION v10.14 · Aprovação dupla de OC-i / OS-i
-- Portão: OC/OS acima do limite exige aprovação de Suprimentos + Diretor.
-- Só após ambas, a OC/OS gera OP (Kanban do financeiro).
-- Idempotente. Roda UMA vez no SQL Editor.
-- ============================================================

-- ---------- 1. Campos de aprovação na ORDENS_COMPRA ----------
ALTER TABLE public.ordens_compra
  ADD COLUMN IF NOT EXISTS status_aprovacao   text DEFAULT 'aprovada',  -- legado já nasce aprovado
  ADD COLUMN IF NOT EXISTS aprov_suprimentos_por  uuid,
  ADD COLUMN IF NOT EXISTS aprov_suprimentos_em   timestamptz,
  ADD COLUMN IF NOT EXISTS aprov_diretor_por      uuid,
  ADD COLUMN IF NOT EXISTS aprov_diretor_em       timestamptz,
  ADD COLUMN IF NOT EXISTS rejeitada_por          uuid,
  ADD COLUMN IF NOT EXISTS rejeitada_em           timestamptz,
  ADD COLUMN IF NOT EXISTS rejeicao_motivo        text;

-- ---------- 2. Mesmos campos na CONTRATOS_SERVICO (OS-i) ----------
ALTER TABLE public.contratos_servico
  ADD COLUMN IF NOT EXISTS status_aprovacao   text DEFAULT 'aprovada',
  ADD COLUMN IF NOT EXISTS aprov_suprimentos_por  uuid,
  ADD COLUMN IF NOT EXISTS aprov_suprimentos_em   timestamptz,
  ADD COLUMN IF NOT EXISTS aprov_diretor_por      uuid,
  ADD COLUMN IF NOT EXISTS aprov_diretor_em       timestamptz,
  ADD COLUMN IF NOT EXISTS rejeitada_por          uuid,
  ADD COLUMN IF NOT EXISTS rejeitada_em           timestamptz,
  ADD COLUMN IF NOT EXISTS rejeicao_motivo        text;

-- ---------- 3. Config global do limite de aprovação ----------
CREATE TABLE IF NOT EXISTS public.config_financeiro (
  chave  text PRIMARY KEY,
  valor  jsonb NOT NULL,
  atualizado_em timestamptz DEFAULT now()
);
INSERT INTO public.config_financeiro (chave, valor)
VALUES ('limite_aprovacao_oc', '1000'::jsonb)
ON CONFLICT (chave) DO NOTHING;

-- ---------- 4. OCs/OS legadas já ficam aprovadas ----------
-- (foram emitidas antes do portão; não devem travar)
UPDATE public.ordens_compra
   SET status_aprovacao = 'aprovada'
 WHERE status_aprovacao IS NULL;
UPDATE public.contratos_servico
   SET status_aprovacao = 'aprovada'
 WHERE status_aprovacao IS NULL;

-- ---------- 5. OPs retroativas: vencidas -> pagas ----------
-- As parcelas com vencimento < hoje já foram pagas na prática.
UPDATE public.ordens_pagamento
   SET status = 'paga',
       data_pagamento = COALESCE(data_pagamento, vencimento),
       atualizado_em = now()
 WHERE origem_tipo = 'oc'
   AND status = 'pendente_nf'
   AND vencimento IS NOT NULL
   AND vencimento < CURRENT_DATE;

-- ---------- 6. Recarrega o schema da API ----------
NOTIFY pgrst, 'reload schema';

-- ============================================================
-- VERIFICAÇÃO (rode após)
-- ============================================================
SELECT 'ordens_compra' AS tabela, status_aprovacao, count(*)
  FROM public.ordens_compra GROUP BY status_aprovacao
UNION ALL
SELECT 'contratos_servico', status_aprovacao, count(*)
  FROM public.contratos_servico GROUP BY status_aprovacao;

SELECT status, count(*), sum(valor) AS total
  FROM public.ordens_pagamento WHERE origem_tipo='oc' GROUP BY status;
