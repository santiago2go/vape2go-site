import type { MetadataRoute } from "next";
import { getAllProducts, CATEGORIES } from "@/data/products";
import { AVAILABLE_BRANDS as BRANDS } from "@/data/brands";
import { GUIAS } from "@/data/guias";

export const dynamic = "force-static";

const BASE = "https://vapes.do";

export default function sitemap(): MetadataRoute.Sitemap {
  // Solo productos VENDIBLES en el sitemap. Las fichas agotadas (90 de 664) son
  // de bajo valor y diluyen el presupuesto de rastreo → alimentan el estado
  // "Descubierta: actualmente sin indexar" de GSC. Cuando una vuelve a stock,
  // reentra sola en el próximo build.
  const productUrls: MetadataRoute.Sitemap = getAllProducts()
    .filter((p) => p.disponible)
    .map((p) => ({
      url: `${BASE}/productos/${p.id}/`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.7,
    }));

  const categoryUrls: MetadataRoute.Sitemap = CATEGORIES.map((cat) => ({
    url: `${BASE}/categoria/${cat.id}/`,
    lastModified: new Date(),
    changeFrequency: "weekly",
    priority: 0.8,
  }));

  const brandUrls: MetadataRoute.Sitemap = BRANDS.map((b) => ({
    url: `${BASE}/marca/${b.id}/`,
    lastModified: new Date(),
    changeFrequency: "weekly",
    priority: 0.8,
  }));

  const guiaUrls: MetadataRoute.Sitemap = GUIAS.map((g) => ({
    url: `${BASE}/guias/${g.id}/`,
    lastModified: new Date(),
    changeFrequency: "monthly",
    priority: 0.7,
  }));

  return [
    { url: `${BASE}/`, lastModified: new Date(), changeFrequency: "daily", priority: 1.0 },
    { url: `${BASE}/catalogo/`, lastModified: new Date(), changeFrequency: "daily", priority: 0.9 },
    { url: `${BASE}/guias/`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.7 },
    ...categoryUrls,
    ...brandUrls,
    ...guiaUrls,
    ...productUrls,
  ];
}
