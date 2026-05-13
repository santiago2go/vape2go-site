import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Check } from "lucide-react";
import ProductCard from "@/components/ProductCard";
import VapePlaceholder from "@/components/VapePlaceholder";
import {
  getProductBySlug,
  getAllSlugs,
  getProductsByCategory,
  CATEGORIES,
  PEDIDOSYA_URL,
  type Category,
} from "@/data/products";

export function generateStaticParams() {
  return getAllSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const product = getProductBySlug(slug);
  if (!product) return {};
  return {
    title: `${product.name} | Vape 2 Go`,
    description:
      product.description ||
      `Compra ${product.name} de ${product.brand} en Vape 2 Go. Entrega rápida en Santiago, RD.`,
    keywords: product.tags,
    openGraph: {
      title: product.name,
      description: product.description || `${product.brand} · ${product.category}`,
      images: product.image ? [{ url: product.image }] : [],
    },
  };
}

const CATEGORY_STYLES: Record<Category, { label: string; bg: string; text: string }> = {
  desechables: { label: "Desechable", bg: "bg-violet-100", text: "text-violet-700" },
  pods:        { label: "Pod",        bg: "bg-blue-100",   text: "text-blue-700" },
  liquids:     { label: "Liquid",     bg: "bg-emerald-100",text: "text-emerald-700" },
  accesorios:  { label: "Accesorio",  bg: "bg-gray-100",   text: "text-gray-600" },
};

export default async function ProductPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const product = getProductBySlug(slug);
  if (!product) notFound();

  const catMeta = CATEGORIES.find((c) => c.id === product.category);
  const catStyle = CATEGORY_STYLES[product.category];
  const related = getProductsByCategory(product.category)
    .filter((p) => p.id !== product.id)
    .slice(0, 4);

  const productSchema = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    sku: product.sku,
    brand: { "@type": "Brand", name: product.brand },
    description: product.description || undefined,
    image: product.image || undefined,
    offers: {
      "@type": "Offer",
      priceCurrency: "DOP",
      price: product.price,
      availability: product.disponible
        ? "https://schema.org/InStock"
        : "https://schema.org/OutOfStock",
      url: `https://vapes.do/productos/${product.id}/`,
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(productSchema) }}
      />

      <div className="max-w-6xl mx-auto px-4 py-10 space-y-12">
        {/* Breadcrumb */}
        <nav className="text-sm text-gray-400 flex items-center gap-2 flex-wrap">
          <Link href="/" className="hover:text-gray-700 transition-colors">Inicio</Link>
          <span>/</span>
          <Link href="/catalogo/" className="hover:text-gray-700 transition-colors">Tienda</Link>
          <span>/</span>
          {catMeta && (
            <>
              <Link href={`/categoria/${product.category}/`} className="hover:text-gray-700 transition-colors">
                {catMeta.label}
              </Link>
              <span>/</span>
            </>
          )}
          <span className="text-gray-700 truncate max-w-[200px]">{product.name}</span>
        </nav>

        {/* Product detail */}
        <div className="grid md:grid-cols-2 gap-10">
          {/* Image */}
          <div className="card-light aspect-square flex items-center justify-center relative overflow-hidden bg-gray-50">
            {product.image ? (
              <Image
                src={product.image}
                alt={product.name}
                fill
                className="object-contain p-8"
                priority
                sizes="(max-width: 768px) 100vw, 50vw"
              />
            ) : (
              <VapePlaceholder className="w-3/4 h-3/4" />
            )}
          </div>

          {/* Info */}
          <div className="space-y-5">
            {/* Badges */}
            <div className="flex gap-2 flex-wrap">
              <span className={`text-xs font-semibold px-3 py-1 rounded-full ${catStyle.bg} ${catStyle.text}`}>
                {catMeta?.icon} {catStyle.label}
              </span>
              {product.disponible ? (
                <span className="text-xs font-semibold px-3 py-1 rounded-full bg-green-50 text-green-700">
                  Disponible
                </span>
              ) : (
                <span className="text-xs font-semibold px-3 py-1 rounded-full bg-gray-100 text-gray-400">
                  Agotado
                </span>
              )}
            </div>

            <p className="text-xs text-gray-400 uppercase tracking-widest">{product.brand}</p>
            <h1 className="text-3xl font-normal text-gray-900 leading-tight">{product.name}</h1>
            <p className="text-xs text-gray-400">SKU: {product.sku}</p>

            {product.price > 0 && (
              <p className="text-3xl font-bold text-violet-700">{product.priceFormatted}</p>
            )}

            {product.disponible ? (
              <a
                href={PEDIDOSYA_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="block text-center font-semibold text-sm py-4 rounded-xl transition-colors bg-violet-600 text-white hover:bg-violet-700"
              >
                Pedir por PedidosYa
              </a>
            ) : (
              <span className="block text-center font-semibold text-sm py-4 rounded-xl bg-gray-100 text-gray-400 cursor-not-allowed">
                No disponible
              </span>
            )}

            {product.description && (
              <div className="space-y-2 pt-2 border-t border-gray-100">
                <h3 className="font-semibold text-gray-900 text-sm">Descripción</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{product.description}</p>
              </div>
            )}

            {product.features.length > 0 && (
              <div className="space-y-2">
                <h3 className="font-semibold text-gray-900 text-sm">Características</h3>
                <ul className="space-y-1.5">
                  {product.features.map((f, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-gray-500">
                      <Check size={14} className="text-violet-600 mt-0.5 shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>

        {/* Related */}
        {related.length > 0 && (
          <section className="space-y-6 pt-6 border-t border-gray-100">
            <h2 className="text-xl font-normal text-gray-900">
              Más {catMeta?.label.toLowerCase() ?? "productos"}
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {related.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          </section>
        )}
      </div>
    </>
  );
}
