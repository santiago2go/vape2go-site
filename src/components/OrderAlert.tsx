"use client";

// Ringtone del mostrador: suena en loop cuando entra una orden nueva (WEB) y para cuando
// alguien toca "En revisión". Canal SEGURO para el rol cost-blind: se alimenta de
// `order_alerts` (RLS: solo sin-acusar/acusada<2min y recientes) por Supabase Realtime.
// Sonido con Web Audio (sin archivo). Montado global en el layout del backoffice.

import { useCallback, useEffect, useRef, useState } from "react";
import { Bell, Clock, Volume2 } from "lucide-react";
import { getSupabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { formatDOP } from "@/data/catalog-meta";

const BRAND = process.env.NEXT_PUBLIC_BRAND || "VAPE";

type Alert = { order_id: string; customer_name: string | null; total: number | null; created_at: string };

/**
 * 🕗 LA ORDEN QUE SE QUEDÓ EN «NUEVA».
 *
 * Pedido de Luis, 2026-08-31: «debe haber algún seguimiento para que una orden no se quede en
 * status nueva durante más de 5 días… se avisan como si fuera una orden nueva con el pop up
 * pero debe ser bien diferenciado para que no haya confusión».
 *
 * 🔑 SE DERIVA, NO SE GUARDA. Lo natural habría sido escribir una fila en `order_alerts` con
 * una marca, y habría sido un error: quedarse en «nueva» **no es un hecho nuevo**, es el estado
 * de la orden más el paso del tiempo. Guardarlo crea una segunda copia que hay que insertar,
 * deduplicar y borrar cuando alguien mueve la orden — y este proyecto ya tiene el catálogo de
 * lo que pasa cuando dos copias dejan de mirarse. Derivándolo, el aviso **desaparece solo** en
 * el instante en que la orden cambia de estado, sin que nadie limpie nada.
 *
 * 🔕 Y NO SUENA. El timbre existe para que alguien corra al mostrador; una orden de hace once
 * días no es una urgencia de este segundo, y hacer sonar el teléfono por ella es la forma más
 * rápida de que el equipo silencie el timbre — y entonces tampoco se entera de las que sí son
 * nuevas. Diferente color, diferente icono, diferente texto, y sin sonido.
 */
type Vieja = { id: string; customer_name: string | null; total: number | null; created_at: string; dias: number };

const DIAS_ATASCADA = 5;

const byTime = (a: Alert, b: Alert) => a.created_at.localeCompare(b.created_at);

export default function OrderAlert() {
  const { session, isBackoffice } = useAuth();
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [viejas, setViejas] = useState<Vieja[]>([]);
  const [audioReady, setAudioReady] = useState(false);
  const audio = useRef<{ ctx: AudioContext | null; timer: number | null }>({ ctx: null, timer: null });

  // --- Web Audio: patrón "ring-ring" (dos tonos), en loop mientras haya alertas. ---
  const ensureCtx = useCallback(() => {
    const a = audio.current;
    if (!a.ctx) {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (AC) a.ctx = new AC();
    }
    if (a.ctx && a.ctx.state === "suspended") a.ctx.resume().then(() => setAudioReady(true)).catch(() => {});
    if (a.ctx && a.ctx.state === "running") setAudioReady(true);
    return a.ctx;
  }, []);

  const ring = useCallback(() => {
    const ctx = ensureCtx();
    if (!ctx || ctx.state !== "running") return;
    const now = ctx.currentTime;
    const tone = (at: number, freq: number, dur: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, at);
      gain.gain.exponentialRampToValueAtTime(0.3, at + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, at + dur);
      osc.connect(gain).connect(ctx.destination);
      osc.start(at);
      osc.stop(at + dur + 0.03);
    };
    tone(now, 880, 0.18);
    tone(now + 0.24, 1047, 0.2);
  }, [ensureCtx]);

  // Loop del tono según haya alertas.
  useEffect(() => {
    const a = audio.current;
    if (alerts.length > 0 && a.timer == null) {
      ring();
      a.timer = window.setInterval(ring, 1600);
    } else if (alerts.length === 0 && a.timer != null) {
      clearInterval(a.timer);
      a.timer = null;
    }
  }, [alerts.length, ring]);

  // Desbloquear el audio con el primer gesto (política de autoplay): touch, click o tecla.
  useEffect(() => {
    const unlock = () => ensureCtx();
    const evs: (keyof WindowEventMap)[] = ["pointerdown", "keydown", "touchstart"];
    evs.forEach((e) => window.addEventListener(e, unlock));
    return () => evs.forEach((e) => window.removeEventListener(e, unlock));
  }, [ensureCtx]);

  // Carga inicial (por si la PC se reinició con órdenes sin acusar) + Realtime.
  useEffect(() => {
    if (!session || !isBackoffice) return;
    const sb = getSupabase();
    if (!sb) return;
    let active = true;

    (async () => {
      const { data } = await sb
        .from("order_alerts")
        .select("order_id,customer_name,total,created_at")
        .eq("brand", BRAND)
        .is("acknowledged_at", null)
        .order("created_at", { ascending: true });
      if (!active || !data) return;
      // MERGE (no replace): si un INSERT de Realtime ya llegó antes de resolver este fetch,
      // no lo pisamos. Dedupe por order_id.
      setAlerts((prev) => {
        const seen = new Set(prev.map((p) => p.order_id));
        const merged = [...prev];
        for (const d of data as Alert[]) if (!seen.has(d.order_id)) merged.push(d);
        return merged.sort(byTime);
      });
    })();

    const ch = sb
      .channel("order-alerts")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "order_alerts", filter: `brand=eq.${BRAND}` },
        (payload) => {
          const r = payload.new as Alert & { acknowledged_at: string | null };
          if (r.acknowledged_at) return;
          setAlerts((prev) => (prev.some((p) => p.order_id === r.order_id) ? prev : [...prev, r].sort(byTime)));
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "order_alerts", filter: `brand=eq.${BRAND}` },
        (payload) => {
          const r = payload.new as { order_id: string; acknowledged_at: string | null };
          if (r.acknowledged_at) setAlerts((prev) => prev.filter((p) => p.order_id !== r.order_id));
        }
      )
      .subscribe();

    return () => {
      active = false;
      sb.removeChannel(ch);
    };
  }, [session, isBackoffice]);

  // Limpieza del audio al desmontar.
  useEffect(() => {
    return () => {
      const a = audio.current;
      if (a.timer != null) clearInterval(a.timer);
      if (a.ctx) a.ctx.close().catch(() => {});
    };
  }, []);

  const ack = useCallback(async (a: Alert) => {
    setAlerts((prev) => prev.filter((p) => p.order_id !== a.order_id)); // optimista → corta el tono
    const sb = getSupabase();
    if (!sb) return;
    const { error } = await sb.rpc("ack_order_alert", { p_order: a.order_id });
    if (error) {
      // Revertir para no perder la alerta en silencio (vuelve a sonar).
      setAlerts((prev) => (prev.some((p) => p.order_id === a.order_id) ? prev : [...prev, a].sort(byTime)));
    }
  }, []);

  // ── Las que se quedaron en «Nueva»: se PREGUNTAN, no se guardan ──────────────
  useEffect(() => {
    if (!session || !isBackoffice) return;
    const sb = getSupabase();
    if (!sb) return;
    let vivo = true;
    const mirar = async () => {
      const corte = new Date(Date.now() - DIAS_ATASCADA * 86400000).toISOString();
      const { data } = await sb
        .from("orders")
        .select("id,customer_name,total,created_at")
        .eq("status", "pending")
        .lt("created_at", corte)
        .order("created_at", { ascending: true });
      if (!vivo) return;
      setViejas((data ?? []).map((o) => ({
        ...(o as Omit<Vieja, "dias">),
        dias: Math.floor((Date.now() - new Date(o.created_at as string).getTime()) / 86400000),
      })));
    };
    void mirar();
    // Cada 10 min alcanza: el umbral es de días, no de segundos. Un intervalo corto acá sería
    // pegarle a la base por algo que no cambia en todo el turno.
    const t = window.setInterval(() => void mirar(), 600000);
    return () => { vivo = false; window.clearInterval(t); };
  }, [session, isBackoffice]);

  if (!isBackoffice) return null;

  const current = alerts[0];
  return (
    <>
      {/* Píldora para "armar" el sonido si el navegador aún lo tiene bloqueado (kiosco sin tocar). */}
      {!audioReady && (
        <button
          onClick={() => ensureCtx()}
          className="fixed bottom-4 right-4 z-[55] inline-flex items-center gap-2 rounded-full bg-slate-800 px-4 py-2.5 text-xs font-semibold text-white shadow-lg hover:bg-slate-900"
        >
          <Volume2 size={15} /> Activar sonido de órdenes
        </button>
      )}

      {/* Banner de la alerta activa. */}
      {current && (
        <div className="fixed inset-x-0 top-0 z-[60] flex justify-center px-3 pt-3 pointer-events-none">
          <div className="pointer-events-auto w-full max-w-md rounded-2xl border border-violet-300 bg-white shadow-2xl shadow-violet-900/20 ring-1 ring-violet-200">
            <div className="flex items-center gap-3 p-4">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-violet-100 text-violet-600 animate-pulse">
                <Bell size={22} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-slate-800">
                  🔔 Nueva orden{alerts.length > 1 ? ` · ${alerts.length} en cola` : ""}
                </p>
                <p className="truncate text-xs text-slate-500">
                  {current.customer_name || "Cliente"}
                  {current.total != null ? ` · ${formatDOP(current.total)}` : ""}
                </p>
              </div>
              <button
                onClick={() => ack(current)}
                className="shrink-0 rounded-lg bg-violet-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-violet-700 active:scale-95"
              >
                En revisión
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 🕗 LA QUE SE ATASCÓ EN «NUEVA». Va DEBAJO de la de orden nueva a propósito: si entra
          una de verdad, la urgente queda arriba. Ámbar y reloj contra violeta y campana, para
          que a un metro de distancia ya se vean distintas. No suena. */}
      {viejas.length > 0 && (
        <div className={`fixed inset-x-0 z-[59] flex justify-center px-3 pointer-events-none ${current ? "top-[86px]" : "top-3"}`}>
          <div className="pointer-events-auto w-full max-w-md rounded-2xl border border-amber-300 bg-amber-50 shadow-xl ring-1 ring-amber-200">
            <div className="flex items-center gap-3 p-4">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-amber-100 text-amber-700">
                <Clock size={22} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-amber-900">
                  🕗 Sin atender hace {viejas[0].dias} días
                  {viejas.length > 1 ? ` · ${viejas.length} en total` : ""}
                </p>
                <p className="truncate text-xs text-amber-800/80">
                  {viejas[0].customer_name || "Cliente"}
                  {viejas[0].total != null ? ` · ${formatDOP(viejas[0].total)}` : ""}
                  {" · sigue en «Nueva»"}
                </p>
              </div>
              <a
                href="/backoffice/ordenes"
                className="shrink-0 rounded-lg bg-amber-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-amber-700 active:scale-95"
              >
                Ver
              </a>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
