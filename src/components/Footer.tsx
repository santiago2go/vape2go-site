import Link from "next/link";
import Logo from "./Logo";
import CategoryThumb from "./CategoryThumb";
import { CATEGORIES, INSTAGRAM_URL, TIKTOK_URL, PEDIDOSYA_URL, DIRECT_ORDERS } from "@/data/catalog-meta";

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
            <a href={INSTAGRAM_URL} target="_blank" rel="noopener noreferrer" className="text-sm text-gray-500 hover:text-gray-700 transition-colors">
              Instagram
            </a>
            <a href={TIKTOK_URL} target="_blank" rel="noopener noreferrer" className="text-sm text-gray-500 hover:text-gray-700 transition-colors">
              TikTok
            </a>
          </div>
          <address className="not-italic space-y-1 text-sm text-gray-500 leading-relaxed">
            <p>Plaza Comercial Bolívar, primer piso, Padre Las Casas, Santiago de los Caballeros, RD</p>
            <p>
              <a href="https://wa.me/18297224238" target="_blank" rel="noopener noreferrer" className="hover:text-gray-700 transition-colors">
                WhatsApp: 829-722-4238
              </a>
            </p>
            <p>Lun–Vie 8:00 AM–10:00 PM · Sáb–Dom 10:00 AM–8:00 PM</p>
          </address>
        </div>

        {/* Categorías */}
        <div>
          <h4 className="text-sm font-semibold text-gray-900 mb-4">Categorías</h4>
          <ul className="space-y-2">
            {CATEGORIES.map((cat) => (
              <li key={cat.id}>
                <Link href={`/categoria/${cat.id}/`} className="flex items-center gap-2 text-sm text-gray-500 hover:text-violet-600 transition-colors">
                  <CategoryThumb category={cat.id} className="w-5 h-5 rounded" />
                  {cat.label}
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
            <li>
              <Link href="/guias/" className="text-sm text-gray-500 hover:text-violet-600 transition-colors">
                Guías de vapeo
              </Link>
            </li>
            <li>
              <Link href="/cuenta/" className="text-sm text-gray-500 hover:text-violet-600 transition-colors">
                Mi cuenta
              </Link>
            </li>
            <li>
              <Link href="/entrar/" className="text-sm text-gray-500 hover:text-violet-600 transition-colors">
                Entrar / Registrarme
              </Link>
            </li>
          </ul>
        </div>

        {/* CTA */}
        <div>
          <h4 className="text-sm font-semibold text-gray-900 mb-4">Pide ahora</h4>
          {DIRECT_ORDERS ? (
            <Link
              href="/catalogo/"
              className="inline-block bg-violet-600 text-white text-sm font-semibold px-5 py-2.5 rounded-lg hover:bg-violet-700 transition-colors"
            >
              Comprar ahora
            </Link>
          ) : (
            <a
              href={PEDIDOSYA_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block bg-violet-600 text-white text-sm font-semibold px-5 py-2.5 rounded-lg hover:bg-violet-700 transition-colors"
            >
              Abrir PedidosYa
            </a>
          )}
        </div>
      </div>

      <div className="border-t border-gray-200 py-4 text-center space-y-2">
        <div className="flex items-center justify-center gap-4 flex-wrap text-xs">
          <Link href="/privacidad/" className="text-gray-500 hover:text-gray-700 transition-colors">Privacidad</Link>
          <Link href="/terminos/" className="text-gray-500 hover:text-gray-700 transition-colors">Términos</Link>
          <Link href="/privacidad-datos/" className="text-gray-500 hover:text-gray-700 transition-colors">Etiqueta de privacidad</Link>
        </div>
        <p className="text-xs text-gray-500">
          © 2026 Vape 2 Go · Santiago, República Dominicana
        </p>
      </div>
    </footer>
  );
}
