-- ============================================================================
-- Vape 2 Go — Migración 0009: configuración de tienda editable (store_config)
-- ----------------------------------------------------------------------------
-- Key/value editable desde el backoffice: tarifa de delivery + umbral gratis
-- ("jugar con el precio del delivery"), datos de transferencia (APAP), WhatsApp.
-- create-order lee `delivery`; el checkout lee `delivery` + `transfer`.
-- Lectura pública (son datos de cara al cliente); escritura solo admin.
-- ============================================================================

create table if not exists public.store_config (
  key        text primary key,
  value      jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_store_config_updated_at on public.store_config;
create trigger trg_store_config_updated_at
  before update on public.store_config
  for each row execute function public.set_updated_at();

insert into public.store_config (key, value) values
  ('delivery', '{"fee":120,"free_over":800,"currency":"DOP","zone":"Santiago"}'::jsonb),
  ('transfer', '{"bank":"Asociación Popular de Ahorros y Préstamos (APAP)","account":"1034334018","account_type":"Ahorros","id_doc":"40200480552","holder":"MAXIMO CHRISTOPHER GOMEZ MARTINEZ"}'::jsonb),
  ('whatsapp', '{"number":"","label":"Enviar comprobante por WhatsApp"}'::jsonb)
on conflict (key) do nothing;

alter table public.store_config enable row level security;

drop policy if exists "store_config_read_all" on public.store_config;
create policy "store_config_read_all" on public.store_config
  for select using (true);

drop policy if exists "store_config_admin_write" on public.store_config;
create policy "store_config_admin_write" on public.store_config
  for all using (public.is_admin()) with check (public.is_admin());
