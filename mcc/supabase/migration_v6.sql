-- ================================================================
-- MCC · MIGRAÇÃO v5 → v6  (executar UMA vez no SQL Editor; idempotente)
-- OC-i: condição de pagamento (à vista / entrada+parcelas / parcelado) com
--       parcelas identificadas por DIAS após o faturamento, e data de faturamento.
-- Essas colunas alimentam a alocação mensal de custos de MATERIAL no Financeiro
-- (abas "Custos por obra" e "Custos diretos (auto)").
-- ================================================================

-- condição de pagamento: { tipo, entrada, nParcelas, primeiroDias, intervaloDias,
--                          diasTexto, parcelas: [{ dias, valor, entrada? }] }
alter table ordens_compra add column if not exists condicao_pagamento jsonb;

-- data-base do faturamento; as parcelas vencem em (data_faturamento + dias)
alter table ordens_compra add column if not exists data_faturamento date;

-- retrocompat: OCs antigas passam a ter o faturamento na própria data da OC
update ordens_compra set data_faturamento = data where data_faturamento is null and data is not null;

-- pronto. (OCs sem condicao_pagamento são tratadas como "à vista" na data de faturamento.)
