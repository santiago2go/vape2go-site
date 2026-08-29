// POST /.netlify/functions/create-order
// Crea una orden directa WEB de forma SEGURA. El cliente manda items (sku + qty) +
// datos de entrega + método de pago; el servidor recalcula TODO con el motor único
// recomputeCart() (precios/stock/cupón/delivery desde product_stock = espejo del
// sheet Vape 2 Go Master). El cliente NUNCA fija precios, totales ni comisiones.

import { admin, verifyTurnstile, json, recomputeCart } from "./_lib.mjs";

export default async function handler(req) {
  if (req.method !== "POST") return json({ error: "method" }, 405);

  let payload;
  try {
    payload = await req.json();
  } catch {
    return json({ error: "json inválido" }, 400);
  }

  const { items, coupon, customer, payment_method, cash_amount, turnstileToken } = payload ?? {};
  const ip = req.headers.get("x-nf-client-connection-ip") ?? undefined;

  if (!(await verifyTurnstile(turnstileToken, ip))) {
    return json({ error: "verificación de seguridad fallida" }, 403);
  }
  if (!Array.isArray(items) || items.length === 0) {
    return json({ error: "carrito vacío" }, 400);
  }
  if (!customer?.name || !customer?.phone) {
    return json({ error: "faltan tu nombre y celular" }, 400);
  }
  if (!customer?.address?.line1) {
    return json({ error: "falta la dirección de entrega" }, 400);
  }
  const method = payment_method === "transfer" ? "transfer" : "cash";

  const sb = admin();

  // El user_id se deriva del JWT verificado (Authorization: Bearer), NUNCA del body.
  let uid = null;
  const authz = req.headers.get("authorization") || "";
  const bearer = authz.startsWith("Bearer ") ? authz.slice(7) : null;
  if (bearer) {
    const { data: { user } = {} } = await sb.auth.getUser(bearer);
    uid = user?.id ?? null;
  }

  // --- Motor de precios único (con delivery por zona) ---
  const calc = await recomputeCart(sb, {
    items,
    coupon,
    uid,
    address: customer.address,
    applyDelivery: true,
  });
  if (!calc.ok) return json({ error: calc.error }, calc.status);

  // Nota de efectivo (para llevar el cambio): se agrega a las notas de la orden →
  // aparece en el detalle de Órdenes del backoffice y en el correo de ops.
  let notes = customer.address?.delivery_notes ?? null;
  const cashAmt = Number(cash_amount);
  if (method === "cash" && Number.isFinite(cashAmt) && cashAmt >= calc.total) {
    const change = Math.round(cashAmt - calc.total);
    const line =
      change > 0
        ? `💵 Paga con RD$${Math.round(cashAmt)} · CAMBIO a llevar: RD$${change}`
        : `💵 Paga con el monto exacto (RD$${Math.round(calc.total)})`;
    notes = notes ? `${line}\n${notes}` : line;
  }

  const { data, error } = await sb.from("orders").insert({
    user_id: uid,
    status: "pending",
    payment_method: method,
    payment_status: "pending",
    customer_name: customer.name,
    customer_phone: customer.phone,
    customer_email: customer.email ?? null,
    address: customer.address,
    items: calc.lineItems,
    subtotal: calc.subtotal,
    discount_applied: calc.discount,
    delivery_fee: calc.delivery,
    delivery_zone: calc.deliveryZone,
    total: calc.total,
    affiliate_code: calc.affiliateCode,
    is_first_order: calc.isFirstOrder,
    commission_owed: calc.commissionOwed,
    channel: "WEB",
    brand: "VAPE",
    notes,
  }).select("id,subtotal,discount_applied,delivery_fee,total,payment_method,status").single();

  if (error) { console.error("create-order insert failed", error); return json({ error: "No pudimos crear la orden. Intenta de nuevo." }, 500); }

  // --- Disparar order-bridge n8n: descuenta el sheet + escribe Ventas-Raw + correo.
  // El WF responde de inmediato (procesa async); no bloqueamos al cliente. ---
  const hook = process.env.ORDER_WEBHOOK_URL;
  if (hook) {
    try {
      await fetch(hook, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ order_id: data.id }),
      });
    } catch { /* no romper la orden si el bridge falla; se reprocesa desde backoffice */ }
  }

  return json({ ok: true, order: data });
}
