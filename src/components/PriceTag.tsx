"use client";

import { useLiveStock } from "@/lib/live-stock-context";
import { formatDOP } from "@/data/catalog-meta";

/**
 * Muestra el precio EN VIVO de un producto (tabla product_stock):
 * - precio directo grande en violet
 * - si hay compare_at_price → precio tachado gris con label "En PedidosYa" + badge -XX%
 * - si no hay dato en vivo (o price 0) → usa `fallback` sin tachado
 *
 * `size`: "sm" (default, para ProductCard) | "lg" (para la ficha de producto).
 */
export default function PriceTag({
  sku,
  fallback,
  size = "sm",
}: {
  sku: string;
  fallback?: string;
  size?: "sm" | "lg";
}) {
  const { get } = useLiveStock();
  const live = get(sku);
  const priceClass = size === "lg" ? "text-2xl" : "text-base";

  // Sin dato en vivo o precio 0 → fallback plano (nunca "RD$0")
  if (!live || live.price <= 0) {
    if (!fallback) return null;
    return <span className={`text-violet-700 font-bold ${priceClass}`}>{fallback}</span>;
  }

  const hasCompare =
    live.compare_at_price !== null && live.compare_at_price > live.price;
  const discountPct = hasCompare
    ? Math.round((1 - live.price / (live.compare_at_price as number)) * 100)
    : 0;

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className={`text-violet-700 font-bold ${priceClass}`}>{formatDOP(live.price)}</span>
      {hasCompare && (
        <>
          <span className="flex items-center gap-1 text-xs">
            <span className="line-through text-gray-400">
              {formatDOP(live.compare_at_price as number)}
            </span>
            <span className="text-gray-400">En PedidosYa</span>
          </span>
          {discountPct > 0 && (
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-green-100 text-green-700">
              -{discountPct}%
            </span>
          )}
        </>
      )}
    </div>
  );
}
