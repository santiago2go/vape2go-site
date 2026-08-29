// Utilidades compartidas por las Netlify Functions (backend seguro).
// NUNCA importar esto desde el cliente: usa la service_role key.

import { createClient } from "@supabase/supabase-js";

export function admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase backend no configurado");
  // service_role ignora RLS: solo aquí, en el servidor.
  return createClient(url, key, { auth: { persistSession: false } });
}

/** Verifica el token de Cloudflare Turnstile contra su API (anti-bot). */
export async function verifyTurnstile(token, ip) {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return process.env.NODE_ENV !== "production"; // prod: fail-closed; dev: permitir
  if (!token) return false;
  const body = new URLSearchParams({ secret, response: token });
  if (ip) body.append("remoteip", ip);
  const r = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    body,
  });
  const data = await r.json();
  return Boolean(data.success);
}

export function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export const clampQty = (q) => Math.max(1, Math.min(99, Number(q) || 1));
// Solo aceptamos URLs https como imagen de línea (evita SSRF/URIs peligrosas en el correo).
export const safeImg = (u) => (typeof u === "string" && /^https:\/\//i.test(u) ? u : null);

/**
 * MOTOR DE PRECIOS ÚNICO (web + POS). Recalcula TODO desde product_stock (fuente de
 * verdad = espejo del sheet Master): valida stock/disponibilidad al momento, arma
 * los line items con el precio real, aplica cupón/afiliado y (opcional) el delivery
 * por zona. El cliente NUNCA fija precios, totales ni comisiones.
 *
 * Devuelve { ok:false, status, error } en validación fallida, o
 * { ok:true, lineItems, subtotal, discount, commissionOwed, affiliateCode,
 *   isFirstOrder, delivery, deliveryZone, total } en éxito.
 *
 * @param sb  cliente service_role (admin()).
 * @param opts.items      [{ sku, qty, product_id?, name?, image? }]
 * @param opts.coupon     código de afiliado (opcional). En POS = null.
 * @param opts.uid        user_id del JWT (para atribución de 1ra orden). null si guest.
 * @param opts.address    { zone?, ... } — solo se usa si applyDelivery=true.
 * @param opts.applyDelivery  true = calcula delivery por zona (web); false = 0 (POS mostrador).
 */
export async function recomputeCart(sb, { items, coupon = null, uid = null, address = null, applyDelivery = true }) {
  if (!Array.isArray(items) || items.length === 0) {
    return { ok: false, status: 400, error: "carrito vacío" };
  }
  const skus = [...new Set(items.map((i) => String(i.sku || "").trim()).filter(Boolean))];
  if (skus.length === 0) return { ok: false, status: 400, error: "carrito inválido" };

  const { data: stockRows, error: stockErr } = await sb
    .from("product_stock")
    .select("sku,name,price,compare_at_price,stock,active")
    .in("sku", skus);
  if (stockErr) {
    console.error("recomputeCart stock query failed", stockErr);
    return { ok: false, status: 500, error: "No pudimos verificar el inventario. Intenta de nuevo." };
  }
  const bySku = Object.fromEntries((stockRows ?? []).map((r) => [r.sku, r]));

  // ACUMULAR por SKU antes de validar: evita el oversell de partir la cantidad en varias
  // líneas del mismo SKU (cada línea pasaría el check contra el stock TOTAL). Una línea por
  // SKU, cantidad total, validada UNA vez contra el stock. Tope duro total = 99.
  const qtyBySku = new Map();
  for (const it of items) {
    const sku = String(it.sku || "").trim();
    if (!sku) continue;
    qtyBySku.set(sku, (qtyBySku.get(sku) || 0) + clampQty(it.qty));
  }
  if (qtyBySku.size === 0) return { ok: false, status: 400, error: "carrito inválido" };

  let subtotal = 0;
  const lineItems = [];
  for (const [sku, rawQty] of qtyBySku) {
    const meta = items.find((i) => String(i.sku || "").trim() === sku) || {};
    const row = bySku[sku];
    if (!row || !row.active || Number(row.stock) <= 0) {
      return { ok: false, status: 409, error: `producto no disponible: ${meta.name || sku}` };
    }
    const qty = Math.min(rawQty, 99);
    if (qty > Number(row.stock)) {
      return { ok: false, status: 409, error: `stock insuficiente de ${row.name} (quedan ${row.stock})` };
    }
    const unit = Number(row.price) || 0;
    if (unit <= 0) return { ok: false, status: 409, error: `precio no configurado: ${row.name}` };
    subtotal += unit * qty;
    lineItems.push({
      product_id: meta.product_id ?? null,
      sku,
      name: row.name,
      qty,
      unit_price: unit,
      compare_at_price: row.compare_at_price ?? null,
      image: safeImg(meta.image),
    });
  }

  // --- Cupón / afiliado (atribución híbrida decreciente) ---
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

      if (uid) {
        const { count } = await sb.from("orders")
          .select("id", { count: "exact", head: true })
          .eq("user_id", uid).eq("affiliate_code", code);
        isFirstOrder = (count ?? 0) === 0;
      } else {
        isFirstOrder = true;
      }
      const pct = isFirstOrder ? Number(aff.commission_pct) : Number(aff.decay_pct ?? 0);
      commissionOwed = (subtotal - discount) * (pct / 100);
    }
  }

  const afterDiscount = Math.max(0, subtotal - discount);

  // --- Delivery por ZONA (solo web; POS mostrador = 0) ---
  let delivery = 0, deliveryZone = null;
  if (applyDelivery) {
    const zoneName = String(address?.zone || "").trim();
    const { data: zonesCfg } = await sb.from("store_config").select("value").eq("key", "zones").maybeSingle();
    const activeZones = (Array.isArray(zonesCfg?.value) ? zonesCfg.value : []).filter((z) => z && z.active);

    if (activeZones.length > 0) {
      const zone = activeZones.find((z) => String(z.name).trim() === zoneName);
      if (!zone) {
        return { ok: false, status: 409, error: "Tu sector no está en cobertura directa. Escríbenos por WhatsApp para coordinar la entrega." };
      }
      const fee = Number(zone.fee) || 0;
      const fo = Number(zone.free_over) || 0;
      delivery = fo > 0 && afterDiscount >= fo ? 0 : fee;
      deliveryZone = zone.name;
    } else {
      let deliveryFee = 120, freeOver = 800;
      const { data: cfg } = await sb.from("store_config").select("value").eq("key", "delivery").maybeSingle();
      if (cfg?.value) {
        deliveryFee = Number(cfg.value.fee ?? deliveryFee);
        freeOver = Number(cfg.value.free_over ?? freeOver);
      }
      delivery = freeOver > 0 && afterDiscount >= freeOver ? 0 : deliveryFee;
    }
  }

  const total = afterDiscount + delivery;
  return { ok: true, lineItems, subtotal, discount, commissionOwed, affiliateCode, isFirstOrder, delivery, deliveryZone, total };
}
