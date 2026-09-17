// POST /.netlify/functions/pos-order
// Venta de MOSTRADOR (canal TIENDA). Solo personal autenticado del backoffice
// (operator / supervisor / staff / admin) — se verifica el JWT + el rol en profiles.
// Recalcula precios/stock con el motor único recomputeCart() (NUNCA confía en montos
// del cliente). La orden nace ENTREGADA y con pago CONFIRMADO (mostrador = venta +
// entrega en el acto), sin delivery. Dispara el mismo order-bridge que la web
// (WF31 descuenta inventario del Master) + el status-action delivered (WF32 escribe
// Ventas-Raw). Converge/reemplaza a WF24 "Registrar Venta Local" agregando identidad
// de cliente y aterrizando la venta en el dashboard/CRM.
//
// ⚠️ n8n (paso conjunto antes del go-live): WF31 y WF32 deben leer `channel` del
//    pedido y, para 'TIENDA', (a) NO aplicar lógica de delivery, (b) escribir
//    Ventas-Raw con Vendor='TIENDA'. Decomisionar WF24 para evitar doble conteo.

import { admin, json, recomputeCart } from "./_lib.mjs";

const ALLOWED_ROLES = new Set(["operator", "supervisor", "staff", "admin"]);
// tarjeta -> 'azul' (valor ya aceptado por el check vivo; evita ALTER del constraint).
const PAY_MAP = { cash: "cash", transfer: "transfer", card: "azul" };

// n8n cierra los webhooks de órdenes con candado de cabecera (cacare `scripts/n8n/candado-ordenes.mjs`):
// sin `X-N8N-Ordenes` el webhook contesta 403 y el aviso a n8n falla callado (es best-effort).
const HOOK_HEADERS = {
  "content-type": "application/json",
  ...(process.env.N8N_ORDERS_HOOK_SECRET ? { "X-N8N-Ordenes": process.env.N8N_ORDERS_HOOK_SECRET } : {}),
};

export default async function handler(req) {
  if (req.method !== "POST") return json({ error: "method" }, 405);

  // --- Auth: JWT de Supabase + rol de backoffice ---
  const authz = req.headers.get("authorization") ?? "";
  const token = authz.startsWith("Bearer ") ? authz.slice(7).trim() : "";
  if (!token) return json({ error: "no autorizado" }, 401);

  const sb = admin();
  const { data: { user } = {} } = await sb.auth.getUser(token);
  if (!user) return json({ error: "no autorizado" }, 401);

  const { data: profile } = await sb.from("profiles").select("role").eq("id", user.id).single();
  const role = profile?.role;
  if (!ALLOWED_ROLES.has(role)) return json({ error: "prohibido" }, 403);

  // --- Payload ---
  let payload;
  try {
    payload = await req.json();
  } catch {
    return json({ error: "json inválido" }, 400);
  }

  const { items, customer, payment_method } = payload ?? {};
  const method = PAY_MAP[payment_method] ?? "cash";
  // Canal: mostrador (TIENDA, venta+entrega en el acto) o WhatsApp (pedido a ENTREGAR,
  // nace pendiente/sin cobrar). Cualquier otro valor cae a TIENDA por seguridad.
  const isWa = String(payload?.channel ?? "").toUpperCase() === "WHATSAPP";
  const channel = isWa ? "WHATSAPP" : "TIENDA";
  const name = String(customer?.name ?? "").trim();
  if (!name) return json({ error: "falta el nombre del cliente" }, 400);
  const phone = customer?.phone ? String(customer.phone).trim() : null;
  const email = customer?.email ? String(customer.email).trim() : null;

  // --- Motor de precios único (sin cupón, sin delivery: mostrador) ---
  const calc = await recomputeCart(sb, { items, coupon: null, uid: user.id, address: null, applyDelivery: false });
  if (!calc.ok) return json({ error: calc.error }, calc.status);

  // --- Insert: nace ENTREGADA + pago CONFIRMADO, canal TIENDA ---
  const { data, error } = await sb.from("orders").insert({
    user_id: null,               // el cliente de mostrador no tiene cuenta; identidad = nombre/tel
    status: isWa ? "pending" : "delivered",
    payment_method: method,
    payment_status: isWa ? "pending" : "confirmed",
    customer_name: name,
    customer_phone: phone,
    customer_email: email,
    address: null,
    items: calc.lineItems,
    subtotal: calc.subtotal,
    discount_applied: 0,
    delivery_fee: 0,
    delivery_zone: isWa ? null : "MOSTRADOR",
    total: calc.total,
    affiliate_code: null,
    is_first_order: false,
    commission_owed: 0,
    channel,
    brand: "VAPE",
    notes: isWa ? `WhatsApp · ${role} · coordinar entrega con el cliente` : `POS · ${role} · ${user.email ?? ""}`.trim(),
  }).select("id,total,items,status,created_at,payment_method").single();

  if (error) { console.error("pos-order insert failed", error); return json({ error: "No pudimos registrar la venta. Intenta de nuevo." }, 500); }

  // --- Fan-out a n8n (best-effort; no romper la venta si un hook falla). ---
  const bridge = process.env.ORDER_WEBHOOK_URL;         // WF31 → descuenta inventario del Master
  const statusHook = process.env.ORDER_STATUS_WEBHOOK_URL; // WF32 → Ventas-Raw (delivered)
  await Promise.allSettled([
    bridge
      ? fetch(bridge, { method: "POST", headers: HOOK_HEADERS, body: JSON.stringify({ order_id: data.id, channel }) })
      : Promise.resolve(),
    // La acción "delivered" (WF32 → Ventas-Raw) es SOLO para mostrador. WhatsApp nace
    // pendiente: se marca entregado luego desde Órdenes → ahí WF32 escribe Ventas-Raw.
    !isWa && statusHook
      ? fetch(statusHook, { method: "POST", headers: HOOK_HEADERS, body: JSON.stringify({ order_id: data.id, action: "delivered", channel }) })
      : Promise.resolve(),
  ]);

  // Recibo WHITELISTEADO (nunca spread de la fila insertada → no filtra commission_owed, etc.).
  return json({
    ok: true,
    receipt: {
      id: data.id,
      total: data.total,
      items: data.items,
      status: data.status,
      payment_method: data.payment_method,
      created_at: data.created_at,
    },
  });
}
