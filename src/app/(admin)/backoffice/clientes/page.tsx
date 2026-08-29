"use client";

import { useEffect, useMemo, useState } from "react";
import { Search, Users, Repeat, UserPlus, ShoppingBag, Crown } from "lucide-react";
import { getSupabase } from "@/lib/supabase";
import { formatDOP } from "@/data/catalog-meta";
import {
  type ProfileRow,
  customerKey,
  digitsOnly,
  dayKey,
  relTime,
} from "@/lib/backoffice";
import { Card, Spinner, Pill, EmptyState, SectionHeader } from "@/components/backoffice/ui";

interface OrderLite {
  customer_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  total: number;
  status: string;
  created_at: string;
}

interface FunnelRow {
  day: string;
  home: number;
  listing: number;
  product: number;
  intent: number;
  orders: number;
}

interface Stat {
  count: number;
  spent: number;
  last: string | null;
}

interface CustomerRow extends ProfileRow {
  orders: number;
  spent: number;
  last: string | null;
}

const DAY_MS = 864e5;

/** Un cliente cuenta como "ballena" si acumula 3+ órdenes o este gasto de por vida. */
const WHALE_ORDERS = 3;
const WHALE_SPEND = 3000;

type RangeDays = 7 | 30 | 90;

export default function ClientesPage() {
  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
  const [orders, setOrders] = useState<OrderLite[]>([]);
  const [funnelRows, setFunnelRows] = useState<FunnelRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [days, setDays] = useState<RangeDays>(30);

  useEffect(() => {
    const sb = getSupabase();
    if (!sb) {
      setLoading(false);
      return;
    }
    // El funnel se trae con holgura (95 días) y se filtra al rango en el cliente.
    const funnelFrom = dayKey(new Date(Date.now() - 95 * DAY_MS).toISOString());
    Promise.all([
      sb.from("profiles").select("id,email,full_name,phone,role,loyalty_points,created_at").order("created_at", { ascending: false }).limit(1000),
      sb.from("orders").select("customer_name,customer_email,customer_phone,total,status,created_at").limit(2000),
      sb.from("funnel_daily").select("day,home,listing,product,intent,orders").gte("day", funnelFrom).order("day", { ascending: false }).limit(150),
    ]).then(([p, o, f]) => {
      setProfiles((p.data as ProfileRow[]) ?? []);
      setOrders((o.data as OrderLite[]) ?? []);
      setFunnelRows((f.data as FunnelRow[]) ?? []);
      setLoading(false);
    });
  }, []);

  const range = useMemo(() => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const to = start.getTime() + DAY_MS; // fin exclusivo = inicio de mañana
    const from = start.getTime() - (days - 1) * DAY_MS;
    return {
      from,
      to,
      fromStr: dayKey(new Date(from).toISOString()),
      label: days === 7 ? "Últimos 7 días" : days === 30 ? "Últimos 30 días" : "Últimos 90 días",
    };
  }, [days]);

  const revenue = useMemo(
    () => orders.filter((o) => o.status !== "cancelled" && o.status !== "refunded"),
    [orders]
  );

  /* ---------- Nuevos vs. recurrentes (respeta el rango) ---------- */
  const nvr = useMemo(() => {
    // 1ra orden de por vida por cliente
    const first = new Map<string, number>();
    for (const o of revenue) {
      const key = customerKey(o.customer_email, o.customer_phone);
      if (!key) continue;
      const t = new Date(o.created_at).getTime();
      const prev = first.get(key);
      if (prev === undefined || t < prev) first.set(key, t);
    }
    // órdenes dentro del rango, agrupadas por cliente
    const inRange = new Map<string, number>();
    for (const o of revenue) {
      const t = new Date(o.created_at).getTime();
      if (t < range.from || t >= range.to) continue;
      const key = customerKey(o.customer_email, o.customer_phone);
      if (!key) continue;
      inRange.set(key, (inRange.get(key) ?? 0) + 1);
    }
    let newCust = 0, retCust = 0, newOrders = 0, retOrders = 0;
    for (const [key, cnt] of inRange) {
      const ft = first.get(key) ?? range.from;
      if (ft >= range.from) {
        newCust += 1;
        newOrders += cnt;
      } else {
        retCust += 1;
        retOrders += cnt;
      }
    }
    const activeCust = newCust + retCust;
    return { newCust, retCust, activeCust, newOrders, retOrders };
  }, [revenue, range]);

  /* ---------- Embudo de conversión (funnel_daily, respeta el rango) ---------- */
  const funnel = useMemo(() => {
    const rows = funnelRows.filter((r) => r.day >= range.fromStr);
    const sum = (k: keyof Omit<FunnelRow, "day">) => rows.reduce((a, r) => a + (Number(r[k]) || 0), 0);
    return [
      { label: "Visitas al home", value: sum("home") },
      { label: "Vieron catálogo", value: sum("listing") },
      { label: "Vieron producto", value: sum("product") },
      { label: "Carrito / intención", value: sum("intent") },
      { label: "Ordenaron", value: sum("orders") },
    ];
  }, [funnelRows, range]);

  /* ---------- Ballenas (valor de por vida, independiente del rango) ---------- */
  const whales = useMemo(() => {
    const life = new Map<string, { name: string | null; email: string | null; phone: string | null; orders: number; spent: number; lastTs: number }>();
    for (const o of revenue) {
      const key = customerKey(o.customer_email, o.customer_phone);
      if (!key) continue;
      const t = new Date(o.created_at).getTime();
      const e = life.get(key) ?? { name: null, email: o.customer_email, phone: o.customer_phone, orders: 0, spent: 0, lastTs: 0 };
      e.orders += 1;
      e.spent += o.total ?? 0;
      if (t >= e.lastTs) {
        e.lastTs = t;
        if (o.customer_name) e.name = o.customer_name;
      }
      if (!e.email && o.customer_email) e.email = o.customer_email;
      if (!e.phone && o.customer_phone) e.phone = o.customer_phone;
      life.set(key, e);
    }
    const all = [...life.entries()].map(([key, v]) => ({ key, ...v }));
    const list = all.filter((w) => w.spent >= WHALE_SPEND || w.orders >= WHALE_ORDERS);
    const top = [...list].sort((a, b) => b.spent - a.spent).slice(0, 5);
    return { count: list.length, top };
  }, [revenue]);

  const statsByKey = useMemo(() => {
    const map = new Map<string, Stat>();
    for (const o of orders) {
      if (o.status === "cancelled" || o.status === "refunded") continue;
      const key = customerKey(o.customer_email, o.customer_phone);
      if (!key) continue;
      const s = map.get(key) ?? { count: 0, spent: 0, last: null };
      s.count += 1;
      s.spent += o.total ?? 0;
      if (!s.last || new Date(o.created_at) > new Date(s.last)) s.last = o.created_at;
      map.set(key, s);
    }
    return map;
  }, [orders]);

  const rows: CustomerRow[] = useMemo(() => {
    return profiles.map((p) => {
      const s = statsByKey.get(customerKey(p.email, p.phone));
      return { ...p, orders: s?.count ?? 0, spent: s?.spent ?? 0, last: s?.last ?? null };
    });
  }, [profiles, statsByKey]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const qd = digitsOnly(search);
    const base = q
      ? rows.filter(
          (r) =>
            (r.full_name ?? "").toLowerCase().includes(q) ||
            (r.email ?? "").toLowerCase().includes(q) ||
            (qd.length >= 3 && digitsOnly(r.phone).includes(qd))
        )
      : rows;
    return [...base].sort((a, b) => b.spent - a.spent || b.orders - a.orders);
  }, [rows, search]);

  const totals = useMemo(() => {
    const withOrders = rows.filter((r) => r.orders > 0).length;
    const recurrentes = rows.filter((r) => r.orders >= 2).length;
    return { total: rows.length, withOrders, recurrentes, nuevos: rows.length - recurrentes };
  }, [rows]);

  if (loading) return <Spinner label="Cargando clientes…" />;

  return (
    <div className="space-y-6">
      {/* Resumen general (de por vida) */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Metric label="Clientes" value={totals.total} icon={<Users size={16} />} />
        <Metric label="Con compras" value={totals.withOrders} icon={<ShoppingBag size={16} />} />
        <Metric label="Recurrentes" value={totals.recurrentes} icon={<Repeat size={16} />} tone="violet" />
        <Metric label="Nuevos" value={totals.nuevos} icon={<UserPlus size={16} />} />
      </div>

      {/* Análisis (respeta el selector de rango) */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <SectionHeader title="Análisis de clientes" subtitle="Adquisición y conversión en el rango seleccionado" />
        <RangeTabs days={days} setDays={setDays} />
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        {/* Nuevos vs. recurrentes */}
        <Card className="p-5 lg:col-span-2">
          <SectionHeader title="Nuevos vs. recurrentes" subtitle={range.label} />
          <div className="mt-4 flex items-center gap-5">
            <Donut returning={nvr.retCust} total={nvr.activeCust} />
            <div className="min-w-0 flex-1 space-y-2">
              <LegendRow color="#7C3AED" label="Recurrentes" a={nvr.retCust} b={`${nvr.retOrders} órd.`} />
              <LegendRow color="#c4b5fd" label="Nuevos" a={nvr.newCust} b={`${nvr.newOrders} órd.`} />
            </div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <MiniStat label="Órdenes de nuevos" value={nvr.newOrders} />
            <MiniStat label="Órdenes de recurrentes" value={nvr.retOrders} tone="violet" />
          </div>
          <p className="mt-3 text-[11px] leading-relaxed text-slate-400">
            Cliente nuevo = su 1ra orden cae en el rango; recurrente = ya compraba antes.
          </p>
        </Card>

        {/* Embudo de conversión */}
        <Card className="p-5 lg:col-span-3">
          <SectionHeader title="Embudo de conversión" subtitle={range.label} />
          <div className="mt-4">
            <FunnelBars steps={funnel} />
          </div>
          <p className="mt-3 text-[11px] leading-relaxed text-slate-400">
            Sesiones únicas del sitio por día. El % a la derecha es la retención frente al paso anterior.
          </p>
        </Card>
      </div>

      {/* Ballenas */}
      <Card className="p-5">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-violet-100 text-violet-600">
              <Crown size={16} />
            </span>
            <div>
              <h2 className="text-[15px] font-semibold text-slate-800">Ballenas</h2>
              <p className="text-[11px] text-slate-400">
                Mejores clientes por valor de por vida ({WHALE_ORDERS}+ órdenes o {formatDOP(WHALE_SPEND)}+).
              </p>
            </div>
          </div>
          <Pill tone="violet">{whales.count} clientes</Pill>
        </div>
        {whales.top.length === 0 ? (
          <EmptyState title="Aún no hay ballenas" hint="Cuando algún cliente acumule varias compras aparecerá aquí." />
        ) : (
          <ol className="divide-y divide-slate-100">
            {whales.top.map((w, i) => (
              <li key={w.key} className="flex items-center gap-3 py-2.5">
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-lg bg-violet-50 text-[11px] font-semibold text-violet-600 ring-1 ring-inset ring-violet-100">
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-800">{w.name || w.email || w.phone || "Cliente"}</p>
                  <p className="text-[11px] text-slate-400">{w.orders} órdenes de por vida</p>
                </div>
                <span className="shrink-0 text-sm font-semibold tabular-nums text-slate-800">{formatDOP(w.spent)}</span>
              </li>
            ))}
          </ol>
        )}
      </Card>

      {/* Tabla de clientes (existente) */}
      <div className="relative max-w-xs">
        <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar cliente…"
          className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm text-slate-800 shadow-sm outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-500/30"
        />
      </div>

      <Card className="overflow-hidden">
        {filtered.length === 0 ? (
          <EmptyState title="Sin clientes" hint="Ajusta la búsqueda o espera nuevos registros." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-left text-[11px] uppercase tracking-wide text-slate-400">
                  <th className="px-4 py-3 font-semibold">Cliente</th>
                  <th className="px-4 py-3 font-semibold">Teléfono</th>
                  <th className="px-4 py-3 text-right font-semibold">Órdenes</th>
                  <th className="px-4 py-3 text-right font-semibold">Total gastado</th>
                  <th className="px-4 py-3 font-semibold">Última compra</th>
                  <th className="px-4 py-3 font-semibold">Segmento</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((c) => (
                  <tr key={c.id} className="transition hover:bg-slate-50/60">
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-800">{c.full_name || "Sin nombre"}</p>
                      <p className="text-[11px] text-slate-400">{c.email || "—"}</p>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{c.phone || "—"}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-slate-700">{c.orders}</td>
                    <td className="px-4 py-3 text-right font-semibold tabular-nums text-slate-800">{formatDOP(c.spent)}</td>
                    <td className="px-4 py-3 text-slate-500">{c.last ? relTime(c.last) : <span className="text-slate-300">—</span>}</td>
                    <td className="px-4 py-3">
                      {c.orders >= 2 ? <Pill tone="violet">Recurrente</Pill> : <Pill tone="slate">Nuevo</Pill>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      <p className="text-[11px] text-slate-400">
        Métricas cruzadas por correo/teléfono con las órdenes (excluye canceladas y reembolsadas).
      </p>
    </div>
  );
}

/* ---------- Selector de rango ---------- */

function RangeTabs({ days, setDays }: { days: RangeDays; setDays: (d: RangeDays) => void }) {
  const opts: [RangeDays, string][] = [
    [7, "7 días"],
    [30, "30 días"],
    [90, "90 días"],
  ];
  return (
    <div className="inline-flex shrink-0 rounded-xl border border-slate-200 bg-white p-0.5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      {opts.map(([d, l]) => {
        const active = days === d;
        return (
          <button
            key={d}
            onClick={() => setDays(d)}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
              active ? "bg-violet-600 text-white shadow-sm shadow-violet-600/20" : "text-slate-500 hover:bg-slate-100 hover:text-slate-800"
            }`}
          >
            {l}
          </button>
        );
      })}
    </div>
  );
}

/* ---------- Donut nuevos vs. recurrentes (SVG a mano) ---------- */

function Donut({ returning, total }: { returning: number; total: number }) {
  const r = 42;
  const C = 2 * Math.PI * r;
  const frac = total > 0 ? returning / total : 0;
  const pct = Math.round(frac * 100);
  const dash = frac * C;
  return (
    <div className="relative h-28 w-28 shrink-0">
      <svg viewBox="0 0 120 120" className="h-full w-full" role="img" aria-label="Nuevos vs. recurrentes">
        <g transform="rotate(-90 60 60)">
          <circle cx={60} cy={60} r={r} fill="none" stroke="#ede9fe" strokeWidth={15} />
          {returning > 0 && (
            <circle
              cx={60}
              cy={60}
              r={r}
              fill="none"
              stroke="#7C3AED"
              strokeWidth={15}
              strokeDasharray={`${dash} ${C - dash}`}
              strokeLinecap="round"
            />
          )}
        </g>
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-xl font-semibold tabular-nums text-slate-900">{pct}%</span>
        <span className="text-[10px] uppercase tracking-wide text-slate-400">recurrencia</span>
      </div>
    </div>
  );
}

function LegendRow({ color, label, a, b }: { color: string; label: string; a: number; b: string }) {
  return (
    <div className="flex items-center justify-between gap-2 text-sm">
      <span className="flex items-center gap-2 text-slate-600">
        <span className="h-2.5 w-2.5 rounded-full" style={{ background: color }} />
        {label}
      </span>
      <span className="tabular-nums text-slate-500">
        <b className="text-slate-800">{a}</b> · {b}
      </span>
    </div>
  );
}

/* ---------- Embudo horizontal (barras decrecientes) ---------- */

function FunnelBars({ steps }: { steps: { label: string; value: number }[] }) {
  const base = Math.max(1, steps[0]?.value ?? 0);
  const anyData = steps.some((s) => s.value > 0);
  return (
    <div className="space-y-2.5">
      {steps.map((s, i) => {
        const prev = i > 0 ? steps[i - 1].value : s.value;
        const stepPct = prev > 0 ? Math.round((s.value / prev) * 100) : 0;
        const topPct = Math.round((s.value / base) * 100);
        const w = s.value > 0 ? Math.max(6, Math.min(100, (s.value / base) * 100)) : 0;
        return (
          <div key={s.label}>
            <div className="mb-1 flex items-baseline justify-between gap-2 text-xs">
              <span className="font-medium text-slate-600">{s.label}</span>
              <span className="tabular-nums text-slate-500">
                <b className="text-slate-800">{s.value}</b> · {topPct}%
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-7 flex-1 overflow-hidden rounded-lg bg-slate-100/70">
                <div className="h-full rounded-lg bg-gradient-to-r from-violet-500 to-violet-600" style={{ width: `${w}%` }} />
              </div>
              <span className="w-12 shrink-0 text-right text-[11px] tabular-nums text-slate-400">{i > 0 ? `${stepPct}%` : ""}</span>
            </div>
          </div>
        );
      })}
      {!anyData && <p className="pt-1 text-[11px] text-slate-400">Sin eventos de navegación en el rango todavía.</p>}
    </div>
  );
}

/* ---------- Tiles ---------- */

function MiniStat({ label, value, tone = "slate" }: { label: string; value: number; tone?: "slate" | "violet" }) {
  return (
    <div className={`rounded-xl p-3 ring-1 ring-inset ${tone === "violet" ? "bg-violet-50/70 ring-violet-100" : "bg-slate-50/70 ring-slate-100"}`}>
      <p className="text-[11px] font-medium text-slate-500">{label}</p>
      <p className={`mt-0.5 text-lg font-semibold tabular-nums ${tone === "violet" ? "text-violet-700" : "text-slate-800"}`}>{value}</p>
    </div>
  );
}

function Metric({ label, value, icon, tone = "slate" }: { label: string; value: number; icon: React.ReactNode; tone?: "slate" | "violet" }) {
  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-medium uppercase tracking-wide text-slate-400">{label}</span>
        <span className={`grid h-6 w-6 place-items-center rounded-lg ${tone === "violet" ? "bg-violet-100 text-violet-600" : "bg-slate-100 text-slate-500"}`}>{icon}</span>
      </div>
      <p className="mt-2 text-2xl font-semibold tabular-nums text-slate-900">{value}</p>
    </div>
  );
}
