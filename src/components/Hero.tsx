import Link from "next/link";
import Image from "next/image";
import { ArrowRight, Check } from "lucide-react";
import { getHeroProducts, CATEGORIES, PEDIDOSYA_URL } from "@/data/products";
import CategoryThumb from "./CategoryThumb";

const TRUST = [
  "100% originales",
  "Entrega el mismo día",
  "+600 productos",
  "Solo mayores de 18",
];

/**
 * Hero único y enfocado (reemplaza el carrusel de 5 slides). Una sola propuesta
 * de valor, un CTA dominante, best sellers reales como ancla visual. Server
 * component: cero JS al cliente, sin framer-motion → mejor LCP/CWV.
 */
export default function Hero() {
  const products = getHeroProducts();

  return (
    <section className="relative overflow-hidden rounded-2xl border border-gray-100 bg-gradient-to-br from-violet-50 via-white to-white">
      <div className="grid lg:grid-cols-2 gap-8 lg:gap-10 items-center px-6 py-10 md:px-12 md:py-14">
        {/* Texto */}
        <div className="space-y-6">
          <span className="inline-flex items-center text-xs font-semibold uppercase tracking-widest text-violet-700 bg-violet-100 px-3 py-1 rounded-full">
            Vapes originales · Santiago, RD
          </span>

          <h1 className="text-4xl md:text-5xl leading-[1.1] text-gray-900">
            Tu vape favorito,
            <br />
            <span className="text-violet-600">en tu puerta hoy.</span>
          </h1>

          <p className="text-base md:text-lg text-gray-600 leading-relaxed max-w-md">
            Desechables, pods, liquids y accesorios{" "}
            <strong className="font-semibold text-gray-900">100% originales</strong>.
            Pídelo ahora y recíbelo el mismo día en Santiago de los Caballeros.
          </p>

          {/* CTAs — una acción claramente dominante */}
          <div className="flex flex-col sm:flex-row gap-3 pt-1">
            <a
              href={PEDIDOSYA_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 bg-violet-600 text-white font-semibold text-base px-7 py-3.5 rounded-xl shadow-lg shadow-violet-600/25 hover:bg-violet-700 transition-all"
            >
              Pedir ahora <ArrowRight size={18} />
            </a>
            <Link
              href="/catalogo/"
              className="inline-flex items-center justify-center px-7 py-3.5 rounded-xl border border-gray-300 text-gray-700 font-medium hover:border-gray-400 hover:bg-gray-50 transition-colors"
            >
              Ver catálogo
            </Link>
          </div>

          {/* Señales de confianza */}
          <ul className="flex flex-wrap gap-x-5 gap-y-2 pt-2">
            {TRUST.map((t) => (
              <li key={t} className="flex items-center gap-1.5 text-sm text-gray-600">
                <Check size={15} className="text-emerald-600 shrink-0" />
                {t}
              </li>
            ))}
          </ul>
        </div>

        {/* Ancla visual — best sellers reales */}
        <div className="grid grid-cols-2 gap-4">
          {products.map((p) => (
            <Link
              key={p.id}
              href={`/productos/${p.id}/`}
              className="group relative aspect-square overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm hover:border-violet-200 hover:shadow-md transition-all"
            >
              <Image
                src={p.image!}
                alt={p.name}
                fill
                className="object-contain p-5 group-hover:scale-105 transition-transform duration-300"
                sizes="(max-width: 1024px) 45vw, 25vw"
              />
              <span className="absolute top-2 left-2 text-[10px] font-bold uppercase tracking-wide bg-violet-600 text-white px-2 py-0.5 rounded-full">
                Top
              </span>
            </Link>
          ))}
        </div>
      </div>

      {/* Quick-links de categoría (preservan la navegación que daban los slides) */}
      <div className="border-t border-gray-100 bg-white/70 px-6 md:px-12 py-4 flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-gray-500 mr-1">Explora:</span>
        {CATEGORIES.map((cat) => (
          <Link
            key={cat.id}
            href={`/categoria/${cat.id}/`}
            className="inline-flex items-center gap-2 text-sm text-gray-700 bg-gray-50 hover:bg-violet-50 hover:text-violet-700 border border-gray-200 hover:border-violet-200 pl-1.5 pr-3.5 py-1.5 rounded-full transition-colors"
          >
            <CategoryThumb category={cat.id} className="w-6 h-6 rounded-full" pad="p-1" />
            {cat.label}
          </Link>
        ))}
      </div>
    </section>
  );
}
