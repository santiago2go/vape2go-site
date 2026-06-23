"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "v2g_age_ok";

export default function AgeGate() {
  // null = aún sin determinar (evita flash); true = mostrar gate; false = ya verificado
  const [show, setShow] = useState<boolean | null>(null);

  useEffect(() => {
    try {
      const ok = localStorage.getItem(STORAGE_KEY) === "1";
      setShow(!ok);
    } catch {
      setShow(true);
    }
  }, []);

  function accept() {
    try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch {}
    setShow(false);
  }

  function leave() {
    window.location.href = "https://www.google.com";
  }

  if (show !== true) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-gray-900/80 backdrop-blur-sm px-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="age-gate-title"
    >
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-8 text-center space-y-5">
        <div className="text-5xl">🔞</div>
        <h2
          id="age-gate-title"
          className="text-2xl text-gray-900"
          style={{ fontFamily: "var(--font-heading)" }}
        >
          ¿Eres mayor de 18 años?
        </h2>
        <p className="text-sm text-gray-500 leading-relaxed">
          Vape 2 Go vende productos con nicotina destinados exclusivamente a personas
          mayores de edad. Debes confirmar que tienes 18 años o más para continuar.
        </p>
        <div className="flex flex-col gap-3 pt-2">
          <button
            onClick={accept}
            className="w-full font-semibold text-sm py-3.5 rounded-xl bg-violet-600 text-white hover:bg-violet-700 transition-colors"
          >
            Sí, soy mayor de 18
          </button>
          <button
            onClick={leave}
            className="w-full font-medium text-sm py-3.5 rounded-xl border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors"
          >
            No, soy menor — salir
          </button>
        </div>
        <p className="text-xs text-gray-500 pt-1">
          El consumo de nicotina es perjudicial para la salud.
        </p>
      </div>
    </div>
  );
}
