# Infraestructura — vapes.do (seguridad, escalabilidad, monitoreo, caché)

Cubre los puntos 3, 4 y 5 del brief. El principio de diseño es **frontend
estático + backend gestionado**: el sitio se sirve como HTML estático desde el
CDN de Netlify (escala infinita, sin servidores que mantener) y todo lo que
tiene estado vive en Supabase, protegido por RLS.

```
                 ┌─────────────────────────────────────────┐
   Navegador ───▶│ Netlify CDN (HTML/JS/CSS estático, brotli)│
   / App PWA     └───────────────┬─────────────────┬─────────┘
                                 │ anon key (RLS)  │ /.netlify/functions/*
                                 ▼                 ▼
                       ┌──────────────────┐  ┌───────────────────────┐
                       │ Supabase         │  │ Netlify Functions      │
                       │ Auth + Postgres  │◀─│ service_role (órdenes, │
                       │ RLS por usuario  │  │ Turnstile, healthcheck)│
                       └──────────────────┘  └───────────┬───────────┘
                                                          │ alertas
                                                          ▼
                                              n8n → Discord / Telegram
```

---

## 3. Seguridad

| Requisito del brief | Cómo se cumple |
|---|---|
| **Secure authentication** | Supabase Auth (email+contraseña, magic link, OAuth opcional). Contraseñas hasheadas (bcrypt) por Supabase; sesiones JWT con refresh. Confirmación de email obligatoria. |
| **User data access / RLS** | RLS activo en `profiles`, `orders`, `analytics_events`, `affiliates`. Cada usuario solo ve su fila (`id = auth.uid()` / `user_id = auth.uid()`). Admin/staff ven todo vía `is_admin()`. Ver `supabase/migrations/`. |
| **Secrets & API keys** | `anon key` es pública por diseño (RLS protege). `service_role` SOLO en env del backend (Netlify Functions / n8n), nunca con prefijo `NEXT_PUBLIC_`. Estructura en `.env.example`. |
| **Users only access their own data** | Probado con las policies `*_select_own`. La escritura sensible (órdenes, comisiones) la hace el backend con service_role; el cliente no puede falsear totales. |
| **Prevent abuse & bot attacks** | Cloudflare Turnstile en registro/login (cliente + verificación en servidor en `_lib.mjs`). Rate limits nativos de Supabase Auth. Trigger anti-payload en `analytics_events`. |
| **Protect data in transit** | HTTPS forzado (HSTS preload). CSP estricta en `connect-src`. `upgrade-insecure-requests`. |
| **Suspicious activity** | Logs de Auth en Supabase + Sentry (errores) + healthcheck con alertas. |

**Cabeceras** (en `netlify.toml`): CSP, HSTS, X-Frame-Options DENY, X-Content-Type-Options,
Referrer-Policy, Permissions-Policy, COOP.

**Rotación de claves**: si se filtra la `service_role`, rotarla en Supabase →
Project Settings → API → "Reset service_role" y actualizar Netlify/n8n.

### Caché (que vaya rápido)
- Assets `_next/static/*` → `Cache-Control: immutable, max-age=1 año` (tienen hash).
- HTML → CDN de Netlify con revalidación.
- Consultas repetidas a Supabase: usar `staleTime` si se agrega React Query; hoy
  las lecturas son puntuales. Para catálogos calientes, considerar Supabase
  Edge Cache o un KV (más adelante).

---

## 4. Escalabilidad (cientos/miles de usuarios simultáneos)

- **Frontend**: estático en CDN → escala prácticamente infinito sin tocar nada.
- **Base de datos**: Supabase usa **PgBouncer** (pooling). Para apps con muchas
  conexiones, **usar la connection string de pooler (puerto 6543)** en el backend,
  no la directa (5432). El SDK del cliente va por la API REST/Realtime (no abre
  conexiones SQL), así que el cliente escala bien.
- **Plan**: Free aguanta el arranque; pasar a **Pro ($25/mes)** antes del lanzamiento
  fuerte (más conexiones, backups diarios, sin pausa por inactividad).
- **Funciones**: Netlify Functions son serverless (autoescalan). Mantenerlas idempotentes.
- **Camino a "app"**: el mismo `@supabase/supabase-js` corre en React Native /
  Expo y como PWA. El backend (RLS + Functions) se reutiliza tal cual. Por eso
  se eligió SDK cliente + RLS en vez de un backend monolítico.

### Índices ya creados (para que las queries no se degraden con volumen)
`analytics_events`: created_at, (event_name,funnel_step), session_id, user_id.
`orders`: user_id, affiliate_code, created_at. `affiliates.code` único.

---

## 5. Monitoreo (que nos avise si algo se rompe)

Tres capas, todas opcionales por env var (no rompen si faltan):

1. **Sentry** (`src/lib/monitoring.ts`) — captura errores y excepciones del
   frontend en producción. Configurar `NEXT_PUBLIC_SENTRY_DSN`. En Sentry,
   conectar la integración a Slack/Discord/email para alertas.
2. **Healthcheck** (`netlify/functions/healthcheck.mjs`) — endpoint que prueba
   la DB. Apuntar **UptimeRobot** o **Better Stack** (gratis) a
   `https://vapes.do/.netlify/functions/healthcheck` cada 5 min. Si responde 503
   o no responde, te avisan.
3. **Alertas propias** — el healthcheck además hace POST a `ALERT_WEBHOOK_URL`
   (un webhook de n8n) cuando detecta degradación → n8n manda a Discord/Telegram
   (mismos canales que Santiago 2 Go).

**Métricas de producto/conversión**: PostHog (funnels, retención, grabaciones) +
la vista `funnel_daily` de Supabase para el dashboard admin propio.

---

## Checklist de puesta en marcha (requiere tu cuenta/decisiones)

- [ ] Crear proyecto Supabase (región East US) y correr migraciones `0001→0003`.
- [ ] Habilitar Email auth + confirmación; setear Site URL y redirects.
- [ ] Crear app en Cloudflare Turnstile → claves.
- [ ] (Opcional) Crear proyecto PostHog → key.
- [ ] (Opcional) Crear proyecto Sentry → DSN.
- [ ] Cargar todas las env vars en Netlify (ver `.env.example`).
- [ ] Registrarte en el sitio y correr `supabase/seed.sql` para volverte admin.
- [ ] Conectar UptimeRobot al healthcheck.
- [ ] Crear webhook n8n para alertas y ponerlo en `ALERT_WEBHOOK_URL`.
