"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Cliente Supabase para el navegador (singleton).
 *
 * Degradación elegante: si faltan las env vars, `supabase` queda en `null` y
 * `isSupabaseConfigured` en `false`. La UI de auth/cuenta debe chequear esto y
 * mostrar un estado "próximamente" en vez de romper el build estático.
 *
 * La anon key es PÚBLICA por diseño; lo que protege la data es RLS en Postgres.
 * La service_role NUNCA va aquí — solo en Netlify Functions / n8n.
 */
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(url && anonKey);

let _client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient | null {
  if (!isSupabaseConfigured) return null;
  if (_client) return _client;
  _client = createClient(url!, anonKey!, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });
  return _client;
}

export const supabase = getSupabase();
