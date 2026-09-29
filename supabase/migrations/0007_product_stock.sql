-- ============================================================================
-- Vape 2 Go — Migración 0007: espejo de inventario (product_stock)
-- ----------------------------------------------------------------------------
-- Inventario UNIFICADO con PedidosYa. La fuente de verdad es la pestaña
-- Inventario del sheet "Vape 2 Go Master" (Stock + Activo PY (S/N) + Precio PY DOP).
-- n8n espeja ese sheet aquí cada ~10 min (con service_role). El sitio lee stock,
-- precio y disponibilidad EN VIVO de esta tabla — NO del products.json horneado.
--
-- Regla de disponibilidad (idéntica a PedidosYa):
--   comprable  ⇔  active = true  AND  stock > 0
-- Una venta web descuenta el mismo Inventario del sheet (order-bridge n8n),
-- así web y PY nunca sobrevenden el stock compartido.
-- ============================================================================

create table if not exists public.product_stock (
  sku          text primary key,               -- join por SKU con el catálogo
  master_code  text,
  name         text,
  stock        integer not null default 0 check (stock >= 0),
  active        boolean not null default false, -- Activo PY (S/N) del sheet
  price        numeric(12,2) not null default 0,-- precio de venta directo (mata los price:0)
  compare_at_price numeric(12,2),               -- precio tachado / regular (lista Precio PY DOP)
  py_state     text,                            -- estado real leído de PedidosYa (reconciliador PY→sheet)
  synced_at    timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

comment on table public.product_stock is
  'Espejo del Inventario del sheet Vape 2 Go Master. Escrito por n8n (service_role). '
  'Fuente de verdad de stock/precio/disponibilidad para el catálogo y el checkout.';

create index if not exists idx_product_stock_active on public.product_stock (active) where active = true;

drop trigger if exists trg_product_stock_updated_at on public.product_stock;
create trigger trg_product_stock_updated_at
  before update on public.product_stock
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- Vista pública de lo comprable (activo + con stock). El sitio la consulta para
-- disponibilidad/precio en vivo sin exponer conteos de productos apagados.
-- ----------------------------------------------------------------------------
create or replace view public.available_products
with (security_invoker = true) as
  select sku, master_code, name, stock, price, compare_at_price
  from public.product_stock
  where active = true and stock > 0;

-- ----------------------------------------------------------------------------
-- RLS: lectura pública (es catálogo, no hay datos sensibles). La escritura sólo
-- por service_role (n8n) — sin policy de insert/update => bloqueada para anon/auth.
-- ----------------------------------------------------------------------------
alter table public.product_stock enable row level security;

drop policy if exists "product_stock_read_all" on public.product_stock;
create policy "product_stock_read_all" on public.product_stock
  for select using (true);
