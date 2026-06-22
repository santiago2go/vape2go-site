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
  if (!secret) return true; // sin configurar => no bloquear (dev)
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
