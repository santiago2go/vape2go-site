-- ============================================================================
-- Vape 2 Go — Migración 0006: celular / WhatsApp por dirección
-- ----------------------------------------------------------------------------
-- Agrega `phone` a `addresses` (contacto de entrega de esa dirección) y hace
-- que el trigger de registro lo llene con el celular del signup.
--
-- Aplicar con: supabase db push   (o pegar en el SQL Editor de Supabase)
-- Idempotente.
-- ============================================================================

alter table public.addresses add column if not exists phone text;
comment on column public.addresses.phone is 'Celular / WhatsApp de contacto para la entrega en esta dirección';

-- Backfill: las direcciones existentes heredan el celular del perfil.
update public.addresses a
set phone = p.phone
from public.profiles p
where a.user_id = p.id
  and coalesce(a.phone, '') = ''
  and coalesce(p.phone, '') <> '';

-- Trigger de alta: crea profile + 1ra dirección (con celular) si vino en registro.
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
    insert into public.addresses (user_id, label, line1, line2, delivery_notes, phone, is_default)
    values (
      new.id,
      coalesce(nullif(new.raw_user_meta_data->>'address_label', ''), 'Casa'),
      new.raw_user_meta_data->>'address_line1',
      nullif(new.raw_user_meta_data->>'address_line2', ''),
      nullif(new.raw_user_meta_data->>'delivery_notes', ''),
      nullif(new.raw_user_meta_data->>'phone', ''),
      true
    );
  end if;
  return new;
end;
$$;
