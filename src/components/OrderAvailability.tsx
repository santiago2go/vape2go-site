"use client";

/**
 * Disponibilidad de pedidos para el storefront.
 *
 * Lee de store_config las llaves 'orders_paused' y 'hours' (mismas que edita el
 * backoffice) y decide si la tienda acepta órdenes ahora mismo:
 *   - PAUSADO si orders_paused.active === true (botón de emergencia).
 *   - FUERA DE HORARIO si la hora actual en America/Santo_Domingo cae fuera del
 *     rango del día, o el día está marcado como cerrado.
 *
 * Degradación elegante: sin Supabase, sin data, o con error → se asume ABIERTO
 * (nunca bloqueamos la venta por un fallo de config).
 *
 * Exporta un hook (`useOrderAvailability`) + dos piezas de UI acordes a la
 * tienda: un modal prominente (`OrderUnavailableModal`) y un banner ámbar
 * (`OrderUnavailableBanner`). El consumidor llama al hook UNA vez y pasa el
 * `state` a las piezas + lo usa para deshabilitar el botón de pagar.
 */

import { useEffect, useState } from "react";
import { Clock, PauseCircle, X } from "lucide-react";
import { getSupabase } from "@/lib/supabase";

type DayKey = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";

interface DayHours {
  open?: string;
  close?: string;
  closed?: boolean;
}
type HoursConfig = Partial<Record<DayKey, DayHours>>;

interface PausedConfig {
  active?: boolean;
  message?: string;
}

export interface AvailabilityState {
  /** true una vez resuelta la config (evita parpadeos y falsos bloqueos). */
  ready: boolean;
  /** ¿Se aceptan pedidos ahora mismo? */
  accepting: boolean;
  reason: "paused" | "closed" | "hours" | null;
  /** Mensaje listo para mostrar al cliente. */
  message: string;
}

const DEFAULT_PAUSE_MSG = "En este momento no estamos recibiendo pedidos. ¡Vuelve pronto!";

const WEEKDAY_TO_KEY: Record<string, DayKey> = {
  Mon: "mon",
  Tue: "tue",
  Wed: "wed",
  Thu: "thu",
  Fri: "fri",
  Sat: "sat",
  Sun: "sun",
};

/** Día + minutos-desde-medianoche en la zona horaria de RD (UTC-4, sin DST). */
function nowInSantoDomingo(): { key: DayKey; minutes: number } | null {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Santo_Domingo",
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).formatToParts(new Date());
    let wd = "";
    let h = "0";
    let m = "0";
    for (const p of parts) {
      if (p.type === "weekday") wd = p.value;
      else if (p.type === "hour") h = p.value;
      else if (p.type === "minute") m = p.value;
    }
    const key = WEEKDAY_TO_KEY[wd];
    if (!key) return null;
    return { key, minutes: (Number(h) % 24) * 60 + Number(m) };
  } catch {
    return null;
  }
}

/** "HH:MM" → minutos-desde-medianoche, o null si no parsea. */
function toMinutes(t?: string): number | null {
  if (!t) return null;
  const m = /^(\d{1,2}):(\d{2})$/.exec(t.trim());
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

const OPEN: AvailabilityState = { ready: true, accepting: true, reason: null, message: "" };

function evaluate(paused: PausedConfig | null, hours: HoursConfig | null): AvailabilityState {
  // La pausa manual manda sobre el horario.
  if (paused?.active === true) {
    const msg = (paused.message ?? "").trim();
    return { ready: true, accepting: false, reason: "paused", message: msg || DEFAULT_PAUSE_MSG };
  }

  if (hours) {
    const now = nowInSantoDomingo();
    const day = now ? hours[now.key] : undefined;
    if (now && day) {
      if (day.closed) {
        return { ready: true, accepting: false, reason: "closed", message: "Hoy estamos cerrados. Vuelve pronto." };
      }
      const open = toMinutes(day.open);
      const close = toMinutes(day.close);
      if (open !== null && close !== null) {
        // close > open: rango normal. close <= open: cruza medianoche.
        const within =
          close > open ? now.minutes >= open && now.minutes < close : now.minutes >= open || now.minutes < close;
        if (!within) {
          return {
            ready: true,
            accepting: false,
            reason: "hours",
            message: `Estamos fuera de horario (${day.open}–${day.close}). Vuelve en ese rango.`,
          };
        }
      }
    }
  }

  return OPEN;
}

export function useOrderAvailability(): AvailabilityState {
  const [raw, setRaw] = useState<{ paused: PausedConfig | null; hours: HoursConfig | null } | null>(null);
  const [state, setState] = useState<AvailabilityState>({ ready: false, accepting: true, reason: null, message: "" });

  // Trae la config una vez.
  useEffect(() => {
    const sb = getSupabase();
    if (!sb) {
      setState(OPEN); // sin Supabase → asumimos abierto
      return;
    }
    let active = true;
    sb.from("store_config")
      .select("key,value")
      .in("key", ["orders_paused", "hours"])
      .then(({ data, error }) => {
        if (!active) return;
        if (error || !data) {
          setState(OPEN);
          return;
        }
        let paused: PausedConfig | null = null;
        let hours: HoursConfig | null = null;
        for (const r of data as Array<{ key: string; value: unknown }>) {
          if (r.key === "orders_paused" && r.value && typeof r.value === "object") paused = r.value as PausedConfig;
          if (r.key === "hours" && r.value && typeof r.value === "object") hours = r.value as HoursConfig;
        }
        setRaw({ paused, hours });
      });
    return () => {
      active = false;
    };
  }, []);

  // Re-evalúa (el horario cambia con el reloj) cada minuto.
  useEffect(() => {
    if (!raw) return;
    const tick = () => setState(evaluate(raw.paused, raw.hours));
    tick();
    const id = window.setInterval(tick, 60_000);
    return () => window.clearInterval(id);
  }, [raw]);

  return state;
}

/** Modal prominente (descartable) cuando no se aceptan pedidos. */
export function OrderUnavailableModal({ state }: { state: AvailabilityState }) {
  const [dismissed, setDismissed] = useState(false);
  if (!state.ready || state.accepting || dismissed) return null;

  const isPaused = state.reason === "paused";
  const Icon = isPaused ? PauseCircle : Clock;
  const title = isPaused ? "Pedidos en pausa" : "Fuera de horario";

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={() => setDismissed(true)} />
      <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
        <button
          type="button"
          onClick={() => setDismissed(true)}
          aria-label="Cerrar"
          className="absolute right-4 top-4 text-gray-400 transition-colors hover:text-gray-600"
        >
          <X size={20} />
        </button>
        <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-violet-100 text-violet-600">
          <Icon size={28} />
        </div>
        <h2 className="text-center text-xl text-gray-900" style={{ fontFamily: "var(--font-heading)" }}>
          {title}
        </h2>
        <p className="mt-2 text-center text-sm leading-relaxed text-gray-600">{state.message}</p>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="mt-6 w-full rounded-xl bg-violet-600 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-violet-700"
        >
          Entendido
        </button>
      </div>
    </div>
  );
}

/** Banner ámbar para colocar arriba del carrito. */
export function OrderUnavailableBanner({ state }: { state: AvailabilityState }) {
  if (!state.ready || state.accepting) return null;
  return (
    <div className="mb-6 flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
      <span aria-hidden className="mt-0.5">
        ⚠️
      </span>
      <p className="leading-relaxed">{state.message}</p>
    </div>
  );
}
