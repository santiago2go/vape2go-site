import type { Metadata } from "next";
import Link from "next/link";
import ProductCard from "@/components/ProductCard";
import { SITE_URL } from "@/data/products";
import { BRANDS, getBrandBySlug, getProductsByBrand } from "@/data/brands";

export function generateStaticParams() {
  return BRANDS.map((b) => ({ brand: b.id }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ brand: string }>;
}): Promise<Metadata> {
  const { brand } = await params;
  const meta = getBrandBySlug(brand);
  if (!meta) return {};

  const title = `${meta.seoTitle} | Vape 2 Go`;
  const description = `Compra ${meta.name} original en Vape 2 Go, Santiago, RD. Entrega rápida el mismo día. ${meta.intro.slice(0, 90)}`;
  const canonical = `${SITE_URL}/marca/${meta.id}/`;

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
    twitter: { card: "summary", title, description },
  };
}

export default async function BrandPage({
  params,
}: {
  params: Promise<{ brand: string }>;
}) {
  const { brand } = await params;
  const meta = getBrandBySlug(brand);

  if (!meta) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-20 text-center">
        <p className="text-gray-400">Marca no encontrada.</p>
        <Link href="/catalogo/" className="text-violet-600 mt-4 inline-block hover:underline">
          Ver catálogo →
        </Link>
      </div>
    );
  }

  const products = getProductsByBrand(meta.name);
  const canonical = `${SITE_URL}/marca/${meta.id}/`;

  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Inicio", item: `${SITE_URL}/` },
      { "@type": "ListItem", position: 2, name: "Tienda", item: `${SITE_URL}/catalogo/` },
      { "@type": "ListItem", position: 3, name: meta.name, item: canonical },
    ],
  };

  const brandSchema = {
    "@context": "https://schema.org",
    "@type": "Brand",
    name: meta.name,
    description: meta.intro,
    url: canonical,
  };

  const collectionSchema = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: `${meta.seoTitle} | Vape 2 Go`,
    description: meta.intro,
    url: canonical,
    isPartOf: { "@type": "WebSite", name: "Vape 2 Go", url: `${SITE_URL}/` },
    about: { "@type": "Brand", name: meta.name },
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

  const otherBrands = BRANDS.filter((b) => b.id !== meta.id).slice(0, 12);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(brandSchema) }}
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
          <span className="text-gray-700">{meta.name}</span>
        </nav>

        {/* Header */}
        <div>
          <h1 className="text-3xl font-normal text-gray-900">{meta.seoTitle}</h1>
          <p className="text-gray-500 mt-1 text-sm">
            {products.length} productos de {meta.name}
          </p>
        </div>

        {/* Intro SEO */}
        <p className="text-gray-500 text-sm leading-relaxed max-w-3xl">{meta.intro}</p>

        {/* Other brands */}
        <div className="flex flex-wrap gap-2">
          {otherBrands.map((b) => (
            <Link
              key={b.id}
              href={`/marca/${b.id}/`}
              className="px-3 py-1.5 rounded-full text-xs border border-gray-200 text-gray-500 hover:border-violet-300 hover:text-violet-600 transition-colors"
            >
              {b.name}
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
            No hay productos de esta marca todavía.
          </p>
        )}
      </div>
    </>
  );
}
