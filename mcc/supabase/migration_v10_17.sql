-- ============================================================
-- MCC · MIGRATION v10.17 · Catálogo de insumos (DATABASE)
-- Duas tabelas-base da empresa, fundação do construtor de memorial:
--   catalogo_financeiro: plano de contas / naturezas financeiras
--   catalogo_mao_obra:   custos de mão de obra própria (salário, R$/hora)
-- Idempotente.
-- ============================================================

-- ---------- 1. Plano de contas / naturezas financeiras ----------
CREATE TABLE IF NOT EXISTS public.catalogo_financeiro (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo       text UNIQUE NOT NULL,        -- ex 30202020001
  descricao    text NOT NULL,               -- ex LOCACAO DE EQUIPAMENTOS
  tipo         text,                         -- CUSTO VARIÁVEL | INVESTIMENTOS | PESSOAL | IMPOSTO | CUSTO FIXO
  ativo        boolean DEFAULT true,
  criado_em    timestamptz DEFAULT now()
);

-- ---------- 2. Tabela de mão de obra ----------
CREATE TABLE IF NOT EXISTS public.catalogo_mao_obra (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prestador      text NOT NULL,             -- ex OFICIAL, AJUDANTE
  salario_mensal numeric,
  valor_hora     numeric,                   -- custo por hora
  unidade        text,
  ativo          boolean DEFAULT true,
  criado_em      timestamptz DEFAULT now(),
  UNIQUE (prestador, valor_hora)
);

CREATE INDEX IF NOT EXISTS idx_catfin_tipo ON public.catalogo_financeiro (tipo);

NOTIFY pgrst, 'reload schema';

SELECT 'catalogo_financeiro' AS tabela, count(*) FROM public.catalogo_financeiro
UNION ALL SELECT 'catalogo_mao_obra', count(*) FROM public.catalogo_mao_obra;
