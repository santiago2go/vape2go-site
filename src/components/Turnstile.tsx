"use client";

import { useEffect, useRef } from "react";

// resetKey: cada vez que cambia, el widget se reinicia y emite un token fresco
// (necesario tras un intento fallido, porque el token de Turnstile es de un solo uso).

/**
 * Cloudflare Turnstile — captcha invisible/no-molesto para frenar bots en
 * registro/login (punto 3: prevent abuse and bot attacks).
 *
 * Si no hay site key configurada, renderiza null y reporta token vacío
 * (el flujo sigue funcionando en desarrollo sin Turnstile).
 */
declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, opts: Record<string, unknown>) => string;
      reset: (id?: string) => void;
    };
  }
}

const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

export default function Turnstile({ onToken, resetKey = 0 }: { onToken: (token: string) => void; resetKey?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | null>(null);

  // Reinicia el widget cuando el padre incrementa resetKey (tras un intento fallido)
  useEffect(() => {
    if (resetKey > 0 && widgetId.current && window.turnstile) {
      onToken("");
      window.turnstile.reset(widgetId.current);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey]);

  useEffect(() => {
    if (!SITE_KEY) {
      onToken("dev-no-turnstile");
      return;
    }
    const SCRIPT_ID = "cf-turnstile-script";
    function renderWidget() {
      if (!ref.current || !window.turnstile || widgetId.current) return;
      widgetId.current = window.turnstile.render(ref.current, {
        sitekey: SITE_KEY,
        callback: (token: string) => onToken(token),
        "error-callback": () => onToken(""),
        "expired-callback": () => onToken(""),
        theme: "light",
      });
    }
    if (!document.getElementById(SCRIPT_ID)) {
      const s = document.createElement("script");
      s.id = SCRIPT_ID;
      s.src = "https://challenges.cloudflare.com/turnstile/v0/api.js";
      s.async = true;
      s.defer = true;
      s.onload = renderWidget;
      document.head.appendChild(s);
    } else {
      renderWidget();
    }
  }, [onToken]);

  if (!SITE_KEY) return null;
  return <div ref={ref} className="flex justify-center" />;
}
