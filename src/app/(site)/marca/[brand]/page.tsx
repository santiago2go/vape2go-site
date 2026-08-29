import type { Metadata } from "next";
import Link from "next/link";
import ProductCard from "@/components/ProductCard";
import { SITE_URL } from "@/data/products";
import { AVAILABLE_BRANDS as BRANDS, getBrandBySlug, getProductsByBrand } from "@/data/brands";

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

  const ogTitle = `${meta.seoTitle} | Vape 2 Go`;
  const available = getProductsByBrand(meta.name).filter((p) => p.disponible).length;
  const description =
    meta.metaDescription ??
    `${meta.name} original en Santiago, RD. ${available}+ productos en stock con entrega el mismo día. Compra ${meta.name} online en Vape 2 Go y recíbelo en tu puerta.`;
  const canonical = `${SITE_URL}/marca/${meta.id}/`;

  return {
    // el template del layout agrega la marca una sola vez al <title>
    title: meta.seoTitle,
    description,
    keywords: meta.keywords,
    alternates: { canonical },
    openGraph: {
      type: "website",
      locale: "es_DO",
      siteName: "Vape 2 Go",
      title: ogTitle,
      description,
      url: canonical,
    },
    twitter: { card: "summary", title: ogTitle, description },
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

  // Solo lo disponible en PedidosYa (Activo=S); el flag se sincroniza en el prebuild.
  const products = getProductsByBrand(meta.name).filter((p) => p.disponible);
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

  const faqSchema =
    meta.faqs && meta.faqs.length > 0
      ? {
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: meta.faqs.map((f) => ({
            "@type": "Question",
            name: f.q,
            acceptedAnswer: { "@type": "Answer", text: f.a },
          })),
        }
      : null;

  const otherBrands = BRANDS.filter((b) => b.id !== meta.id).slice(0, 12);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema).replace(/</g, "\\u003c") }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(brandSchema).replace(/</g, "\\u003c") }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(collectionSchema).replace(/</g, "\\u003c") }}
      />
      {faqSchema && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema).replace(/</g, "\\u003c") }}
        />
      )}

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

        {/* FAQ (AEO + rich results) */}
        {meta.faqs && meta.faqs.length > 0 && (
          <section className="pt-8 border-t border-gray-100 max-w-3xl">
            <h2 className="text-2xl font-normal text-gray-900 mb-6">
              Preguntas frecuentes sobre {meta.name}
            </h2>
            <div className="space-y-5">
              {meta.faqs.map((f) => (
                <div key={f.q}>
                  <h3 className="text-base font-semibold text-gray-900 mb-1.5">{f.q}</h3>
                  <p className="text-sm text-gray-500 leading-relaxed">{f.a}</p>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </>
  );
}
