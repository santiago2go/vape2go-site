-- 0015_channel_whatsapp.sql
-- Amplía el canal de las órdenes para incluir WHATSAPP.
-- Contexto: el POS ahora distingue "En el local" (TIENDA) vs "WhatsApp" (pedido a
-- ENTREGA, nace pendiente). El check de 0012 solo permitía ('WEB','TIENDA'), así que
-- un pedido de WhatsApp era rechazado ("No pudimos registrar la venta").
-- Correr MANUAL en el SQL Editor de AMBOS proyectos (Maskotas hizskmr… y Vape xrfwtrd…).

alter table public.orders drop constraint if exists orders_channel_check;
alter table public.orders
  add constraint orders_channel_check check (channel in ('WEB', 'TIENDA', 'WHATSAPP'));
