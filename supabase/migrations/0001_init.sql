-- ============================================================================
-- Vape 2 Go — Migración 0001: base de identidad y perfiles
-- ----------------------------------------------------------------------------
-- Crea la tabla `profiles` (1:1 con auth.users), el sistema de roles y los
-- helpers SECURITY DEFINER que el resto de migraciones usan para RLS.
--
-- Aplicar con: supabase db push   (o pegar en el SQL Editor de Supabase)
-- Es idempotente: se puede re-correr sin romper nada.
-- ============================================================================

-- Extensiones útiles
create extension if not exists "pgcrypto";      -- gen_random_uuid()
create extension if not exists "citext";         -- emails case-insensitive

-- ----------------------------------------------------------------------------
-- profiles: datos de la cuenta. El id ES el id de auth.users (no exponemos PII
-- de auth directamente; todo lo consultable vive aquí con RLS).
-- ----------------------------------------------------------------------------
create table if not exists public.profiles (
  id                uuid primary key references auth.users(id) on delete cascade,
  email             citext,
  full_name         text,
  phone             text,
  role              text not null default 'customer'
                      check (role in ('customer', 'staff', 'admin')),
  age_verified      boolean not null default false,
  marketing_consent boolean not null default false,
  -- constancia electrónica de aceptación de Términos + Política (Ley 172-13 / 358-05)
  terms_accepted_at timestamptz,
  -- coins / lealtad (motor de puntos del roadmap de retención)
  loyalty_points    integer not null default 0 check (loyalty_points >= 0),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

comment on table public.profiles is 'Perfil público/privado de cada usuario; 1:1 con auth.users. Protegido por RLS.';
comment on column public.profiles.role is 'customer = cliente final | staff = operación | admin = control total';

-- Guarda por si la tabla ya existía de una corrida previa (re-ejecución segura)
alter table public.profiles add column if not exists terms_accepted_at timestamptz;

-- ----------------------------------------------------------------------------
-- updated_at automático
-- ----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_profiles_updated_at on public.profiles;
create trigger trg_profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- Crear el profile automáticamente cuando nace un usuario en auth.users.
-- SECURITY DEFINER para poder insertar saltándose RLS.
-- ----------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, phone, age_verified, marketing_consent, terms_accepted_at)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    coalesce(new.raw_user_meta_data->>'phone', ''),
    coalesce((new.raw_user_meta_data->>'age_verified')::boolean, false),
    coalesce((new.raw_user_meta_data->>'marketing_consent')::boolean, false),
    -- si el cliente marcó la aceptación en el registro, sella la fecha
    case when (new.raw_user_meta_data->>'terms_accepted')::boolean then now() else null end
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ----------------------------------------------------------------------------
-- Helpers de rol — SECURITY DEFINER para evitar recursión de RLS.
-- (Si leyéramos profiles dentro de una policy de profiles sin definer,
--  entraríamos en bucle infinito de evaluación.)
-- ----------------------------------------------------------------------------
create or replace function public.current_role_is(target text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = target
  );
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('admin', 'staff')
  );
$$;

create or replace function public.is_full_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

-- ----------------------------------------------------------------------------
-- RLS en profiles
-- ----------------------------------------------------------------------------
alter table public.profiles enable row level security;

-- Cada quien ve y edita SOLO su propio perfil...
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
  for select using (id = auth.uid());

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update using (id = auth.uid())
  with check (
    id = auth.uid()
    -- un usuario NO puede auto-promoverse de rol: el rol solo lo cambia un admin
    and role = (select p.role from public.profiles p where p.id = auth.uid())
  );

-- ...salvo admin/staff, que ven todos los perfiles
drop policy if exists "profiles_select_admin" on public.profiles;
create policy "profiles_select_admin" on public.profiles
  for select using (public.is_admin());

-- Solo un admin pleno puede actualizar cualquier perfil (incl. cambiar roles)
drop policy if exists "profiles_update_admin" on public.profiles;
create policy "profiles_update_admin" on public.profiles
  for update using (public.is_full_admin())
  with check (public.is_full_admin());
