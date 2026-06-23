import Image from "next/image";
import { CATEGORY_IMAGE, type Category } from "@/data/products";

/**
 * Miniatura de producto representativo de una categoría. Reemplaza los emojis
 * para identificar categorías en home, hero, catálogo y footer. Decorativa
 * (alt=""): el label de texto siempre va al lado.
 */
export default function CategoryThumb({
  category,
  className = "w-5 h-5 rounded bg-white",
  pad = "p-0.5",
}: {
  category: Category;
  className?: string;
  pad?: string;
}) {
  const src = CATEGORY_IMAGE[category];
  return (
    <span
      className={`relative inline-block border border-gray-100 overflow-hidden shrink-0 ${className}`}
    >
      {src && (
        <Image src={src} alt="" fill className={`object-contain ${pad}`} sizes="80px" />
      )}
    </span>
  );
}
