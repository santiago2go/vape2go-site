// Prebuild: sincroniza el flag `disponible` de products.json con la disponibilidad
// EN VIVO (product_stock via la vista available_products: active && stock>0 && price>0).
// Motivo: el `disponible` estático estaba PODRIDO (marcaba 574 disponibles cuando en vivo
// solo hay ~228; p.ej. las cajetillas Heets marcadas disponible=true pero ya no existen en
// PedidosYa). Todas las listas del storefront (home/categoría/marca/catálogo) filtran por
// `disponible`, así que corregirlo aquí las arregla TODAS en un solo lugar.
//
// FAIL-SAFE: si faltan las creds, el fetch falla, o available_products viene vacío,
// se deja products.json INTACTO (nunca vacía el catálogo por un problema de red del build).
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const path = join(here, "../src/data/products.json");

// El prebuild corre como node plano (sin las env de Next): cargar .env.local a mano.
try {
  const env = readFileSync(join(here, "../.env.local"), "utf8");
  for (const line of env.split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
} catch { /* sin .env.local: caerá al fail-safe abajo */ }

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

async function main() {
  if (!URL || !ANON) {
    console.log("sync-availability: sin creds Supabase → products.json SIN cambios (fail-safe)");
    return;
  }
  let available;
  try {
    const res = await fetch(`${URL}/rest/v1/available_products?select=sku`, {
      headers: { apikey: ANON, authorization: `Bearer ${ANON}` },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const rows = await res.json();
    available = new Set(rows.map((r) => String(r.sku)));
  } catch (e) {
    console.log(`sync-availability: fetch falló (${e.message}) → products.json SIN cambios (fail-safe)`);
    return;
  }
  if (available.size === 0) {
    console.log("sync-availability: available_products vacío → SIN cambios (fail-safe)");
    return;
  }

  const products = JSON.parse(readFileSync(path, "utf8"));
  let changed = 0;
  for (const p of products) {
    const disp = available.has(String(p.sku));
    if (p.disponible !== disp) { p.disponible = disp; changed++; }
  }
  writeFileSync(path, JSON.stringify(products, null, 2) + "\n");
  const total = products.filter((p) => p.disponible).length;
  console.log(`sync-availability: ${available.size} disponibles en vivo → ${total}/${products.length} con disponible=true (${changed} flags cambiados)`);
}
main();
