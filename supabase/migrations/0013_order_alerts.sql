-- 0013_order_alerts.sql
-- Ringtone de órdenes para el MOSTRADOR. Canal SEGURO para el rol cost-blind
-- (operator/supervisor): una tabla mínima que la PC del mostrador SÍ puede oír por
-- Realtime, SIN poder leer la tabla `orders` (que sigue bloqueada por default-deny).
--
-- Modelo de seguridad (mismo criterio que orders_ops en 0012):
--   * order_alerts NO acumula historial visible al operador: la RLS solo deja ver
--     alertas SIN ACUSAR y de las últimas 12h. Así el operador nunca puede sumar
--     revenue ni sacar el directorio de clientes (queda INCOMPUTABLE, igual que hoy).
--   * `total`/`customer_name` ya son visibles al operador para órdenes abiertas vía
--     orders_ops → no es dato nuevo; el row-limit evita la acumulación.
--   * Nadie escribe la tabla directo: la llena un trigger security-definer; el "acuse"
--     (marcar en revisión) va por RPC security-definer whitelisteado.
--
-- Correr MANUAL en el SQL Editor. Proyecto V2G xrfwtrdkclujgagpaaii.
-- (Aplicar también en Maskotas al unificar el backend brand-aware.)

begin;

-- 1. Tabla mínima de alertas (sin subtotal/discount/commission/email/phone/address).
create table if not exists public.order_alerts (
  id              uuid primary key default gen_random_uuid(),
  order_id        uuid not null references public.orders(id) on delete cascade,
  channel         text not null,
  brand           text not null default 'VAPE',
  customer_name   text,
  total           numeric,          -- ya visible al operador vía orders_ops (ventana abierta)
  item_count      int,
  created_at      timestamptz not null default now(),
  acknowledged_at timestamptz,
  acknowledged_by uuid references auth.users(id)
);

-- Una alerta por orden (idempotente ante reintentos del webhook / doble insert).
create unique index if not exists uq_order_alerts_order on public.order_alerts(order_id);
create index if not exists idx_order_alerts_open
  on public.order_alerts (created_at desc)
  where acknowledged_at is null;

-- Realtime necesita la fila completa para propagar bien el UPDATE del acuse.
alter table public.order_alerts replica identity full;

alter table public.order_alerts enable row level security;

-- 2. RLS: SOLO backoffice, y SOLO alertas sin-acusar de las últimas 12h (anti-acumulación).
--    (El histórico y la suma de revenue quedan incomputables, igual que orders_ops.)
drop policy if exists order_alerts_select_bo on public.order_alerts;
create policy order_alerts_select_bo on public.order_alerts
  for select to authenticated
  using (
    public.is_backoffice()
    -- sin-acusar, o acusada hace <2 min: así el UPDATE del acuse se PROPAGA por Realtime
    -- a otras PC del mostrador (multi-terminal) sin reabrir el histórico → sigue incomputable.
    and (acknowledged_at is null or acknowledged_at > now() - interval '2 minutes')
    and created_at > now() - interval '12 hours'
  );

-- ⚠️ AISLAMIENTO DE MARCA (pendiente pre-unificación): esta policy NO filtra por `brand`
--    (el `.eq('brand', BRAND)` del cliente NO es barrera de seguridad). HOY no hay fuga:
--    V2G (xrfwtrdkclujgagpaaii) es un proyecto Supabase AISLADO y de marca única. ANTES de
--    unificar el backend brand-aware con Maskotas hay que: agregar `brand` a profiles (o una
--    tabla operator_brand) + helper `current_brand()`, y sumar `and brand = public.current_brand()`
--    AQUÍ y en el where de `orders_ops` (0012) — si no, un operador de una marca leería las
--    alertas (cliente+monto) de la otra. Mismo hueco a tapar en ambos objetos a la vez.

-- Nadie escribe/actualiza/borra directo: trigger + RPC lo hacen (security definer).
revoke insert, update, delete on public.order_alerts from authenticated, anon;

-- 3. Trigger: toda orden que NO sea de mostrador (WEB/KIOSCO/…) dispara una alerta.
--    Las ventas TIENDA (POS) NO alertan: las hace la propia cajera en el momento.
create or replace function public.tg_order_alert() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  if NEW.channel is distinct from 'TIENDA' then
    insert into public.order_alerts (order_id, channel, brand, customer_name, total, item_count)
    values (
      NEW.id, NEW.channel, coalesce(NEW.brand, 'VAPE'), NEW.customer_name, NEW.total,
      jsonb_array_length(case when jsonb_typeof(NEW.items::jsonb) = 'array'
                              then NEW.items::jsonb else '[]'::jsonb end)
    )
    on conflict (order_id) do nothing;
  end if;
  return NEW;
exception when others then
  -- El ringtone es SECUNDARIO: un fallo poblando order_alerts JAMÁS debe hacer rollback
  -- de la creación de la orden (ruta crítica de ingresos). Se traga el error y sigue.
  return NEW;
end; $$;

drop trigger if exists trg_order_alert on public.orders;
create trigger trg_order_alert after insert on public.orders
  for each row execute function public.tg_order_alert();

-- 4. Acuse ("en revisión"): corta el tono. NO cambia el status de la orden (eso es del
--    kanban de Órdenes del admin). Cualquier rol de backoffice puede acusar.
create or replace function public.ack_order_alert(p_order uuid) returns void
  language plpgsql security definer set search_path = public as $$
begin
  if not public.is_backoffice() then raise exception 'forbidden'; end if;
  update public.order_alerts
     set acknowledged_at = now(), acknowledged_by = auth.uid()
   where order_id = p_order and acknowledged_at is null;
end; $$;

grant execute on function public.ack_order_alert(uuid) to authenticated;

-- 5. Realtime: publicar la tabla (la RLS de arriba sigue filtrando por-suscriptor).
--    Si ya estaba en la publicación, ignora el error de "already member".
do $$
begin
  alter publication supabase_realtime add table public.order_alerts;
exception when duplicate_object then null;
end $$;

commit;
