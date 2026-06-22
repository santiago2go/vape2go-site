// GET /.netlify/functions/healthcheck
// Chequea que el sitio y la base de datos responden. Pensado para que un
// monitor externo (UptimeRobot / Better Stack) o un workflow n8n lo llame cada
// pocos minutos. Si algo falla, avisa a ALERT_WEBHOOK_URL (n8n→Discord/Telegram).
//
// Devuelve 200 si todo OK, 503 si hay degradación.

import { admin, json } from "./_lib.mjs";

async function notify(message) {
  const url = process.env.ALERT_WEBHOOK_URL;
  if (!url) return;
  try {
    await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      // formato compatible con Discord ({content}) y genérico para n8n
      body: JSON.stringify({ content: message, text: message, source: "vapes.do healthcheck" }),
    });
  } catch {
    /* noop */
  }
}

export default async function handler() {
  const checks = { db: false };
  let healthy = true;

  try {
    const sb = admin();
    // consulta barata que prueba conectividad + RLS de la vista
    const { error } = await sb.from("affiliates").select("id", { head: true, count: "exact" }).limit(1);
    checks.db = !error;
    if (error) healthy = false;
  } catch (e) {
    healthy = false;
    checks.error = String(e?.message ?? e);
  }

  if (!healthy) {
    await notify(`🔴 vapes.do degradado: ${JSON.stringify(checks)}`);
    return json({ status: "degraded", checks }, 503);
  }
  return json({ status: "ok", checks });
}
