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
