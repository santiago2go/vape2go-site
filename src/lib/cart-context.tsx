"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useMemo,
  type ReactNode,
} from "react";
import type { Product } from "@/data/catalog-meta";

/**
 * Carrito de compras (cliente). Molde de auth-context: createContext + Provider
 * + hook con guard. Persiste en localStorage (`v2g_cart`) y se hidrata en
 * useEffect (nunca en el initializer de useState → no rompe SSR/export).
 *
 * OJO: el carrito NO guarda precio ni subtotal. El precio se lee SIEMPRE fresco
 * desde useLiveStock() en el render, así nunca mostramos un precio viejo y el
 * servidor (create-order) es la fuente de verdad final.
 */

export interface CartItem {
  id: string;
  sku: string;
  name: string;
  image?: string;
  qty: number;
}

interface CartState {
  items: CartItem[];
  count: number;
  /** true una vez leído localStorage; hasta entonces items podría no reflejar lo guardado. */
  hydrated: boolean;
  addItem: (product: Product) => void;
  removeItem: (sku: string) => void;
  setQty: (sku: string, qty: number) => void;
  clear: () => void;
}

const CartContext = createContext<CartState | null>(null);

const STORAGE_KEY = "v2g_cart";
const clampQty = (q: number) => Math.max(1, Math.min(99, Math.round(q) || 1));

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [hydrated, setHydrated] = useState(false);

  // Hidratar desde localStorage (patrón AgeGate: try/catch, en useEffect)
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          setItems(
            parsed
              .filter((i) => i && typeof i.sku === "string")
              .map((i) => ({
                id: String(i.id ?? ""),
                sku: String(i.sku),
                name: String(i.name ?? ""),
                image: i.image ? String(i.image) : undefined,
                qty: clampQty(Number(i.qty)),
              }))
          );
        }
      }
    } catch {
      /* carrito corrupto / storage no disponible → arranca vacío */
    }
    setHydrated(true);
  }, []);

  // Persistir cada cambio (solo después de hidratar, para no pisar con [] vacío)
  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {
      /* storage lleno / no disponible → no es crítico */
    }
  }, [items, hydrated]);

  const addItem = useCallback((product: Product) => {
    setItems((prev) => {
      const found = prev.find((i) => i.sku === product.sku);
      if (found) {
        return prev.map((i) =>
          i.sku === product.sku ? { ...i, qty: clampQty(i.qty + 1) } : i
        );
      }
      return [
        ...prev,
        {
          id: product.id,
          sku: product.sku,
          name: product.name,
          image: product.image,
          qty: 1,
        },
      ];
    });
  }, []);

  const removeItem = useCallback((sku: string) => {
    setItems((prev) => prev.filter((i) => i.sku !== sku));
  }, []);

  const setQty = useCallback((sku: string, qty: number) => {
    setItems((prev) => {
      if (qty <= 0) return prev.filter((i) => i.sku !== sku);
      return prev.map((i) => (i.sku === sku ? { ...i, qty: clampQty(qty) } : i));
    });
  }, []);

  const clear = useCallback(() => setItems([]), []);

  const count = useMemo(() => items.reduce((sum, i) => sum + i.qty, 0), [items]);

  const value: CartState = { items, count, hydrated, addItem, removeItem, setQty, clear };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartState {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart debe usarse dentro de <CartProvider>");
  return ctx;
}
