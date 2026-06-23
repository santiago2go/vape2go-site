"use client";

import { useEffect, useRef, Suspense } from "react";
import { usePathname } from "next/navigation";
import { AuthProvider, useAuth } from "@/lib/auth-context";
import { track } from "@/lib/analytics";
import { initMonitoring } from "@/lib/monitoring";

type PostHogLite = {
  identify: (id: string, props?: Record<string, unknown>) => void;
  reset: () => void;
};
function ph(): PostHogLite | undefined {
  return (window as unknown as { posthog?: PostHogLite }).posthog;
}

/**
 * Inicializa PostHog (si hay key) y Sentry una sola vez.
 *
 * PostHog se carga con CUIDADO para no penalizar el mobile:
 * - Import DINÁMICO (~211 kB de chunk) y solo si hay key configurada.
 * - Init DIFERIDO a `requestIdleCallback` → fuera del critical path del LCP.
 * - Sin session recorder, sin surveys y sin la llamada /flags (/decide): esas
 *   tres son las que descargaban recorder.js (~50 kB) + surveys.js (~31 kB)
 *   eager en cada página. El funnel real vive en Supabase (analytics.ts), aquí
 *   PostHog es solo un espejo top-of-funnel.
 */
function initPostHog() {
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!key || typeof window === "undefined" || (window as unknown as { posthog?: unknown }).posthog) {
    return;
  }
  import("posthog-js").then(({ default: posthog }) => {
    posthog.init(key, {
      api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com",
      capture_pageview: false, // lo manejamos manualmente para mapear el funnel
      capture_pageleave: false,
      autocapture: false,
      disable_session_recording: true,
      disable_surveys: true,
      advanced_disable_decide: true, // corta /decide (posthog-js viejo)
      advanced_disable_flags: true, // corta /flags (posthog-js nuevo) → no baja recorder/surveys
      capture_heatmaps: false,
      capture_dead_clicks: false,
      person_profiles: "identified_only",
      // El puente window.posthog se publica cuando PostHog terminó de cargar,
      // así cualquier capture() posterior encuentra la instancia lista.
      loaded: (ph) => {
        (window as unknown as { posthog: typeof ph }).posthog = ph;
      },
    });
  });
}

function bootstrap() {
  initMonitoring();
  if (typeof window === "undefined") return;
  const w = window as unknown as {
    requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => void;
  };
  if (typeof w.requestIdleCallback === "function") {
    w.requestIdleCallback(initPostHog, { timeout: 3000 });
  } else {
    setTimeout(initPostHog, 800);
  }
}

/** Dispara un page_view en cada cambio de ruta. */
function PageViews() {
  const pathname = usePathname();
  useEffect(() => {
    track("page_view", { props: { path: pathname } });
  }, [pathname]);
  return null;
}

/**
 * Ata los eventos de PostHog al usuario logueado (identify) y limpia al salir
 * (reset). Así el funnel se cruza con clientes reales, no solo sesiones anónimas.
 */
function PostHogIdentify() {
  const { user, profile } = useAuth();
  const identified = useRef<string | null>(null);
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (user && identified.current !== user.id) {
      ph()?.identify(user.id, {
        email: user.email,
        role: profile?.role,
        name: profile?.full_name || undefined,
      });
      identified.current = user.id;
    } else if (!user && identified.current) {
      ph()?.reset();
      identified.current = null;
    }
  }, [user, profile]);
  return null;
}

export default function Providers({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    bootstrap();
  }, []);

  return (
    <AuthProvider>
      <Suspense fallback={null}>
        <PageViews />
      </Suspense>
      <PostHogIdentify />
      {children}
    </AuthProvider>
  );
}
