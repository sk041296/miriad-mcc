-- ================================================================
-- MIRIAD CONSTRUCTION CONTROL (MCC) — schema do banco (Supabase/Postgres)
-- Executar no SQL Editor uma única vez.
-- Conceito RDO-i: dados normalizados e consultáveis por obra/EAP/data.
-- ================================================================

create extension if not exists pgcrypto;

-- ---------- Usuários e hierarquia de acesso ----------
create table if not exists usuarios (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  email text unique not null,
  senha_hash text not null,                 -- sha-256 (hash no servidor)
  papel text not null default 'supervisor', -- 'gestor' | 'supervisor'
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);

-- ---------- Obras ----------
create table if not exists obras (
  id uuid primary key default gen_random_uuid(),
  codigo text not null,                      -- ex.: FUN-PIR-004-REF-CPP
  nome text not null,
  contratante text,
  contrato text,                             -- nº do contrato / protocolo
  local text,
  prazo_dias int,                            -- prazo contratual em dias
  data_inicio date,
  desconto numeric not null default 0,       -- desconto da licitação (0.11 = 11%)
  meta_pct_padrao numeric default 1,         -- meta% padrão p/ novos itens
  ativa boolean not null default true,
  criado_em timestamptz not null default now()
);

-- ---------- EAP analítica (itens do orçamento) ----------
create table if not exists eap_itens (
  id uuid primary key default gen_random_uuid(),
  obra_id uuid not null references obras(id) on delete cascade,
  codigo text not null,                      -- ex.: 33.1
  descricao text,
  unidade text,                              -- m2, m3, kg, un, % ...
  qtde numeric,                              -- quantitativo contratado
  valor_unit numeric,                        -- já com BDI e (opcional) desconto
  valor_total numeric,
  disciplina text,
  ambiente text not null default 'interno',  -- 'interno' | 'externo' (afeta projeção c/ clima)
  custo_sem_bdi numeric,                     -- custo unitário SEM BDI (base da meta)
  bdi numeric default 0,                     -- BDI fracionário (0.27 = 27%)
  desconto numeric default 0,                -- desconto da licitação aplicado (0.11 = 11%)
  meta_pct numeric,                          -- % sobre custo SEM BDI que define a meta
  meta_valor numeric,                        -- meta de custo unitária resultante (R$)
  ordem int
);
create index if not exists idx_eap_obra on eap_itens(obra_id);

-- ---------- Cadastros operacionais ----------
create table if not exists contratos_servico (   -- OS-i (Ordem de Serviço Inteligente)
  id uuid primary key default gen_random_uuid(),
  obra_id uuid references obras(id) on delete set null,
  empresa text, cnpj text, responsavel text,
  escopo_eap text,                                -- (legado) item único da EAP
  itens_eap jsonb not null default '[]',          -- múltiplos itens [{eap_codigo, descricao, valor}]
  tipo text default 'indireto',                   -- 'direto' | 'indireto'
  custo_mensal numeric,                           -- p/ contratos diretos
  meses int,                                      -- duração em meses (diretos)
  valor numeric,
  criado_em timestamptz not null default now()
);

create table if not exists ordens_compra (        -- OC-i (materiais)
  id uuid primary key default gen_random_uuid(),
  obra_id uuid references obras(id) on delete set null,
  numero text, fornecedor text, data date,
  eap_codigo text,                                -- (legado) item único da EAP
  itens_eap jsonb not null default '[]',          -- múltiplos itens [{eap_codigo, material, valor}]
  material text, valor numeric,
  criado_em timestamptz not null default now()
);

create table if not exists funcionarios (          -- prestadores em obra (diretos × indiretos)
  id uuid primary key default gen_random_uuid(),
  nome text not null, atribuicao text,
  vinculo text default 'direto',                  -- 'direto' | 'indireto'
  obra_id uuid references obras(id) on delete set null,
  custo_mensal numeric,
  contrato_id uuid references contratos_servico(id) on delete set null,
  criado_em timestamptz not null default now()
);

-- ---------- RDO-i ----------
create table if not exists rdos (
  id uuid primary key default gen_random_uuid(),
  obra_id uuid not null references obras(id) on delete cascade,
  numero text,                                    -- nº sequencial do relatório
  data date not null,
  usuario_id uuid references usuarios(id) on delete set null,
  responsavel_nome text,
  clima text,                                     -- condição predominante
  clima_horas jsonb,                              -- detalhamento por hora (opcional)
  efetivo int,
  ocorrencias text,
  comentarios text,                               -- sai no PDF do cliente
  atividades jsonb not null default '[]',         -- [{eap,descricao,unidade,qtde_dia,pct_dia,equipe[]}]
  equipe jsonb not null default '[]',             -- [{ocupacao,nome,he_inicio,he_fim}]
  equipamentos jsonb not null default '[]',
  fotos jsonb not null default '[]',              -- [{url, eap_codigo, legenda, path}]
  payload jsonb,                                  -- snapshot completo p/ recuperação
  criado_em timestamptz not null default now()
);
create index if not exists idx_rdos_obra on rdos(obra_id);
create index if not exists idx_rdos_data on rdos(data);

-- ---------- Restrições de material (RDO-i — NÃO sai no PDF do cliente) ----------
create table if not exists restricoes_material (
  id uuid primary key default gen_random_uuid(),
  rdo_id uuid references rdos(id) on delete cascade,
  obra_id uuid not null references obras(id) on delete cascade,
  eap_codigo text not null,                       -- item da EAP impedido
  material text not null,                         -- material em falta
  data_solicitacao date,                          -- data do pedido ao suprimentos
  data_registro date not null default current_date,
  resolvida boolean not null default false,
  oc_id uuid references ordens_compra(id) on delete set null,
  criado_em timestamptz not null default now()
);
create index if not exists idx_restr_obra on restricoes_material(obra_id);

-- ---------- Estado financeiro (módulo Financeiro — premissas/cenários) ----------
create table if not exists financeiro_estado (
  chave text primary key,                         -- ex.: 'premissas'
  valor jsonb,
  atualizado_em timestamptz not null default now()
);

-- ---------- RLS: acesso só via service_role (funções serverless) ----------
alter table usuarios            enable row level security;
alter table obras               enable row level security;
alter table eap_itens           enable row level security;
alter table contratos_servico   enable row level security;
alter table ordens_compra       enable row level security;
alter table funcionarios        enable row level security;
alter table rdos                enable row level security;
alter table restricoes_material enable row level security;
alter table financeiro_estado   enable row level security;

-- ---------- Storage: bucket de fotos do RDO ----------
insert into storage.buckets (id, name, public) values ('rdo-fotos','rdo-fotos',true) on conflict (id) do nothing;
