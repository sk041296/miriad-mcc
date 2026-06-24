-- ================================================================
-- MCC · MIGRAÇÃO v10.0 → v10.1  (executar UMA vez no SQL Editor; idempotente)
-- Centro de custo na obra + Boletim de Medição de Prestadores (BMP).
-- ================================================================
alter table obras add column if not exists centro_custo text;

create table if not exists boletins_medicao (
  id            uuid primary key default gen_random_uuid(),
  contrato_id   uuid references contratos_servico(id) on delete cascade,
  obra_id       uuid references obras(id) on delete set null,
  numero        int,
  status        text not null default 'aguardando_aprovacao',  -- aguardando_aprovacao | aprovado | rejeitado
  itens         jsonb not null default '[]'::jsonb,
  total         numeric not null default 0,   -- soma medida (bruto)
  retencao      numeric not null default 0,   -- soma das retenções técnicas
  liquido       numeric not null default 0,   -- total - retencao
  aprovacoes    jsonb not null default '{}'::jsonb,  -- { coord_obras, coord_planejamento, diretor }
  observacao    text,
  criado_por    uuid,
  criado_em     timestamptz not null default now()
);
create index if not exists idx_bm_contrato on boletins_medicao(contrato_id);
create index if not exists idx_bm_obra on boletins_medicao(obra_id);

notify pgrst, 'reload schema';
