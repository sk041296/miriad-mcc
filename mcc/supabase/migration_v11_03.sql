-- ============================================================
-- MCC · migration_v11_03
-- 1) Log de travamentos de acesso (quem travou, por qual tarefa, e destravamento)
-- 2) envio_semanal.sem_necessidade — supervisor declara "sem SM-i nesta semana"
-- Idempotente. Rode UMA vez no SQL Editor do Supabase.
-- ============================================================

-- ---------- 1. Log de travamentos ----------
CREATE TABLE IF NOT EXISTS public.travamentos (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id     uuid REFERENCES public.usuarios(id) ON DELETE CASCADE,
  tipo           text NOT NULL,                 -- 'sm' | 'pos' | 'pmm' (tarefa que motivou)
  motivo         text,                          -- descrição da tarefa/prazo
  ref            text,                          -- semana (yyyy-mm-dd) ou mês (yyyy-mm-01) de referência
  criado_em      timestamptz NOT NULL DEFAULT now(),
  destravado_em  timestamptz,                   -- preenchido quando o acesso é liberado
  destravado_por uuid REFERENCES public.usuarios(id)
);
CREATE INDEX IF NOT EXISTS idx_travamentos_usuario ON public.travamentos (usuario_id);
CREATE INDEX IF NOT EXISTS idx_travamentos_aberto  ON public.travamentos (usuario_id, tipo, ref) WHERE destravado_em IS NULL;

-- ---------- 2. "Sem necessidade de SM-i" na conformidade semanal ----------
ALTER TABLE public.envio_semanal
  ADD COLUMN IF NOT EXISTS sem_necessidade boolean NOT NULL DEFAULT false;

notify pgrst, 'reload schema';
