-- ============================================================
-- MCC · MIGRATION v10.39 · Papéis customizados + aprovação de ações de usuário
-- Idempotente.
-- ============================================================

-- 1) Papéis customizados (variações de um papel-base)
CREATE TABLE IF NOT EXISTS public.papeis_customizados (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chave         text UNIQUE NOT NULL,          -- ex: custom_encarregado_pintura
  nome          text NOT NULL,                 -- ex: Encarregado de Pintura
  papel_base    text NOT NULL,                 -- herda permissões deste papel fixo
  criado_por    uuid,
  criado_em     timestamptz DEFAULT now()
);

-- 2) Ações de usuário pendentes de aprovação (criar/excluir usuário pelo coord_planejamento)
CREATE TABLE IF NOT EXISTS public.acoes_usuario_pendentes (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo          text NOT NULL,                 -- 'criar' | 'excluir'
  payload       jsonb NOT NULL,                -- dados do usuário a criar, ou {id} a excluir
  descricao     text,                          -- resumo legível
  status        text DEFAULT 'aguardando',     -- aguardando | aprovada | rejeitada
  solicitado_por uuid,
  solicitado_em  timestamptz DEFAULT now(),
  decidido_por   uuid,
  decidido_em    timestamptz,
  motivo_rejeicao text
);

CREATE INDEX IF NOT EXISTS idx_acoes_usuario_status ON public.acoes_usuario_pendentes (status);

NOTIFY pgrst, 'reload schema';

SELECT 'papeis_customizados' AS t, count(*) FROM public.papeis_customizados
UNION ALL
SELECT 'acoes_usuario_pendentes', count(*) FROM public.acoes_usuario_pendentes;
