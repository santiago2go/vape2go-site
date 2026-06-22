-- ============================================================================
-- Vape 2 Go — Migración 0003: comercio (afiliados, cupones, órdenes)
-- ----------------------------------------------------------------------------
-- Base del modelo de cupones/afiliados con atribución HÍBRIDA decreciente
-- (ver "Contexto SEO Vape 2 Go.md", frente 4) y de las órdenes del checkout
-- propio (frente 3). Las órdenes las confirma el backend (Netlify Function /
-- n8n con service_role), nunca el cliente directo.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- affiliates: cada negocio afín con su código/QR
-- ----------------------------------------------------------------------------
create table if not exists public.affiliates (
  id             uuid primary key default gen_random_uuid(),
  code           text unique not null,                 -- va en el QR: ?ref=CODE
  business_name  text not null,
  contact_phone  text,
  discount_type  text not null default 'percent' check (discount_type in ('percent','fixed')),
  discount_value numeric(10,2) not null default 10,    -- % o monto fijo en DOP
  commission_pct numeric(5,2) not null default 10,     -- comisión base al afiliado
  attribution    text not null default 'hybrid'
                   check (attribution in ('first_order','hybrid','lifetime')),
  -- atribución híbrida decreciente: ventana en días para comisión reducida
  decay_days     integer not null default 90,
  decay_pct      numeric(5,2) not null default 5,      -- comisión tras primera orden, dentro de decay_days
  max_discount   numeric(10,2),                         -- tope de descuento por orden (anti-fraude)
  active         boolean not null default true,
  notes          text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

drop trigger if exists trg_affiliates_updated_at on public.affiliates;
create trigger trg_affiliates_updated_at
  before update on public.affiliates
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- orders: órdenes del checkout propio
-- ----------------------------------------------------------------------------
create table if not exists public.orders (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid references auth.users(id) on delete set null,
  status          text not null default 'pending'
                    check (status in ('pending','paid','shipped','delivered','cancelled','refunded')),
  customer_name   text,
  customer_phone  text,
  address         jsonb,                  -- {street, ref, city, lat, lng}
  items           jsonb not null,         -- [{product_id, sku, name, qty, unit_price}]
  subtotal        numeric(12,2) not null default 0,
  discount_applied numeric(12,2) not null default 0,
  total           numeric(12,2) not null default 0,
  affiliate_code  text references public.affiliates(code) on delete set null,
  is_first_order  boolean not null default false,
  commission_owed numeric(12,2) not null default 0,
  payment_ref     text,                   -- referencia Azul/CardNet/transferencia
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists idx_orders_user      on public.orders (user_id);
create index if not exists idx_orders_affiliate  on public.orders (affiliate_code);
create index if not exists idx_orders_created_at on public.orders (created_at desc);

drop trigger if exists trg_orders_updated_at on public.orders;
create trigger trg_orders_updated_at
  before update on public.orders
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- RLS afiliados: solo admin gestiona; los códigos activos se pueden VALIDAR
-- públicamente vía RPC (no exponemos la tabla entera al público).
-- ----------------------------------------------------------------------------
alter table public.affiliates enable row level security;

drop policy if exists "affiliates_admin_all" on public.affiliates;
create policy "affiliates_admin_all" on public.affiliates
  for all using (public.is_admin()) with check (public.is_admin());

-- RPC pública: valida un código y devuelve solo el descuento (no datos del negocio)
create or replace function public.validate_coupon(coupon_code text)
returns table (valid boolean, discount_type text, discount_value numeric, max_discount numeric)
language sql
stable
security definer
set search_path = public
as $$
  select
    (a.id is not null and a.active) as valid,
    a.discount_type, a.discount_value, a.max_discount
  from public.affiliates a
  where a.code = upper(trim(coupon_code))
  limit 1;
$$;

-- ----------------------------------------------------------------------------
-- RLS órdenes: el usuario ve SOLO sus órdenes; admin ve todas.
-- La INSERCIÓN/escritura "de verdad" la hace el backend con service_role
-- (que ignora RLS). El cliente no puede inventar totales/comisiones.
-- ----------------------------------------------------------------------------
alter table public.orders enable row level security;

drop policy if exists "orders_select_own" on public.orders;
create policy "orders_select_own" on public.orders
  for select using (user_id = auth.uid());

drop policy if exists "orders_admin_all" on public.orders;
create policy "orders_admin_all" on public.orders
  for all using (public.is_admin()) with check (public.is_admin());

-- ----------------------------------------------------------------------------
-- Reporte de liquidación por afiliado (solo admin lo lee vía la vista RLS)
-- ----------------------------------------------------------------------------
create or replace view public.affiliate_settlement
with (security_invoker = true) as
select
  o.affiliate_code,
  a.business_name,
  count(*)                       as orders_count,
  sum(o.subtotal)                as gross_subtotal,
  sum(o.discount_applied)        as total_discount,
  sum(o.commission_owed)         as commission_owed
from public.orders o
join public.affiliates a on a.code = o.affiliate_code
where o.status in ('paid','shipped','delivered')
group by o.affiliate_code, a.business_name;
