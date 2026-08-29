-- ============================================================================
-- Vape 2 Go — Migración 0008: órdenes directas (checkout propio)
-- ----------------------------------------------------------------------------
-- Extiende `orders` (0003) para el lanzamiento de órdenes directas de vapes.do:
--   • Pago: efectivo contra entrega + transferencia (Toke/Azul quedan preparados).
--   • Entrega: riders PROPIOS de Vape 2 Go → tracking por estado + notificación.
--   • Estados con etapa "preparing" y flujo de confirmación de pago.
-- La escritura la sigue haciendo el backend con service_role (create-order + n8n).
-- ============================================================================

alter table public.orders
  add column if not exists payment_method     text
    check (payment_method in ('cash','transfer','toke','azul')),
  add column if not exists payment_status     text not null default 'pending'
    check (payment_status in ('pending','confirmed','failed')),
  add column if not exists transfer_proof_url text,          -- comprobante que manda el cliente
  add column if not exists delivery_fee       numeric(12,2) not null default 0,
  add column if not exists delivery_zone       text,
  add column if not exists rider_name          text,         -- rider propio asignado
  add column if not exists assigned_at         timestamptz,
  add column if not exists notes               text;         -- notas internas de operaciones

-- ----------------------------------------------------------------------------
-- Estados: se agrega 'preparing' (Preparando) al enum de 0003.
-- Mapeo del backoffice (kanban):
--   pending   = Nueva (esperando pago/confirmación)
--   paid      = Pago confirmado
--   preparing = Preparando
--   shipped   = En ruta (rider despachado)
--   delivered = Entregada (edad verificada en la puerta)
--   cancelled = Cancelada    refunded = Reembolsada
-- ----------------------------------------------------------------------------
alter table public.orders drop constraint if exists orders_status_check;
alter table public.orders
  add constraint orders_status_check
  check (status in ('pending','paid','preparing','shipped','delivered','cancelled','refunded'));

create index if not exists idx_orders_status         on public.orders (status);
create index if not exists idx_orders_payment_status on public.orders (payment_status);
