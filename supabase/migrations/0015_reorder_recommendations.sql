-- 0015_reorder_recommendations.sql
-- Reco semanal del bot de compras (WF05/06) espejada en Supabase para la VISTA DEL
-- SUPERVISOR (backoffice). Es el puente entre el bot (Sheets: Ops-Orden-Compra) y el
-- backoffice cost-blind: el supervisor ve QUÉ está en 0 / próximo a agotarse + CUÁNTO
-- sugiere el bot, hace conteo físico y arma la propuesta para Máximo.
--
-- Modelo de seguridad (mismo criterio cost-blind que orders_ops / order_alerts):
--   * TABLA COST-BLIND POR CONSTRUCCIÓN: NO guarda costo ni inversión (eso queda en
--     Sheets/Discord para Luis+Máximo). El supervisor solo ve cantidades/urgencia/días.
--   * La reco la escribe el BOT con service_role (bypassa RLS). authenticated solo LEE
--     (is_backoffice). Nadie de authenticated escribe directo.
--   * Las anotaciones del supervisor (conteo físico + cantidad propuesta + nota) van por
--     un RPC security-definer (sb_review_reorder). NO son señal de entrenamiento del bot
--     (el aprendizaje aprende de compras reales + resultado, no de la opinión del supervisor).
--
-- Correr MANUAL en el SQL Editor. Proyecto V2G: xrfwtrdkclujgagpaaii.
-- (Existe una copia idéntica en maskotas-site para el proyecto hizskmrndcqxpkqvlrvu.)

begin;

create table if not exists public.reorder_recommendations (
  week_key          text not null,          -- llave estable de semana del bot: 'Sem YYYY-MM-DD' (lunes)
  sku               text not null,
  -- Campos que calcula el bot (hoy solo iban a Discord; aquí se persisten). SIN costo.
  stock             integer,
  dias_restantes    integer,                -- null = "infinito" (velocidad ~0)
  cantidad_sugerida integer,
  urgencia          text,                   -- URGENTE | REPONER | ESTA SEMANA | SEMANAL
  apagado           boolean default false,
  vendia_semana     numeric,                -- solo apagados: ~unidades/semana histórico
  vel_dia           numeric,
  colchon_dias      numeric,
  lead_dias         integer,
  proveedor         text,
  generated_at      timestamptz not null default now(),
  -- Anotaciones del SUPERVISOR (handoff a Máximo; NO entran al aprendizaje).
  physical_count    integer,
  supervisor_qty    integer,
  supervisor_note   text,
  reviewed_at       timestamptz,
  reviewed_by       uuid references auth.users(id),
  updated_at        timestamptz not null default now(),
  primary key (week_key, sku)
);

create index if not exists idx_reorder_reco_week on public.reorder_recommendations(week_key);

drop trigger if exists trg_reorder_reco_updated_at on public.reorder_recommendations;
create trigger trg_reorder_reco_updated_at
  before update on public.reorder_recommendations
  for each row execute function public.set_updated_at();

alter table public.reorder_recommendations enable row level security;

-- Lectura: cualquier rol de backoffice (admin/staff/operator/supervisor). Datos NO sensibles.
drop policy if exists reorder_reco_select_bo on public.reorder_recommendations;
create policy reorder_reco_select_bo on public.reorder_recommendations
  for select to authenticated
  using (public.is_backoffice());

-- Nadie de authenticated/anon escribe directo: el bot usa service_role; el supervisor, el RPC.
revoke insert, update, delete on public.reorder_recommendations from authenticated, anon;

-- RPC: el supervisor anota conteo físico + cantidad propuesta + nota sobre la reco de la
-- semana en curso. Calcula el week_key (lunes, UTC) para que cuadre con la llave del bot.
-- Upsert: permite anotar incluso un SKU agotado sin reco del bot (fila mínima), sin pisar
-- los campos que calcula el bot.
create or replace function public.sb_review_reorder(
  p_sku text,
  p_physical_count integer default null,
  p_supervisor_qty integer default null,
  p_note text default null
) returns void
  language plpgsql security definer set search_path = public as $$
declare
  v_week text := to_char(date_trunc('week', timezone('UTC', now())), '"Sem "YYYY-MM-DD');
begin
  if not public.is_backoffice() then raise exception 'forbidden'; end if;
  insert into public.reorder_recommendations
    (week_key, sku, physical_count, supervisor_qty, supervisor_note, reviewed_at, reviewed_by)
  values
    (v_week, p_sku, p_physical_count, p_supervisor_qty, p_note, now(), auth.uid())
  on conflict (week_key, sku) do update set
    physical_count  = excluded.physical_count,
    supervisor_qty  = excluded.supervisor_qty,
    supervisor_note = excluded.supervisor_note,
    reviewed_at     = now(),
    reviewed_by     = auth.uid();
end; $$;

grant execute on function public.sb_review_reorder(text, integer, integer, text) to authenticated;

commit;
