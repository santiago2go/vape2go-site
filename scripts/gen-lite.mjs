// Genera products-lite.json: el catálogo LIVIANO para el cliente (SearchModal,
// /catalogo). El cliente solo usa id/sku/name/brand/category/price/disponible/
// image/bestseller + tags (para buscar); NO usa description/features/faqs/images.
// Vaciar esos campos pesados evita que el enriquecimiento SEO (descripciones
// largas + FAQs, solo necesarias en las fichas server-side) infle el bundle
// cliente. Corre en `prebuild` antes de cada build.
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const inPath = process.argv[2] || join(here, "../src/data/products.json");
const outPath = join(here, "../src/data/products-lite.json");

const products = JSON.parse(readFileSync(inPath, "utf8"));
const lite = products.map((p) => ({
  id: p.id,
  sku: p.sku,
  master_code: p.master_code,
  name: p.name,
  brand: p.brand,
  category: p.category,
  price: p.price,
  priceFormatted: p.priceFormatted,
  disponible: p.disponible,
  bestseller: p.bestseller ?? false,
  image: p.image,
  tags: p.tags ?? [],
  // Vaciados a propósito (el cliente no los renderiza; viven en products.json server-side):
  description: "",
  features: [],
}));

writeFileSync(outPath, JSON.stringify(lite));
const kb = (Buffer.byteLength(JSON.stringify(lite)) / 1024).toFixed(0);
console.log(`gen-lite: ${lite.length} productos → products-lite.json (${kb} KB)`);
