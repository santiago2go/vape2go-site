-- ============================================================================
-- Seed — promover tu cuenta a admin
-- ----------------------------------------------------------------------------
-- 1) Primero regístrate en el sitio (o en Authentication → Users del dashboard).
-- 2) Cambia el email de abajo por el TUYO.
-- 3) Corre este script en el SQL Editor.
-- ============================================================================

update public.profiles
set role = 'admin'
where email = 'eduardovaldez909@gmail.com';

-- Verificar:
-- select id, email, role from public.profiles where role = 'admin';
