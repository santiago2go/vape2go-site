import productsData from "./products.json";

export type Category = "desechables" | "pods" | "liquids" | "accesorios";

export interface Product {
  id: string;
  sku: string;
  master_code: string;
  name: string;
  brand: string;
  category: Category;
  price: number;
  priceFormatted: string;
  disponible: boolean;
  description: string;
  features: string[];
  tags: string[];
  bestseller?: boolean;
  image?: string;
  images?: string[];
}

export interface CategoryMeta {
  id: Category;
  label: string;
  icon: string;
  description: string;
  color: string;
  /** Título SEO largo para <title> y H1 enriquecido. */
  seoTitle: string;
  /** Párrafo introductorio visible (80-140 palabras) — evita "thin content". */
  intro: string;
  /** Keywords para meta keywords y refuerzo on-page. */
  keywords: string[];
}

export const CATEGORIES: CategoryMeta[] = [
  {
    id: "desechables",
    label: "Desechables",
    icon: "💨",
    description: "WAKA, Geek Bar, HQD, Veev y más",
    color: "cat-desechables",
    seoTitle: "Vapes Desechables en Santiago, RD",
    intro:
      "Los vapes desechables son la forma más fácil de empezar: vienen cargados, llenos y listos para usar, sin recargas ni mantenimiento. En Vape 2 Go encuentras las marcas más buscadas de República Dominicana —WAKA, Geek Bar, HQD, Veev, SWFT y más— en una variedad enorme de sabores y cantidades de puffs. Cada desechable está pensado para durar días de uso normal y desecharse al terminar. Compra online en Santiago de los Caballeros con entrega rápida el mismo día. Filtra por marca, sabor o cantidad de puffs y recibe tu vape favorito directo en tu puerta.",
    keywords: [
      "desechables vape rd", "vape desechable santiago", "waka vape dominicana",
      "hqd rd", "geek bar dominicana", "veev rd", "puff desechable rd",
      "comprar vape desechable santiago",
    ],
  },
  {
    id: "pods",
    label: "Pods",
    icon: "⚡",
    description: "IQOS, kits recargables y sistemas pod",
    color: "cat-pods",
    seoTitle: "Pods y Sistemas Recargables para Vape en Santiago, RD",
    intro:
      "Los sistemas pod y kits recargables son la opción ideal si quieres ahorrar a largo plazo y controlar tu experiencia de vapeo. A diferencia del desechable, recargas el líquido y reemplazas solo el pod o el coil, reduciendo el costo por uso. En Vape 2 Go encuentras IQOS, kits recargables y dispositivos pod de las mejores marcas, con la potencia y portabilidad que buscas. Perfectos para quien ya conoce el vapeo y quiere dar el siguiente paso. Compra online en Santiago, RD, con entrega rápida y soporte para elegir el sistema que mejor se adapta a ti.",
    keywords: [
      "pods vape rd", "iqos dominicana", "kit recargable vape santiago",
      "sistema pod rd", "dispositivo vape recargable", "iqos santiago rd",
      "comprar pod vape dominicana",
    ],
  },
  {
    id: "liquids",
    label: "Liquids",
    icon: "🔥",
    description: "E-liquids, sales de nicotina y freebase",
    color: "cat-liquids",
    seoTitle: "E-Liquids, Sales de Nicotina y Freebase en Santiago, RD",
    intro:
      "Los e-liquids son el corazón de cualquier sistema recargable: definen el sabor, la intensidad y la sensación en garganta. En Vape 2 Go tienes sales de nicotina (ideales para pods, golpe suave y absorción rápida) y freebase (mayor producción de vapor para dispositivos potentes), en una amplia gama de sabores —frutales, mentolados, postres y tabaco—. Elige el nivel de nicotina que necesitas y combina sabores a tu gusto. Compra líquidos para vape online en Santiago de los Caballeros con entrega rápida el mismo día. Si no sabes cuál elegir, te orientamos según tu dispositivo y preferencia.",
    keywords: [
      "liquids vape rd", "e-liquid dominicana", "sales de nicotina santiago",
      "freebase vape rd", "liquido para vape santiago", "nic salt rd",
      "comprar e-liquid dominicana",
    ],
  },
  {
    id: "accesorios",
    label: "Accesorios",
    icon: "✨",
    description: "Heets, Terea y accesorios para IQOS",
    color: "cat-accesorios",
    seoTitle: "Heets, Terea y Accesorios para IQOS en Santiago, RD",
    intro:
      "Mantén tu dispositivo siempre listo con los accesorios y consumibles correctos. En Vape 2 Go encuentras Heets y Terea originales para IQOS en sus distintas selecciones de sabor, además de coils, cargadores y repuestos para que nunca te quedes a mitad de camino. Todos nuestros consumibles son productos auténticos con empaque sellado. Compra accesorios para vape e IQOS online en Santiago, RD, con entrega rápida el mismo día. Encuentra justo el repuesto o consumible que tu dispositivo necesita y recíbelo directo en tu puerta.",
    keywords: [
      "heets rd", "terea dominicana", "accesorios iqos santiago",
      "coils vape rd", "repuestos vape dominicana", "heets santiago rd",
      "sticks tabaco calentado rd",
    ],
  },
];

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

export function getBestsellers(limit = 12): Product[] {
  const bestsellers = allProducts.filter((p) => p.bestseller);
  if (bestsellers.length >= limit) return bestsellers.slice(0, limit);
  // Fill with available products if not enough bestsellers
  const extras = allProducts
    .filter((p) => !p.bestseller && p.disponible && p.image)
    .slice(0, limit - bestsellers.length);
  return [...bestsellers, ...extras];
}

export function searchProducts(query: string, limit = 8): Product[] {
  if (query.length < 2) return [];
  const q = query.toLowerCase();
  return allProducts
    .filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.brand.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q) ||
        p.tags.some((t) => t.toLowerCase().includes(q))
    )
    .slice(0, limit);
}

export const SITE_URL = "https://vapes.do";
export const PEDIDOSYA_URL = "http://bit.ly/4nPE2yE";
export const WHATSAPP_URL = "https://wa.me/18094567890";
export const INSTAGRAM_URL = "https://instagram.com/vape2go.rd";
