"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import VapePlaceholder from "./VapePlaceholder";
import { type Product, type Category, PEDIDOSYA_URL } from "@/data/products";

const CATEGORY_STYLES: Record<Category, { label: string; bg: string; text: string }> = {
  desechables: { label: "Desechable", bg: "bg-violet-100", text: "text-violet-700" },
  pods:        { label: "Pod",        bg: "bg-blue-100",   text: "text-blue-700" },
  liquids:     { label: "Liquid",     bg: "bg-emerald-100",text: "text-emerald-700" },
  accesorios:  { label: "Accesorio",  bg: "bg-gray-100",   text: "text-gray-600" },
};

export default function ProductCard({ product }: { product: Product }) {
  const [imgError, setImgError] = useState(false);
  const catStyle = CATEGORY_STYLES[product.category];

  return (
    <div className="card-light flex flex-col overflow-hidden hover:border-violet-300 hover:shadow-md hover:shadow-violet-100/50 transition-all duration-200 group">
      {/* Image */}
      <Link href={`/productos/${product.id}/`} className="block relative aspect-square bg-gray-50 overflow-hidden">
        {product.image && !imgError ? (
          <Image
            src={product.image}
            alt={product.name}
            fill
            className="object-contain p-3 group-hover:scale-105 transition-transform duration-300"
            onError={() => setImgError(true)}
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
          />
        ) : (
          <VapePlaceholder className="w-full h-full" />
        )}
        {product.bestseller && (
          <span className="absolute top-2 left-2 text-[10px] font-bold bg-violet-600 text-white px-2 py-0.5 rounded-full uppercase tracking-wide">
            Top
          </span>
        )}
      </Link>

      {/* Content */}
      <div className="flex flex-col gap-2 p-3 flex-1">
        {/* Badges */}
        <div className="flex gap-1 flex-wrap">
          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${catStyle.bg} ${catStyle.text}`}>
            {catStyle.label}
          </span>
          {product.disponible ? (
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-green-50 text-green-700">
              Disponible
            </span>
          ) : (
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-400">
              Agotado
            </span>
          )}
        </div>

        {/* Name */}
        <Link href={`/productos/${product.id}/`}>
          <h3 className="text-sm font-semibold text-gray-900 line-clamp-2 leading-snug hover:text-violet-600 transition-colors">
            {product.name}
          </h3>
        </Link>

        {/* Brand */}
        <p className="text-xs text-gray-400">{product.brand}</p>

        {/* Price */}
        {product.price > 0 && (
          <p className="text-violet-700 font-bold text-base mt-auto">
            {product.priceFormatted}
          </p>
        )}

        {/* CTA */}
        <a
          href={PEDIDOSYA_URL}
          target="_blank"
          rel="noopener noreferrer"
          className={`mt-auto text-center text-xs font-semibold py-2 rounded-lg transition-colors ${
            product.disponible
              ? "bg-violet-600 text-white hover:bg-violet-700"
              : "bg-gray-100 text-gray-400 cursor-not-allowed"
          }`}
          onClick={product.disponible ? undefined : (e) => e.preventDefault()}
        >
          {product.disponible ? "Pedir ahora" : "No disponible"}
        </a>
      </div>
    </div>
  );
}
