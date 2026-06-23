-- ============================================================================
-- Vape 2 Go — Migración 0005: libreta de direcciones (1:N)
-- ----------------------------------------------------------------------------
-- Reemplaza la dirección única en `profiles` (0004) por una tabla `addresses`
-- con varias direcciones por usuario (Casa, Trabajo, Otro…), editables desde
-- /cuenta. Migra (backfill) la dirección que ya estaba en profiles y deja
-- addresses como fuente de verdad.
--
-- Aplicar con: supabase db push   (o pegar en el SQL Editor de Supabase)
-- Idempotente: re-ejecutable sin romper nada.
-- ============================================================================

create table if not exists public.addresses (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users(id) on delete cascade,
  label          text not null default 'Casa',   -- Casa | Trabajo | Otro
  line1          text not null,                   -- calle, número, sector
  line2          text,                            -- apartamento, piso, casa
  delivery_notes text,                            -- referencias / indicaciones
  is_default     boolean not null default false,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists idx_addresses_user on public.addresses(user_id);

comment on table public.addresses is 'Libreta de direcciones de entrega (1:N con auth.users). Protegida por RLS.';

-- updated_at automático (reusa set_updated_at de 0001)
drop trigger if exists trg_addresses_updated_at on public.addresses;
create trigger trg_addresses_updated_at
  before update on public.addresses
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- RLS: cada quien gestiona SOLO sus direcciones; admin/staff pueden verlas.
-- ----------------------------------------------------------------------------
alter table public.addresses enable row level security;

drop policy if exists "addresses_crud_own" on public.addresses;
create policy "addresses_crud_own" on public.addresses
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "addresses_select_admin" on public.addresses;
create policy "addresses_select_admin" on public.addresses
  for select using (public.is_admin());

-- ----------------------------------------------------------------------------
-- Backfill: la dirección que estaba en profiles (0004) pasa a addresses.
-- ----------------------------------------------------------------------------
insert into public.addresses (user_id, label, line1, line2, delivery_notes, is_default)
select
  p.id,
  coalesce(nullif(p.address_label, ''), 'Casa'),
  p.address_line1,
  nullif(p.address_line2, ''),
  nullif(p.delivery_notes, ''),
  true
from public.profiles p
where coalesce(p.address_line1, '') <> ''
  and not exists (select 1 from public.addresses a where a.user_id = p.id);

-- ----------------------------------------------------------------------------
-- Trigger de alta: crea el profile + la primera dirección (si vino en registro).
-- ----------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (
    id, email, full_name, phone, age_verified, marketing_consent, terms_accepted_at
  )
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    coalesce(new.raw_user_meta_data->>'phone', ''),
    coalesce((new.raw_user_meta_data->>'age_verified')::boolean, false),
    coalesce((new.raw_user_meta_data->>'marketing_consent')::boolean, false),
    case when (new.raw_user_meta_data->>'terms_accepted')::boolean then now() else null end
  )
  on conflict (id) do nothing;

  if coalesce(new.raw_user_meta_data->>'address_line1', '') <> '' then
    insert into public.addresses (user_id, label, line1, line2, delivery_notes, is_default)
    values (
      new.id,
      coalesce(nullif(new.raw_user_meta_data->>'address_label', ''), 'Casa'),
      new.raw_user_meta_data->>'address_line1',
      nullif(new.raw_user_meta_data->>'address_line2', ''),
      nullif(new.raw_user_meta_data->>'delivery_notes', ''),
      true
    );
  end if;
  return new;
end;
$$;

-- ----------------------------------------------------------------------------
-- Quitar las columnas de dirección de profiles (ya migradas a addresses).
-- (Se hace al final, después del backfill, para no perder datos.)
-- ----------------------------------------------------------------------------
alter table public.profiles drop column if exists address_line1;
alter table public.profiles drop column if exists address_line2;
alter table public.profiles drop column if exists delivery_notes;
alter table public.profiles drop column if exists address_label;
