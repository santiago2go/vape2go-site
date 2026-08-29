-- 0012_operator_role_and_tienda.sql
-- Canal TIENDA (POS mostrador) + roles operativos cost-blind (operator/supervisor).
-- Correr MANUAL en el SQL Editor. Proyecto V2G: xrfwtrdkclujgagpaaii.
-- (Aplicar también en el proyecto de Maskotas si esa marca lleva POS.)
--
-- Modelo de seguridad (verificado por red-team adversarial):
--  * operator/supervisor NO están en is_admin() => por DEFAULT-DENY quedan fuera de
--    TODAS las policies sensibles (orders_admin_all, profiles_select_admin,
--    affiliates_admin_all, store_config_admin_write) sin escribir un solo bloqueo nuevo.
--  * El operador NUNCA lee la tabla `orders` base (0 filas). Lee la vista `orders_ops`,
--    acotada POR FILA a la ventana operativa (órdenes abiertas u <48h) y POR COLUMNA
--    (sin subtotal/discount/affiliate/commission/email) => revenue histórico, ballenas,
--    RFM y el directorio completo de teléfonos quedan INCOMPUTABLES.
--  * Toda escritura del operador pasa por RPC security-definer que whitelistea campos;
--    jamás un UPDATE directo. cancel/refund solo supervisor.

begin;

-- 0. Defensivo: customer_email se inserta desde create-order.mjs pero no está en ninguna
--    migración del folder (se agregó fuera de banda). Garantizarlo para que POS/checkout no fallen.
alter table public.orders add column if not exists customer_email text;

-- 1. Roles nuevos en el check de profiles (is_admin NO se toca => staff/admin intactos).
--    Defensivo: quita CUALQUIER check viejo sobre `role` (sin depender del nombre) y pone el nuevo.
do $$
declare c record;
begin
  for c in
    select conname from pg_constraint
    where conrelid = 'public.profiles'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%role%'
  loop
    execute format('alter table public.profiles drop constraint %I', c.conname);
  end loop;
end $$;
alter table public.profiles add constraint profiles_role_check
  check (role in ('customer','staff','admin','operator','supervisor'));

-- 2. Helpers (mismo patrón security-definer que is_admin; is_admin queda EXACTO admin|staff).
create or replace function public.is_operator() returns boolean
  language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles
                 where id = auth.uid() and role in ('operator','supervisor'));
$$;

create or replace function public.is_supervisor() returns boolean
  language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles
                 where id = auth.uid() and role = 'supervisor');
$$;

create or replace function public.is_backoffice() returns boolean
  language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles
                 where id = auth.uid() and role in ('admin','staff','operator','supervisor'));
$$;

-- 3. Canal de venta + marca (brand = semilla multi-marca; hoy todo 'VAPE', Maskotas entra como #2).
alter table public.orders add column if not exists channel text not null default 'WEB'
  check (channel in ('WEB','TIENDA'));
alter table public.orders add column if not exists brand text not null default 'VAPE';
create index if not exists idx_orders_channel on public.orders(channel);
create index if not exists idx_orders_brand on public.orders(brand);

-- 4. Vista operativa para el operador. Definer (owner=postgres) => bypassa RLS solo para PROYECTAR
--    las columnas no-sensibles, acotada por FILA a la ventana operativa.
--    EXCLUIDAS a propósito: subtotal, discount_applied, affiliate_code, commission_owed,
--    is_first_order, payment_ref, transfer_proof_url, customer_email, user_id.
--    (Sin subtotal, discount = subtotal+fee-total NO es derivable por aritmética.)
create or replace view public.orders_ops
  with (security_invoker = false, security_barrier = true) as
  select id, created_at, updated_at, channel, brand, status,
         payment_method, payment_status,
         customer_name, customer_phone, address, items, notes,
         total, delivery_fee, delivery_zone, rider_name, assigned_at
  from public.orders
  where public.is_operator()
    and (status in ('pending','paid','preparing','shipped')
         or created_at > now() - interval '48 hours');

revoke all on public.orders_ops from anon, public;
grant select on public.orders_ops to authenticated;

-- 5. RPCs de escritura del operador (whitelist de campos; jamás tocan columnas financieras).
create or replace function public.ops_advance_order(p_order uuid, p_to text) returns void
  language plpgsql security definer set search_path = public as $$
begin
  if not public.is_backoffice() then raise exception 'forbidden'; end if;
  if p_to not in ('preparing','shipped','delivered') then raise exception 'bad status'; end if;
  update public.orders
     set status = p_to,
         assigned_at = case when p_to = 'shipped' then now() else assigned_at end
   where id = p_order;
end; $$;

create or replace function public.ops_assign_rider(p_order uuid, p_rider text) returns void
  language plpgsql security definer set search_path = public as $$
begin
  if not public.is_backoffice() then raise exception 'forbidden'; end if;
  update public.orders set rider_name = p_rider, assigned_at = now() where id = p_order;
end; $$;

create or replace function public.ops_confirm_payment(p_order uuid) returns void
  language plpgsql security definer set search_path = public as $$
begin
  if not public.is_backoffice() then raise exception 'forbidden'; end if;
  update public.orders
     set payment_status = 'confirmed',
         status = case when status = 'pending' then 'paid' else status end
   where id = p_order;
end; $$;

-- cancel/refund tocan dinero => SOLO supervisor.
create or replace function public.ops_cancel_order(p_order uuid) returns void
  language plpgsql security definer set search_path = public as $$
begin
  if not public.is_supervisor() then raise exception 'forbidden: supervisor only'; end if;
  update public.orders set status = 'cancelled' where id = p_order;
end; $$;

-- Lookup de cliente para el POS: SOLO nombre + dirección de la última orden (sin gasto, sin agregación).
create or replace function public.pos_lookup_customer(p_phone text)
  returns table(customer_name text, address jsonb)
  language sql stable security definer set search_path = public as $$
  select customer_name, address from public.orders
   where public.is_backoffice() and customer_phone = p_phone
   order by created_at desc limit 1;
$$;

commit;

-- NOTA: NO se agrega ninguna policy de operator sobre orders/profiles/affiliates/store_config.
-- El default-deny es la barrera. Prueba obligatoria antes de dar login (con sesión de un
-- operator real, en DevTools):
--   supabase.from('orders').select('*')     -> []
--   supabase.from('profiles').select('*')   -> []  (solo su propia fila si hay policy self)
--   supabase.from('affiliates').select('*') -> []
--   supabase.from('orders_ops').select('total,customer_phone')  -> solo ventana operativa, no histórico
