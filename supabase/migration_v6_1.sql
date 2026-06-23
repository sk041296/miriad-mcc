-- ================================================================
-- MCC · MIGRAÇÃO v6 → v6.1  (executar UMA vez no SQL Editor; idempotente)
-- OC-i: geração de PDF para o fornecedor.
--   • obras.cno          -> Cadastro Nacional de Obra (CNO), por obra
--   • ordens_compra.dados_oc (jsonb) -> solicitante, comprador, cliente,
--       solicitacaoNum, cno (snapshot), observacao, fornecedor{...}, entrega{...}
-- Os itens (itens_eap) passam a guardar por linha: material, quantidade,
-- unidade, valorUnit e valor — sem migração (já é jsonb).
-- ================================================================

alter table obras          add column if not exists cno text;
alter table ordens_compra  add column if not exists dados_oc jsonb;

-- pronto.
