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
