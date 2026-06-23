import Link from "next/link";
import { Zap, Package, Shield, ArrowRight } from "lucide-react";
import Hero from "@/components/Hero";
import ProductCard from "@/components/ProductCard";
import TrackView from "@/components/TrackView";
import CategoryThumb from "@/components/CategoryThumb";
import { getBestsellers, getAllProducts, CATEGORIES, PEDIDOSYA_URL } from "@/data/products";

export default function HomePage() {
  const bestsellers = getBestsellers(12);
  const disponibles = getAllProducts().filter((p) => p.disponible).length;

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-16">
      <TrackView event="view_home" />
      {/* Hero */}
      <Hero />

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
              <CategoryThumb
                category={cat.id}
                className="w-16 h-16 rounded-xl"
                pad="p-3"
              />
              <div>
                <h3 className="font-semibold text-gray-900 group-hover:text-violet-600 transition-colors">
                  {cat.label}
                </h3>
                <p className="text-xs text-gray-500 mt-1">{cat.description}</p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Bestsellers */}
      <section>
        <div className="flex items-center justify-between gap-4 mb-6">
          <h2 className="text-2xl font-normal text-gray-900">Productos destacados</h2>
          <Link
            href="/catalogo/"
            className="hidden sm:inline-flex items-center gap-1.5 text-sm font-semibold text-violet-600 hover:text-violet-800 transition-colors shrink-0"
          >
            Ver catálogo completo <ArrowRight size={16} />
          </Link>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {bestsellers.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>

        {/* CTA explícito: motiva a navegar todo el catálogo */}
        <div className="mt-10 flex flex-col items-center gap-3 text-center">
          <Link
            href="/catalogo/"
            className="group inline-flex items-center justify-center gap-2 bg-violet-600 text-white font-semibold text-base px-8 py-4 rounded-xl shadow-lg shadow-violet-600/25 hover:bg-violet-700 transition-all"
          >
            Explorar los {disponibles} productos
            <ArrowRight size={18} className="group-hover:translate-x-0.5 transition-transform" />
          </Link>
          <p className="text-sm text-gray-500">
            Desechables, pods, liquids y accesorios — filtra por marca, sabor o precio.
          </p>
        </div>
      </section>

      {/* How to order */}
      <section className="bg-gray-50 rounded-2xl p-8 md:p-12 border border-gray-100">
        <h2 className="text-2xl font-normal text-gray-900 text-center mb-10">¿Cómo pedir?</h2>
        <div className="grid md:grid-cols-3 gap-8">
          {[
            { step: "01", title: "Elige tu vape", desc: "Navega el catálogo y encuentra el desechable, pod o liquid que quieres.", color: "text-violet-600" },
            { step: "02", title: "Pide por PedidosYa", desc: "Abre PedidosYa, busca Vape 2 Go y agrega tus productos al carrito.", color: "text-blue-600" },
            { step: "03", title: "Recíbelo rápido", desc: "Entrega a domicilio en Santiago, rápido y seguro.", color: "text-emerald-600" },
          ].map(({ step, title, desc, color }) => (
            <div key={step} className="text-center space-y-3">
              <div className={`text-4xl font-normal ${color}`}>{step}</div>
              <h3 className="font-semibold text-gray-900 text-lg">{title}</h3>
              <p className="text-sm text-gray-500 leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
        <div className="flex justify-center mt-10">
          <a href={PEDIDOSYA_URL} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center bg-violet-600 text-white font-semibold px-8 py-3 rounded-xl hover:bg-violet-700 transition-colors">
            Abrir PedidosYa
          </a>
        </div>
      </section>

      {/* Trust bar */}
      <section className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        {[
          { icon: Zap, title: "Entrega rápida", desc: "Pedidos por PedidosYa directo a tu puerta en Santiago.", gradient: "from-violet-500 to-violet-700" },
          { icon: Shield, title: "Marcas originales", desc: "Solo productos 100% auténticos. Sin réplicas ni imitaciones.", gradient: "from-blue-500 to-blue-700" },
          { icon: Package, title: "Amplio catálogo", desc: "Más de 600 productos entre desechables, pods, liquids y accesorios.", gradient: "from-emerald-500 to-emerald-700" },
        ].map(({ icon: Icon, title, desc, gradient }) => (
          <div key={title} className="card-light p-6 flex gap-4 items-start hover:border-gray-300 hover:shadow-md transition-all">
            <div className={`grid place-items-center w-14 h-14 rounded-2xl shrink-0 bg-gradient-to-br ${gradient} text-white shadow-sm`}>
              <Icon size={26} />
            </div>
            <div>
              <h4 className="font-semibold text-gray-900 text-lg">{title}</h4>
              <p className="text-sm text-gray-500 mt-1 leading-relaxed">{desc}</p>
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
