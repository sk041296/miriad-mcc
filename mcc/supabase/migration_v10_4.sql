-- ================================================================
-- MCC · MIGRAÇÃO v10.3 → v10.4  (executar UMA vez; idempotente)
-- Índices de desempenho para suportar mais obras e usuários simultâneos.
-- ================================================================
create index if not exists idx_eap_obra            on eap_itens(obra_id);
create index if not exists idx_rdos_obra            on rdos(obra_id);
create index if not exists idx_rdos_data            on rdos(data);
create index if not exists idx_rdos_obra_data       on rdos(obra_id, data);
create index if not exists idx_restricoes_obra      on restricoes_material(obra_id);
create index if not exists idx_contratos_obra       on contratos_servico(obra_id);
create index if not exists idx_oc_obra              on ordens_compra(obra_id);
create index if not exists idx_sm_obra              on sm_itens(obra_id);
create index if not exists idx_ss_obra              on ss_itens(obra_id);
create index if not exists idx_pos_obra             on pos(obra_id);
create index if not exists idx_pmm_obra             on pmm(obra_id);
create index if not exists idx_desig_usuario        on designacoes(usuario_id);
create index if not exists idx_desig_obra           on designacoes(obra_id);

notify pgrst, 'reload schema';
