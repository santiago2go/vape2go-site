-- ============================================================================
-- Vape 2 Go — Migración 0010: reseñas de productos (ratings 5★ + SEO)
-- ----------------------------------------------------------------------------
-- Reviews de productos: quién puso (cliente) y qué puso (rating + comentario).
-- Moderación en el backoffice; solo los 'approved' se muestran en la tienda y
-- cuentan para el aggregateRating (estrellas en Google). Ley/SEO: solo reales.
-- ============================================================================

create table if not exists public.product_reviews (
  id            uuid primary key default gen_random_uuid(),
  sku           text not null,                 -- join con el catálogo
  product_id    text,                          -- slug del producto
  product_name  text,
  user_id       uuid references auth.users(id) on delete set null,
  customer_name text,
  customer_email text,
  rating        integer not null check (rating between 1 and 5),
  comment       text,
  status        text not null default 'pending'
                  check (status in ('pending','approved','rejected')),
  order_id      uuid references public.orders(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists idx_reviews_sku_approved on public.product_reviews (sku) where status = 'approved';
create index if not exists idx_reviews_status on public.product_reviews (status);

drop trigger if exists trg_reviews_updated_at on public.product_reviews;
create trigger trg_reviews_updated_at
  before update on public.product_reviews
  for each row execute function public.set_updated_at();

alter table public.product_reviews enable row level security;

-- Público lee SOLO reseñas aprobadas (para mostrar + aggregateRating)
drop policy if exists "reviews_read_approved" on public.product_reviews;
create policy "reviews_read_approved" on public.product_reviews
  for select using (status = 'approved');

-- Cualquiera puede DEJAR una reseña, pero entra como 'pending' (no puede auto-aprobar)
drop policy if exists "reviews_insert_pending" on public.product_reviews;
create policy "reviews_insert_pending" on public.product_reviews
  for insert with check (status = 'pending');

-- Admin: todo (moderar)
drop policy if exists "reviews_admin_all" on public.product_reviews;
create policy "reviews_admin_all" on public.product_reviews
  for all using (public.is_admin()) with check (public.is_admin());
