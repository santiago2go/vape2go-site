"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  TrendingUp,
  Wallet,
  Clock,
  Truck,
  PackageCheck,
  Receipt,
  ArrowUpRight,
  CalendarDays,
} from "lucide-react";
import { getSupabase } from "@/lib/supabase";
import { formatDOP } from "@/data/catalog-meta";
import { type Order, isRevenue, relTime, itemQty } from "@/lib/backoffice";
import { Card, Spinner, StatusBadge, EmptyState } from "@/components/backoffice/ui";

/* ---------- Rango de fechas ---------- */

type Preset = "today" | "7d" | "30d" | "6m" | "custom";

const PRESETS: { id: Preset; label: string }[] = [
  { id: "today", label: "Hoy" },
  { id: "7d", label: "7 días" },
  { id: "30d", label: "30 días" },
  { id: "6m", label: "6 meses" },
  { id: "custom", label: "Personalizado" },
];

const DAY_MS = 864e5;

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

/** Date → "YYYY-MM-DD" en zona local (para <input type="date">). */
function toDateInput(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** "YYYY-MM-DD" → Date local a medianoche (evita el corrimiento de UTC). */
function parseDateInput(s: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  d.setHours(0, 0, 0, 0);
  return Number.isNaN(d.getTime()) ? null : d;
}

function fmtShort(d: Date): string {
  return d.toLocaleDateString("es-DO", { day: "numeric", month: "short" }).replace(".", "");
}

/** Devuelve el rango [from, to) en epoch ms + una etiqueta legible. */
function computeRange(preset: Preset, customFrom: string, customTo: string): { from: number; to: number; label: string } {
  const todayStart = startOfDay(new Date()).getTime();
  const tomorrow = todayStart + DAY_MS; // fin exclusivo = inicio de mañana
  if (preset === "today") return { from: todayStart, to: tomorrow, label: "Hoy" };
  if (preset === "7d") return { from: todayStart - 6 * DAY_MS, to: tomorrow, label: "Últimos 7 días" };
  if (preset === "30d") return { from: todayStart - 29 * DAY_MS, to: tomorrow, label: "Últimos 30 días" };
  if (preset === "6m") {
    const f = new Date(todayStart);
    f.setMonth(f.getMonth() - 6);
    return { from: startOfDay(f).getTime(), to: tomorrow, label: "Últimos 6 meses" };
  }
  // custom
  let fromD = parseDateInput(customFrom) ?? new Date(todayStart - 29 * DAY_MS);
  let toD = parseDateInput(customTo) ?? new Date(todayStart);
  if (fromD.getTime() > toD.getTime()) [fromD, toD] = [toD, fromD];
  const toExcl = startOfDay(new Date(toD.getTime() + DAY_MS)).getTime();
  return { from: fromD.getTime(), to: toExcl, label: `${fmtShort(fromD)} – ${fmtShort(toD)}` };
}

export default function DashboardPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  const [preset, setPreset] = useState<Preset>("30d");
  const [customFrom, setCustomFrom] = useState(() => toDateInput(new Date(Date.now() - 29 * DAY_MS)));
  const [customTo, setCustomTo] = useState(() => toDateInput(new Date()));

  useEffect(() => {
    const sb = getSupabase();
    if (!sb) {
      setLoading(false);
      return;
    }
    sb.from("orders")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(2000)
      .then(({ data }) => {
        setOrders((data as Order[]) ?? []);
        setLoading(false);
      });
  }, []);

  const range = useMemo(() => computeRange(preset, customFrom, customTo), [preset, customFrom, customTo]);

  const inRange = useMemo(
    () =>
      orders.filter((o) => {
        const t = new Date(o.created_at).getTime();
        return t >= range.from && t < range.to;
      }),
    [orders, range]
  );

  const kpis = useMemo(() => {
    const rev = inRange.filter(isRevenue);
    const ingresos = rev.reduce((a, o) => a + o.total, 0);
    return {
      ordenes: inRange.length,
      ingresos,
      ticket: rev.length ? ingresos / rev.length : 0,
      pendientesPago: inRange.filter(
        (o) => o.payment_method === "transfer" && o.payment_status === "pending" && isRevenue(o)
      ).length,
      enRuta: inRange.filter((o) => o.status === "shipped").length,
      entregadas: inRange.filter((o) => o.status === "delivered").length,
      primeras: inRange.filter((o) => o.is_first_order && isRevenue(o)).length,
    };
  }, [inRange]);

  const series = useMemo(() => buildSeries(inRange, range.from, range.to), [inRange, range]);
  const bucketWord = series.stepDays === 1 ? "día" : series.stepDays === 7 ? "semana" : "período";

  const ultimas = inRange.slice(0, 7);
  const porConfirmar = inRange
    .filter((o) => o.payment_method === "transfer" && o.payment_status === "pending" && isRevenue(o))
    .slice(0, 6);

  if (loading) return <Spinner />;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Resumen</h1>
          <p className="mt-1 text-sm text-slate-500">{range.label}</p>
        </div>
        <RangePicker
          preset={preset}
          setPreset={setPreset}
          from={customFrom}
          to={customTo}
          setFrom={setCustomFrom}
          setTo={setCustomTo}
        />
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        <Kpi label="Órdenes" value={String(kpis.ordenes)} icon={<TrendingUp size={16} />} tone="violet" />
        <Kpi label="Ingresos" value={formatDOP(kpis.ingresos)} icon={<Wallet size={16} />} tone="emerald" primary />
        <Kpi label="Ticket promedio" value={formatDOP(kpis.ticket)} icon={<Receipt size={16} />} tone="slate" />
        <Kpi label="Pagos por confirmar" value={String(kpis.pendientesPago)} icon={<Clock size={16} />} tone="amber" />
        <Kpi label="En ruta" value={String(kpis.enRuta)} icon={<Truck size={16} />} tone="blue" />
        <Kpi label="Entregadas" value={String(kpis.entregadas)} icon={<PackageCheck size={16} />} tone="emerald" />
      </div>

      <div className="text-xs text-slate-400">
        {kpis.primeras > 0 ? (
          <>
            Primeras órdenes en el rango:{" "}
            <span className="font-semibold text-slate-600">{kpis.primeras}</span>
          </>
        ) : (
          "Sin clientes nuevos en este rango."
        )}
      </div>

      {/* Charts */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <ChartHeader title={`Órdenes por ${bucketWord}`} sub={range.label} total={String(series.totalOrders)} />
          <BarChart
            data={series.buckets.map((b) => ({ label: b.label, tip: b.tip, value: b.orders }))}
            color="#7C3AED"
            fmt={(v) => String(v)}
          />
        </Card>
        <Card className="p-5">
          <ChartHeader title={`Ingresos por ${bucketWord}`} sub={range.label} total={formatDOP(series.totalRevenue)} />
          <AreaChart
            data={series.buckets.map((b) => ({ label: b.label, tip: b.tip, value: b.revenue }))}
            color="#6D28D9"
            fmt={(v) => formatDOP(v)}
          />
        </Card>
      </div>

      {/* Listas */}
      <div className="grid gap-4 lg:grid-cols-5">
        <Card className="p-5 lg:col-span-3">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-[15px] font-semibold text-slate-800">Últimas órdenes</h2>
            <Link href="/backoffice/ordenes/" className="inline-flex items-center gap-1 text-xs font-semibold text-violet-600 hover:text-violet-700">
              Ver tablero <ArrowUpRight size={13} />
            </Link>
          </div>
          {ultimas.length === 0 ? (
            <EmptyState title="Sin órdenes en el rango" hint="Ajusta el rango de fechas para ver más pedidos." />
          ) : (
            <ul className="divide-y divide-slate-100">
              {ultimas.map((o) => (
                <li key={o.id} className="flex items-center gap-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-800">{o.customer_name || "Sin nombre"}</p>
                    <p className="text-[11px] text-slate-400">
                      {itemQty(o)} art. · {relTime(o.created_at)}
                    </p>
                  </div>
                  <StatusBadge status={o.status} />
                  <span className="w-20 shrink-0 text-right text-sm font-semibold text-slate-800">{formatDOP(o.total)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="p-5 lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-[15px] font-semibold text-slate-800">Pagos por confirmar</h2>
            {porConfirmar.length > 0 && (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-700">{porConfirmar.length}</span>
            )}
          </div>
          {porConfirmar.length === 0 ? (
            <EmptyState title="Todo al día" hint="No hay transferencias pendientes de confirmar en el rango." />
          ) : (
            <ul className="space-y-2">
              {porConfirmar.map((o) => (
                <li key={o.id} className="flex items-center gap-3 rounded-xl bg-amber-50/60 px-3 py-2 ring-1 ring-inset ring-amber-100">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-800">{o.customer_name || "Sin nombre"}</p>
                    <p className="text-[11px] text-slate-400">{relTime(o.created_at)}</p>
                  </div>
                  <span className="text-sm font-semibold text-slate-800">{formatDOP(o.total)}</span>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-[11px] leading-relaxed text-slate-400">
            Confirma cada pago desde el detalle de la orden en el tablero.
          </p>
        </Card>
      </div>
    </div>
  );
}

/* ---------- Selector de rango ---------- */

function RangePicker({
  preset,
  setPreset,
  from,
  to,
  setFrom,
  setTo,
}: {
  preset: Preset;
  setPreset: (p: Preset) => void;
  from: string;
  to: string;
  setFrom: (v: string) => void;
  setTo: (v: string) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="inline-flex rounded-xl border border-slate-200 bg-white p-0.5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
        {PRESETS.map((p) => {
          const active = preset === p.id;
          return (
            <button
              key={p.id}
              onClick={() => setPreset(p.id)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                active ? "bg-violet-600 text-white shadow-sm shadow-violet-600/20" : "text-slate-500 hover:bg-slate-100 hover:text-slate-800"
              }`}
            >
              {p.label}
            </button>
          );
        })}
      </div>
      {preset === "custom" && (
        <div className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          <CalendarDays size={14} className="shrink-0 text-slate-400" />
          <input
            type="date"
            value={from}
            max={to || undefined}
            onChange={(e) => setFrom(e.target.value)}
            className="bg-transparent text-xs text-slate-700 outline-none [color-scheme:light]"
            aria-label="Desde"
          />
          <span className="text-slate-300">–</span>
          <input
            type="date"
            value={to}
            min={from || undefined}
            onChange={(e) => setTo(e.target.value)}
            className="bg-transparent text-xs text-slate-700 outline-none [color-scheme:light]"
            aria-label="Hasta"
          />
        </div>
      )}
    </div>
  );
}

/* ---------- KPI tile ---------- */

function Kpi({
  label,
  value,
  icon,
  tone,
  primary,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  tone: "violet" | "emerald" | "amber" | "blue" | "slate";
  primary?: boolean;
}) {
  const chip: Record<string, string> = {
    violet: "bg-violet-100 text-violet-600",
    emerald: "bg-emerald-100 text-emerald-600",
    amber: "bg-amber-100 text-amber-600",
    blue: "bg-blue-100 text-blue-600",
    slate: "bg-slate-100 text-slate-500",
  };
  return (
    <div
      className={`rounded-2xl border p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)] ${
        primary ? "border-violet-200 bg-gradient-to-br from-violet-50 to-white" : "border-slate-200/80 bg-white"
      }`}
    >
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-medium uppercase tracking-wide text-slate-400">{label}</span>
        <span className={`grid h-6 w-6 place-items-center rounded-lg ${chip[tone]}`}>{icon}</span>
      </div>
      <p className="mt-2 text-2xl font-semibold tabular-nums tracking-tight text-slate-900">{value}</p>
    </div>
  );
}

/* ---------- Charts (SVG a mano, sin dependencias) ---------- */

interface Bucket {
  label: string; // etiqueta corta del eje
  tip: string; // texto del tooltip
  orders: number;
  revenue: number;
}

/**
 * Serie dinámica al rango. Elige la granularidad para no pasar de ~60 barras:
 * día (≤60 días), semana (≤420 días) o bloques uniformes para rangos enormes.
 */
function buildSeries(orders: Order[], from: number, to: number) {
  const totalDays = Math.max(1, Math.round((to - from) / DAY_MS));
  let stepDays: number;
  if (totalDays <= 60) stepDays = 1;
  else if (totalDays <= 420) stepDays = 7;
  else stepDays = Math.ceil(totalDays / 58);

  const buckets: Bucket[] = [];
  const cursor = new Date(from);
  cursor.setHours(0, 0, 0, 0);
  while (cursor.getTime() < to) {
    const start = new Date(cursor);
    const next = new Date(cursor);
    next.setDate(next.getDate() + stepDays);
    const endDate = new Date(Math.min(next.getTime(), to) - DAY_MS);
    buckets.push({
      label: stepDays === 1 ? String(start.getDate()) : `${start.getDate()}/${start.getMonth() + 1}`,
      tip: stepDays === 1 ? fmtShort(start) : `${fmtShort(start)} – ${fmtShort(endDate)}`,
      orders: 0,
      revenue: 0,
    });
    cursor.setTime(next.getTime());
  }

  const slotMs = stepDays * DAY_MS;
  for (const o of orders) {
    const t = new Date(o.created_at).getTime();
    if (t < from || t >= to) continue;
    const i = Math.min(buckets.length - 1, Math.max(0, Math.floor((t - from) / slotMs)));
    buckets[i].orders += 1;
    if (isRevenue(o)) buckets[i].revenue += o.total;
  }

  return {
    buckets,
    stepDays,
    totalOrders: buckets.reduce((a, b) => a + b.orders, 0),
    totalRevenue: buckets.reduce((a, b) => a + b.revenue, 0),
  };
}

function ChartHeader({ title, sub, total }: { title: string; sub: string; total: string }) {
  return (
    <div className="mb-4 flex items-end justify-between gap-2">
      <div className="min-w-0">
        <h2 className="text-[15px] font-semibold text-slate-800">{title}</h2>
        <p className="truncate text-[11px] text-slate-400">{sub}</p>
      </div>
      <span className="shrink-0 text-sm font-semibold tabular-nums text-slate-700">{total}</span>
    </div>
  );
}

const CW = 520;
const CH = 150;
const PAD_B = 20;
const PAD_T = 8;

interface Point {
  label: string;
  tip: string;
  value: number;
}

function BarChart({ data, color, fmt }: { data: Point[]; color: string; fmt: (v: number) => string }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  const n = data.length;
  const slot = CW / n;
  const bw = Math.min(22, slot * 0.55);
  const plotH = CH - PAD_B - PAD_T;
  const stride = Math.max(1, Math.ceil(n / 12));
  return (
    <svg viewBox={`0 0 ${CW} ${CH}`} className="w-full" role="img" aria-label="Órdenes por período">
      {[0.5, 1].map((g) => (
        <line key={g} x1={0} x2={CW} y1={PAD_T + plotH * (1 - g)} y2={PAD_T + plotH * (1 - g)} stroke="#eef0f4" strokeWidth={1} />
      ))}
      {data.map((d, i) => {
        const h = (d.value / max) * plotH;
        const x = i * slot + (slot - bw) / 2;
        const y = PAD_T + plotH - h;
        return (
          <g key={i}>
            <rect x={x} y={y} width={bw} height={Math.max(h, d.value > 0 ? 3 : 0)} rx={4} fill={color} opacity={0.92}>
              <title>{`${d.tip}: ${fmt(d.value)}`}</title>
            </rect>
            {(i % stride === 0 || i === n - 1) && (
              <text x={i * slot + slot / 2} y={CH - 6} textAnchor="middle" fontSize={9} fill="#94a3b8">
                {d.label}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

function AreaChart({ data, color, fmt }: { data: Point[]; color: string; fmt: (v: number) => string }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  const n = data.length;
  const plotH = CH - PAD_B - PAD_T;
  const x = (i: number) => (n === 1 ? CW / 2 : (i / (n - 1)) * CW);
  const y = (v: number) => PAD_T + plotH - (v / max) * plotH;
  const line = data.map((d, i) => `${i === 0 ? "M" : "L"} ${x(i).toFixed(1)} ${y(d.value).toFixed(1)}`).join(" ");
  const area = `${line} L ${CW} ${PAD_T + plotH} L 0 ${PAD_T + plotH} Z`;
  const spacing = n > 1 ? CW / (n - 1) : CW;
  const half = Math.min(12, spacing / 2);
  const showDots = n <= 31;
  const gid = "areaFill";
  return (
    <svg viewBox={`0 0 ${CW} ${CH}`} className="w-full" role="img" aria-label="Ingresos por período">
      <defs>
        <linearGradient id={gid} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.22} />
          <stop offset="100%" stopColor={color} stopOpacity={0.01} />
        </linearGradient>
      </defs>
      {[0.5, 1].map((g) => (
        <line key={g} x1={0} x2={CW} y1={PAD_T + plotH * (1 - g)} y2={PAD_T + plotH * (1 - g)} stroke="#eef0f4" strokeWidth={1} />
      ))}
      <path d={area} fill={`url(#${gid})`} />
      <path d={line} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
      {data.map((d, i) => (
        <g key={i}>
          {showDots && <circle cx={x(i)} cy={y(d.value)} r={2.5} fill="#fff" stroke={color} strokeWidth={1.5} />}
          <rect x={x(i) - half} y={0} width={half * 2} height={CH} fill="transparent">
            <title>{`${d.tip}: ${fmt(d.value)}`}</title>
          </rect>
        </g>
      ))}
    </svg>
  );
}
