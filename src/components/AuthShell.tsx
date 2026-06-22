"use client";

import Link from "next/link";
import { isSupabaseConfigured } from "@/lib/supabase";

/** Contenedor visual compartido por las pantallas de auth (Editorial Premium). */
export default function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4 py-16">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="inline-block text-3xl text-gray-900" style={{ fontFamily: "var(--font-heading)" }}>
            Vape 2 Go
          </Link>
        </div>
        <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-8">
          <h1 className="text-2xl text-gray-900 mb-1" style={{ fontFamily: "var(--font-heading)" }}>
            {title}
          </h1>
          {subtitle && <p className="text-sm text-gray-500 mb-6">{subtitle}</p>}

          {!isSupabaseConfigured ? (
            <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 text-sm text-amber-800">
              El registro estará disponible muy pronto. Estamos terminando de configurar
              tu cuenta segura. Mientras tanto puedes seguir pidiendo por PedidosYa.
            </div>
          ) : (
            children
          )}
        </div>
        {footer && <div className="text-center mt-6 text-sm text-gray-500">{footer}</div>}
        <p className="text-center mt-8 text-[11px] text-gray-400 leading-relaxed">
          Solo para mayores de 18 años. El consumo de nicotina es perjudicial para la salud.
          Al continuar aceptas nuestros{" "}
          <Link href="/terminos/" className="underline hover:text-gray-600">Términos</Link> y la{" "}
          <Link href="/privacidad/" className="underline hover:text-gray-600">Política de Privacidad</Link>.
        </p>
      </div>
    </div>
  );
}
