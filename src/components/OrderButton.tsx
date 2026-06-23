"use client";

import { PEDIDOSYA_URL } from "@/data/catalog-meta";
import { track } from "@/lib/analytics";

/**
 * CTA de orden. Marca el paso final del funnel (order_click = paso 5) antes de
 * mandar al cliente a PedidosYa. Cuando exista checkout propio (Fase 1), este
 * botón se reemplaza por "Agregar al carrito" + begin_checkout.
 */
export default function OrderButton({
  productId,
  label = "Pedir por PedidosYa",
  href = PEDIDOSYA_URL,
  className = "block text-center font-semibold text-sm py-4 rounded-xl transition-colors bg-violet-600 text-white hover:bg-violet-700",
}: {
  productId?: string;
  label?: string;
  href?: string;
  className?: string;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={className}
      onClick={() => track("order_click", { productId })}
    >
      {label}
    </a>
  );
}
