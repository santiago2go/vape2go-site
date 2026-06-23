import { type Category } from "@/data/products";

/**
 * Identificador visual de categoría: icono SVG genérico (vape, pod, botella,
 * cajetilla) en el color de la categoría, sobre un tile con tinte. Reemplaza
 * los emojis y las fotos de producto (que cargaban rotas o pixeladas).
 * Escala a cualquier tamaño sin perder nitidez. Decorativo: el label va al lado.
 */

const CAT_COLORS: Record<Category, string> = {
  desechables: "bg-violet-100 text-violet-600",
  pods: "bg-blue-100 text-blue-600",
  liquids: "bg-emerald-100 text-emerald-600",
  accesorios: "bg-gray-100 text-gray-600",
};

function Glyph({ category, className }: { category: Category; className?: string }) {
  const common = {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    className,
    "aria-hidden": true,
  };
  switch (category) {
    case "desechables": // vape desechable (barra con boquilla)
      return (
        <svg {...common}>
          <rect x="9" y="2.5" width="6" height="3" rx="1.2" />
          <rect x="7.5" y="5" width="9" height="16.5" rx="3.5" />
          <path d="M10 17.5h4" />
        </svg>
      );
    case "pods": // sistema pod (cuerpo + pod desmontable)
      return (
        <svg {...common}>
          <rect x="10" y="2" width="4" height="3.5" rx="1" />
          <rect x="7.5" y="5" width="9" height="16.5" rx="2.5" />
          <path d="M7.5 10.5h9" />
        </svg>
      );
    case "liquids": // botella de e-liquid con gotero
      return (
        <svg {...common}>
          <rect x="9.5" y="2" width="5" height="2.4" rx="0.8" />
          <path d="M10.3 4.4v2.4M13.7 4.4v2.4" />
          <rect x="7.8" y="6.8" width="8.4" height="14.7" rx="2.6" />
          <path d="M7.8 12.6h8.4" />
        </svg>
      );
    case "accesorios": // cajetilla (Heets / Terea)
      return (
        <svg {...common}>
          <rect x="6.5" y="4" width="11" height="16" rx="1.8" />
          <path d="M6.5 8.7h11" />
          <path d="M10 13.5h4" />
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
    <span className={`grid place-items-center shrink-0 ${CAT_COLORS[category]} ${className}`}>
      <Glyph category={category} className={`w-full h-full ${pad}`} />
    </span>
  );
}
