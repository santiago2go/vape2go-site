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
}

export const CATEGORIES: CategoryMeta[] = [
  {
    id: "desechables",
    label: "Desechables",
    icon: "💨",
    description: "WAKA, Elf Bar, Geek Bar, Fume y más",
    color: "cat-desechables",
  },
  {
    id: "pods",
    label: "Pods",
    icon: "⚡",
    description: "IQOS, kits recargables y sistemas pod",
    color: "cat-pods",
  },
  {
    id: "liquids",
    label: "Liquids",
    icon: "🔥",
    description: "E-liquids, sales de nicotina y freebase",
    color: "cat-liquids",
  },
  {
    id: "accesorios",
    label: "Accesorios",
    icon: "✨",
    description: "Heets, Terea y accesorios para IQOS",
    color: "cat-accesorios",
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

export const PEDIDOSYA_URL = "https://www.pedidosya.com.do/restaurantes/santiago/vape-2-go-menu";
export const WHATSAPP_URL = "https://wa.me/18094567890";
export const INSTAGRAM_URL = "https://instagram.com/vape2go.rd";
