-- ============================================================================
-- Vape 2 Go — Migración 0004: dirección de entrega en el perfil
-- ----------------------------------------------------------------------------
-- Agrega la dirección de entrega principal al perfil (capturada en el registro)
-- y actualiza handle_new_user() para mapearla desde raw_user_meta_data.
--
-- Aplicar con: supabase db push   (o pegar en el SQL Editor de Supabase)
-- Es idempotente: se puede re-correr sin romper nada.
--
-- Nota de modelo: por ahora la cuenta guarda UNA dirección principal en
-- `profiles`. Cuando llegue el checkout propio (Fase 1) y se necesiten varias
-- direcciones por usuario, migrar a una tabla `addresses` (1:N) y backfillear
-- desde estas columnas.
-- ============================================================================

alter table public.profiles add column if not exists address_line1  text;
alter table public.profiles add column if not exists address_line2  text;
alter table public.profiles add column if not exists delivery_notes text;
alter table public.profiles add column if not exists address_label  text;

comment on column public.profiles.address_line1  is 'Dirección de entrega (calle, número, sector)';
comment on column public.profiles.address_line2  is 'Apartamento, piso, casa, etc.';
comment on column public.profiles.delivery_notes is 'Referencias / indicaciones para el repartidor';
comment on column public.profiles.address_label  is 'Nombre de la dirección: Casa | Trabajo | Otro';

-- ----------------------------------------------------------------------------
-- Re-crear el trigger de alta para mapear los nuevos campos del metadata.
-- (El trigger on_auth_user_created ya apunta a esta función; no se recrea.)
-- ----------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (
    id, email, full_name, phone,
    address_line1, address_line2, delivery_notes, address_label,
    age_verified, marketing_consent, terms_accepted_at
  )
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    coalesce(new.raw_user_meta_data->>'phone', ''),
    nullif(new.raw_user_meta_data->>'address_line1', ''),
    nullif(new.raw_user_meta_data->>'address_line2', ''),
    nullif(new.raw_user_meta_data->>'delivery_notes', ''),
    nullif(new.raw_user_meta_data->>'address_label', ''),
    coalesce((new.raw_user_meta_data->>'age_verified')::boolean, false),
    coalesce((new.raw_user_meta_data->>'marketing_consent')::boolean, false),
    case when (new.raw_user_meta_data->>'terms_accepted')::boolean then now() else null end
  )
  on conflict (id) do nothing;
  return new;
end;
$$;
