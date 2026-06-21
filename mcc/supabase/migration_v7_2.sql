-- ================================================================
-- MCC · MIGRAÇÃO v7.1 → v7.2  (executar UMA vez no SQL Editor; idempotente)
-- Conformidade semanal de envio das SM-is pelo Supervisor de Obras.
-- (SM-i emergencial e travamento usam colunas já criadas na v7.0.)
-- ================================================================
create extension if not exists pgcrypto;

create table if not exists envio_semanal (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid references usuarios(id) on delete cascade,
  semana date,                       -- segunda-feira da semana de referência
  confirmado_em timestamptz default now(),
  unique (usuario_id, semana)
);
create index if not exists idx_envio_semanal_usuario on envio_semanal(usuario_id);

notify pgrst, 'reload schema';
