/**
 * Metadatos del catálogo SIN el dataset pesado (products.json).
 *
 * Este módulo es seguro de importar desde componentes CLIENTE: tipos, las 4
 * categorías, las URLs públicas y una búsqueda PURA (recibe el array, no lo
 * importa). Así el home no embebe el products.json de ~1MB solo porque un
 * componente cliente (ProductCard, Navbar, SearchModal…) necesita una URL o un
 * tipo. El dataset vive en `products.ts` (server/build-time) y se carga por
 * dynamic import donde de verdad se necesita (SearchModal, /catalogo).
 */

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
  /** Preguntas frecuentes — alimentan FAQPage JSON-LD (AEO) + sección visible. */
  faqs: { q: string; a: string }[];
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
    faqs: [
      { q: "¿Cuántos puffs dura un vape desechable?", a: "Depende del modelo: van desde ~600 hasta más de 10,000 puffs. En Vape 2 Go cada producto indica su cantidad de puffs para que elijas según tu uso. Un desechable de 5,000 puffs suele durar varios días de uso normal." },
      { q: "¿Dónde comprar vapes desechables en Santiago, RD?", a: "En Vape 2 Go (vapes.do) compras desechables online con entrega rápida el mismo día en Santiago de los Caballeros. Tenemos WAKA, Geek Bar, HQD, Veev, SWFT y más marcas originales." },
      { q: "¿Cuáles son las mejores marcas de desechables?", a: "Las más buscadas en RD son WAKA, Geek Bar, HQD y Veev, por su variedad de sabores, duración y consistencia. Todas están disponibles en nuestro catálogo." },
      { q: "¿El vape desechable se recarga?", a: "No. El desechable viene cargado y lleno de fábrica; al terminarse se desecha. Si buscas recargar, mira nuestra sección de Pods y sistemas recargables." },
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
    faqs: [
      { q: "¿Qué es un sistema pod y en qué se diferencia de un desechable?", a: "Un sistema pod es un dispositivo recargable: rellenas el líquido y reemplazas solo el pod o el coil, en vez de botar todo el aparato. A largo plazo cuesta menos por uso y te da más control sobre sabor y nicotina." },
      { q: "¿Conviene un pod recargable o un desechable?", a: "Si vapeas a diario, el pod recargable sale más económico con el tiempo y genera menos desperdicio. El desechable es más cómodo para empezar o para uso ocasional." },
      { q: "¿Venden IQOS en Santiago, RD?", a: "Sí. En Vape 2 Go encuentras dispositivos IQOS y sus consumibles (Heets, Terea) originales, con entrega rápida en Santiago de los Caballeros." },
      { q: "¿Cada cuánto se cambia el pod o el coil?", a: "En general cada 1 a 2 semanas según el uso, o cuando notes sabor quemado o menos vapor. Cada modelo trae su recomendación." },
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
    faqs: [
      { q: "¿Cuál es la diferencia entre sales de nicotina y freebase?", a: "Las sales de nicotina dan un golpe más suave y absorción rápida, ideales para pods y nicotinas altas. El freebase produce más vapor y se usa en dispositivos más potentes. Elige según tu equipo y tu preferencia." },
      { q: "¿Qué nivel de nicotina debo elegir?", a: "Para pods con sales, lo común es 20–50 mg. Para freebase en equipos potentes, 3–6 mg. Si vienes del cigarrillo, una nicotina más alta en sales suele satisfacer mejor. Te orientamos si nos escribes." },
      { q: "¿Dónde comprar e-liquids en Santiago, RD?", a: "En Vape 2 Go (vapes.do) compras e-liquids, sales de nicotina y freebase originales con entrega rápida el mismo día en Santiago de los Caballeros." },
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
    faqs: [
      { q: "¿Cuál es la diferencia entre Heets y Terea?", a: "Heets son los sticks para dispositivos IQOS con lámina (modelos anteriores), y Terea son los sticks diseñados para IQOS ILUMA, que calientan sin lámina. Cada uno funciona solo con su tipo de dispositivo." },
      { q: "¿Venden Heets y Terea originales en Santiago, RD?", a: "Sí. En Vape 2 Go todos los Heets y Terea son originales con empaque sellado, disponibles en sus distintas selecciones de sabor, con entrega rápida en Santiago de los Caballeros." },
      { q: "¿Qué accesorios necesito para mi vape?", a: "Depende del equipo: coils o resistencias de repuesto, cargadores y pods. En esta sección encuentras los consumibles y repuestos para mantener tu dispositivo siempre listo." },
    ],
  },
];

/**
 * Búsqueda PURA sobre un array de productos. No importa products.json: el
 * llamador (SearchModal) carga el dataset por dynamic import y lo pasa aquí.
 */
export function searchProducts(products: Product[], query: string, limit = 8): Product[] {
  if (query.length < 2) return [];
  const q = query.toLowerCase();
  return products
    .filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.brand.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q) ||
        p.tags.some((t) => t.toLowerCase().includes(q))
    )
    .slice(0, limit);
}

/**
 * Sirve las imágenes del CDN de PedidosYa REDIMENSIONADAS por URL (`?width=`).
 * Las originales miden 1774×1774 px (~148 KB) aunque se muestren a 180-320 px:
 * a `width=400` bajan ~87% (~19 KB). Gran win de LCP/ancho de banda sin migrar
 * de CDN. No toca imágenes de otros orígenes (Cloudinary, etc.) ni URLs que ya
 * traigan query params.
 */
export function cdnImage(url: string | undefined, width: number): string | undefined {
  if (!url || !url.includes("pedidosya.dhmedia.io") || url.includes("?")) return url;
  return `${url}?width=${width}`;
}

export const SITE_URL = "https://vapes.do";
export const PEDIDOSYA_URL = "http://bit.ly/4nPE2yE";
export const WHATSAPP_URL = "https://wa.me/18094567890";
export const INSTAGRAM_URL = "https://instagram.com/vape2go.rd";
