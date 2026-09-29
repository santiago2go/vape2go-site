"use client";

import { useEffect, useMemo, useState } from "react";
import { Search, MessageCircle, Mail, ArrowUp, ArrowDown, ChevronsUpDown, Crown, Filter, X } from "lucide-react";
import { getSupabase } from "@/lib/supabase";
import { formatDOP } from "@/data/catalog-meta";
import { customerKey, digitsOnly, waLink } from "@/lib/backoffice";
import { Card, Spinner, Pill, EmptyState, SectionHeader } from "@/components/backoffice/ui";

/* ────────────────────────────────────────────────────────────────────────
 * CRM v1 — Segmentación RFM (Recencia / Frecuencia / Monto) sobre `orders`.
 *
 * Solo lectura + contacto directo (WhatsApp / email). Sin tablas nuevas: los
 * clientes se agrupan por correo (y en su defecto por teléfono) directo desde
 * las órdenes. Campañas, tags y crédito quedan para v2 (requieren tablas).
 * ──────────────────────────────────────────────────────────────────────── */

const DAY_MS = 864e5;

/* ---------- Umbrales de segmentación (ajustables) ---------- */
const RECURRING_MIN_ORDERS = 2;   // "recurrente" = 2+ órdenes
const NEW_DAYS = 30;              // "nuevo" = 1 orden y recencia <= 30 días
const ACTIVE_DAYS = 45;          // recurrente activo si recencia <= 45 días
const DORMANT_DAYS = 90;         // "dormido" = recencia > 90 días
const WHALE_FREQ = 6;            // "ballena" por frecuencia: 6+ órdenes…
const WHALE_TOP_PCT = 0.1;       // …o gasto en el top 10% (percentil 90)…
const WHALE_MIN_SPEND = 3000;    // …con un piso de monto para el corte por %.

type SegKey = "ballena" | "recurrente" | "nuevo" | "riesgo" | "dormido";

const SEG_ORDER: SegKey[] = ["ballena", "recurrente", "nuevo", "riesgo", "dormido"];

const SEG_META: Record<
  SegKey,
  { emoji: string; label: string; help: string; badge: string; dot: string; ring: string; icon: string }
> = {
  ballena: {
    emoji: "🐋",
    label: "Ballenas",
    help: "Mayor valor: 6+ órdenes o gasto en el top 10%.",
    badge: "bg-violet-100 text-violet-700 ring-violet-200",
    dot: "bg-violet-500",
    ring: "ring-violet-200",
    icon: "bg-violet-100 text-violet-600",
  },
  recurrente: {
    emoji: "🔁",
    label: "Recurrentes",
    help: "2+ órdenes y activos (recencia ≤ 45 días).",
    badge: "bg-emerald-100 text-emerald-700 ring-emerald-200",
    dot: "bg-emerald-500",
    ring: "ring-emerald-200",
    icon: "bg-emerald-100 text-emerald-600",
  },
  nuevo: {
    emoji: "🆕",
    label: "Nuevos",
    help: "1 sola orden, reciente (≤ 30 días).",
    badge: "bg-sky-100 text-sky-700 ring-sky-200",
    dot: "bg-sky-500",
    ring: "ring-sky-200",
    icon: "bg-sky-100 text-sky-600",
  },
  riesgo: {
    emoji: "⚠️",
    label: "En riesgo",
    help: "Se están enfriando (recencia 45–90 días).",
    badge: "bg-amber-100 text-amber-700 ring-amber-200",
    dot: "bg-amber-500",
    ring: "ring-amber-200",
    icon: "bg-amber-100 text-amber-600",
  },
  dormido: {
    emoji: "😴",
    label: "Dormidos",
    help: "Sin comprar hace más de 90 días.",
    badge: "bg-slate-100 text-slate-600 ring-slate-200",
    dot: "bg-slate-400",
    ring: "ring-slate-300",
    icon: "bg-slate-100 text-slate-500",
  },
};

interface OrderLite {
  customer_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  total: number | null;
  status: string;
  created_at: string;
}

interface Customer {
  key: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  orders: number;
  spent: number;
  lastTs: number;
  recencyDays: number;
  segment: SegKey;
}

type SortKey = "spent" | "orders" | "recency";
type SortDir = "asc" | "desc";

/** Asigna UN segmento primario (mutuamente excluyente) por cliente. */
function assignSegment(freq: number, recencyDays: number, isWhale: boolean): SegKey {
  if (recencyDays > DORMANT_DAYS) return "dormido";
  if (isWhale) return "ballena";
  if (freq >= RECURRING_MIN_ORDERS) return recencyDays > ACTIVE_DAYS ? "riesgo" : "recurrente";
  // freq === 1
  if (recencyDays <= NEW_DAYS) return "nuevo";
  return "riesgo"; // 1 orden que se enfrió (30–90 días): candidato a win-back
}

export default function CrmPage() {
  const [orders, setOrders] = useState<OrderLite[]>([]);
  const [loading, setLoading] = useState(true);
  const [ready, setReady] = useState(true);
  const [search, setSearch] = useState("");
  const [segFilter, setSegFilter] = useState<SegKey | null>(null);
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>({ key: "spent", dir: "desc" });

  useEffect(() => {
    const sb = getSupabase();
    if (!sb) {
      setReady(false);
      setLoading(false);
      return;
    }
    sb.from("orders")
      .select("customer_name,customer_email,customer_phone,total,status,created_at")
      .limit(5000)
      .then(({ data }) => {
        setOrders((data as OrderLite[]) ?? []);
        setLoading(false);
      });
  }, []);

  /* ---------- Agregación por cliente (excluye canceladas y reembolsadas) ---------- */
  const customers: Customer[] = useMemo(() => {
    const now = Date.now();
    const map = new Map<
      string,
      { name: string | null; email: string | null; phone: string | null; orders: number; spent: number; lastTs: number }
    >();
    for (const o of orders) {
      if (o.status === "cancelled" || o.status === "refunded") continue;
      const key = customerKey(o.customer_email, o.customer_phone);
      if (!key) continue;
      const t = new Date(o.created_at).getTime();
      const e =
        map.get(key) ?? { name: null, email: o.customer_email, phone: o.customer_phone, orders: 0, spent: 0, lastTs: 0 };
      e.orders += 1;
      e.spent += Number(o.total) || 0;
      if (t >= e.lastTs) {
        e.lastTs = t;
        if (o.customer_name) e.name = o.customer_name; // nombre de la orden más reciente
      }
      if (!e.email && o.customer_email) e.email = o.customer_email;
      if (!e.phone && o.customer_phone) e.phone = o.customer_phone;
      map.set(key, e);
    }

    const base = [...map.entries()].map(([key, v]) => ({ key, ...v }));

    // Corte de "ballena por monto" = percentil 90 del gasto (con un piso).
    const spends = base.map((c) => c.spent).sort((a, b) => a - b);
    const p90 =
      spends.length > 0
        ? spends[Math.min(spends.length - 1, Math.max(0, Math.ceil((1 - WHALE_TOP_PCT) * spends.length) - 1))]
        : Infinity;
    const whaleSpend = Math.max(p90, WHALE_MIN_SPEND);

    return base.map((c) => {
      const recencyDays = Math.floor((now - c.lastTs) / DAY_MS);
      const isWhale = c.orders >= WHALE_FREQ || (c.spent > 0 && c.spent >= whaleSpend);
      return {
        key: c.key,
        name: c.name,
        email: c.email,
        phone: c.phone,
        orders: c.orders,
        spent: c.spent,
        lastTs: c.lastTs,
        recencyDays,
        segment: assignSegment(c.orders, recencyDays, isWhale),
      };
    });
  }, [orders]);

  /* ---------- Conteos por segmento (tiles) ---------- */
  const counts = useMemo(() => {
    const c: Record<SegKey, number> = { ballena: 0, recurrente: 0, nuevo: 0, riesgo: 0, dormido: 0 };
    for (const cust of customers) c[cust.segment] += 1;
    return c;
  }, [customers]);

  /* ---------- Top ballenas (por gasto de por vida, para white-glove / win-back) ---------- */
  const topWhales = useMemo(
    () => [...customers].sort((a, b) => b.spent - a.spent).slice(0, 8),
    [customers]
  );

  /* ---------- Filtro + búsqueda + orden ---------- */
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const qd = digitsOnly(search);
    let list = customers;
    if (segFilter) list = list.filter((c) => c.segment === segFilter);
    if (q) {
      list = list.filter(
        (c) =>
          (c.name ?? "").toLowerCase().includes(q) ||
          (c.email ?? "").toLowerCase().includes(q) ||
          (qd.length >= 3 && digitsOnly(c.phone).includes(qd))
      );
    }
    const dir = sort.dir === "asc" ? 1 : -1;
    return [...list].sort((a, b) => {
      let d = 0;
      if (sort.key === "spent") d = a.spent - b.spent;
      else if (sort.key === "orders") d = a.orders - b.orders;
      else d = b.recencyDays - a.recencyDays; // "recency" desc = más reciente primero
      if (d === 0) d = a.spent - b.spent;
      return d * dir;
    });
  }, [customers, segFilter, search, sort]);

  function toggleSort(key: SortKey) {
    setSort((s) => (s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "desc" }));
  }

  if (loading) return <Spinner label="Cargando CRM…" />;

  if (!ready) {
    return (
      <EmptyState
        title="CRM no disponible"
        hint="El módulo estará disponible cuando se configure el backend (Supabase)."
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Encabezado */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <SectionHeader
          title="CRM · Segmentación RFM"
          subtitle="Clientes agrupados por recencia, frecuencia y monto — contacto directo."
        />
        <span className="inline-flex items-center gap-1.5 self-start rounded-full bg-violet-50 px-3 py-1 text-[11px] font-medium text-violet-500 ring-1 ring-inset ring-violet-100">
          <Filter size={12} /> Próximamente: campañas, tags y crédito (requieren tablas nuevas)
        </span>
      </div>

      {/* Tiles de segmentos (click = filtra la tabla) */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {SEG_ORDER.map((key) => (
          <SegmentTile
            key={key}
            seg={key}
            count={counts[key]}
            active={segFilter === key}
            onClick={() => setSegFilter((s) => (s === key ? null : key))}
          />
        ))}
      </div>

      {/* Top ballenas */}
      <Card className="p-5">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-violet-100 text-violet-600">
              <Crown size={16} />
            </span>
            <div>
              <h2 className="text-[15px] font-semibold text-slate-800">Ballenas · mayor valor</h2>
              <p className="text-[11px] text-slate-400">
                Top por gasto de por vida — clientes white-glove y prioridad de win-back.
              </p>
            </div>
          </div>
          <Pill tone="violet">{counts.ballena} en total</Pill>
        </div>
        {topWhales.length === 0 || topWhales[0].spent <= 0 ? (
          <EmptyState title="Aún no hay clientes con compras" hint="Aparecerán aquí cuando entren órdenes." />
        ) : (
          <ol className="divide-y divide-slate-100">
            {topWhales.map((w, i) => (
              <li key={w.key} className="flex items-center gap-3 py-2.5">
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-lg bg-violet-50 text-[11px] font-semibold text-violet-600 ring-1 ring-inset ring-violet-100">
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-800">
                    {w.name || w.email || w.phone || "Cliente"}
                  </p>
                  <p className="text-[11px] text-slate-400">
                    {w.orders} {w.orders === 1 ? "orden" : "órdenes"} ·{" "}
                    <span className={w.recencyDays > DORMANT_DAYS ? "text-rose-500" : ""}>
                      {agoLabel(w.recencyDays)}
                    </span>
                  </p>
                </div>
                <ContactButtons phone={w.phone} email={w.email} name={w.name} />
                <span className="w-24 shrink-0 text-right text-sm font-semibold tabular-nums text-slate-800">
                  {formatDOP(w.spent)}
                </span>
              </li>
            ))}
          </ol>
        )}
      </Card>

      {/* Buscador + filtro activo */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative max-w-xs flex-1">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar cliente…"
            className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm text-slate-800 shadow-sm outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-500/30"
          />
        </div>
        {segFilter && (
          <button
            onClick={() => setSegFilter(null)}
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${SEG_META[segFilter].badge}`}
          >
            {SEG_META[segFilter].emoji} {SEG_META[segFilter].label}
            <X size={13} />
          </button>
        )}
        <span className="ml-auto text-xs text-slate-400 tabular-nums">
          {filtered.length} de {customers.length} clientes
        </span>
      </div>

      {/* Tabla de clientes */}
      <Card className="overflow-hidden">
        {filtered.length === 0 ? (
          <EmptyState title="Sin clientes" hint="Ajusta el filtro o la búsqueda." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-left text-[11px] uppercase tracking-wide text-slate-400">
                  <th className="px-4 py-3 font-semibold">Cliente</th>
                  <th className="px-4 py-3 font-semibold">Segmento</th>
                  <SortableTH label="Órdenes" active={sort.key === "orders"} dir={sort.dir} onClick={() => toggleSort("orders")} align="right" />
                  <SortableTH label="Total gastado" active={sort.key === "spent"} dir={sort.dir} onClick={() => toggleSort("spent")} align="right" />
                  <SortableTH label="Última compra" active={sort.key === "recency"} dir={sort.dir} onClick={() => toggleSort("recency")} align="left" />
                  <th className="px-4 py-3 text-right font-semibold">Contacto</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((c) => {
                  const m = SEG_META[c.segment];
                  return (
                    <tr key={c.key} className="transition hover:bg-slate-50/60">
                      <td className="px-4 py-3">
                        <p className="font-medium text-slate-800">{c.name || "Sin nombre"}</p>
                        <p className="text-[11px] text-slate-400">{c.email || c.phone || "—"}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${m.badge}`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${m.dot}`} />
                          {m.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-slate-700">{c.orders}</td>
                      <td className="px-4 py-3 text-right font-semibold tabular-nums text-slate-800">{formatDOP(c.spent)}</td>
                      <td className="px-4 py-3">
                        <p className="text-slate-600">{fmtDate(c.lastTs)}</p>
                        <p className={`text-[11px] ${c.recencyDays > DORMANT_DAYS ? "text-rose-500" : "text-slate-400"}`}>
                          {agoLabel(c.recencyDays)}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end">
                          <ContactButtons phone={c.phone} email={c.email} name={c.name} />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <p className="text-[11px] leading-relaxed text-slate-400">
        Clientes agrupados por correo (y en su defecto teléfono) desde las órdenes; excluye canceladas y reembolsadas.
        Recencia = días desde la última compra · Frecuencia = # de órdenes · Monto = total gastado. Umbrales ajustables
        en el código. v1 es análisis + contacto directo; campañas, tags y crédito llegan cuando se creen sus tablas.
      </p>
    </div>
  );
}

/* ────────────────────────────── Subcomponentes ────────────────────────── */

function SegmentTile({
  seg,
  count,
  active,
  onClick,
}: {
  seg: SegKey;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  const m = SEG_META[seg];
  return (
    <button
      onClick={onClick}
      title={m.help}
      className={`rounded-2xl border bg-white p-4 text-left shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition hover:shadow-md ${
        active ? `border-transparent ring-2 ${m.ring}` : "border-slate-200/80"
      }`}
    >
      <div className="flex items-center justify-between">
        <span className={`grid h-8 w-8 place-items-center rounded-lg text-base ${m.icon}`}>{m.emoji}</span>
        <span className={`h-2 w-2 rounded-full ${m.dot}`} />
      </div>
      <p className="mt-3 text-2xl font-semibold tabular-nums text-slate-900">{count}</p>
      <p className="text-[13px] font-semibold text-slate-700">{m.label}</p>
      <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-slate-400">{m.help}</p>
    </button>
  );
}

function SortableTH({
  label,
  active,
  dir,
  onClick,
  align,
}: {
  label: string;
  active: boolean;
  dir: SortDir;
  onClick: () => void;
  align: "left" | "right";
}) {
  return (
    <th className={`px-4 py-3 font-semibold ${align === "right" ? "text-right" : "text-left"}`}>
      <button
        onClick={onClick}
        className={`inline-flex items-center gap-1 uppercase tracking-wide transition hover:text-slate-600 ${
          active ? "text-violet-600" : ""
        } ${align === "right" ? "flex-row-reverse" : ""}`}
      >
        {label}
        {active ? (
          dir === "asc" ? <ArrowUp size={12} /> : <ArrowDown size={12} />
        ) : (
          <ChevronsUpDown size={12} className="text-slate-300" />
        )}
      </button>
    </th>
  );
}

function ContactButtons({ phone, email, name }: { phone: string | null; email: string | null; name: string | null }) {
  const digits = digitsOnly(phone);
  const first = (name ?? "").trim().split(/\s+/)[0] || "";
  const waHref = waLink(phone) + (first ? `?text=${encodeURIComponent(`¡Hola ${first}! Te escribimos de Vape 2 Go 👋`)}` : "");
  return (
    <div className="flex items-center gap-1.5">
      {digits.length >= 8 ? (
        <a
          href={waHref}
          target="_blank"
          rel="noopener noreferrer"
          title="Enviar WhatsApp"
          aria-label="Enviar WhatsApp"
          className="grid h-8 w-8 place-items-center rounded-lg text-emerald-600 ring-1 ring-inset ring-emerald-200 transition hover:bg-emerald-50"
        >
          <MessageCircle size={15} />
        </a>
      ) : (
        <span className="grid h-8 w-8 place-items-center rounded-lg text-slate-300 ring-1 ring-inset ring-slate-200" title="Sin teléfono">
          <MessageCircle size={15} />
        </span>
      )}
      {email ? (
        <a
          href={`mailto:${email}`}
          title={`Escribir a ${email}`}
          aria-label="Enviar correo"
          className="grid h-8 w-8 place-items-center rounded-lg text-violet-600 ring-1 ring-inset ring-violet-200 transition hover:bg-violet-50"
        >
          <Mail size={15} />
        </a>
      ) : (
        <span className="grid h-8 w-8 place-items-center rounded-lg text-slate-300 ring-1 ring-inset ring-slate-200" title="Sin correo">
          <Mail size={15} />
        </span>
      )}
    </div>
  );
}

/* ────────────────────────────── Helpers ───────────────────────────────── */

function agoLabel(days: number): string {
  if (!Number.isFinite(days) || days < 0) return "—";
  if (days === 0) return "hoy";
  if (days === 1) return "ayer";
  return `hace ${days} días`;
}

function fmtDate(ts: number): string {
  if (!ts) return "—";
  return new Date(ts).toLocaleDateString("es-DO", { day: "2-digit", month: "short", year: "numeric" });
}
