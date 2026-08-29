"use client";

import { useEffect, useMemo, useState } from "react";
import { Search, XCircle, PowerOff, TrendingDown, ClipboardCheck, Send, Check } from "lucide-react";
import { getSupabase } from "@/lib/supabase";
import { type ProductStock, type ReorderReco } from "@/lib/backoffice";
import { Card, Spinner, EmptyState, Button, Pill } from "@/components/backoffice/ui";

/** Webhook n8n que arma la propuesta (con costos, del lado servidor) y la postea al Discord de operaciones. */
const N8N_BASE = "https://curson8n-n8n.emmrbs.easypanel.host";
const IS_MASKOTAS = (process.env.NEXT_PUBLIC_BRAND || "VAPE").toUpperCase().includes("MASKOTAS");
const PROPUESTA_URL = `${N8N_BASE}/webhook/propuesta-maximo-${IS_MASKOTAS ? "m2g" : "v2g"}`;
/** Webhook que emite la tarjeta de ajuste de stock a Discord cuando el conteo difiere del sistema. */
const CONTEO_URL = `${N8N_BASE}/webhook/conteo-ajuste-${IS_MASKOTAS ? "m2g" : "v2g"}`;

/** Fila del inventario = stock vivo (product_stock) + reco del bot (si existe). Cost-blind. */
type Row = ProductStock & { reco?: ReorderReco };

/** vende ~/sem: apagados traen vendia_semana; el resto se deriva de vel_dia. */
function ventaSemana(r: ReorderReco | undefined): number | null {
  if (!r) return null;
  if (r.vendia_semana != null) return r.vendia_semana;
  if (r.vel_dia != null) return Math.round(r.vel_dia * 7 * 10) / 10;
  return null;
}

/** Cantidad que se propone comprar: lo que ajustó el supervisor, o lo que sugiere el bot. */
function propuesta(r: ReorderReco | undefined): number | null {
  if (!r) return null;
  return r.supervisor_qty ?? r.cantidad_sugerida ?? null;
}

export default function InventarioPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [week, setWeek] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    const sb = getSupabase();
    if (!sb) {
      setLoading(false);
      return;
    }
    Promise.all([
      sb.from("product_stock").select("sku,name,stock,active,price,compare_at_price,synced_at").limit(3000),
      sb.from("reorder_recommendations").select("*").order("week_key", { ascending: false }).limit(4000),
    ]).then(([ps, rr]) => {
      const stock = (ps.data as ProductStock[]) ?? [];
      const recos = (rr.data as ReorderReco[]) ?? [];
      // Mapa sku -> reco de la semana MÁS reciente (recos vienen ordenados week_key desc).
      const recoMap = new Map<string, ReorderReco>();
      let latestWeek: string | null = null;
      for (const rc of recos) {
        if (!latestWeek) latestWeek = rc.week_key;
        if (!recoMap.has(rc.sku)) recoMap.set(rc.sku, rc);
      }
      setWeek(latestWeek);
      setRows(stock.map((s) => ({ ...s, reco: recoMap.get(s.sku) })).sort((a, b) => (a.name ?? "").localeCompare(b.name ?? "")));
      setLoading(false);
    });
  }, []);

  /** Clasificación en secciones (prioridad: agotados > se apagaron c/stock > próximos). */
  const groups = useMemo(() => {
    const agotados: Row[] = [];
    const apagados: Row[] = [];
    const proximos: Row[] = [];
    for (const r of rows) {
      const stock = r.stock ?? 0;
      const rc = r.reco;
      if (stock <= 0 && r.active) agotados.push(r);
      else if (rc?.apagado && stock > 0) apagados.push(r);
      else if (rc && !rc.apagado && stock > 0 && rc.urgencia) proximos.push(r);
    }
    // próximos: ordenar por días de cobertura ascendente (los más urgentes arriba).
    proximos.sort((a, b) => (a.reco?.dias_restantes ?? 9999) - (b.reco?.dias_restantes ?? 9999));
    apagados.sort((a, b) => (ventaSemana(b.reco) ?? 0) - (ventaSemana(a.reco) ?? 0));
    return { agotados, apagados, proximos };
  }, [rows]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => (r.name ?? "").toLowerCase().includes(q) || (r.sku ?? "").toLowerCase().includes(q));
  }, [rows, search]);

  async function saveReview(sku: string, physical: number | null, qty: number | null, note: string) {
    const sb = getSupabase();
    if (!sb) return;
    const sysStock = rows.find((r) => r.sku === sku)?.stock ?? null;
    const { error } = await sb.rpc("sb_review_reorder", {
      p_sku: sku,
      p_physical_count: physical,
      p_supervisor_qty: qty,
      p_note: note || null,
    });
    if (error) {
      alert("No se pudo guardar: " + error.message);
      return;
    }
    // Reflejar localmente sin recargar.
    setRows((prev) =>
      prev.map((r) =>
        r.sku === sku
          ? {
              ...r,
              reco: {
                ...(r.reco ?? ({ week_key: week ?? "", sku } as ReorderReco)),
                physical_count: physical,
                supervisor_qty: qty,
                supervisor_note: note || null,
                reviewed_at: new Date().toISOString(),
              },
            }
          : r
      )
    );
    // Si el conteo físico DIFIERE del sistema → dispara la tarjeta de ajuste a Discord
    // (Luis aprueba con 1 clic y corrige el Master). Fire-and-forget.
    if (physical != null && sysStock != null && physical !== sysStock) {
      fetch(`${CONTEO_URL}?sku=${encodeURIComponent(sku)}`).catch(() => {});
    }
  }

  async function sendToMaximo() {
    setSending(true);
    try {
      // El servidor (n8n) arma la propuesta con costos y la postea al canal de operaciones.
      await fetch(PROPUESTA_URL, { method: "POST" });
      setSent(true);
      setTimeout(() => setSent(false), 5000);
    } catch {
      alert("No se pudo enviar la propuesta. Revisa la conexión e intenta de nuevo.");
    }
    setSending(false);
  }

  if (loading) return <Spinner label="Cargando inventario…" />;

  const noReco = rows.every((r) => !r.reco);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-slate-800">Reabastecimiento</h1>
          <p className="text-xs text-slate-500">
            Productos en 0 y próximos a agotarse, con la recomendación del bot.{" "}
            {week ? <span className="font-medium text-slate-600">Reco: {week}</span> : "Sin reco del bot esta semana."}
          </p>
        </div>
        <Button variant="secondary" size="sm" onClick={sendToMaximo} disabled={sending}>
          {sent ? <Check size={14} /> : <Send size={14} />} {sent ? "Enviado a Máximo" : sending ? "Enviando…" : "Enviar propuesta a Máximo"}
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Metric label="Agotados" value={groups.agotados.length} icon={<XCircle size={16} />} tone="rose" />
        <Metric label="Se apagaron" value={groups.apagados.length} icon={<PowerOff size={16} />} tone="amber" />
        <Metric label="Próximos a agotarse" value={groups.proximos.length} icon={<TrendingDown size={16} />} tone="slate" />
      </div>

      {noReco && (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-700">
          Aún no llega la recomendación del bot a esta vista (corre los lunes 7 AM). Mientras tanto se muestran los
          agotados por stock; las secciones "próximos a agotarse" y "se apagaron" se llenan con la reco del bot.
        </p>
      )}

      <Section title="🔴 Agotados" hint="Stock en 0 y activos en la tienda. Pedir hoy." rows={groups.agotados} onSave={saveReview} />
      <Section title="📴 Se apagaron (con stock)" hint="Vendían y pararon pero tienen stock — revisa si están apagados en PedidosYa." rows={groups.apagados} onSave={saveReview} />
      <Section title="🟡 Próximos a agotarse" hint="El bot recomienda reponer al nivel objetivo de la semana." rows={groups.proximos} onSave={saveReview} />

      {/* Buscador sobre todo el catálogo (fallback / consulta puntual). */}
      <Card className="overflow-hidden">
        <div className="flex items-center gap-3 border-b border-slate-100 px-4 py-3">
          <div className="relative flex-1">
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar cualquier producto por nombre o SKU…"
              className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm text-slate-800 shadow-sm outline-none"
            />
          </div>
          <span className="text-xs text-slate-400">{filtered.length} productos</span>
        </div>
        {search.trim() ? <RecoTable rows={filtered} onSave={saveReview} /> : (
          <p className="px-4 py-4 text-xs text-slate-400">Escribe para buscar en todo el catálogo.</p>
        )}
      </Card>

      <p className="rounded-xl border border-slate-200 bg-slate-50/70 px-4 py-3 text-xs text-slate-500">
        Vista de solo lectura del stock (se edita en el sheet Master y se sincroniza). El{" "}
        <span className="font-semibold text-slate-700">conteo físico</span> y la{" "}
        <span className="font-semibold text-slate-700">cantidad propuesta</span> las guardas tú aquí para armar la
        compra con Máximo.
      </p>
    </div>
  );
}

/* ---------- Secciones ---------- */

function Section({ title, hint, rows, onSave }: { title: string; hint: string; rows: Row[]; onSave: SaveFn }) {
  if (!rows.length) return null;
  return (
    <Card className="overflow-hidden">
      <div className="border-b border-slate-100 px-4 py-3">
        <h2 className="text-[15px] font-semibold text-slate-800">
          {title} <span className="text-slate-400">· {rows.length}</span>
        </h2>
        <p className="mt-0.5 text-xs text-slate-500">{hint}</p>
      </div>
      <RecoTable rows={rows} onSave={onSave} />
    </Card>
  );
}

type SaveFn = (sku: string, physical: number | null, qty: number | null, note: string) => Promise<void>;

function RecoTable({ rows, onSave }: { rows: Row[]; onSave: SaveFn }) {
  const [open, setOpen] = useState<string | null>(null);
  if (!rows.length) return <EmptyState title="Nada aquí" hint="Sin productos en esta sección." />;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50/70 text-left text-[11px] uppercase tracking-wide text-slate-400">
            <th className="px-4 py-2.5 font-semibold">Producto</th>
            <th className="px-3 py-2.5 text-center font-semibold">Stock</th>
            <th className="px-3 py-2.5 text-center font-semibold">~Días</th>
            <th className="px-3 py-2.5 text-center font-semibold">Vende/sem</th>
            <th className="px-3 py-2.5 text-center font-semibold">Urgencia</th>
            <th className="px-3 py-2.5 text-center font-semibold">Sugerido</th>
            <th className="px-3 py-2.5 text-center font-semibold"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((r) => {
            const rc = r.reco;
            const vs = ventaSemana(rc);
            const reviewed = rc?.reviewed_at != null;
            return (
              <FragmentRow
                key={r.sku}
                r={r}
                rc={rc}
                vs={vs}
                reviewed={reviewed}
                isOpen={open === r.sku}
                onToggle={() => setOpen(open === r.sku ? null : r.sku)}
                onSave={onSave}
              />
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function FragmentRow({
  r,
  rc,
  vs,
  reviewed,
  isOpen,
  onToggle,
  onSave,
}: {
  r: Row;
  rc: ReorderReco | undefined;
  vs: number | null;
  reviewed: boolean;
  isOpen: boolean;
  onToggle: () => void;
  onSave: SaveFn;
}) {
  const stock = r.stock ?? 0;
  const sugerido = propuesta(rc);
  return (
    <>
      <tr className="transition hover:bg-slate-50/60">
        <td className="px-4 py-2.5">
          <div className="font-medium text-slate-800">
            {r.name || "—"}
            {rc?.apagado && <span className="ml-1.5 align-middle text-xs">📴</span>}
          </div>
          <div className="font-mono text-[10px] text-slate-400">
            {r.sku}
            {rc?.proveedor ? ` · ${rc.proveedor}` : ""}
          </div>
        </td>
        <td className="px-3 py-2.5 text-center">
          <StockTag stock={stock} />
        </td>
        <td className="px-3 py-2.5 text-center tabular-nums text-slate-600">{rc?.dias_restantes != null ? `${rc.dias_restantes}d` : "—"}</td>
        <td className="px-3 py-2.5 text-center tabular-nums text-slate-600">{vs != null ? vs : "—"}</td>
        <td className="px-3 py-2.5 text-center">{rc?.urgencia ? <UrgPill u={rc.urgencia} /> : <span className="text-slate-300">—</span>}</td>
        <td className="px-3 py-2.5 text-center">
          {sugerido != null ? (
            <span className="font-semibold tabular-nums text-slate-900">
              {sugerido}
              {rc?.supervisor_qty != null && <span className="ml-1 text-[10px] font-normal text-emerald-600">✎</span>}
            </span>
          ) : (
            <span className="text-slate-300">—</span>
          )}
        </td>
        <td className="px-3 py-2.5 text-center">
          <button
            onClick={onToggle}
            title="Conteo físico / propuesta"
            className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium ring-1 ring-inset transition ${
              reviewed ? "bg-emerald-50 text-emerald-700 ring-emerald-200" : "bg-white text-slate-500 ring-slate-200 hover:bg-slate-50"
            }`}
          >
            <ClipboardCheck size={13} /> {reviewed ? "Revisado" : "Revisar"}
          </button>
        </td>
      </tr>
      {isOpen && <ReviewRow r={r} rc={rc} onSave={onSave} onDone={onToggle} />}
    </>
  );
}

function ReviewRow({ r, rc, onSave, onDone }: { r: Row; rc: ReorderReco | undefined; onSave: SaveFn; onDone: () => void }) {
  const [physical, setPhysical] = useState<string>(rc?.physical_count != null ? String(rc.physical_count) : "");
  const [qty, setQty] = useState<string>(
    rc?.supervisor_qty != null ? String(rc.supervisor_qty) : rc?.cantidad_sugerida != null ? String(rc.cantidad_sugerida) : ""
  );
  const [note, setNote] = useState<string>(rc?.supervisor_note ?? "");
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    await onSave(
      r.sku,
      physical.trim() === "" ? null : Math.max(0, Math.floor(Number(physical) || 0)),
      qty.trim() === "" ? null : Math.max(0, Math.floor(Number(qty) || 0)),
      note.trim()
    );
    setSaving(false);
    onDone();
  }

  return (
    <tr className="bg-slate-50/70">
      <td colSpan={7} className="px-4 py-3">
        <div className="flex flex-wrap items-end gap-3">
          <MiniField label="Conteo físico">
            <input value={physical} onChange={(e) => setPhysical(e.target.value)} inputMode="numeric" placeholder={String(r.stock ?? 0)} className="w-20 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm tabular-nums outline-none" />
          </MiniField>
          <MiniField label="Cantidad a pedir">
            <input value={qty} onChange={(e) => setQty(e.target.value)} inputMode="numeric" placeholder={rc?.cantidad_sugerida != null ? String(rc.cantidad_sugerida) : "—"} className="w-20 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm tabular-nums outline-none" />
          </MiniField>
          <MiniField label="Nota para Máximo">
            <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="ej: conté físico, faltan 3 · casi no se mueve · clientes preguntando" className="w-72 max-w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm outline-none" />
          </MiniField>
          <Button size="sm" onClick={save} disabled={saving}>
            {saving ? "Guardando…" : "Guardar"}
          </Button>
        </div>
        {rc?.cantidad_sugerida != null && (
          <p className="mt-2 text-[11px] text-slate-400">
            El bot sugiere <span className="font-medium text-slate-600">{rc.cantidad_sugerida}</span>
            {rc.lead_dias != null ? ` · lead ${rc.lead_dias}d` : ""}
            {rc.colchon_dias != null ? ` · colchón ${rc.colchon_dias}d` : ""}. Tu cantidad manda en la propuesta.
          </p>
        )}
      </td>
    </tr>
  );
}

/* ---------- Primitivas ---------- */

function MiniField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-slate-400">{label}</span>
      {children}
    </label>
  );
}

function StockTag({ stock }: { stock: number }) {
  if (stock <= 0) return <span className="rounded-full bg-rose-100 px-2 py-0.5 text-xs font-semibold text-rose-700 ring-1 ring-inset ring-rose-200">0</span>;
  if (stock <= 5) return <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700 ring-1 ring-inset ring-amber-200 tabular-nums">{stock}</span>;
  return <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-100 tabular-nums">{stock}</span>;
}

function UrgPill({ u }: { u: string }) {
  const tone: Record<string, "rose" | "amber" | "slate"> = {
    URGENTE: "rose",
    REPONER: "amber",
    "ESTA SEMANA": "amber",
    SEMANAL: "slate",
  };
  return <Pill tone={tone[u] ?? "slate"}>{u}</Pill>;
}

function Metric({ label, value, icon, tone = "slate" }: { label: string; value: number; icon: React.ReactNode; tone?: "slate" | "rose" | "amber" }) {
  const chip: Record<string, string> = {
    slate: "bg-slate-100 text-slate-500",
    rose: "bg-rose-100 text-rose-600",
    amber: "bg-amber-100 text-amber-600",
  };
  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-medium uppercase tracking-wide text-slate-400">{label}</span>
        <span className={`grid h-6 w-6 place-items-center rounded-lg ${chip[tone]}`}>{icon}</span>
      </div>
      <p className="mt-2 text-2xl font-semibold tabular-nums text-slate-900">{value}</p>
    </div>
  );
}
