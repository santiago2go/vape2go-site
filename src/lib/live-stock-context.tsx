"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import { getSupabase } from "./supabase";

/**
 * Precios + stock EN VIVO desde la tabla `product_stock` (espejo del sheet Vape
 * 2 Go Master). Reemplaza los precios en 0 de products.json. Cachea en memoria
 * (useState) y opcionalmente en localStorage con TTL de 5 min para no golpear
 * Supabase en cada navegación. Degrada elegante si Supabase no está configurado.
 *
 * El servidor (create-order) SIEMPRE recalcula; esto es solo para pintar la UI.
 */

export interface LiveStock {
  price: number;
  compare_at_price: number | null;
  stock: number;
  active: boolean;
  /** Cuándo la escribió WF30. Solo se usa para desempatar dos grafías del mismo SKU. */
  updated_at?: string | null;
}

/**
 * 🔑 EL SKU SE BUSCA NORMALIZADO, NO TAL CUAL.
 *
 * El 2026-08-21 WF30 cambió de fuente: dejó de leer el Sheet y empezó a leer `store_feed` de
 * la plataforma, que emite el SKU en su forma CANÓNICA (mayúsculas, sin ceros a la izquierda).
 * Como WF30 hace *upsert por SKU*, creó filas nuevas con la grafía nueva y **las viejas se
 * quedaron congeladas**:
 *
 *     la tienda tiene   C-5x7311250045431   ← congelada el 21-ago, nadie la vuelve a tocar
 *     la plataforma manda  C-5X7311250045431   ← ésta se actualiza cada 10 minutos
 *
 * `products.json` trae la grafía vieja, así que este contexto buscaba por texto exacto y leía
 * **la fila muerta**: 74 SKU de este sitio y 17 del de Maskotas. Hoy los números coinciden por
 * casualidad (las dos grafías están en el mismo valor), pero el día que la buena cambie, la
 * página se queda con el número viejo — agotado falso, o peor, disponible falso.
 *
 * Normalizando las DOS puntas del mapa, el sitio deja de depender de cómo esté escrito el SKU
 * y cualquier grafía nueva casa sola. Comprobado antes de escribirlo: normalizando los 664 SKU
 * de este catálogo hay **0 colisiones** — no hay dos productos distintos que se confundan.
 */
function normSku(s: unknown): string {
  // 🔴 Las TRES reglas, y son las mismas que `scripts/db/lib/sku.mjs` de la plataforma. La
  // primera versión de esta función se quedó en dos y por eso `DK002591.00` no reconciliaba
  // con `DK002591`: el barrido de la tienda (que sí usaba las tres) borró la vieja y el sitio
  // se quedó sin poder encontrar la buena. Dos normalizaciones distintas para la misma llave
  // es la misma clase de bug que las dos grafías — solo que una capa más arriba.
  const t = String(s ?? "").trim().toUpperCase().replace(/\.0+$/, "");
  return t.replace(/^0+/, "") || t;
}

interface LiveStockState {
  get: (sku: string) => LiveStock | undefined;
  isAvailable: (sku: string) => boolean;
  loading: boolean;
}

const LiveStockContext = createContext<LiveStockState | null>(null);

const CACHE_KEY = "v2g_stock";
const TTL_MS = 5 * 60 * 1000;

interface CacheShape {
  ts: number;
  rows: Array<{ sku: string } & LiveStock>;
}

function toMap(rows: Array<{ sku: string } & LiveStock>): Map<string, LiveStock> {
  const m = new Map<string, LiveStock>();
  for (const r of rows) {
    const k = normSku(r.sku);
    /**
     * 🔴 EL DESEMPATE ES OBLIGATORIO, no un detalle. Al normalizar, las dos grafías del mismo
     * producto caen en la MISMA llave, así que una pisa a la otra. Sin esta condición el
     * ganador sería «la última que devolvió Supabase», o sea el orden de un `select` sin
     * `order by` — que funciona hasta el martes que cambie. Gana la más fresca; si alguna no
     * trae fecha, gana la que ya estaba (una fila sin fecha es la vieja: WF30 siempre la pone).
     */
    const prev = m.get(k);
    if (prev) {
      const tNew = Date.parse(String(r.updated_at ?? "")) || 0;
      const tOld = Date.parse(String(prev.updated_at ?? "")) || 0;
      if (tNew <= tOld) continue;
    }
    m.set(k, {
      price: Number(r.price) || 0,
      compare_at_price:
        r.compare_at_price === null || r.compare_at_price === undefined
          ? null
          : Number(r.compare_at_price),
      stock: Number(r.stock) || 0,
      active: Boolean(r.active),
      updated_at: r.updated_at ?? null,
    });
  }
  return m;
}

export function LiveStockProvider({ children }: { children: ReactNode }) {
  const [map, setMap] = useState<Map<string, LiveStock>>(new Map());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    // 1) Intenta hidratar desde localStorage (cache fresca < 5 min)
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      if (raw) {
        const cached = JSON.parse(raw) as CacheShape;
        if (cached && Date.now() - cached.ts < TTL_MS && Array.isArray(cached.rows)) {
          setMap(toMap(cached.rows));
          setLoading(false);
          return; // cache válida, no golpeamos la red
        }
      }
    } catch {
      /* cache corrupta / storage no disponible → seguimos al fetch */
    }

    // 2) Fetch en vivo
    const supabase = getSupabase();
    if (!supabase) {
      setLoading(false);
      return;
    }

    supabase
      .from("product_stock")
      // `updated_at` viaja solo para desempatar dos grafías del mismo SKU. Ver `normSku`.
      .select("sku,name,price,compare_at_price,stock,active,updated_at")
      .then(({ data }) => {
        if (!active) return;
        const rows = (data as Array<{ sku: string } & LiveStock>) ?? [];
        setMap(toMap(rows));
        setLoading(false);
        try {
          const payload: CacheShape = {
            ts: Date.now(),
            rows: rows.map((r) => ({
              sku: String(r.sku),
              updated_at: r.updated_at ?? null,
              price: Number(r.price) || 0,
              compare_at_price:
                r.compare_at_price === null || r.compare_at_price === undefined
                  ? null
                  : Number(r.compare_at_price),
              stock: Number(r.stock) || 0,
              active: Boolean(r.active),
            })),
          };
          localStorage.setItem(CACHE_KEY, JSON.stringify(payload));
        } catch {
          /* localStorage lleno / no disponible → no es crítico */
        }
      });

    return () => {
      active = false;
    };
  }, []);

  const get = useCallback((sku: string) => map.get(normSku(sku)), [map]);

  const isAvailable = useCallback(
    (sku: string) => {
      const s = map.get(normSku(sku));
      return Boolean(s && s.active && s.stock > 0 && s.price > 0);
    },
    [map]
  );

  const value: LiveStockState = { get, isAvailable, loading };

  return <LiveStockContext.Provider value={value}>{children}</LiveStockContext.Provider>;
}

export function useLiveStock(): LiveStockState {
  const ctx = useContext(LiveStockContext);
  if (!ctx) throw new Error("useLiveStock debe usarse dentro de <LiveStockProvider>");
  return ctx;
}
