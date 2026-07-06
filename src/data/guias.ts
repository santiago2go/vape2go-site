/**
 * Guías / contenido informacional (SEO long-tail + AEO).
 *
 * Captura búsquedas informacionales de alta intención ("sabores terea",
 * "que sabor es glacier pearl", "que es veev now") que el catálogo puro no
 * responde bien, y sirve de PUENTE con la saga "El Sereno" (cada personaje =
 * un sabor). Mismo patrón data-driven que brands.ts / catalog-meta.ts.
 *
 * Ruta: /guias/[slug]/  ·  índice en /guias/
 */

export interface GuiaSection {
  heading: string;
  /** Párrafos del cuerpo. */
  body: string[];
}

export interface GuiaMeta {
  /** slug URL-safe para /guias/[id]/ */
  id: string;
  /** <title> (el template del layout agrega "| Vape 2 Go"). */
  seoTitle: string;
  /** H1 visible. */
  title: string;
  metaDescription: string;
  keywords: string[];
  /** Fecha ISO para el Article schema (dateModified). */
  updated: string;
  /** Bajada / resumen visible bajo el H1. */
  intro: string;
  sections: GuiaSection[];
  faqs: { q: string; a: string }[];
  /** slug de /marca/[x]/ relacionado para enlazado interno (opcional). */
  relatedBrand?: string;
}

export const GUIAS: GuiaMeta[] = [
  {
    id: "sabores-terea",
    seoTitle: "Sabores de Terea para IQOS ILUMA: la Guía Completa (RD 2026)",
    title: "Sabores de Terea: la guía completa",
    metaDescription:
      "Todos los sabores de Terea para IQOS ILUMA explicados: Sienna, Deep Mint, Glacier, Amber, Bronze, Yellow y más. Cuál elegir y dónde comprarlos en Santiago, RD.",
    keywords: [
      "sabores terea", "terea sienna", "terea deep mint", "terea glacier",
      "que sabor es el terea glacier pearl", "terea blue", "terea amber",
      "sabores iqos terea", "terea iluma sabores",
    ],
    updated: "2026-07-06",
    intro:
      "¿No sabes cuál Terea escoger? Aquí te explicamos, en dominicano y sin vueltas, qué sabor es cada selección de Terea para IQOS ILUMA —de las tostadas como Sienna a las mentoladas como Deep Mint y Glacier— para que pidas la tuya con los ojos cerrados.",
    sections: [
      {
        heading: "¿Qué es Terea?",
        body: [
          "Terea son los sticks de tabaco diseñados para los dispositivos IQOS ILUMA. Usan tecnología SMARTCORE: el calor viene de adentro del stick, así que calientan el tabaco sin quemarlo —menos olor, menos ceniza y un sabor más limpio que el cigarrillo tradicional.",
          "Ojo: Terea funciona SOLO con IQOS ILUMA. Si tienes un IQOS clásico (3, 3 Duo o Lil Solid), lo tuyo son los Heets. Cada stick trabaja únicamente con su tipo de dispositivo.",
        ],
      },
      {
        heading: "Las familias de sabor",
        body: [
          "Para elegir fácil, piensa en tres familias: las tostadas/tabaco (cálidas, para quien viene del cigarrillo), las mentoladas (frescas, de suave a intensa) y las frutales/mixtas (un toque distinto sobre la base de tabaco).",
        ],
      },
      {
        heading: "Sabor por sabor",
        body: [
          "Terea Sienna — tabaco tostado con notas cálidas y ligeramente especiadas. Una de las más vendidas en RD, ideal si quieres algo redondo y sin mentol. (Sí: es el sabor detrás de 'Sienna', el personaje de nuestra saga El Sereno.)",
          "Terea Amber — tabaco tostado equilibrado, con un toque de madera. Un clásico para el día a día.",
          "Terea Bronze — tabaco más profundo, con matices de cacao y especias. Para el que le gusta el sabor con cuerpo.",
          "Terea Deep Mint — mentol intenso, fresco y directo. El favorito de los que quieren el golpe frío bien marcado.",
          "Terea Glacier — mentol fresco y limpio, un poco más suave que el Deep Mint. Frescura sin que tape el tabaco. (La variante Glacier Pearl trae una cápsula que refuerza el frío al apretarla.)",
          "Terea Yellow — tabaco suave con un toque cítrico ligero. La opción liviana.",
          "Terea Turquoise — mentol con un aire herbal/aromático. Fresco pero distinto al mentol clásico.",
          "Terea Blue — mentol con un toque frutal fresco. Un intermedio entre lo frío y lo dulce.",
        ],
      },
      {
        heading: "¿Cuál me conviene?",
        body: [
          "Si vienes del cigarrillo y quieres sabor a tabaco: Sienna, Amber o Bronze. Si buscas frescura suave: Glacier o Blue. Si quieres el mentol más fuerte: Deep Mint. Si te gusta experimentar: Turquoise o Glacier Pearl.",
          "Consejo: la mayoría empieza con una tostada (Sienna/Amber) y una mentolada (Deep Mint/Glacier) para ir alternando. Puedes pedir por cajetilla para probar antes de llevar el cartón.",
        ],
      },
      {
        heading: "Dónde comprar Terea en Santiago, RD",
        body: [
          "En Vape 2 Go (vapes.do) tienes Terea original por cajetilla o cartón, con stock real y entrega el mismo día en Santiago de los Caballeros. Revisa la disponibilidad y los precios del momento en la página de la marca.",
        ],
      },
    ],
    faqs: [
      {
        q: "¿Qué sabor es el Terea Glacier Pearl?",
        a: "Glacier Pearl es un mentol fresco con una cápsula (pearl) integrada: al apretarla, libera una ráfaga extra de frescor. Es de las selecciones mentoladas más buscadas por quien quiere frío intenso y control.",
      },
      {
        q: "¿Qué sabor es el Terea Sienna?",
        a: "Terea Sienna es una mezcla de tabaco tostado con notas cálidas y ligeramente especiadas, sin mentol. Es una de las más vendidas en RD —y el sabor que inspira al personaje 'Sienna' de nuestra saga El Sereno.",
      },
      {
        q: "¿Cuál es la Terea más fuerte de mentol?",
        a: "Deep Mint es la más intensa en mentol. Si buscas algo más suave pero fresco, Glacier o Blue son mejores opciones.",
      },
      {
        q: "¿Terea sirve para cualquier IQOS?",
        a: "No. Terea funciona solo con los dispositivos IQOS ILUMA. Para los IQOS clásicos (3, 3 Duo, Lil Solid) se usan los Heets.",
      },
    ],
    relatedBrand: "terea",
  },
];

export function getGuiaBySlug(slug: string): GuiaMeta | undefined {
  return GUIAS.find((g) => g.id === slug);
}
