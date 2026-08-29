"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import {
  Search,
  RefreshCw,
  X,
  Phone,
  MapPin,
  Bike,
  Package,
  CheckCircle2,
  Ban,
} from "lucide-react";
import { getSupabase } from "@/lib/supabase";
import { cdnImage, formatDOP } from "@/data/catalog-meta";
import {
  type Order,
  type OrderStatus,
  ORDER_COLUMNS,
  ORDER_FLOW,
  STATUS_META,
  PEDIDOSYA_RIDER,
  itemQty,
  relTime,
  shortId,
  waLink,
  digitsOnly,
} from "@/lib/backoffice";
import { Button, PayBadge, StatusBadge, Spinner } from "@/components/backoffice/ui";

type PayFilter = "all" | "cash" | "transfer";

/** Opción "Otro…" del selector de rider (nombre libre). */
const OTHER_RIDER = "__other__";

export default function OrdenesPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [riders, setRiders] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [payFilter, setPayFilter] = useState<PayFilter>("all");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [lastLoaded, setLastLoaded] = useState<Date | null>(null);

  const load = useCallback(async () => {
    const sb = getSupabase();
    if (!sb) {
      setLoading(false);
      return;
    }
    setRefreshing(true);
    const { data } = await sb.from("orders").select("*").order("created_at", { ascending: false }).limit(400);
    setOrders((data as Order[]) ?? []);
    setLastLoaded(new Date());
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Riders configurables (store_config.riders) para el selector de despacho.
  useEffect(() => {
    const sb = getSupabase();
    if (!sb) return;
    let active = true;
    sb.from("store_config")
      .select("value")
      .eq("key", "riders")
      .maybeSingle()
      .then(({ data }) => {
        if (!active) return;
        const v = (data as { value?: unknown } | null)?.value;
        if (Array.isArray(v)) setRiders(v.filter((x): x is string => typeof x === "string"));
      });
    return () => {
      active = false;
    };
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const qDigits = digitsOnly(search);
    return orders.filter((o) => {
      if (payFilter !== "all" && o.payment_method !== payFilter) return false;
      if (!q) return true;
      const nameHit = (o.customer_name ?? "").toLowerCase().includes(q);
      const phoneHit = qDigits.length >= 3 && digitsOnly(o.customer_phone).includes(qDigits);
      return nameHit || phoneHit;
    });
  }, [orders, search, payFilter]);

  const selected = orders.find((o) => o.id === selectedId) ?? null;

  async function runUpdate(id: string, patch: Record<string, unknown>) {
    const sb = getSupabase();
    if (!sb) return;
    setBusy(true);
    setErr(null);
    const { error } = await sb.from("orders").update(patch).eq("id", id);
    if (error) {
      setErr(error.message);
      setBusy(false);
      return;
    }

    // Al Entregar (registra Ventas-Raw) o Cancelar (restaura stock) disparamos el
    // hook n8n. Best-effort: el cambio de estado ya quedó hecho; si el hook falla
    // no bloqueamos ni mostramos error (se reprocesa aparte).
    const newStatus = patch.status;
    if (newStatus === "delivered" || newStatus === "cancelled") {
      const { data: sess } = await sb.auth.getSession();
      const token = sess.session?.access_token;
      fetch("/.netlify/functions/order-action", {
        method: "POST",
        headers: { "content-type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ order_id: id, action: newStatus }),
      }).catch(() => {});
    }

    await load();
    setBusy(false);
  }

  if (loading) return <Spinner label="Cargando órdenes…" />;

  return (
    <div className="space-y-5">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[220px] flex-1 sm:max-w-xs">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre o teléfono…"
            className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm text-slate-800 shadow-sm outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-500/30"
          />
        </div>

        <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white p-0.5 shadow-sm">
          {([["all", "Todos"], ["cash", "Efectivo"], ["transfer", "Transferencia"]] as [PayFilter, string][]).map(([id, label]) => (
            <button
              key={id}
              onClick={() => setPayFilter(id)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${
                payFilter === id ? "bg-violet-600 text-white shadow-sm" : "text-slate-500 hover:text-slate-800"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="ml-auto flex items-center gap-3">
          <span className="text-xs text-slate-400">{filtered.length} órdenes</span>
          {lastLoaded && (
            <span className="hidden text-xs text-slate-400 sm:inline" title="Esta vista no es en vivo: actualiza para ver órdenes nuevas">
              Actualizado {lastLoaded.toLocaleTimeString("es-DO", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
            </span>
          )}
          <Button variant="secondary" size="sm" onClick={load} disabled={refreshing}>
            <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
            {refreshing ? "…" : "Actualizar"}
          </Button>
        </div>
      </div>

      {/* Kanban */}
      <div className="flex gap-4 overflow-x-auto pb-4">
        {ORDER_COLUMNS.map((status) => {
          const col = filtered.filter((o) => o.status === status);
          const meta = STATUS_META[status];
          return (
            <section key={status} className="flex w-[280px] shrink-0 flex-col">
              <div className="mb-3 flex items-center gap-2 px-1">
                <span className={`h-2 w-2 rounded-full ${meta.dot}`} />
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-600">{meta.label}</span>
                <span className="ml-auto rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-500">{col.length}</span>
              </div>
              <div className="flex-1 space-y-2.5 rounded-2xl bg-slate-100/50 p-2">
                {col.length === 0 ? (
                  <p className="px-2 py-6 text-center text-[11px] text-slate-400">Sin órdenes</p>
                ) : (
                  col.map((o) => <OrderCard key={o.id} order={o} onClick={() => setSelectedId(o.id)} />)
                )}
              </div>
            </section>
          );
        })}
      </div>

      {selected && (
        <OrderDrawer
          key={selected.id}
          order={selected}
          riders={riders}
          busy={busy}
          err={err}
          onClose={() => {
            setSelectedId(null);
            setErr(null);
          }}
          onUpdate={(patch) => runUpdate(selected.id, patch)}
        />
      )}
    </div>
  );
}

function OrderCard({ order, onClick }: { order: Order; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full rounded-xl border border-slate-200/80 bg-white p-3 text-left shadow-sm transition hover:border-violet-300 hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-2">
        <span className="truncate text-sm font-semibold text-slate-800">{order.customer_name || "Sin nombre"}</span>
        <span className="shrink-0 text-sm font-semibold text-violet-700">{formatDOP(order.total)}</span>
      </div>
      <p className="mt-0.5 text-[11px] text-slate-400">
        #{shortId(order.id)} · {order.customer_phone || "sin teléfono"}
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <PayBadge order={order} />
        <span className="text-[11px] text-slate-400">{itemQty(order)} art.</span>
        {order.is_first_order && (
          <span className="rounded-full bg-violet-50 px-1.5 py-0.5 text-[10px] font-medium text-violet-600 ring-1 ring-inset ring-violet-100">1ª compra</span>
        )}
      </div>
      <div className="mt-1.5 flex items-center justify-between text-[11px] text-slate-400">
        <span>{relTime(order.created_at)}</span>
        {order.rider_name && (
          <span className="flex items-center gap-1 truncate">
            <Bike size={11} /> {order.rider_name}
          </span>
        )}
      </div>
    </button>
  );
}

/* ---------- Drawer de detalle ---------- */

function OrderDrawer({
  order,
  riders,
  busy,
  err,
  onClose,
  onUpdate,
}: {
  order: Order;
  riders: string[];
  busy: boolean;
  err: string | null;
  onClose: () => void;
  onUpdate: (patch: Record<string, unknown>) => void;
}) {
  // Si la orden ya trae rider: pre-selecciona el de la lista, o "Otro…" si es libre.
  const preset = order.rider_name ?? "";
  const [riderSelect, setRiderSelect] = useState<string>(preset ? (riders.includes(preset) ? preset : OTHER_RIDER) : "");
  const [riderCustom, setRiderCustom] = useState<string>(preset && !riders.includes(preset) ? preset : "");
  const chosenRider = (riderSelect === OTHER_RIDER ? riderCustom : riderSelect).trim();

  const flow = ORDER_FLOW[order.status];
  const canCancel = !(["cancelled", "delivered", "refunded"] as OrderStatus[]).includes(order.status);
  const needsPayConfirm = order.payment_method === "transfer" && order.payment_status === "pending";

  function confirmPayment() {
    onUpdate({ payment_status: "confirmed", status: "paid" });
  }

  function dispatchOwnRider() {
    onUpdate({
      status: "shipped",
      rider_name: chosenRider || null,
      assigned_at: new Date().toISOString(),
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button aria-label="Cerrar" className="absolute inset-0 bg-slate-900/40 backdrop-blur-[1px]" onClick={onClose} />
      <div className="relative flex h-full w-full max-w-md flex-col bg-[#f8f8fc] shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 bg-white px-5 py-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-[11px] font-medium text-slate-400">Orden #{shortId(order.id)}</p>
              <StatusBadge status={order.status} />
            </div>
            <p className="mt-0.5 truncate text-lg font-semibold text-slate-900">{order.customer_name || "Sin nombre"}</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="Cerrar">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-5">
          {/* Items */}
          <div className="space-y-2">
            {(order.items ?? []).map((it, idx) => (
              <div key={`${it.sku}-${idx}`} className="flex items-center gap-3 rounded-xl border border-slate-200/80 bg-white p-2.5">
                <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-slate-50">
                  {it.image ? (
                    <Image src={cdnImage(it.image, 72)!} alt={it.name} fill className="object-contain p-1" sizes="56px" />
                  ) : (
                    <div className="h-full w-full bg-slate-100" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-2 text-sm leading-snug text-slate-800">{it.name}</p>
                  <p className="mt-0.5 text-xs text-slate-400">
                    {it.qty}× {formatDOP(it.unit_price)}
                  </p>
                </div>
                <span className="shrink-0 text-sm font-medium text-slate-800">{formatDOP(it.unit_price * it.qty)}</span>
              </div>
            ))}
          </div>

          {/* Totales */}
          <div className="rounded-xl border border-slate-200/80 bg-white p-4">
            <Row label="Subtotal" value={formatDOP(order.subtotal)} />
            {order.discount_applied > 0 && (
              <Row label={`Descuento${order.affiliate_code ? ` (${order.affiliate_code})` : ""}`} value={"− " + formatDOP(order.discount_applied)} />
            )}
            <Row label="Delivery" value={order.delivery_fee === 0 ? "Gratis" : formatDOP(order.delivery_fee)} />
            <div className="mt-2 flex items-center justify-between border-t border-slate-100 pt-2">
              <span className="text-sm font-semibold text-slate-800">Total</span>
              <span className="text-base font-bold text-violet-700">{formatDOP(order.total)}</span>
            </div>
          </div>

          {/* Cliente */}
          <div className="rounded-xl border border-slate-200/80 bg-white p-4">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Cliente</p>
            <div className="flex items-center justify-between gap-3 py-1">
              <span className="text-sm text-slate-500">Teléfono</span>
              {order.customer_phone ? (
                <a href={waLink(order.customer_phone)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm font-medium text-violet-600 hover:text-violet-700">
                  <Phone size={13} /> {order.customer_phone}
                </a>
              ) : (
                <span className="text-sm text-slate-800">—</span>
              )}
            </div>
            {order.customer_email && <Row label="Correo" value={order.customer_email} />}
            {order.address && (
              <div className="mt-2 flex gap-2 border-t border-slate-100 pt-2 text-sm">
                <MapPin size={14} className="mt-0.5 shrink-0 text-slate-400" />
                <div className="min-w-0">
                  <p className="text-slate-800">{order.address.line1 || "—"}</p>
                  {order.address.line2 && <p className="text-xs text-slate-500">{order.address.line2}</p>}
                  {order.address.delivery_notes && <p className="mt-0.5 text-xs text-slate-500">{order.address.delivery_notes}</p>}
                  {order.address.label && <p className="mt-0.5 text-[11px] text-slate-400">{order.address.label}</p>}
                </div>
              </div>
            )}
          </div>

          {order.notes && (
            <p className="rounded-xl border border-slate-200/80 bg-white p-3 text-sm text-slate-600">{order.notes}</p>
          )}
        </div>

        {/* Acciones (fijas abajo) */}
        <div className="space-y-3 border-t border-slate-200 bg-white px-5 py-4">
          {needsPayConfirm && (
            <Button variant="success" onClick={confirmPayment} disabled={busy} className="w-full">
              <CheckCircle2 size={16} /> Confirmar pago (transferencia)
            </Button>
          )}

          {/* Avance normal del flujo (pending→paid, paid→preparing, shipped→delivered) */}
          {flow && (
            <Button variant="primary" onClick={() => onUpdate({ status: flow.to })} disabled={busy} className="w-full">
              {flow.label}
            </Button>
          )}

          {/* Preparando → EN RUTA: dos vías de despacho */}
          {order.status === "preparing" && (
            <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Despachar a ruta</p>
              <div className="mb-2">
                <span className="mb-1 block text-[11px] font-medium text-slate-500">Rider asignado</span>
                <select
                  value={riderSelect}
                  onChange={(e) => setRiderSelect(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-500/30"
                >
                  <option value="">Selecciona un rider…</option>
                  {riders.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                  <option value={OTHER_RIDER}>➕ Otro…</option>
                </select>
                {riderSelect === OTHER_RIDER && (
                  <input
                    value={riderCustom}
                    onChange={(e) => setRiderCustom(e.target.value)}
                    placeholder="Nombre del rider"
                    autoFocus
                    className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-500/30"
                  />
                )}
              </div>
              <Button variant="primary" onClick={dispatchOwnRider} disabled={busy} className="mb-2 w-full">
                <Bike size={16} /> Despachar con rider propio
              </Button>
              <div className="relative">
                <Button
                  variant="secondary"
                  disabled
                  title="Integración con PedidosYa B2C — próximamente"
                  className="w-full opacity-60"
                >
                  <Package size={16} /> Pedir PedidosYa (B2C)
                </Button>
                <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                  Próximamente
                </span>
              </div>
              <p className="mt-2 text-[10px] leading-relaxed text-slate-400">
                Al habilitarse, PedidosYa guardará el rider como “{PEDIDOSYA_RIDER}”.
              </p>
            </div>
          )}

          {canCancel && (
            <Button
              variant="danger"
              disabled={busy}
              onClick={() => {
                if (confirm("¿Cancelar esta orden? Se restaurará el stock en el sheet.")) onUpdate({ status: "cancelled" });
              }}
              className="w-full"
            >
              <Ban size={16} /> Cancelar orden
            </Button>
          )}

          <p className="text-[10px] leading-relaxed text-slate-400">
            Nota: al marcar “Entregada” se registra la venta en Ventas-Raw; al “Cancelar” se restaura el stock.
          </p>
          {err && <p className="text-sm text-rose-600">{err}</p>}
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 py-0.5 text-sm">
      <span className="text-slate-500">{label}</span>
      <span className="break-words text-right font-medium text-slate-800">{value}</span>
    </div>
  );
}
