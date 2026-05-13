"use client";

import { ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";
import { CATEGORIES, type Category } from "@/data/products";

export interface Filters {
  category: Category | "todas";
  brands: string[];
  soloDisponibles: boolean;
}

const KNOWN_BRANDS = [
  "WAKA", "Elf Bar", "Geek Bar", "Fume", "Lost Mary",
  "IQOS", "Heets", "Terea", "SMOK", "Vaporesso",
  "Voopoo", "Uwell", "Bang", "Hyde",
];

function Section({
  title,
  children,
  defaultOpen = true,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-gray-100 pb-4 mb-4">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center justify-between w-full text-left mb-3"
      >
        <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">
          {title}
        </span>
        {open ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
      </button>
      {open && children}
    </div>
  );
}

export default function FilterSidebar({
  filters,
  onChange,
  totalCount,
  filteredCount,
}: {
  filters: Filters;
  onChange: (f: Filters) => void;
  totalCount: number;
  filteredCount: number;
}) {
  const set = (patch: Partial<Filters>) => onChange({ ...filters, ...patch });

  const toggleBrand = (brand: string) => {
    const brands = filters.brands.includes(brand)
      ? filters.brands.filter((b) => b !== brand)
      : [...filters.brands, brand];
    set({ brands });
  };

  const clearAll = () => onChange({ category: "todas", brands: [], soloDisponibles: false });
  const hasFilters = filters.category !== "todas" || filters.brands.length > 0 || filters.soloDisponibles;

  return (
    <aside className="w-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <h3 className="text-sm font-semibold text-gray-900">Filtros</h3>
        {hasFilters && (
          <button
            onClick={clearAll}
            className="text-xs text-violet-600 hover:text-violet-800 transition-colors"
          >
            Limpiar todo
          </button>
        )}
      </div>

      <p className="text-xs text-gray-400 mb-5">
        {filteredCount} de {totalCount} productos
      </p>

      {/* Categoría */}
      <Section title="Categoría">
        <ul className="space-y-1.5">
          <li>
            <label className="flex items-center gap-2 cursor-pointer group">
              <input
                type="radio"
                name="category"
                checked={filters.category === "todas"}
                onChange={() => set({ category: "todas" })}
                className="accent-violet-600"
              />
              <span className={`text-sm transition-colors ${filters.category === "todas" ? "text-violet-700 font-medium" : "text-gray-600 group-hover:text-gray-900"}`}>
                Todas
              </span>
            </label>
          </li>
          {CATEGORIES.map((cat) => (
            <li key={cat.id}>
              <label className="flex items-center gap-2 cursor-pointer group">
                <input
                  type="radio"
                  name="category"
                  checked={filters.category === cat.id}
                  onChange={() => set({ category: cat.id })}
                  className="accent-violet-600"
                />
                <span className={`text-sm transition-colors ${filters.category === cat.id ? "text-violet-700 font-medium" : "text-gray-600 group-hover:text-gray-900"}`}>
                  {cat.icon} {cat.label}
                </span>
              </label>
            </li>
          ))}
        </ul>
      </Section>

      {/* Marca */}
      <Section title="Marca" defaultOpen={false}>
        <ul className="space-y-1.5">
          {KNOWN_BRANDS.map((brand) => (
            <li key={brand}>
              <label className="flex items-center gap-2 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={filters.brands.includes(brand)}
                  onChange={() => toggleBrand(brand)}
                  className="accent-violet-600 rounded"
                />
                <span className={`text-sm transition-colors ${filters.brands.includes(brand) ? "text-violet-700 font-medium" : "text-gray-600 group-hover:text-gray-900"}`}>
                  {brand}
                </span>
              </label>
            </li>
          ))}
        </ul>
      </Section>

      {/* Disponibilidad */}
      <Section title="Disponibilidad">
        <label className="flex items-center gap-2 cursor-pointer group">
          <input
            type="checkbox"
            checked={filters.soloDisponibles}
            onChange={() => set({ soloDisponibles: !filters.soloDisponibles })}
            className="accent-violet-600 rounded"
          />
          <span className={`text-sm transition-colors ${filters.soloDisponibles ? "text-violet-700 font-medium" : "text-gray-600 group-hover:text-gray-900"}`}>
            Solo disponibles
          </span>
        </label>
      </Section>
    </aside>
  );
}
