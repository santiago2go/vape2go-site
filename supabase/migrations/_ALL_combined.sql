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
-- ============================================================================
-- Vape 2 Go — Migración 0002: analítica de conversión (funnel propio)
-- ----------------------------------------------------------------------------
-- Tabla de eventos para medir el embudo: home → catálogo/categoría → producto
-- → intención de orden → orden. Es nuestro sink propietario (dueños de la data).
-- Para top-of-funnel anónimo de alto volumen, PostHog es complemento; aquí
-- guardamos lo que queremos poseer y cruzar con usuarios/órdenes.
-- ============================================================================

create table if not exists public.analytics_events (
  id           bigint generated always as identity primary key,
  -- session_id: uuid de cliente (cookie/localStorage), permite hilar anónimos
  session_id   text not null,
  user_id      uuid references auth.users(id) on delete set null,
  event_name   text not null,           -- 'page_view' | 'view_product' | 'add_intent' | 'order_click' | 'signup' ...
  funnel_step  smallint,                -- 1=home 2=listing 3=product 4=intent 5=order (nullable)
  path         text,
  referrer     text,
  product_id   text,
  category     text,
  brand        text,
  utm          jsonb,                   -- {source, medium, campaign, ref}
  props        jsonb,                   -- payload libre, acotado por trigger
  user_agent   text,
  created_at   timestamptz not null default now()
);

-- Índices para las consultas del dashboard de funnel
create index if not exists idx_events_created_at on public.analytics_events (created_at desc);
create index if not exists idx_events_name_step  on public.analytics_events (event_name, funnel_step);
create index if not exists idx_events_session    on public.analytics_events (session_id);
create index if not exists idx_events_user       on public.analytics_events (user_id);

-- ----------------------------------------------------------------------------
-- Guardia anti-abuso: limita el tamaño del payload (un anónimo NO debe poder
-- meter blobs gigantes). Rechaza props > 4KB y nombres de evento desconocidos.
-- ----------------------------------------------------------------------------
create or replace function public.validate_event()
returns trigger
language plpgsql
as $$
begin
  if new.event_name not in (
    'page_view','view_home','view_listing','view_product','view_brand',
    'search','add_intent','order_click','signup','login','add_to_cart','begin_checkout','purchase'
  ) then
    raise exception 'evento no permitido: %', new.event_name;
  end if;
  if new.props is not null and octet_length(new.props::text) > 4096 then
    raise exception 'props demasiado grande';
  end if;
  if length(coalesce(new.path,'')) > 512 then
    new.path = left(new.path, 512);
  end if;
  -- el user_id solo puede ser el propio (o null); nunca el de otro
  if new.user_id is not null and new.user_id <> auth.uid() then
    new.user_id = auth.uid();
  end if;
  return new;
end;
$$;

drop trigger if exists trg_validate_event on public.analytics_events;
create trigger trg_validate_event
  before insert on public.analytics_events
  for each row execute function public.validate_event();

-- ----------------------------------------------------------------------------
-- RLS: cualquiera (anon/authenticated) puede INSERTAR eventos, NADIE puede
-- leerlos salvo admin/staff. No hay update/delete para clientes.
-- ----------------------------------------------------------------------------
alter table public.analytics_events enable row level security;

drop policy if exists "events_insert_any" on public.analytics_events;
create policy "events_insert_any" on public.analytics_events
  for insert with check (true);

drop policy if exists "events_select_admin" on public.analytics_events;
create policy "events_select_admin" on public.analytics_events
  for select using (public.is_admin());

-- ----------------------------------------------------------------------------
-- Vista de funnel diario (para el dashboard admin / Grafana / Metabase).
-- Cuenta sesiones únicas por paso por día.
-- ----------------------------------------------------------------------------
create or replace view public.funnel_daily
with (security_invoker = true) as
select
  date_trunc('day', created_at)::date as day,
  count(distinct session_id) filter (where funnel_step = 1) as home,
  count(distinct session_id) filter (where funnel_step = 2) as listing,
  count(distinct session_id) filter (where funnel_step = 3) as product,
  count(distinct session_id) filter (where funnel_step = 4) as intent,
  count(distinct session_id) filter (where funnel_step = 5) as orders
from public.analytics_events
group by 1
order by 1 desc;

comment on view public.funnel_daily is 'Embudo diario por sesiones únicas. security_invoker => respeta RLS (solo admin lee).';
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
