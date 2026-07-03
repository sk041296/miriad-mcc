-- ============================================================
-- MCC · MIGRATION v11.01 · Centro de custo — Gastos de escritório
-- Idempotente.
-- ============================================================

-- Unidades cadastráveis (Sede, Filial, Fabril...)
CREATE TABLE IF NOT EXISTS public.gastos_unidades (
  id       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome     text UNIQUE NOT NULL,
  ordem    int DEFAULT 0,
  ativo    boolean DEFAULT true
);

-- Descrições/categorias cadastráveis (Manutenção, Benfeitorias...)
CREATE TABLE IF NOT EXISTS public.gastos_descricoes (
  id       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome     text UNIQUE NOT NULL,
  ordem    int DEFAULT 0,
  ativo    boolean DEFAULT true
);

-- Gastos de escritório (centro de custo permanente, sem obra/EAP)
CREATE TABLE IF NOT EXISTS public.gastos_escritorio (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unidade       text NOT NULL,               -- Sede / Filial / Fabril
  descricao     text NOT NULL,               -- Manutenção / Benfeitorias / etc
  detalhe       text,                         -- descrição livre do gasto
  valor         numeric DEFAULT 0,
  data          date DEFAULT current_date,
  origem_tipo   text,                         -- 'sm' | 'ss' | 'oc' | 'os' | 'manual'
  origem_id     uuid,                         -- id da solicitação original, se convertida
  criado_por    uuid,
  criado_em     timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_gastos_esc_data ON public.gastos_escritorio (data);
CREATE INDEX IF NOT EXISTS idx_gastos_esc_unidade ON public.gastos_escritorio (unidade);

-- Semear unidades e descrições padrão (só se ainda não existirem)
INSERT INTO public.gastos_unidades (nome, ordem)
SELECT * FROM (VALUES ('Sede - Centro Cívico', 1), ('Filial - Joinville', 2), ('Unidade Fabril - Santa Felicidade', 3)) AS v(nome, ordem)
ON CONFLICT (nome) DO NOTHING;

INSERT INTO public.gastos_descricoes (nome, ordem)
SELECT * FROM (VALUES ('Manutenção', 1), ('Benfeitorias', 2), ('Confraternizações', 3), ('Consumíveis', 4)) AS v(nome, ordem)
ON CONFLICT (nome) DO NOTHING;

NOTIFY pgrst, 'reload schema';

SELECT 'gastos_unidades' AS t, count(*) FROM public.gastos_unidades
UNION ALL SELECT 'gastos_descricoes', count(*) FROM public.gastos_descricoes
UNION ALL SELECT 'gastos_escritorio', count(*) FROM public.gastos_escritorio;
