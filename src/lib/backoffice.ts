/**
 * Tipos y helpers PUROS del backoffice. Sin React, seguro de importar desde
 * cualquier client component. Las escrituras van directo a Supabase con la
 * sesión del admin (RLS is_admin() lo permite).
 */

export type OrderStatus =
  | "pending"
  | "paid"
  | "preparing"
  | "shipped"
  | "delivered"
  | "cancelled"
  | "refunded";

export interface OrderItem {
  sku: string;
  name: string;
  qty: number;
  unit_price: number;
  compare_at_price?: number | null;
  image?: string;
}

export interface OrderAddress {
  label?: string;
  line1?: string;
  line2?: string;
  delivery_notes?: string;
}

export interface Order {
  id: string;
  created_at: string;
  status: OrderStatus;
  payment_method: "cash" | "transfer";
  payment_status: "pending" | "confirmed";
  customer_name: string | null;
  customer_phone: string | null;
  customer_email: string | null;
  address: OrderAddress | null;
  items: OrderItem[] | null;
  subtotal: number;
  discount_applied: number;
  delivery_fee: number;
  total: number;
  rider_name: string | null;
  assigned_at: string | null;
  notes: string | null;
  affiliate_code: string | null;
  is_first_order: boolean;
}

export interface ProfileRow {
  id: string;
  email: string | null;
  full_name: string | null;
  phone: string | null;
  role: string | null;
  loyalty_points: number | null;
  created_at: string;
}

export interface ProductStock {
  sku: string;
  name: string | null;
  stock: number | null;
  active: boolean | null;
  price: number | null;
  compare_at_price: number | null;
  synced_at: string | null;
}

/**
 * Reco semanal del bot de compras (WF05/06) espejada en Supabase (tabla
 * reorder_recommendations). COST-BLIND: sin costo/inversión. Alimenta la vista de
 * reabastecimiento del supervisor. Las columnas *supervisor* son anotaciones del
 * conteo físico / propuesta a Máximo (NO son señal de entrenamiento del bot).
 */
export interface ReorderReco {
  week_key: string;
  sku: string;
  stock: number | null;
  dias_restantes: number | null;
  cantidad_sugerida: number | null;
  urgencia: string | null;
  apagado: boolean | null;
  vendia_semana: number | null;
  vel_dia: number | null;
  colchon_dias: number | null;
  lead_dias: number | null;
  proveedor: string | null;
  physical_count: number | null;
  supervisor_qty: number | null;
  supervisor_note: string | null;
  reviewed_at: string | null;
}

export interface AffiliateRow {
  id: string;
  code: string;
  business_name: string | null;
  discount_type: string | null;
  discount_value: number | null;
  commission_pct: number | null;
  active: boolean | null;
}

export interface StoreConfig {
  delivery: { fee?: number; free_over?: number; currency?: string; zone?: string };
  transfer: { bank?: string; account?: string; account_type?: string; id_doc?: string; holder?: string };
  whatsapp: { number?: string; label?: string };
  order_notify: { email?: string };
}

/** Rider fijo para la ruta B2C de PedidosYa (aún deshabilitado en UI). */
export const PEDIDOSYA_RIDER = "PedidosYa (B2C)";

/** Metadatos por estado: etiqueta + clases de badge (light). */
export const STATUS_META: Record<
  OrderStatus,
  { label: string; badge: string; dot: string }
> = {
  pending:   { label: "Nueva",           badge: "bg-slate-100 text-slate-600 ring-slate-200",   dot: "bg-slate-400" },
  paid:      { label: "Pago confirmado", badge: "bg-violet-100 text-violet-700 ring-violet-200", dot: "bg-violet-500" },
  preparing: { label: "Preparando",      badge: "bg-amber-100 text-amber-700 ring-amber-200",    dot: "bg-amber-500" },
  shipped:   { label: "En ruta",         badge: "bg-blue-100 text-blue-700 ring-blue-200",       dot: "bg-blue-500" },
  delivered: { label: "Entregada",       badge: "bg-emerald-100 text-emerald-700 ring-emerald-200", dot: "bg-emerald-500" },
  cancelled: { label: "Cancelada",       badge: "bg-rose-100 text-rose-700 ring-rose-200",       dot: "bg-rose-400" },
  refunded:  { label: "Reembolsada",     badge: "bg-slate-100 text-slate-500 ring-slate-200",    dot: "bg-slate-400" },
};

/** Columnas del tablero kanban, en orden de flujo. */
export const ORDER_COLUMNS: OrderStatus[] = [
  "pending",
  "paid",
  "preparing",
  "shipped",
  "delivered",
  "cancelled",
];

/** Transición "siguiente paso". Sin entrada = estado terminal o especial (shipped se maneja aparte). */
export const ORDER_FLOW: Partial<Record<OrderStatus, { to: OrderStatus; label: string }>> = {
  pending: { to: "paid", label: "Marcar pago confirmado" },
  paid: { to: "preparing", label: "Empezar a preparar" },
  shipped: { to: "delivered", label: "Marcar entregada" },
};

export function itemQty(o: Order): number {
  return (o.items ?? []).reduce((a, i) => a + (Number(i.qty) || 0), 0);
}

export function relTime(iso: string | null): string {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "ahora";
  if (mins < 60) return `hace ${mins} min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `hace ${hrs} h`;
  const days = Math.floor(hrs / 24);
  return `hace ${days} d`;
}

export function shortId(id: string): string {
  return id.slice(0, 8).toUpperCase();
}

export function waLink(phone: string | null): string {
  const d = digitsOnly(phone);
  // Números dominicanos: 10 dígitos sin código de país → anteponer "1" para wa.me.
  return "https://wa.me/" + (d.length === 10 ? "1" + d : d);
}

export function digitsOnly(s: string | null): string {
  return (s ?? "").replace(/[^\d]/g, "");
}

/** Clave de cliente para cruzar profiles con orders (email primero, luego tel). */
export function customerKey(email: string | null, phone: string | null): string {
  const e = (email ?? "").trim().toLowerCase();
  if (e) return "e:" + e;
  const p = digitsOnly(phone);
  return p ? "p:" + p : "";
}

/** YYYY-MM-DD en zona local (para agrupar por día). */
export function dayKey(iso: string): string {
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function isToday(iso: string): boolean {
  return dayKey(iso) === dayKey(new Date().toISOString());
}

/** Órdenes que cuentan como ingreso real (no canceladas/reembolsadas). */
export function isRevenue(o: Order): boolean {
  return o.status !== "cancelled" && o.status !== "refunded";
}
