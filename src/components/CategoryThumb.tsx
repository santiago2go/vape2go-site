import { type Category } from "@/data/products";

/**
 * Identificador visual de categoría: icono SVG genérico relleno en blanco sobre
 * un tile con gradiente saturado del color de la categoría. Reemplaza emojis y
 * fotos de producto (que cargaban rotas/pixeladas). Escala sin perder nitidez.
 * Decorativo: el label de texto va al lado.
 */

const CAT_TILE: Record<Category, string> = {
  desechables: "bg-gradient-to-br from-violet-500 to-violet-700 text-white",
  pods: "bg-gradient-to-br from-blue-500 to-blue-700 text-white",
  liquids: "bg-gradient-to-br from-emerald-500 to-emerald-700 text-white",
  accesorios: "bg-gradient-to-br from-gray-500 to-gray-700 text-white",
};

function Glyph({ category, className }: { category: Category; className?: string }) {
  const common = {
    viewBox: "0 0 24 24",
    fill: "currentColor",
    className,
    "aria-hidden": true,
  };
  switch (category) {
    case "desechables": // barra delgada y alta + boquilla (disposable stick)
      return (
        <svg {...common}>
          <rect x="9.7" y="2" width="4.6" height="2.6" rx="1.2" />
          <rect x="9" y="4.3" width="6" height="17.7" rx="3" />
        </svg>
      );
    case "pods": // dispositivo ancho + pod removible (más angosto) separado arriba
      return (
        <svg {...common}>
          <rect x="9" y="2.4" width="6" height="5.8" rx="1.6" />
          <rect x="6.4" y="9.6" width="11.2" height="11.9" rx="2.6" />
        </svg>
      );
    case "liquids": // botella de e-liquid (tapa + cuello + cuerpo)
      return (
        <svg {...common}>
          <rect x="9.4" y="2" width="5.2" height="2.7" rx="1" />
          <rect x="10.2" y="4" width="3.6" height="2.6" />
          <rect x="7.8" y="6.2" width="8.4" height="15.3" rx="2.8" />
        </svg>
      );
    case "accesorios": // cajetilla (Heets / Terea)
      return (
        <svg {...common}>
          <rect x="6.5" y="4" width="11" height="16" rx="2" />
        </svg>
      );
  }
}

export default function CategoryThumb({
  category,
  className = "w-5 h-5 rounded",
  pad = "p-1",
}: {
  category: Category;
  className?: string;
  pad?: string;
}) {
  return (
    <span className={`grid place-items-center shrink-0 ${CAT_TILE[category]} ${className}`}>
      <Glyph category={category} className={`w-full h-full ${pad}`} />
    </span>
  );
}
