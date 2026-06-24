-- ================================================================
-- MCC · MIGRAÇÃO v9.8 → v10.0  (executar UMA vez no SQL Editor; idempotente)
-- Condição de pagamento (parcelas) na OS-i / contratos de serviço.
-- ================================================================
alter table contratos_servico add column if not exists condicao_pagamento jsonb;

notify pgrst, 'reload schema';
