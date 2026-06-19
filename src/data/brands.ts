import { getAllProducts, type Product } from "./products";

export interface BrandMeta {
  /** slug URL-safe para /marca/[id]/ */
  id: string;
  /** debe coincidir EXACTO con product.brand para el match */
  name: string;
  seoTitle: string;
  intro: string;
  keywords: string[];
}

// Solo marcas reales con volumen de stock. El orden define prioridad en listados.
export const BRANDS: BrandMeta[] = [
  {
    id: "veev",
    name: "Veev",
    seoTitle: "Veev en Santiago, RD — Desechables y Pods",
    intro:
      "Veev es la marca de vapeo de Philip Morris pensada para quienes buscan una experiencia limpia, consistente y premium. La línea Veev Now ofrece desechables de hasta 500 puffs en sabores frutales y mentolados muy buscados en República Dominicana. En Vape 2 Go encuentras la mayor variedad de Veev en Santiago, con stock real y entrega rápida el mismo día. Compra Veev original online y recíbelo directo en tu puerta.",
    keywords: ["veev rd", "veev now", "veev dominicana", "veev santiago", "veev desechable", "comprar veev rd"],
  },
  {
    id: "hqd",
    name: "HQD",
    seoTitle: "HQD en Santiago, RD — Desechables y Lux Pods",
    intro:
      "HQD es una de las marcas de vape más populares y confiables del mundo, conocida por sus desechables Cuvie de gran cantidad de puffs y su sistema recargable HQD Lux Pods. Sabores intensos, batería duradera y precio accesible. En Vape 2 Go tienes HQD original en Santiago, RD, con amplia variedad de sabores y entrega rápida. Compra HQD desechable o tu kit Lux y recíbelo el mismo día.",
    keywords: ["hqd rd", "hqd dominicana", "hqd cuvie", "hqd lux", "hqd santiago", "comprar hqd rd"],
  },
  {
    id: "terea",
    name: "Terea",
    seoTitle: "Terea para IQOS ILUMA en Santiago, RD",
    intro:
      "Terea son los sticks de tabaco diseñados específicamente para los dispositivos IQOS ILUMA, con tecnología SMARTCORE que calienta sin quemar. Disponibles en una amplia gama de selecciones —Amber, Bronze, Sienna, Yellow, Deep Mint y más—, ofrecen un sabor consistente y limpio. En Vape 2 Go encuentras Terea original por cajetilla o cartón en Santiago, RD, con entrega rápida. Compra tus Terea para IQOS ILUMA y recíbelos directo en tu puerta.",
    keywords: ["terea rd", "terea iluma", "terea dominicana", "terea santiago", "sticks iqos iluma", "comprar terea rd"],
  },
  {
    id: "geek-bar",
    name: "Geek Bar",
    seoTitle: "Geek Bar en Santiago, RD — Desechables Pulse",
    intro:
      "Geek Bar es sinónimo de desechables de alta gama, con su icónica línea Pulse de miles de puffs, pantalla y sabores premium muy buscados. Diseño cómodo, vapor abundante y duración líder en su categoría. En Vape 2 Go tienes Geek Bar original en Santiago, RD, con variedad de sabores y stock real. Compra tu Geek Bar Pulse online y recíbelo el mismo día con entrega rápida.",
    keywords: ["geek bar rd", "geek bar pulse", "geek bar dominicana", "geek bar santiago", "geekbar rd", "comprar geek bar rd"],
  },
  {
    id: "vladdin",
    name: "Vladdin",
    seoTitle: "Vladdin en Santiago, RD — Pods y Kapikua",
    intro:
      "Vladdin ofrece lo mejor de dos mundos: sistemas pod recargables fáciles de usar y la línea de desechables Kapikua de gran cantidad de puffs. Ideal para quien quiere ahorrar recargando o disfrutar de un desechable de larga duración. En Vape 2 Go encuentras Vladdin original y sus cartuchos en Santiago, RD, con entrega rápida. Compra tu kit o cartucho Vladdin y recíbelo directo en tu puerta.",
    keywords: ["vladdin rd", "vladdin kapikua", "vladdin dominicana", "vladdin santiago", "pod vladdin", "comprar vladdin rd"],
  },
  {
    id: "zyn",
    name: "ZYN",
    seoTitle: "ZYN en Santiago, RD — Bolsas de Nicotina",
    intro:
      "ZYN son bolsas de nicotina sin tabaco y sin humo, una alternativa discreta y limpia para consumir nicotina en cualquier lugar. Disponibles en sabores como Cool Mint, Spearmint y Black Cherry, en intensidades media y fuerte. En Vape 2 Go tienes ZYN original en Santiago, RD, con entrega rápida el mismo día. Compra tus bolsas de nicotina ZYN online y recíbelas directo en tu puerta.",
    keywords: ["zyn rd", "zyn dominicana", "bolsas de nicotina", "nicotine pouches rd", "zyn santiago", "comprar zyn rd"],
  },
  {
    id: "heets",
    name: "Heets",
    seoTitle: "Heets para IQOS en Santiago, RD",
    intro:
      "Heets son los sticks de tabaco calentado para los dispositivos IQOS clásicos (IQOS 3, 3 Duo y Lil Solid). Calientan el tabaco sin quemarlo, ofreciendo sabor real con menos olor y ceniza. Disponibles en selecciones como Sienna, Amber, Bronze y Purple. En Vape 2 Go encuentras Heets original por cajetilla o cartón en Santiago, RD, con entrega rápida. Compra tus Heets y recíbelos el mismo día.",
    keywords: ["heets rd", "heets dominicana", "heets iqos", "heets santiago", "sticks tabaco calentado", "comprar heets rd"],
  },
  {
    id: "iqos",
    name: "IQOS",
    seoTitle: "IQOS en Santiago, RD — Dispositivos y Kits",
    intro:
      "IQOS es el sistema de tabaco calentado de Philip Morris que calienta sin quemar, reduciendo olor y ceniza frente al cigarrillo tradicional. Desde el clásico IQOS 3 Duo hasta la nueva generación ILUMA, encuentras el dispositivo o kit ideal para ti. En Vape 2 Go tienes IQOS original en Santiago, RD, con sus consumibles Heets y Terea, y entrega rápida. Compra tu IQOS y recíbelo directo en tu puerta.",
    keywords: ["iqos rd", "iqos dominicana", "iqos iluma", "iqos santiago", "dispositivo iqos", "comprar iqos rd"],
  },
  {
    id: "swft",
    name: "SWFT",
    seoTitle: "SWFT en Santiago, RD — Desechables Meta y Mod",
    intro:
      "SWFT es una marca de desechables potentes, con su línea Meta de hasta 30,000 puffs y la serie Mod de gran autonomía. Sabores intensos, vapor abundante y duración extrema para quien busca lo máximo en un desechable. En Vape 2 Go tienes SWFT original en Santiago, RD, con stock real y variedad de sabores. Compra tu SWFT Meta o Mod online y recíbelo el mismo día.",
    keywords: ["swft rd", "swft meta", "swft mod", "swft dominicana", "swft santiago", "comprar swft rd"],
  },
  {
    id: "waka",
    name: "WAKA",
    seoTitle: "WAKA en Santiago, RD — Desechables Premium",
    intro:
      "WAKA es una marca de desechables reconocida por su diseño elegante, tecnología antiderrame y sabores suaves y consistentes. Perfecta para quien busca una experiencia cómoda y confiable de principio a fin. En Vape 2 Go encuentras WAKA original en Santiago, RD, con variedad de sabores y entrega rápida el mismo día. Compra tu WAKA online y recíbelo directo en tu puerta.",
    keywords: ["waka rd", "waka vape", "waka dominicana", "waka santiago", "waka desechable", "comprar waka rd"],
  },
  {
    id: "vizzel",
    name: "Vizzel",
    seoTitle: "Vizzel en Santiago, RD — Cartuchos 8000 Puffs",
    intro:
      "Vizzel ofrece cartuchos y desechables de hasta 8,000 puffs con una gran variedad de sabores frutales y mentolados, a un precio muy competitivo. Una opción ideal para quien busca duración y sabor sin gastar de más. En Vape 2 Go tienes Vizzel original en Santiago, RD, con stock real y entrega rápida. Compra tu cartucho Vizzel online y recíbelo el mismo día.",
    keywords: ["vizzel rd", "vizzel dominicana", "vizzel 8000 puffs", "vizzel santiago", "cartucho vizzel", "comprar vizzel rd"],
  },
  {
    id: "magi",
    name: "Magi",
    seoTitle: "Magi Pods en Santiago, RD",
    intro:
      "Magi Pods son cápsulas recargables de 50mg con sabores intensos como Red Bull, Green Apple y Blue Crush, ideales para sistemas pod compatibles. Una forma económica y sabrosa de mantener tu vapeo. En Vape 2 Go encuentras Magi original en Santiago, RD, con variedad de sabores y entrega rápida el mismo día. Compra tus Magi Pods online y recíbelos directo en tu puerta.",
    keywords: ["magi pods rd", "magi dominicana", "magi 50mg", "magi santiago", "pods magi", "comprar magi rd"],
  },
  {
    id: "marlboro",
    name: "Marlboro",
    seoTitle: "Marlboro en Santiago, RD",
    intro:
      "Marlboro es una de las marcas de cigarrillos más reconocidas del mundo. En Vape 2 Go la tienes disponible en Santiago, RD, con entrega rápida el mismo día directo en tu puerta. Compra Marlboro online de forma cómoda y discreta.",
    keywords: ["marlboro rd", "marlboro dominicana", "marlboro santiago", "cigarrillos marlboro", "comprar marlboro rd"],
  },
  {
    id: "relx",
    name: "Relx",
    seoTitle: "RELX en Santiago, RD — Pods Recargables",
    intro:
      "RELX es un sistema pod premium reconocido por su diseño minimalista, tecnología antiderrame y sabores refinados. Sus cápsulas recargables ofrecen una experiencia suave y elegante. En Vape 2 Go tienes RELX original y sus pods en Santiago, RD, con entrega rápida. Compra tu kit o cartucho RELX online y recíbelo el mismo día.",
    keywords: ["relx rd", "relx dominicana", "relx santiago", "pods relx", "relx infinity", "comprar relx rd"],
  },
  {
    id: "juul",
    name: "Juul",
    seoTitle: "JUUL en Santiago, RD — Sistema Pod y Cartuchos",
    intro:
      "JUUL es el sistema pod compacto que popularizó el vapeo de sales de nicotina, con cartuchos de sabores como Virginia Tobacco y Mint. Discreto, fácil de usar y de carga rápida. En Vape 2 Go encuentras JUUL y sus cartuchos originales en Santiago, RD, con entrega rápida. Compra tu JUUL o pods online y recíbelos directo en tu puerta.",
    keywords: ["juul rd", "juul dominicana", "juul santiago", "cartuchos juul", "pods juul", "comprar juul rd"],
  },
  {
    id: "lost-mary",
    name: "Lost Mary",
    seoTitle: "Lost Mary en Santiago, RD — Desechables",
    intro:
      "Lost Mary, de los creadores de Elf Bar, destaca por su diseño llamativo, sabores creativos y desechables de gran duración. Una de las marcas favoritas a nivel mundial por su calidad y estilo. En Vape 2 Go tienes Lost Mary original en Santiago, RD, con stock real y entrega rápida. Compra tu Lost Mary online y recíbelo el mismo día.",
    keywords: ["lost mary rd", "lost mary dominicana", "lost mary santiago", "lost mary desechable", "comprar lost mary rd"],
  },
];

export function getBrandBySlug(slug: string): BrandMeta | undefined {
  return BRANDS.find((b) => b.id === slug);
}

/** Devuelve la marca con página propia que coincide con el brand de un producto. */
export function getBrandByName(name: string): BrandMeta | undefined {
  return BRANDS.find((b) => b.name === name);
}

export function getProductsByBrand(name: string): Product[] {
  const products = getAllProducts().filter((p) => p.brand === name);
  // disponibles primero, luego por nombre
  return products.sort(
    (a, b) => Number(b.disponible) - Number(a.disponible) || a.name.localeCompare(b.name)
  );
}
