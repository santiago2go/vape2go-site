-- 0014_product_barcodes.sql
-- Mapa codigo-de-barras -> SKU para el escaner del POS de mostrador.
-- Correr MANUAL en el SQL Editor del proyecto V2G (xrfwtrdkclujgagpaaii), mismo patron que 0012.
-- Los barcodes NO son sensibles (no exponen costo/margen/cliente): lectura para
-- cualquier sesion de backoffice; ESCRITURA gateada a is_backoffice() (patron 0012).
-- Depende de public.set_updated_at() (0001) y public.is_backoffice() (0012), ambas ya existen.
-- Si NO se corre, el POS degrada: select da 42P01 -> barcodeMap vacio -> sigue con busqueda + match directo SKU.
begin;

create table if not exists public.product_barcodes (
  barcode     text primary key,                 -- lo que el lector tipea (EAN/UPC o codigo interno)
  sku         text not null,                    -- join por SKU con el catalogo / product_stock
  created_by  uuid references auth.users(id),   -- quien lo enseño (auditoria)
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists idx_product_barcodes_sku on public.product_barcodes (sku);

comment on table public.product_barcodes is
  'Mapa barcode->SKU aprendido desde el POS (modo aprendizaje). Barcodes no sensibles; escritura solo is_backoffice.';

drop trigger if exists trg_product_barcodes_updated_at on public.product_barcodes;
create trigger trg_product_barcodes_updated_at
  before update on public.product_barcodes
  for each row execute function public.set_updated_at();

alter table public.product_barcodes enable row level security;

-- Lectura: cualquier sesion de backoffice (operator/supervisor/staff/admin).
-- is_backoffice() en vez de using(true) para no exponer el mapa a customers logueados.
drop policy if exists "product_barcodes_read_backoffice" on public.product_barcodes;
create policy "product_barcodes_read_backoffice" on public.product_barcodes
  for select using (public.is_backoffice());

-- Escritura (insert/update/delete): solo backoffice. created_by debe ser el propio uid.
-- NOTA de diseño: la policy es abierta a CUALQUIER backoffice a propósito — en un mostrador
-- compartido conviene que cualquier cajera pueda CORREGIR un mapeo mal enseñado (re-teach).
-- Al re-enseñar, created_by queda con el último que lo enseñó (last-writer). Barcodes son
-- no-sensibles (barcode↔sku), así que no hay fuga; NO se divide en INSERT/UPDATE por-dueño
-- porque eso bloquearía las correcciones legítimas entre cajeras.
drop policy if exists "product_barcodes_write_backoffice" on public.product_barcodes;
create policy "product_barcodes_write_backoffice" on public.product_barcodes
  for all using (public.is_backoffice())
  with check (public.is_backoffice() and (created_by is null or created_by = auth.uid()));

commit;
