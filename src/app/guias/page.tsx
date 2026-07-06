import type { Metadata } from "next";
import Link from "next/link";
import { SITE_URL } from "@/data/products";
import { GUIAS } from "@/data/guias";

export const metadata: Metadata = {
  title: "Guías de vapeo",
  description:
    "Guías prácticas de vapeo en RD: sabores de Terea, diferencias entre marcas y cómo elegir tu vape. De Vape 2 Go, Santiago de los Caballeros.",
  alternates: { canonical: `${SITE_URL}/guias/` },
  openGraph: {
    type: "website",
    locale: "es_DO",
    siteName: "Vape 2 Go",
    title: "Guías de vapeo | Vape 2 Go",
    description: "Sabores, marcas y cómo elegir tu vape. Guías prácticas de Vape 2 Go, Santiago, RD.",
    url: `${SITE_URL}/guias/`,
  },
};

export default function GuiasIndex() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-10 space-y-8">
      <nav className="text-sm text-gray-400 flex items-center gap-2 flex-wrap">
        <Link href="/" className="hover:text-gray-700 transition-colors">Inicio</Link>
        <span>/</span>
        <span className="text-gray-700">Guías</span>
      </nav>

      <header>
        <h1 className="text-3xl font-normal text-gray-900">Guías de vapeo</h1>
        <p className="text-gray-500 mt-2 text-sm leading-relaxed">
          Todo lo que necesitas saber para elegir bien: sabores, marcas y diferencias, explicado fácil
          y en dominicano. De Vape 2 Go, Santiago de los Caballeros.
        </p>
      </header>

      <div className="space-y-4">
        {GUIAS.map((g) => (
          <Link
            key={g.id}
            href={`/guias/${g.id}/`}
            className="block rounded-2xl border border-gray-200 p-6 hover:border-violet-300 transition-colors"
          >
            <h2 className="text-xl font-normal text-gray-900">{g.title}</h2>
            <p className="text-sm text-gray-500 mt-2 leading-relaxed">{g.intro}</p>
            <span className="text-violet-600 text-sm font-semibold mt-3 inline-block">Leer guía →</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
