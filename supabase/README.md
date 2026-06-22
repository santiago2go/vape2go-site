# Supabase — Vape 2 Go

Backend de identidad, datos y analítica para vapes.do. El frontend es **estático
(`output: "export"`)**; toda la lógica con estado vive aquí, protegida por
**Row Level Security (RLS)** para que cada usuario vea solo su propia información.

## Qué hay aquí

```
supabase/
  migrations/
    0001_init.sql        profiles + roles + helpers RLS + auto-creación de perfil
    0002_analytics.sql   analytics_events + funnel + anti-abuso
    0003_commerce.sql    affiliates (cupones) + orders + liquidación
  seed.sql               promueve tu cuenta a admin (editar email)
```

## Setup (una sola vez) — REQUIERE TU CUENTA

1. Crea un proyecto en https://supabase.com (región **East US (North Virginia)**
   — la más cercana a RD con baja latencia). Plan Free aguanta el arranque;
   subir a Pro (~$25/mes) cuando haya tráfico real.
2. En **SQL Editor**, pega y corre las migraciones en orden: `0001` → `0002` → `0003`.
   (O con CLI: `supabase link` y `supabase db push`.)
3. En **Authentication → Providers**: habilita **Email** (con confirmación) y,
   opcional, **Google**. En **URL Configuration** pon `https://vapes.do` como Site URL
   y agrega `https://vapes.do/entrar/` y `http://localhost:3000/entrar/` a redirects.
4. **Authentication → Rate limits**: deja los límites por defecto (anti-fuerza-bruta).
5. Crea tu cuenta desde el sitio (o el dashboard), luego corre `seed.sql` con TU email
   para volverte `admin`.
6. Copia las claves a `.env.local` (ver `.env.example` en la raíz del repo):
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`   ← pública, segura para el cliente (RLS la protege)
   - `SUPABASE_SERVICE_ROLE_KEY`       ← **SECRETA**, solo en Netlify Functions / n8n. NUNCA en el cliente.

## Reglas de oro de seguridad

- La **anon key** es pública por diseño: lo que protege la data es **RLS**, no la clave.
- La **service_role key** ignora RLS. Vive SOLO en variables de entorno del backend
  (Netlify env, n8n credentials). Si se filtra, rotarla de inmediato en Supabase.
- Las **órdenes y comisiones** las escribe el backend con service_role; el cliente
  nunca inventa totales. El cliente solo LEE sus propias órdenes (RLS `orders_select_own`).
- Los **eventos de analítica** son insert-only para anónimos y se validan por trigger
  (lista blanca de eventos + tope de tamaño). Solo admin los lee.

## Verificar que RLS quedó bien

En el SQL Editor, como usuario anónimo (rol `anon`) deberías PODER:
- `insert into analytics_events ...` (con un event_name de la lista blanca)
- `select * from validate_coupon('X')`

y NO deberías poder:
- `select * from profiles` de otro usuario
- `select * from analytics_events`
- `select * from orders` de otro usuario

## Backups

Supabase Pro hace backups diarios automáticos (PITR opcional). En Free, programa
un `pg_dump` semanal (puede ir en un workflow n8n) y guárdalo en Drive.
