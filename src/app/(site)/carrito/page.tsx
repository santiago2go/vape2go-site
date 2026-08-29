"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Minus, Plus, Trash2, ShoppingBag } from "lucide-react";
import { useCart } from "@/lib/cart-context";
import { useLiveStock } from "@/lib/live-stock-context";
import { getSupabase } from "@/lib/supabase";
import { cdnImage, formatDOP } from "@/data/catalog-meta";
import { useOrderAvailability, OrderUnavailableModal, OrderUnavailableBanner } from "@/components/OrderAvailability";
import OrderChannels from "@/components/OrderChannels";

interface DeliveryConfig {
  fee: number;
  free_over: number;
}

export default function CartPage() {
  const { items, setQty, removeItem, count } = useCart();
  const { get, isAvailable } = useLiveStock();
  const availability = useOrderAvailability();
  const [delivery, setDelivery] = useState<DeliveryConfig | null>(null);

  useEffect(() => {
    const sb = getSupabase();
    if (!sb) return;
    sb.from("store_config")
      .select("key,value")
      .eq("key", "delivery")
      .maybeSingle()
      .then(({ data }) => {
        const v = (data as { value?: DeliveryConfig } | null)?.value;
        if (v) setDelivery({ fee: Number(v.fee) || 0, free_over: Number(v.free_over) || 0 });
      });
  }, []);

  // Subtotal EN VIVO: solo cuenta líneas disponibles con precio real.
  const subtotal = items.reduce((sum, it) => {
    const live = get(it.sku);
    if (!live || !isAvailable(it.sku)) return sum;
    return sum + live.price * it.qty;
  }, 0);

  const deliveryNote =
    delivery &&
    (delivery.free_over > 0
      ? `Delivery ${formatDOP(delivery.fee)} · gratis desde ${formatDOP(delivery.free_over)}`
      : `Delivery ${formatDOP(delivery.fee)}`);

  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      <OrderUnavailableModal state={availability} />

      <h1 className="text-3xl text-gray-900 mb-8" style={{ fontFamily: "var(--font-heading)" }}>
        Tu carrito
      </h1>

      <OrderUnavailableBanner state={availability} />

      {count === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-200 p-8 text-center">
          <ShoppingBag size={32} className="mx-auto text-gray-300 mb-3" />
          <p className="text-sm text-gray-500 mb-4">Tu carrito está vacío.</p>
          <Link
            href="/catalogo/"
            className="inline-flex items-center text-sm font-semibold text-violet-600 hover:text-violet-700"
          >
            Explorar el catálogo →
          </Link>
        </div>
      ) : (
        <>
          <div className="space-y-3">
            {items.map((it) => {
              const live = get(it.sku);
              const available = isAvailable(it.sku);
              const linePrice = live ? live.price * it.qty : 0;
              return (
                <div
                  key={it.sku}
                  className="flex items-center gap-3 border border-gray-200 rounded-xl p-3"
                >
                  <div className="relative w-16 h-16 shrink-0 rounded-lg bg-gray-50 overflow-hidden">
                    {it.image ? (
                      <Image
                        src={cdnImage(it.image, 100)!}
                        alt={it.name}
                        fill
                        className="object-contain p-1.5"
                        sizes="64px"
                      />
                    ) : (
                      <div className="w-full h-full bg-gray-100" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 line-clamp-2 leading-snug">
                      {it.name}
                    </p>
                    {available ? (
                      live && (
                        <p className="text-xs text-gray-500 mt-0.5">
                          {formatDOP(live.price)} c/u
                        </p>
                      )
                    ) : (
                      <p className="text-xs text-red-600 mt-0.5">Agotado — quítalo para continuar</p>
                    )}

                    {/* Quantity control */}
                    <div className="flex items-center gap-2 mt-2">
                      <button
                        type="button"
                        onClick={() => setQty(it.sku, it.qty - 1)}
                        className="w-7 h-7 flex items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors"
                        aria-label="Restar"
                      >
                        <Minus size={14} />
                      </button>
                      <span className="text-sm font-semibold text-gray-900 w-6 text-center">
                        {it.qty}
                      </span>
                      <button
                        type="button"
                        onClick={() => setQty(it.sku, it.qty + 1)}
                        className="w-7 h-7 flex items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors"
                        aria-label="Sumar"
                      >
                        <Plus size={14} />
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-2 shrink-0">
                    {available && (
                      <span className="text-violet-700 font-bold text-sm">
                        {formatDOP(linePrice)}
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => removeItem(it.sku)}
                      className="p-1.5 text-gray-400 hover:text-red-600 transition-colors"
                      aria-label="Quitar"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Subtotal + delivery */}
          <div className="mt-6 border-t border-gray-100 pt-5 space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500">Subtotal</span>
              <span className="text-gray-900 font-semibold">{formatDOP(subtotal)}</span>
            </div>
            {deliveryNote && <p className="text-xs text-gray-400">{deliveryNote}</p>}
          </div>

          <div className="mt-6 flex flex-col sm:flex-row gap-3">
            {availability.ready && !availability.accepting ? (
              <button
                type="button"
                disabled
                className="flex-1 text-center bg-gray-200 text-gray-400 font-semibold text-sm py-3.5 rounded-xl cursor-not-allowed"
              >
                Pedidos no disponibles
              </button>
            ) : (
              <Link
                href="/checkout/"
                className="flex-1 text-center bg-violet-600 text-white font-semibold text-sm py-3.5 rounded-xl hover:bg-violet-700 transition-colors"
              >
                Ir a pagar
              </Link>
            )}
            <Link
              href="/catalogo/"
              className="flex-1 text-center border border-gray-200 text-gray-500 hover:bg-gray-50 rounded-xl py-3.5 text-sm font-medium transition-colors"
            >
              Seguir comprando
            </Link>
          </div>

          <OrderChannels variant="inline" className="mt-5" />
        </>
      )}
    </div>
  );
}
