# Plataforma de cuentas, datos y conversión — vapes.do

Documento maestro de la tanda de trabajo "antes de los cupones" (registro,
analítica de conversión, seguridad, escalabilidad, monitoreo, frontend, legal).
Lee esto primero al volver.

> **Estado**: todo el código está construido y el sitio **compila** (`npm run build`
> ✓ 698 páginas). Nada se ha desplegado ni commiteado. Funciona en modo
> "degradado": sin las claves de Supabase, la UI de cuenta muestra "muy pronto"
> y el sitio sigue idéntico al actual. **Se activa cuando cargues los secretos.**

---

## ⚠️ DECISIONES / ACCIONES QUE NECESITO DE TI

Ninguna bloquea el build; todas son para *encender* lo construido.

1. **Crear el proyecto Supabase** (tu cuenta) y correr las 3 migraciones.
   → guía paso a paso en [`supabase/README.md`](../supabase/README.md).
2. **Decidir analítica**: ¿activamos **PostHog** (funnels visuales, grabaciones,
   gratis hasta 1M eventos/mes) además del sink propio en Supabase? Recomiendo **sí**.
   Si no quieres terceros, el dashboard admin propio ya cubre el funnel básico.
3. **Bot protection**: crear app en **Cloudflare Turnstile** (gratis) para las claves.
   Recomiendo activarlo antes de abrir el registro al público.
4. **Monitoreo de errores**: ¿activamos **Sentry** (gratis 5k errores/mes)? Recomiendo sí.
5. **Email del proyecto**: definí placeholders `privacidad@vapes.do` y `legal@vapes.do`
   en los textos legales. ¿Creamos esos correos o usamos otro? (afecta los textos).
6. **Revisión legal**: los 3 documentos legales son borradores sólidos pero **deben
   pasar por un abogado en RD** — sobre todo la cláusula de arbitraje y la renuncia
   a acciones colectivas frente a Pro Consumidor. ¿Tienes abogado o lo busco?
7. **OAuth con Google** en el login: ¿lo habilitamos? (más conversión en registro,
   requiere configurar credenciales Google en Supabase).
8. **Plan Supabase**: Free para arrancar; subir a **Pro ($25/mes)** antes del
   lanzamiento fuerte (backups diarios, sin pausa, más conexiones).

Costo recurrente estimado para producción: **~$25/mes** (Supabase Pro) + el resto
en planes gratuitos hasta tener tráfico relevante.

---

## Qué se construyó (mapa)

### 1. Registro + administración de la base de datos (punto 1)
- **Auth real** con Supabase: `/registro/`, `/entrar/` (contraseña o magic link), `/cuenta/`.
- **Panel admin** en `/admin/` (solo rol admin/staff): pestañas de **Conversión**,
  **Usuarios** (con cambio de rol), **Órdenes** y **Cupones/Afiliados** (alta/baja).
- Acceso a cuenta desde el ícono 👤 del Navbar; links en el Footer.
- Esquema: `supabase/migrations/0001_init.sql` (profiles + roles + triggers).

### 2. Datos de conversión / funnel (punto 2)
- Tracker propio (`src/lib/analytics.ts`) con `session_id` persistente, captura de
  UTM y mapeo de pasos: **home(1) → listado(2) → producto(3) → intención(4) → orden(5)**.
- Eventos insertados en `analytics_events` (Supabase) + puente opcional a PostHog.
- Vista `funnel_daily` y dashboard de funnel en `/admin/`.
- Disparadores ya colocados en home, categoría, producto y botón "Pedir".

### 3. Seguridad (punto 3) — ver [`docs/INFRAESTRUCTURA.md`](./INFRAESTRUCTURA.md)
- RLS en todas las tablas: **cada usuario ve solo lo suyo**; admin ve todo.
- Secretos separados: `anon` (pública) vs `service_role` (solo backend).
- **Netlify Functions** como API segura: `create-order` (recalcula totales/comisiones
  server-side; el cliente no puede falsearlos) y verificación de **Turnstile**.
- Cabeceras: CSP, HSTS, X-Frame-Options, Permissions-Policy, etc. en `netlify.toml`.
- Caché agresiva de assets con hash; brotli automático de Netlify.

### 4. Escalabilidad (punto 4) — ver [`docs/INFRAESTRUCTURA.md`](./INFRAESTRUCTURA.md)
- Frontend estático en CDN (escala infinita). DB con PgBouncer (pooler).
- Mismo stack (`@supabase/supabase-js` + RLS) sirve para la futura **app/PWA**.

### 5. Monitoreo (punto 5)
- **Sentry** (errores de frontend, carga dinámica), **healthcheck** function que
  avisa a un webhook de **n8n → Discord/Telegram** si la DB se cae, y UptimeRobot
  apuntando al healthcheck.

### 6. Frontend comprimido (punto 6)
- PostHog y Sentry pasados a **import dinámico** (no pesan en el bundle inicial).
- `optimizePackageImports` para lucide-react y framer-motion.
- Caché inmutable de `_next/static/*` + brotli de Netlify.
- **Palanca pendiente** (opcional): el home pesa ~373 kB sin comprimir por
  framer-motion del `HeroCarousel`. Reescribir esas animaciones en CSS bajaría
  ~40-50 kB. No urgente (brotli lo reduce a ~⅓ en transferencia).

### 7. Legal (punto 7)
- `/privacidad/` — Política con **cláusula específica de uso de IA** (Anthropic/Claude
  para descripciones; sin datos personales; sin decisiones 100% automatizadas).
- `/terminos/` — Términos con **arbitraje vinculante (Ley 489-08)** + **renuncia a
  acciones colectivas**.
- `/privacidad-datos/` — **Etiqueta de privacidad** tipo "nutrition label" (qué dato,
  para qué, con quién).
- Todos referencian la **Ley 172-13** (RD) y llevan nota de revisión por abogado.

---

## Archivos nuevos / tocados

```
supabase/migrations/0001_init.sql 0002_analytics.sql 0003_commerce.sql
supabase/README.md  supabase/seed.sql
netlify/functions/_lib.mjs  create-order.mjs  healthcheck.mjs
netlify.toml                         (CSP + headers + functions + caché)
next.config.ts                       (optimizePackageImports)
.env.example                         (estructura de secretos)
src/lib/supabase.ts  auth-context.tsx  analytics.ts  monitoring.ts
src/components/Providers.tsx  Turnstile.tsx  AuthShell.tsx  TrackView.tsx
              OrderButton.tsx  LegalPage.tsx
src/app/entrar/  registro/  cuenta/  admin/  privacidad/  terminos/  privacidad-datos/
src/app/layout.tsx  page.tsx  robots.ts  components/Navbar.tsx  Footer.tsx
src/app/categoria/[cat]/page.tsx  productos/[slug]/page.tsx   (TrackView)
docs/INFRAESTRUCTURA.md  docs/PLATAFORMA.md
package.json   (+@supabase/supabase-js, posthog-js, @sentry/nextjs)
```

---

## Cómo encender todo (resumen)

1. Supabase: crear proyecto → migraciones → auth → seed admin.
2. Turnstile / PostHog / Sentry: crear y copiar claves.
3. Netlify: cargar todas las env vars de `.env.example`.
4. `npm run build && npx netlify-cli deploy --prod --dir out --site <SITE_ID>`.
5. Registrarte → correr `seed.sql` → entrar a `/admin/`.
6. UptimeRobot → healthcheck; webhook n8n → `ALERT_WEBHOOK_URL`.

Hecho esto, lo siguiente del roadmap son los **cupones/afiliados** (la tabla
`affiliates` y el cálculo de comisión híbrida ya están listos en el backend).
