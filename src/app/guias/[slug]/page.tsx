import type { Metadata } from "next";
import Link from "next/link";
import { SITE_URL } from "@/data/products";
import { GUIAS, getGuiaBySlug } from "@/data/guias";
import { getBrandBySlug } from "@/data/brands";
import { INSTAGRAM_URL } from "@/data/catalog-meta";

export function generateStaticParams() {
  return GUIAS.map((g) => ({ slug: g.id }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const guia = getGuiaBySlug(slug);
  if (!guia) return {};

  const canonical = `${SITE_URL}/guias/${guia.id}/`;
  const ogTitle = `${guia.seoTitle} | Vape 2 Go`;

  return {
    title: guia.seoTitle,
    description: guia.metaDescription,
    keywords: guia.keywords,
    alternates: { canonical },
    openGraph: {
      type: "article",
      locale: "es_DO",
      siteName: "Vape 2 Go",
      title: ogTitle,
      description: guia.metaDescription,
      url: canonical,
      images: [{ url: "/og-cover.png", width: 1200, height: 630 }],
    },
    twitter: { card: "summary_large_image", title: ogTitle, description: guia.metaDescription, images: ["/og-cover.png"] },
  };
}

export default async function GuiaPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const guia = getGuiaBySlug(slug);

  if (!guia) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-20 text-center">
        <p className="text-gray-400">Guía no encontrada.</p>
        <Link href="/guias/" className="text-violet-600 mt-4 inline-block hover:underline">
          Ver todas las guías →
        </Link>
      </div>
    );
  }

  const canonical = `${SITE_URL}/guias/${guia.id}/`;
  const brand = guia.relatedBrand ? getBrandBySlug(guia.relatedBrand) : undefined;

  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Inicio", item: `${SITE_URL}/` },
      { "@type": "ListItem", position: 2, name: "Guías", item: `${SITE_URL}/guias/` },
      { "@type": "ListItem", position: 3, name: guia.title, item: canonical },
    ],
  };

  const articleSchema = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: guia.title,
    image: `${SITE_URL}/og-cover.png`,
    description: guia.metaDescription,
    datePublished: guia.updated,
    dateModified: guia.updated,
    author: { "@type": "Organization", name: "Vape 2 Go" },
    publisher: { "@type": "Organization", name: "Vape 2 Go", url: `${SITE_URL}/` },
    mainEntityOfPage: canonical,
    url: canonical,
  };

  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: guia.faqs.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />

      <article className="max-w-3xl mx-auto px-4 py-10 space-y-8">
        {/* Breadcrumb */}
        <nav className="text-sm text-gray-400 flex items-center gap-2 flex-wrap">
          <Link href="/" className="hover:text-gray-700 transition-colors">Inicio</Link>
          <span>/</span>
          <Link href="/guias/" className="hover:text-gray-700 transition-colors">Guías</Link>
          <span>/</span>
          <span className="text-gray-700">{guia.title}</span>
        </nav>

        {/* Header */}
        <header>
          <h1 className="text-3xl sm:text-4xl font-normal text-gray-900 leading-tight">{guia.title}</h1>
          <p className="text-gray-500 mt-4 text-base leading-relaxed">{guia.intro}</p>
        </header>

        {/* Cuerpo */}
        <div className="space-y-8">
          {guia.sections.map((s) => (
            <section key={s.heading}>
              <h2 className="text-2xl font-normal text-gray-900 mb-3">{s.heading}</h2>
              <div className="space-y-3">
                {s.body.map((p, i) => (
                  <p key={i} className="text-sm text-gray-600 leading-relaxed">{p}</p>
                ))}
              </div>
            </section>
          ))}
        </div>

        {/* CTA a la marca relacionada */}
        {brand && (
          <div className="rounded-2xl border border-violet-100 bg-violet-50/60 p-6">
            <p className="text-sm text-gray-600">
              ¿Listo para pedir? Mira todo el stock de{" "}
              <Link href={`/marca/${brand.id}/`} className="text-violet-600 font-semibold hover:underline">
                {brand.name} en Vape 2 Go
              </Link>{" "}
              con entrega el mismo día en Santiago, RD.
            </p>
          </div>
        )}

        {/* Guiño a la saga El Sereno (puente social) */}
        <div className="rounded-2xl border border-gray-100 bg-gray-50 p-6">
          <p className="text-sm text-gray-500 leading-relaxed">
            🌙 <span className="font-semibold text-gray-700">¿Sabías que cada sabor tiene su personaje?</span>{" "}
            Sienna, Kúlmin y el resto del coro viven en <span className="italic">El Sereno</span>, nuestra
            saga animada de Santiago.{" "}
            <a href={INSTAGRAM_URL} target="_blank" rel="noopener noreferrer" className="text-violet-600 font-semibold hover:underline">
              Conócelos en Instagram →
            </a>
          </p>
        </div>

        {/* FAQ */}
        <section className="pt-8 border-t border-gray-100">
          <h2 className="text-2xl font-normal text-gray-900 mb-6">Preguntas frecuentes</h2>
          <div className="space-y-5">
            {guia.faqs.map((f) => (
              <div key={f.q}>
                <h3 className="text-base font-semibold text-gray-900 mb-1.5">{f.q}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{f.a}</p>
              </div>
            ))}
          </div>
        </section>

        <p className="text-xs text-gray-400 pt-4 border-t border-gray-100">
          Contenido informativo para mayores de 18 años. Vape 2 Go no promueve el consumo de nicotina.
        </p>
      </article>
    </>
  );
}
