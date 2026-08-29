-- 0011_security_hardening.sql
-- Endurecimiento de RLS tras la auditoría de seguridad (cyber-neo, 2026-07-20).
-- ⚠️ CORRER MANUALMENTE en el SQL Editor de Supabase (no hay SUPABASE_DB_URL local).
--    Aplicar en AMBOS proyectos: V2G (xrfwtrdkclujgagpaaii) y Maskotas (hizskmrndcqxpkqvlrvu).

-- ── CN-004 ──────────────────────────────────────────────────────────────────
-- La policy anterior solo impedía cambiar `role`. Con la anon key, un cliente
-- podía auto-editarse loyalty_points (fraude de puntos), age_verified (saltar el
-- gate de edad de nicotina) y terms_accepted_at (falsificar la constancia legal).
-- Fijamos todas las columnas privilegiadas: solo el backend (service_role) las cambia.
-- (marketing_consent NO se fija: es una preferencia que el usuario controla.)
drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update using (id = auth.uid())
  with check (
    id = auth.uid()
    and role           = (select p.role           from public.profiles p where p.id = auth.uid())
    and loyalty_points = (select p.loyalty_points from public.profiles p where p.id = auth.uid())
    and age_verified   = (select p.age_verified   from public.profiles p where p.id = auth.uid())
    and terms_accepted_at is not distinct from
        (select p.terms_accepted_at from public.profiles p where p.id = auth.uid())
  );

-- ── CN-011 ──────────────────────────────────────────────────────────────────
-- El insert de reseñas solo exigía status='pending'; un anónimo podía suplantar
-- el user_id de otro cliente. Atamos la identidad: solo tu propio user_id (o null
-- si eres invitado). Sigue requiriendo moderación admin (status='pending').
drop policy if exists "reviews_insert_pending" on public.product_reviews;
create policy "reviews_insert_pending" on public.product_reviews
  for insert with check (
    status = 'pending'
    and (user_id = auth.uid() or user_id is null)
  );
