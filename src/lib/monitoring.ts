"use client";

/**
 * Monitoreo de errores en el cliente (punto 5). Init only-browser para no
 * chocar con `output: "export"` (sin servidor). Si falta el DSN, no-op.
 *
 * Sentry (~100 kB) se carga de forma DINÁMICA: nunca entra al bundle inicial
 * si no hay DSN configurado.
 *
 * Las alertas "algo se rompió" salen de:
 *  - Sentry (errores de frontend) → integración Sentry→Slack/Discord/email.
 *  - Healthcheck (netlify/functions/healthcheck) → n8n → Discord/Telegram.
 */
let started = false;
type SentryModule = typeof import("@sentry/nextjs");
let sentryRef: SentryModule | null = null;

export function initMonitoring(): void {
  if (started || typeof window === "undefined") return;
  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
  if (!dsn) return;
  started = true;
  import("@sentry/nextjs").then((Sentry) => {
    sentryRef = Sentry;
    Sentry.init({
      dsn,
      environment: process.env.NEXT_PUBLIC_ENV ?? "production",
      tracesSampleRate: 0.1,
      replaysSessionSampleRate: 0,
      replaysOnErrorSampleRate: 0.2,
      sendDefaultPii: false,

      // Filtra ruido de terceros que NO es un bug de vapes.do (no debe paginar).
      ignoreErrors: [
        // Navegadores in-app (Instagram/Facebook/TikTok) inyectan su propio JS
        // que llama a window.webkit.messageHandlers y truena en iOS. No es código nuestro.
        /webkit\.messageHandlers/i,
        "sendDataToNative",
        "sendPageHideMessage",
        "_AutofillCallbackHandler",
      ],

      beforeSend(event) {
        try {
          const ex = event.exception?.values?.[0];
          const value = ex?.value ?? "";

          // 1) Errores de scripts inyectados por el navegador in-app: TODOS sus
          //    frames son app:/// (sin path); nuestro código vive en app:///_next/...
          const frames =
            event.exception?.values?.flatMap((v) => v.stacktrace?.frames ?? []) ?? [];
          const hasOurCode = frames.some((f) => (f.filename ?? "").includes("_next"));
          const hasInjected = frames.some((f) => {
            const fn = f.filename ?? "";
            return fn === "app:///" || /^app:\/\/\/:\d/.test(fn);
          });
          if (hasInjected && !hasOurCode) return null;

          // 2) Fallos de red transitorios (CDN de imágenes, señal móvil, adblock)
          //    SOLO cuando vienen de un rejection/error global no manejado. Los
          //    errores capturados a mano (captureError, con contexto) sí pasan.
          const unhandled = ex?.mechanism?.handled === false;
          const isNetworkNoise =
            /(Load failed|Failed to fetch|NetworkError|network connection was lost|The request timed out|cancelled)/i.test(
              value,
            );
          if (unhandled && isNetworkNoise) return null;
        } catch {
          /* si el filtro truena, deja pasar el evento */
        }
        return event;
      },
    });
  });
}

export function captureError(err: unknown, context?: Record<string, unknown>): void {
  try {
    sentryRef?.captureException(err, context ? { extra: context } : undefined);
  } catch {
    /* noop */
  }
}
