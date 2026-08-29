"use client";
import { useEffect, useRef } from "react";

type Opts = { onScan: (code: string) => void; minLen?: number; maxGapMs?: number; enabled?: boolean };

/** Detecta un lector de código de barras (keyboard-wedge) por CADENCIA: ráfaga de
 *  teclas + Enter. No rompe la escritura humana (cadencia lenta) ni los inputs. */
export function useBarcodeScanner({ onScan, minLen = 4, maxGapMs = 50, enabled = true }: Opts) {
  const buf = useRef("");
  const lastT = useRef(0);
  const gaps = useRef<number[]>([]);
  const cb = useRef(onScan);
  cb.current = onScan;

  useEffect(() => {
    if (!enabled) return;
    function onKey(e: KeyboardEvent) {
      const now = performance.now();
      const gap = now - lastT.current;
      lastT.current = now;
      // Reset si hubo pausa "humana" (>120ms) => buffer nuevo.
      if (gap > 120) { buf.current = ""; gaps.current = []; }

      if (e.key === "Enter") {
        const code = buf.current;
        const avg = gaps.current.length ? gaps.current.reduce((a, b) => a + b, 0) / gaps.current.length : 999;
        buf.current = ""; gaps.current = [];
        // ESCANEO = suficientemente largo + cadencia de máquina.
        if (code.length >= minLen && avg < maxGapMs) {
          e.preventDefault();      // que el Enter NO dispare submit ni salte foco
          e.stopPropagation();
          cb.current(code);
        }
        return;
      }
      // Solo caracteres imprimibles de 1 char (dígitos/letras del código).
      if (e.key.length === 1) {
        if (buf.current !== "") gaps.current.push(gap);
        buf.current += e.key;
      }
    }
    // Capture=true para verlo antes que el input; no cancelamos el keydown normal
    // (dejamos fluir la escritura manual), solo actuamos en el Enter-de-ráfaga.
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [minLen, maxGapMs, enabled]);
}
