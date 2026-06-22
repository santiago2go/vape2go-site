"use client";

import { useEffect, useRef } from "react";
import { track, type EventName } from "@/lib/analytics";

/**
 * Dispara un evento de funnel una sola vez al montar. Se inserta en páginas
 * server-rendered (home, categoría, producto) para marcar el paso del embudo.
 */
export default function TrackView({
  event,
  productId,
  category,
  brand,
}: {
  event: EventName;
  productId?: string;
  category?: string;
  brand?: string;
}) {
  const fired = useRef(false);
  useEffect(() => {
    if (fired.current) return;
    fired.current = true;
    track(event, { productId, category, brand });
  }, [event, productId, category, brand]);
  return null;
}
