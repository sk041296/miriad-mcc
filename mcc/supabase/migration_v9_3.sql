-- ================================================================
-- MCC · MIGRAÇÃO v9.2 → v9.3  (executar UMA vez no SQL Editor; idempotente)
-- Configuração de acesso por cargo (key-value JSON).
-- ================================================================
create extension if not exists pgcrypto;

create table if not exists app_config (
  chave         text primary key,
  valor         jsonb,
  atualizado_em timestamptz default now()
);

notify pgrst, 'reload schema';
