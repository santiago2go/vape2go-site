"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { Minus, Plus, ShoppingBag } from "lucide-react";
import { useCart } from "@/lib/cart-context";
import { useLiveStock } from "@/lib/live-stock-context";
import { track } from "@/lib/analytics";
import type { Product } from "@/data/catalog-meta";

/**
 * Botón "Agregar" que se transforma en un stepper [ − qty + ] leyendo/escribiendo
 * la cantidad del carrito. Respeta el stock máximo EN VIVO (product_stock). Si el
 * producto no está disponible → botón deshabilitado "Agotado".
 *
 * `size`: "sm" (default, para ProductCard) | "lg" (para la ficha de producto).
 */
export default function AddToCartButton({
  product,
  size = "sm",
}: {
  product: Product;
  size?: "sm" | "lg";
}) {
  const { items, addItem, setQty, removeItem } = useCart();
  const { isAvailable, get, loading } = useLiveStock();

  const available = isAvailable(product.sku);
  const stock = get(product.sku)?.stock ?? 0;
  const qty = items.find((i) => i.sku === product.sku)?.qty ?? 0;

  const [flash, setFlash] = useState(false);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const big = size === "lg";
  const btnBase = big ? "text-sm py-3.5" : "text-xs py-2";
  const iconSize = big ? 16 : 14;

  function onAdd() {
    addItem(product);
    void track("add_to_cart", { productId: product.id });
    setFlash(true);
    if (flashTimer.current) clearTimeout(flashTimer.current);
    flashTimer.current = setTimeout(() => setFlash(false), 900);
  }

  function inc() {
    if (qty >= stock) return; // respeta el stock máximo en vivo
    setQty(product.sku, qty + 1);
  }

  function dec() {
    if (qty <= 1) {
      removeItem(product.sku);
      return;
    }
    setQty(product.sku, qty - 1);
  }

  if (!available) {
    return (
      <button
        type="button"
        disabled
        className={`w-full text-center font-semibold ${btnBase} rounded-lg bg-gray-100 text-gray-400 cursor-not-allowed`}
      >
        {loading ? "Cargando…" : "Agotado"}
      </button>
    );
  }

  // Ya está en el carrito → stepper + CTA directo "Ver mi carrito"
  if (qty > 0) {
    const atMax = qty >= stock;
    const count = items.reduce((a, i) => a + (Number(i.qty) || 0), 0);
    return (
      <div className="w-full space-y-1.5">
        <div
          className={`flex items-center justify-between rounded-lg text-white transition-colors ${
            big ? "px-2 py-1.5" : "px-1.5 py-1"
          } ${flash ? "bg-green-600" : "bg-violet-600"}`}
        >
          <button
            type="button"
            onClick={dec}
            aria-label="Restar"
            className="p-1.5 rounded-md hover:bg-white/15 transition-colors"
          >
            <Minus size={iconSize} />
          </button>
          <span className={`font-semibold tabular-nums ${big ? "text-sm" : "text-xs"}`}>
            {flash ? "✓ Agregado" : qty}
          </span>
          <button
            type="button"
            onClick={inc}
            disabled={atMax}
            aria-label="Sumar"
            title={atMax ? "No hay más stock disponible" : undefined}
            className="p-1.5 rounded-md hover:bg-white/15 transition-colors disabled:opacity-40 disabled:hover:bg-transparent"
          >
            <Plus size={iconSize} />
          </button>
        </div>
        <Link
          href="/carrito/"
          className={`flex w-full items-center justify-center gap-1.5 rounded-lg border border-violet-200 bg-violet-50 font-semibold text-violet-700 transition-colors hover:bg-violet-100 ${btnBase}`}
        >
          <ShoppingBag size={iconSize} /> Ver mi carrito · {count}
        </Link>
      </div>
    );
  }

  // Aún no está en el carrito
  return (
    <button
      type="button"
      onClick={onAdd}
      className={`w-full text-center font-semibold ${btnBase} rounded-lg text-white transition-colors ${
        flash ? "bg-green-600" : "bg-violet-600 hover:bg-violet-700"
      }`}
    >
      {flash ? "✓ Agregado" : "Agregar"}
    </button>
  );
}
