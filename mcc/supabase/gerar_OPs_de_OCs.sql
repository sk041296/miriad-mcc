-- ============================================================
-- MCC · Fatia 2 · Gera Ordens de Pagamento (OP) a partir das OC-i
-- Uma OP por PARCELA de cada OC. Status inicial: pendente_nf.
-- Puxa centro_custo da obra. Idempotente (índice único impede duplicar).
-- ============================================================

-- ---------- SEÇÃO 0 · CONFERÊNCIA (não grava) ----------
-- Quantas parcelas (=futuras OPs) existem nas OCs carregadas?
SELECT o.codigo AS obra, count(*) AS ocs,
       sum(jsonb_array_length(oc.condicao_pagamento->'parcelas')) AS parcelas_total
FROM ordens_compra oc
JOIN obras o ON o.id = oc.obra_id
WHERE oc.dados_oc->>'origem' IN ('carga_pdf_oc_ifsc','carga_pdf_oc_bc')
GROUP BY o.codigo;

-- ---------- SEÇÃO 1 · GERAÇÃO DAS OPs ----------
BEGIN;

INSERT INTO ordens_pagamento
  (origem_tipo, origem_id, obra_id, numero, fornecedor, cnpj, centro_custo,
   descricao, valor, vencimento, status, payload)
SELECT
  'oc'                                              AS origem_tipo,
  oc.id                                             AS origem_id,
  oc.obra_id                                        AS obra_id,
  oc.numero || '-' || (p->>'parcela')               AS numero,
  oc.fornecedor                                     AS fornecedor,
  oc.dados_oc->>'cnpj'                              AS cnpj,
  o.centro_custo                                    AS centro_custo,
  'OC ' || oc.numero || ' · parcela ' || (p->>'parcela') AS descricao,
  (p->>'valor')::numeric                            AS valor,
  NULLIF(p->>'vencimento','')::date                 AS vencimento,
  'pendente_nf'                                     AS status,
  jsonb_build_object(
    'parcela', p->>'parcela',
    'obs', p->>'obs',
    'oc_numero', oc.numero,
    'origem', 'oc_parcela'
  )                                                 AS payload
FROM ordens_compra oc
JOIN obras o ON o.id = oc.obra_id
CROSS JOIN LATERAL jsonb_array_elements(oc.condicao_pagamento->'parcelas') AS p
WHERE oc.dados_oc->>'origem' IN ('carga_pdf_oc_ifsc','carga_pdf_oc_bc')
ON CONFLICT (origem_tipo, origem_id, (payload->>'parcela')) WHERE origem_id IS NOT NULL
DO NOTHING;

COMMIT;

-- ---------- SEÇÃO 2 · VERIFICAÇÃO ----------
SELECT o.codigo AS obra, count(*) AS ops_geradas, sum(op.valor) AS valor_total
FROM ordens_pagamento op
JOIN obras o ON o.id = op.obra_id
WHERE op.origem_tipo = 'oc'
GROUP BY o.codigo;

-- amostra
SELECT numero, fornecedor, valor, vencimento, status, centro_custo
FROM ordens_pagamento WHERE origem_tipo='oc'
ORDER BY vencimento LIMIT 10;
