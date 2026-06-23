-- ================================================================
-- MCC · MIGRAÇÃO v9.3 → v9.4  (executar UMA vez no SQL Editor; idempotente)
-- Item de EAP "não descrito" (atividade executada fora da EAP original).
-- ================================================================
alter table eap_itens add column if not exists nao_descrito boolean not null default false;

notify pgrst, 'reload schema';
