import Link from "next/link";
import Logo from "./Logo";
import { CATEGORIES, INSTAGRAM_URL } from "@/data/products";

export default function Footer() {
  return (
    <footer className="border-t border-gray-200 bg-gray-50 mt-20">
      {/* 18+ legal banner */}
      <div className="bg-amber-50 border-b border-amber-200 py-2 text-center">
        <p className="text-xs text-amber-700">
          ⚠️ Solo para mayores de 18 años. Vape 2 Go no promueve el consumo de nicotina ni sus efectos.
        </p>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
        {/* Brand */}
        <div className="space-y-4">
          <Logo />
          <p className="text-sm text-gray-500 leading-relaxed">
            Tu vape favorito, donde estés. Entrega rápida en Santiago, RD vía PedidosYa.
          </p>
          <div className="flex gap-4">
            <a href={INSTAGRAM_URL} target="_blank" rel="noopener noreferrer" className="text-sm text-gray-400 hover:text-gray-700 transition-colors">
              Instagram
            </a>
          </div>
        </div>

        {/* Categorías */}
        <div>
          <h4 className="text-sm font-semibold text-gray-900 mb-4">Categorías</h4>
          <ul className="space-y-2">
            {CATEGORIES.map((cat) => (
              <li key={cat.id}>
                <Link href={`/categoria/${cat.id}/`} className="text-sm text-gray-500 hover:text-violet-600 transition-colors">
                  {cat.icon} {cat.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        {/* Tienda */}
        <div>
          <h4 className="text-sm font-semibold text-gray-900 mb-4">Tienda</h4>
          <ul className="space-y-2">
            <li>
              <Link href="/catalogo/" className="text-sm text-gray-500 hover:text-violet-600 transition-colors">
                Catálogo completo
              </Link>
            </li>
          </ul>
        </div>

        {/* CTA */}
        <div>
          <h4 className="text-sm font-semibold text-gray-900 mb-4">Pide ahora</h4>
          <a
            href="https://www.pedidosya.com.do"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block bg-violet-600 text-white text-sm font-semibold px-5 py-2.5 rounded-lg hover:bg-violet-700 transition-colors"
          >
            Abrir PedidosYa
          </a>
        </div>
      </div>

      <div className="border-t border-gray-200 py-4 text-center">
        <p className="text-xs text-gray-400">
          © 2026 Vape 2 Go · Santiago, República Dominicana
        </p>
      </div>
    </footer>
  );
}
