// POST /.netlify/functions/create-order
// Crea una orden de forma SEGURA: el cliente manda items + (opcional) cupón;
// el servidor recalcula precios desde la fuente de verdad, valida el cupón,
// computa la comisión del afiliado (atribución híbrida decreciente) y escribe
// la orden con service_role. El cliente NUNCA fija totales ni comisiones.
//
// Es el esqueleto de la Fase 1 del checkout propio. Hoy los precios se leen de
// products.json embebido; cuando exista tabla `products` en Supabase, leer de ahí.

import { admin, verifyTurnstile, json } from "./_lib.mjs";
// esbuild (node_bundler) inyecta el JSON al compilar la función.
import products from "../../src/data/products.json";

const priceOf = (id) => {
  const p = products.find((x) => x.id === id);
  return p && p.disponible ? Number(p.price) || 0 : null;
};

export default async function handler(req) {
  if (req.method !== "POST") return json({ error: "method" }, 405);

  let payload;
  try {
    payload = await req.json();
  } catch {
    return json({ error: "json inválido" }, 400);
  }

  const { items, coupon, customer, turnstileToken, userId } = payload ?? {};
  const ip = req.headers.get("x-nf-client-connection-ip") ?? undefined;

  if (!(await verifyTurnstile(turnstileToken, ip))) {
    return json({ error: "verificación de seguridad fallida" }, 403);
  }
  if (!Array.isArray(items) || items.length === 0) {
    return json({ error: "carrito vacío" }, 400);
  }

  // Recalcular subtotal desde la fuente de verdad (ignora precios del cliente)
  let subtotal = 0;
  const lineItems = [];
  for (const it of items) {
    const unit = priceOf(it.product_id);
    if (unit == null) return json({ error: `producto no disponible: ${it.product_id}` }, 400);
    const qty = Math.max(1, Math.min(99, Number(it.qty) || 1));
    subtotal += unit * qty;
    lineItems.push({ product_id: it.product_id, qty, unit_price: unit });
  }

  const sb = admin();

  // Validar cupón + calcular descuento y comisión
  let discount = 0, commissionOwed = 0, affiliateCode = null, isFirstOrder = false;
  if (coupon) {
    const code = String(coupon).trim().toUpperCase();
    const { data: aff } = await sb.from("affiliates").select("*").eq("code", code).eq("active", true).maybeSingle();
    if (aff) {
      affiliateCode = code;
      discount = aff.discount_type === "percent"
        ? subtotal * (Number(aff.discount_value) / 100)
        : Number(aff.discount_value);
      if (aff.max_discount) discount = Math.min(discount, Number(aff.max_discount));

      // ¿primera orden de este cliente con este código? -> comisión plena
      if (userId) {
        const { count } = await sb.from("orders")
          .select("id", { count: "exact", head: true })
          .eq("user_id", userId).eq("affiliate_code", code);
        isFirstOrder = (count ?? 0) === 0;
      } else {
        isFirstOrder = true;
      }
      // atribución híbrida decreciente: plena en la primera; reducida luego
      const pct = isFirstOrder ? Number(aff.commission_pct) : Number(aff.decay_pct ?? 0);
      commissionOwed = (subtotal - discount) * (pct / 100);
    }
  }

  const total = Math.max(0, subtotal - discount);

  const { data, error } = await sb.from("orders").insert({
    user_id: userId ?? null,
    status: "pending",
    customer_name: customer?.name ?? null,
    customer_phone: customer?.phone ?? null,
    address: customer?.address ?? null,
    items: lineItems,
    subtotal,
    discount_applied: discount,
    total,
    affiliate_code: affiliateCode,
    is_first_order: isFirstOrder,
    commission_owed: commissionOwed,
  }).select("id,total,discount_applied").single();

  if (error) return json({ error: error.message }, 500);
  return json({ ok: true, order: data });
}
