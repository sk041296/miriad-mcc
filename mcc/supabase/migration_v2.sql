-- ================================================================
-- MCC · MIGRAÇÃO v1 → v2  (executar UMA vez no SQL Editor do Supabase)
-- Preserva todos os dados já em produção. Idempotente (pode reexecutar).
-- ================================================================

-- ---------- 1. EAP: custo sem BDI, BDI, desconto e META de custo ----------
alter table eap_itens add column if not exists custo_sem_bdi numeric;     -- custo unitário SEM BDI (base da meta)
alter table eap_itens add column if not exists bdi numeric default 0;      -- BDI fracionário do item (0.27 = 27%)
alter table eap_itens add column if not exists desconto numeric default 0; -- desconto da licitação aplicado ao item (0.11 = 11%)
alter table eap_itens add column if not exists meta_pct numeric;           -- % sobre custo SEM BDI que define a meta de fechamento
alter table eap_itens add column if not exists meta_valor numeric;         -- meta de custo unitária resultante (R$)

-- Retrocompat: para itens já existentes, deriva custo_sem_bdi a partir do valor_unit
-- (assume que valor_unit guardava o valor com BDI; se não houver BDI, custo≈valor_unit).
update eap_itens
   set custo_sem_bdi = case when coalesce(bdi,0) > 0 then valor_unit / (1 + bdi) else valor_unit end
 where custo_sem_bdi is null;

-- ---------- 2. OC-i e OS-i: múltiplos itens de EAP ----------
-- A coluna eap_codigo (texto único) continua existindo p/ compatibilidade;
-- adiciona-se eap_itens (jsonb) com a lista [{eap_codigo, descricao, valor}].
alter table ordens_compra     add column if not exists itens_eap jsonb not null default '[]';
alter table contratos_servico add column if not exists itens_eap jsonb not null default '[]';

-- migra o valor antigo (eap_codigo único) para o array, quando ainda vazio
update ordens_compra
   set itens_eap = jsonb_build_array(jsonb_build_object('eap_codigo', eap_codigo, 'material', material, 'valor', valor))
 where (itens_eap = '[]'::jsonb or itens_eap is null) and coalesce(eap_codigo,'') <> '';
update contratos_servico
   set itens_eap = jsonb_build_array(jsonb_build_object('eap_codigo', escopo_eap, 'valor', valor))
 where (itens_eap = '[]'::jsonb or itens_eap is null) and coalesce(escopo_eap,'') <> '';

-- ---------- 3. OS-i (antiga RSO-i): tipo direto/indireto + custo mensal ----------
alter table contratos_servico add column if not exists tipo text default 'indireto';  -- 'direto' | 'indireto'
alter table contratos_servico add column if not exists custo_mensal numeric;           -- p/ contratos diretos
alter table contratos_servico add column if not exists meses int;                      -- duração em meses (diretos)

-- ---------- 4. Prestadores em obra: diretos × indiretos ----------
-- Reaproveita a tabela funcionarios, adicionando o vínculo.
alter table funcionarios add column if not exists vinculo text default 'direto';       -- 'direto' | 'indireto'
alter table funcionarios add column if not exists obra_id uuid references obras(id) on delete set null;
alter table funcionarios add column if not exists custo_mensal numeric;

-- ---------- 5. Fotos do RDO-i ----------
-- As fotos ficam no Supabase Storage (bucket 'rdo-fotos'); o RDO guarda metadados.
alter table rdos add column if not exists fotos jsonb not null default '[]';           -- [{url, eap_codigo, legenda, path}]

-- ---------- 6. Bucket de Storage para fotos ----------
insert into storage.buckets (id, name, public)
values ('rdo-fotos', 'rdo-fotos', true)
on conflict (id) do nothing;

-- Política de leitura pública das fotos (bucket público já permite leitura via URL).
-- O upload é feito pelo servidor com a service_role, que ignora RLS de Storage.

-- ---------- 7. Metas a nível de obra (parâmetro padrão) ----------
alter table obras add column if not exists meta_pct_padrao numeric default 1;  -- meta% padrão aplicada a novos itens

-- pronto.
