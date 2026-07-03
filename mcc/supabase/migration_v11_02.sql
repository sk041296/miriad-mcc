-- ============================================================
-- MCC · migration_v11_02
-- 1) Colunas de "devolução para suprimentos" na ordens_pagamento
-- 2) Recalcula as OPs de OS-i em "% de avanço" que nasceram com
--    valor errado (o gerador antigo lia p.valor em vez de pct×total)
--    e corrige a colisão de chave de parcela.
-- Idempotente. Rode UMA vez no SQL Editor do Supabase.
-- ============================================================

-- ---------- 1. Flag de divergência / devolução ----------
ALTER TABLE public.ordens_pagamento
  ADD COLUMN IF NOT EXISTS divergencia        boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS divergencia_motivo text,
  ADD COLUMN IF NOT EXISTS divergencia_em     timestamptz;

-- ---------- 2. Conferência (não grava): OPs de OS-i em % pendentes ----------
SELECT count(*) AS ops_pendentes_pct_os
FROM ordens_pagamento op
JOIN contratos_servico cs ON cs.id = op.origem_id
WHERE op.origem_tipo = 'bmp'
  AND coalesce(cs.condicao_pagamento->>'modo','valor') = 'pct'
  AND op.status = 'pendente_nf';

-- ---------- 3. Recalcula (só contratos SEM OP liberada/paga) ----------
BEGIN;

-- 3a. remove as OPs pendentes erradas (valor incorreto / colisão de parcela)
DELETE FROM ordens_pagamento op
USING contratos_servico cs
WHERE op.origem_tipo = 'bmp'
  AND op.origem_id = cs.id
  AND coalesce(cs.condicao_pagamento->>'modo','valor') = 'pct'
  AND op.status = 'pendente_nf'
  AND NOT EXISTS (
    SELECT 1 FROM ordens_pagamento op2
    WHERE op2.origem_tipo = 'bmp' AND op2.origem_id = cs.id AND op2.status <> 'pendente_nf'
  );

-- 3b. regenera com valor correto (pct/100 × valor do contrato) e chave única
INSERT INTO ordens_pagamento
  (origem_tipo, origem_id, obra_id, numero, fornecedor, cnpj, centro_custo,
   descricao, valor, vencimento, status, payload)
SELECT
  'bmp',
  cs.id,
  cs.obra_id,
  'OS-' || x.ord || '/' || x.tot,
  coalesce(cs.empresa, cs.responsavel),
  cs.cnpj,
  ob.centro_custo,
  'OS · parcela ' || x.ord || '/' || x.tot,
  round( (coalesce((x.p->>'pct')::numeric, 0) / 100.0) * coalesce(cs.valor, 0), 2),
  nullif(x.p->>'vencimento','')::date,
  'pendente_nf',
  jsonb_build_object(
    'parcela', x.ord || '/' || x.tot,
    'obs', coalesce(x.p->>'obs',''),
    'origem', 'os_recalc_v11_02'
  )
FROM contratos_servico cs
LEFT JOIN obras ob ON ob.id = cs.obra_id
CROSS JOIN LATERAL (
  SELECT value AS p,
         row_number() OVER () AS ord,
         count(*)  OVER () AS tot
  FROM jsonb_array_elements(cs.condicao_pagamento->'parcelas')
) x
WHERE coalesce(cs.condicao_pagamento->>'modo','valor') = 'pct'
  AND coalesce(cs.status_aprovacao,'aprovada') = 'aprovada'
  AND NOT EXISTS (
    SELECT 1 FROM ordens_pagamento op2
    WHERE op2.origem_tipo = 'bmp' AND op2.origem_id = cs.id AND op2.status <> 'pendente_nf'
  )
ON CONFLICT (origem_tipo, origem_id, (payload->>'parcela')) WHERE origem_id IS NOT NULL
DO NOTHING;

COMMIT;

-- ---------- 4. Verificação ----------
SELECT numero, fornecedor, valor, vencimento, status, payload->>'origem' AS origem
FROM ordens_pagamento
WHERE payload->>'origem' = 'os_recalc_v11_02'
ORDER BY vencimento
LIMIT 20;

notify pgrst, 'reload schema';
