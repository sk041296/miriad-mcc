-- ================================================================
-- MCC · MIGRAÇÃO v7.x → v8.0  (executar UMA vez no SQL Editor; idempotente)
-- POS — Plano Operacional Semanal (lookahead da semana seguinte).
-- ================================================================
create extension if not exists pgcrypto;

create table if not exists pos (
  id uuid primary key default gen_random_uuid(),
  obra_id       uuid references obras(id) on delete cascade,
  supervisor_id uuid references usuarios(id) on delete set null,
  semana        date,                 -- segunda-feira da semana-alvo (semana seguinte)
  frentes       jsonb default '[]',   -- [{eap_codigo, descricao, equipe, producao_planejada, unidade}]
  observacao    text,
  criado_em     timestamptz default now(),
  atualizado_em timestamptz default now(),
  unique (obra_id, supervisor_id, semana)
);
create index if not exists idx_pos_obra on pos(obra_id);
create index if not exists idx_pos_semana on pos(semana);

notify pgrst, 'reload schema';
