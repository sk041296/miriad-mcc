-- ================================================================
-- MCC · MIGRAÇÃO v2 → v3  (executar UMA vez no SQL Editor; idempotente)
-- Adiciona o papel "Supervisor Residente" (acesso só à própria obra).
-- ================================================================

-- obra designada ao usuário (usada quando papel = 'residente')
alter table usuarios add column if not exists obra_id uuid references obras(id) on delete set null;

-- (papel já é texto livre; os valores passam a ser: 'gestor' | 'supervisor' | 'residente')
