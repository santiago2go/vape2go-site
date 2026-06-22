"use client";

import { getSupabase } from "./supabase";

/**
 * Analítica de conversión propietaria (funnel) + puente opcional a PostHog.
 *
 * - Cada visitante recibe un session_id persistente (localStorage).
 * - Los eventos se insertan en `analytics_events` (RLS: insert-only para anon).
 * - Si PostHog está configurado, se reenvía el mismo evento allí (top-of-funnel).
 * - No-op silencioso si Supabase no está configurado (no rompe el build estático).
 *
 * Pasos del funnel: 1=home 2=listing/categoría 3=producto 4=intención 5=orden.
 */

const SESSION_KEY = "v2g_sid";

export type EventName =
  | "page_view"
  | "view_home"
  | "view_listing"
  | "view_product"
  | "view_brand"
  | "search"
  | "add_intent"
  | "order_click"
  | "signup"
  | "login"
  | "add_to_cart"
  | "begin_checkout"
  | "purchase";

const FUNNEL_STEP: Partial<Record<EventName, number>> = {
  view_home: 1,
  view_listing: 2,
  view_brand: 2,
  view_product: 3,
  add_intent: 4,
  begin_checkout: 4,
  order_click: 5,
  purchase: 5,
};

function getSessionId(): string {
  if (typeof window === "undefined") return "ssr";
  try {
    let sid = localStorage.getItem(SESSION_KEY);
    if (!sid) {
      sid = (crypto.randomUUID?.() ?? `${Date.now()}-${Math.round(Math.random() * 1e9)}`);
      localStorage.setItem(SESSION_KEY, sid);
    }
    return sid;
  } catch {
    return "no-storage";
  }
}

function captureUtm(): Record<string, string> | null {
  if (typeof window === "undefined") return null;
  const p = new URLSearchParams(window.location.search);
  const utm: Record<string, string> = {};
  for (const k of ["utm_source", "utm_medium", "utm_campaign", "ref"]) {
    const v = p.get(k);
    if (v) utm[k.replace("utm_", "")] = v;
  }
  return Object.keys(utm).length ? utm : null;
}

interface TrackProps {
  productId?: string;
  category?: string;
  brand?: string;
  props?: Record<string, unknown>;
}

export async function track(event: EventName, opts: TrackProps = {}): Promise<void> {
  if (typeof window === "undefined") return;

  const utm = captureUtm();

  // Puente PostHog (si el snippet lo cargó en window)
  try {
    const ph = (window as unknown as { posthog?: { capture: (e: string, p?: object) => void } }).posthog;
    ph?.capture?.(event, { ...opts, ...(utm ?? {}) });
  } catch {
    /* noop */
  }

  const supabase = getSupabase();
  if (!supabase) return;

  const { data: sess } = await supabase.auth.getSession();

  try {
    await supabase.from("analytics_events").insert({
      session_id: getSessionId(),
      user_id: sess.session?.user?.id ?? null,
      event_name: event,
      funnel_step: FUNNEL_STEP[event] ?? null,
      path: window.location.pathname,
      referrer: document.referrer || null,
      product_id: opts.productId ?? null,
      category: opts.category ?? null,
      brand: opts.brand ?? null,
      utm,
      props: opts.props ?? null,
      user_agent: navigator.userAgent.slice(0, 256),
    });
  } catch {
    /* la analítica nunca debe romper la experiencia */
  }
}
