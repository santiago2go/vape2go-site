import Link from "next/link";
import { Zap, Package, Shield } from "lucide-react";
import HeroCarousel from "@/components/HeroCarousel";
import ProductCard from "@/components/ProductCard";
import { getBestsellers, CATEGORIES, PEDIDOSYA_URL, WHATSAPP_URL } from "@/data/products";

export default function HomePage() {
  const bestsellers = getBestsellers(12);

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-16">
      {/* Hero */}
      <HeroCarousel />

      {/* Category cards */}
      <section>
        <h2 className="text-2xl font-normal text-gray-900 mb-6">Explora por categoría</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {CATEGORIES.map((cat) => (
            <Link
              key={cat.id}
              href={`/categoria/${cat.id}/`}
              className="card-light p-5 flex flex-col gap-3 hover:border-violet-300 hover:shadow-md hover:shadow-violet-100/40 transition-all duration-200 group"
            >
              <span className="text-3xl">{cat.icon}</span>
              <div>
                <h3 className="font-semibold text-gray-900 group-hover:text-violet-600 transition-colors">
                  {cat.label}
                </h3>
                <p className="text-xs text-gray-400 mt-1">{cat.description}</p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Bestsellers */}
      <section>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-normal text-gray-900">Productos destacados</h2>
          <Link href="/catalogo/" className="text-sm text-violet-600 hover:text-violet-800 transition-colors">
            Ver todos →
          </Link>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {bestsellers.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      </section>

      {/* How to order */}
      <section className="bg-gray-50 rounded-2xl p-8 md:p-12 border border-gray-100">
        <h2 className="text-2xl font-normal text-gray-900 text-center mb-10">¿Cómo pedir?</h2>
        <div className="grid md:grid-cols-3 gap-8">
          {[
            { step: "01", title: "Elige tu vape", desc: "Navega el catálogo y encuentra el desechable, pod o liquid que quieres.", color: "text-violet-600" },
            { step: "02", title: "Pide por PedidosYa", desc: "Abre PedidosYa, busca Vape 2 Go y agrega tus productos al carrito.", color: "text-blue-600" },
            { step: "03", title: "Recíbelo rápido", desc: "Entrega a domicilio en Santiago. También puedes escribirnos por WhatsApp.", color: "text-emerald-600" },
          ].map(({ step, title, desc, color }) => (
            <div key={step} className="text-center space-y-3">
              <div className={`text-4xl font-normal ${color}`}>{step}</div>
              <h3 className="font-semibold text-gray-900 text-lg">{title}</h3>
              <p className="text-sm text-gray-500 leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
        <div className="flex flex-col sm:flex-row gap-4 justify-center mt-10">
          <a href={PEDIDOSYA_URL} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center bg-violet-600 text-white font-semibold px-8 py-3 rounded-xl hover:bg-violet-700 transition-colors">
            Abrir PedidosYa
          </a>
          <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center border border-gray-200 text-gray-700 px-8 py-3 rounded-xl hover:border-gray-300 hover:text-gray-900 transition-colors">
            Escribir por WhatsApp
          </a>
        </div>
      </section>

      {/* Trust bar */}
      <section className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        {[
          { icon: Zap, title: "Entrega rápida", desc: "Pedidos por PedidosYa directo a tu puerta en Santiago.", iconClass: "text-violet-600 bg-violet-50" },
          { icon: Shield, title: "Marcas originales", desc: "Solo productos 100% auténticos. Sin réplicas ni imitaciones.", iconClass: "text-blue-600 bg-blue-50" },
          { icon: Package, title: "Amplio catálogo", desc: "Más de 600 productos entre desechables, pods, liquids y accesorios.", iconClass: "text-emerald-600 bg-emerald-50" },
        ].map(({ icon: Icon, title, desc, iconClass }) => (
          <div key={title} className="card-light p-6 flex gap-4 items-start hover:border-gray-300 transition-colors">
            <div className={`p-2.5 rounded-xl shrink-0 ${iconClass}`}>
              <Icon size={20} />
            </div>
            <div>
              <h4 className="font-semibold text-gray-900">{title}</h4>
              <p className="text-sm text-gray-500 mt-1 leading-relaxed">{desc}</p>
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
