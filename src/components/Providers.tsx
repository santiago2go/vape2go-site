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
 * PostHog se importa de forma DINÁMICA: ~50 kB que no deben pesar en el bundle
 * inicial de cada página cuando ni siquiera está configurado.
 */
function bootstrap() {
  initMonitoring();
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (key && typeof window !== "undefined" && !(window as unknown as { posthog?: unknown }).posthog) {
    import("posthog-js").then(({ default: posthog }) => {
      posthog.init(key, {
        api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com",
        capture_pageview: false, // lo manejamos manualmente para mapear el funnel
        person_profiles: "identified_only",
      });
      (window as unknown as { posthog: typeof posthog }).posthog = posthog;
    });
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
