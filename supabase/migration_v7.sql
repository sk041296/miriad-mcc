-- ================================================================
-- MCC · MIGRAÇÃO v6.2 → v7.0  (executar UMA vez no SQL Editor; idempotente)
-- Fundação de acesso: 11 papéis, designação de usuários por obra, convite por
-- link (criação de senha), e tabelas de SM-i / SS-i já criadas para as próximas
-- etapas (v7.1+). Sem perda de dados.
-- ================================================================
create extension if not exists pgcrypto;

-- ---- usuarios: novos campos de convite/ativação e travamento ----
alter table usuarios add column if not exists senha_definida boolean not null default true;
alter table usuarios add column if not exists convite_exp   timestamptz;
alter table usuarios add column if not exists travado        boolean not null default false;
alter table usuarios add column if not exists travado_em     timestamptz;
-- senha pode ficar vazia até o convidado definir a própria senha
do $$ begin alter table usuarios alter column senha_hash drop not null; exception when others then null; end $$;

-- ---- migração dos papéis antigos para o novo modelo ----
update usuarios set papel = 'ceo'       where papel = 'gestor';
update usuarios set papel = 'sup_obras' where papel in ('residente', 'supervisor');
-- Papéis válidos: ceo, diretor, coord_suprimentos, coord_planejamento, coord_obras,
-- coord_orcamentos, op_planejamento, op_suprimentos, op_orcamento, financeiro, sup_obras

-- ---- designações: vincula um usuário a uma obra (e função naquela obra) ----
create table if not exists designacoes (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid references usuarios(id) on delete cascade,
  obra_id    uuid references obras(id)    on delete cascade,
  funcao     text,
  criado_em  timestamptz default now(),
  unique (usuario_id, obra_id)
);
create index if not exists idx_designacoes_usuario on designacoes(usuario_id);
create index if not exists idx_designacoes_obra    on designacoes(obra_id);

-- ---- SM-i (solicitação de material inteligente) — usada a partir da v7.1 ----
create table if not exists sm_itens (
  id uuid primary key default gen_random_uuid(),
  obra_id        uuid references obras(id) on delete cascade,
  solicitante_id uuid references usuarios(id) on delete set null,
  itens          jsonb default '[]',          -- [{eap_codigo, descricao, qtde_contratada, material, quantidade, unidade}]
  data_necessidade date,
  descricao      text,
  status         text default 'aberta',       -- aberta | em_atendimento | atendida | cancelada
  emergencial    boolean default false,
  autorizada_emergencial boolean default false,
  autorizada_por uuid references usuarios(id) on delete set null,
  atendido_por   uuid references usuarios(id) on delete set null,
  baixa_autorizada_por uuid references usuarios(id) on delete set null,
  baixado_em     timestamptz,
  criado_em      timestamptz default now()
);
create index if not exists idx_sm_obra on sm_itens(obra_id);

-- ---- SS-i (solicitação de serviço) — usada a partir da v7.3 ----
create table if not exists ss_itens (
  id uuid primary key default gen_random_uuid(),
  obra_id        uuid references obras(id) on delete cascade,
  solicitante_id uuid references usuarios(id) on delete set null,
  itens          jsonb default '[]',          -- [{eap_codigo, descricao, servico, quantidade, unidade}]
  data_necessidade date,
  descricao      text,
  tipo           text,                         -- empreitada | locacao | outros
  status         text default 'aberta',
  emergencial    boolean default false,
  autorizada_emergencial boolean default false,
  autorizada_por uuid references usuarios(id) on delete set null,
  atendido_por   uuid references usuarios(id) on delete set null,
  baixado_por    uuid references usuarios(id) on delete set null,
  baixado_em     timestamptz,
  criado_em      timestamptz default now()
);
create index if not exists idx_ss_obra on ss_itens(obra_id);

notify pgrst, 'reload schema';
-- pronto.
