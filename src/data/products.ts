/**
 * Módulo PESADO del catálogo: embebe products.json (~1MB) vía import estático.
 *
 * ⚠️ Impórtalo SOLO desde server components / código build-time (páginas con
 * generateStaticParams, sitemap, Hero, home). NUNCA desde un componente
 * "use client" que cargue en el home, o el JSON de ~1MB entra al bundle del
 * cliente. Para datos en el cliente usa dynamic import de "@/data/products.json"
 * (ver SearchModal y /catalogo). Los tipos, CATEGORIES y URLs viven en
 * "@/data/catalog-meta" (liviano) y se re-exportan aquí por conveniencia.
 */
import productsData from "./products.json";
import type { Product, Category } from "./catalog-meta";

// Re-export de lo liviano para que los consumidores server existentes no cambien.
export type { Product, Category, CategoryMeta } from "./catalog-meta";
export {
  CATEGORIES,
  searchProducts,
  cdnImage,
  SITE_URL,
  PEDIDOSYA_URL,
  WHATSAPP_URL,
  INSTAGRAM_URL,
} from "./catalog-meta";

const allProducts = productsData as Product[];

export function getAllProducts(): Product[] {
  return allProducts;
}

export function getProductsByCategory(category: Category): Product[] {
  return allProducts.filter((p) => p.category === category);
}

export function getProductBySlug(slug: string): Product | undefined {
  return allProducts.find((p) => p.id === slug);
}

export function getAllSlugs(): string[] {
  return allProducts.map((p) => p.id);
}

/**
 * Best sellers curados (orden = prioridad). Fuente: ventas reales de Vape 2 Go.
 * Se reusan en "Productos destacados" (home) y en el ancla visual del hero.
 */
export const BESTSELLER_SLUGS: string[] = [
  "tabaco-terea-sienna-20-unidades",
  "cartucho-vizzel-cool-mint-8000-puff-1-unidad",
  "tabaco-terea-yellow-20-unidades",
  "tabaco-terea-blue-20-unidades",
  "tabaco-terea-turquoise-20-unidades",
  "tabaco-terea-amber-20-unidades",
  "cartucho-vizzel-strawberry-ice-8000-puff-1-unidad",
  "cartucho-vizzel-coconut-agua-8000-puff-1-unidad",
  "cartucho-vizzel-blue-razz-peach-ice-8000-puff-1-unidad",
  "cigarrillos-terea-zesty-1-carton",
];

function curatedBestsellers(): Product[] {
  return BESTSELLER_SLUGS.map((slug) => allProducts.find((p) => p.id === slug)).filter(
    (p): p is Product => Boolean(p) && p!.disponible && Boolean(p!.image)
  );
}

export function getBestsellers(limit = 12): Product[] {
  const curated = curatedBestsellers();
  const seen = new Set(curated.map((p) => p.id));
  const fill = allProducts.filter((p) => !seen.has(p.id) && p.disponible && p.image);
  return [...curated, ...fill].slice(0, limit);
}

/**
 * 4 productos para el ancla visual del hero: best sellers curados, intercalando
 * categoría para variedad visual. Rellena con disponibles si falta. Build time.
 */
export function getHeroProducts(): Product[] {
  const byCat = new Map<Category, Product[]>();
  for (const p of curatedBestsellers()) {
    if (!byCat.has(p.category)) byCat.set(p.category, []);
    byCat.get(p.category)!.push(p);
  }
  const ordered: Product[] = [];
  let added = true;
  while (ordered.length < 4 && added) {
    added = false;
    for (const list of byCat.values()) {
      const next = list.shift();
      if (next) {
        ordered.push(next);
        added = true;
      }
      if (ordered.length >= 4) break;
    }
  }
  if (ordered.length < 4) {
    const seen = new Set(ordered.map((p) => p.id));
    const extra = allProducts.filter((p) => !seen.has(p.id) && p.disponible && p.image);
    ordered.push(...extra.slice(0, 4 - ordered.length));
  }
  return ordered.slice(0, 4);
}
