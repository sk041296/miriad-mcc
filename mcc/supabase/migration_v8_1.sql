-- ================================================================
-- MCC · MIGRAÇÃO v8.0 → v8.1  (executar UMA vez no SQL Editor; idempotente)
-- PMM — Plano de Medição Mensal (medição prevista da obra no mês).
-- ================================================================
create extension if not exists pgcrypto;

create table if not exists pmm (
  id uuid primary key default gen_random_uuid(),
  obra_id       uuid references obras(id) on delete cascade,
  supervisor_id uuid references usuarios(id) on delete set null,
  mes           date,                 -- primeiro dia do mês de referência (yyyy-mm-01)
  itens         jsonb default '[]',   -- [{eap_codigo, descricao, producao_prevista, unidade}]
  observacao    text,
  criado_em     timestamptz default now(),
  atualizado_em timestamptz default now(),
  unique (obra_id, supervisor_id, mes)
);
create index if not exists idx_pmm_obra on pmm(obra_id);
create index if not exists idx_pmm_mes on pmm(mes);

notify pgrst, 'reload schema';
