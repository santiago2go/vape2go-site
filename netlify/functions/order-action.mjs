// POST /.netlify/functions/order-action
// Dispara el webhook n8n cuando el backoffice marca una orden "Entregada" o
// "Cancelada". El WF de n8n registra la venta en Ventas-Raw (delivered) o
// restaura el stock en el sheet Vape 2 Go Master (cancelled).
//
// SEGURIDAD: solo admin/staff. Exige un JWT de Supabase (Authorization: Bearer)
// que se verifica con service_role; luego consulta el rol en `profiles`. El
// cliente nunca escribe al sheet directamente: pasa siempre por este gate.

import { admin, json } from "./_lib.mjs";

const ACTIONS = new Set(["delivered", "cancelled"]);
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function handler(req) {
  if (req.method !== "POST") return json({ error: "method" }, 405);

  // --- Autenticación: JWT de Supabase en el header Authorization ---
  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
  if (!token) return json({ error: "no autorizado" }, 401);

  const sb = admin();

  const { data: { user } = {} } = await sb.auth.getUser(token);
  if (!user) return json({ error: "no autorizado" }, 401);

  // --- Autorización: solo admin/staff ---
  const { data: profile } = await sb.from("profiles").select("role").eq("id", user.id).single();
  const role = profile?.role;
  if (role !== "admin" && role !== "staff") return json({ error: "prohibido" }, 403);

  // --- Payload ---
  let payload;
  try {
    payload = await req.json();
  } catch {
    return json({ error: "json inválido" }, 400);
  }

  const orderId = String(payload?.order_id ?? "").trim();
  const action = String(payload?.action ?? "").trim();

  if (!ACTIONS.has(action)) return json({ error: "acción inválida" }, 400);
  if (!UUID_RE.test(orderId)) return json({ error: "order_id inválido" }, 400);

  // --- Disparar el webhook n8n. Si no está configurado, no-op sin error. ---
  const hook = process.env.ORDER_STATUS_WEBHOOK_URL;
  if (hook) {
    await fetch(hook, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ order_id: orderId, action }),
    });
  }

  return json({ ok: true });
}
