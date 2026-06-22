import type { Metadata } from "next";
import Link from "next/link";
import ProductCard from "@/components/ProductCard";
import TrackView from "@/components/TrackView";
import {
  getProductsByCategory,
  CATEGORIES,
  SITE_URL,
  type Category,
} from "@/data/products";

export function generateStaticParams() {
  return CATEGORIES.map((cat) => ({ cat: cat.id }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ cat: string }>;
}): Promise<Metadata> {
  const { cat } = await params;
  const meta = CATEGORIES.find((c) => c.id === cat);
  if (!meta) return {};

  const title = `${meta.seoTitle} | Vape 2 Go`;
  const description = `Compra ${meta.label.toLowerCase()} en Vape 2 Go. ${meta.description}. Entrega rápida en Santiago, RD.`;
  const canonical = `${SITE_URL}/categoria/${meta.id}/`;

  return {
    title,
    description,
    keywords: meta.keywords,
    alternates: { canonical },
    openGraph: {
      type: "website",
      locale: "es_DO",
      siteName: "Vape 2 Go",
      title,
      description,
      url: canonical,
    },
    twitter: {
      card: "summary",
      title,
      description,
    },
  };
}

export default async function CategoryPage({
  params,
}: {
  params: Promise<{ cat: string }>;
}) {
  const { cat } = await params;
  const meta = CATEGORIES.find((c) => c.id === (cat as Category));
  const products = meta ? getProductsByCategory(cat as Category) : [];

  if (!meta) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-20 text-center">
        <p className="text-gray-400">Categoría no encontrada.</p>
        <Link href="/catalogo/" className="text-violet-600 mt-4 inline-block hover:underline">
          Ver catálogo →
        </Link>
      </div>
    );
  }

  const canonical = `${SITE_URL}/categoria/${meta.id}/`;

  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Inicio", item: `${SITE_URL}/` },
      { "@type": "ListItem", position: 2, name: "Tienda", item: `${SITE_URL}/catalogo/` },
      { "@type": "ListItem", position: 3, name: meta.label, item: canonical },
    ],
  };

  const collectionSchema = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: `${meta.seoTitle} | Vape 2 Go`,
    description: meta.intro,
    url: canonical,
    isPartOf: { "@type": "WebSite", name: "Vape 2 Go", url: `${SITE_URL}/` },
    about: meta.label,
    mainEntity: {
      "@type": "ItemList",
      numberOfItems: products.length,
      itemListElement: products.slice(0, 20).map((p, i) => ({
        "@type": "ListItem",
        position: i + 1,
        url: `${SITE_URL}/productos/${p.id}/`,
        name: p.name,
      })),
    },
  };

  return (
    <>
      <TrackView event="view_listing" category={meta.id} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(collectionSchema) }}
      />

      <div className="max-w-6xl mx-auto px-4 py-10 space-y-8">
        {/* Breadcrumb */}
        <nav className="text-sm text-gray-400 flex items-center gap-2 flex-wrap">
          <Link href="/" className="hover:text-gray-700 transition-colors">Inicio</Link>
          <span>/</span>
          <Link href="/catalogo/" className="hover:text-gray-700 transition-colors">Tienda</Link>
          <span>/</span>
          <span className="text-gray-700">{meta.label}</span>
        </nav>

        {/* Header */}
        <div className="flex items-center gap-4">
          <span className="text-4xl">{meta.icon}</span>
          <div>
            <h1 className="text-3xl font-normal text-gray-900">{meta.seoTitle}</h1>
            <p className="text-gray-500 mt-1 text-sm">
              {products.length} productos · {meta.description}
            </p>
          </div>
        </div>

        {/* Intro SEO (evita thin content) */}
        <p className="text-gray-500 text-sm leading-relaxed max-w-3xl">{meta.intro}</p>

        {/* Other categories */}
        <div className="flex flex-wrap gap-2">
          {CATEGORIES.filter((c) => c.id !== cat).map((c) => (
            <Link
              key={c.id}
              href={`/categoria/${c.id}/`}
              className="px-3 py-1.5 rounded-full text-xs border border-gray-200 text-gray-500 hover:border-violet-300 hover:text-violet-600 transition-colors"
            >
              {c.icon} {c.label}
            </Link>
          ))}
        </div>

        {/* Grid */}
        {products.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {products.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        ) : (
          <p className="text-gray-400 py-12 text-center text-sm">
            No hay productos en esta categoría todavía.
          </p>
        )}
      </div>
    </>
  );
}
