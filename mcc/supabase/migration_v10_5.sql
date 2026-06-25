-- ================================================================
-- MCC · MIGRAÇÃO v10.4 → v10.5  (executar UMA vez; idempotente)
-- "Dia sem atividades" no RDO-i + normalização de e-mails existentes.
-- ================================================================
alter table rdos add column if not exists sem_atividades boolean not null default false;

-- Normaliza e-mails (remove espaços e maiúsculas) para evitar falha de login
update usuarios set email = lower(trim(email)) where email <> lower(trim(email));

notify pgrst, 'reload schema';
