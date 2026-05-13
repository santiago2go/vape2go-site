"use client";

import { useState, useMemo } from "react";
import { SlidersHorizontal, X } from "lucide-react";
import ProductCard from "@/components/ProductCard";
import FilterSidebar, { type Filters } from "@/components/FilterSidebar";
import { getAllProducts, type Category } from "@/data/products";

const PAGE_SIZE = 24;

const SORT_OPTIONS = [
  { value: "default", label: "Destacados" },
  { value: "name_asc", label: "Nombre A–Z" },
  { value: "name_desc", label: "Nombre Z–A" },
  { value: "price_asc", label: "Precio: menor a mayor" },
  { value: "price_desc", label: "Precio: mayor a menor" },
];

export default function CatalogoPage() {
  const allProducts = useMemo(() => getAllProducts(), []);
  const [filters, setFilters] = useState<Filters>({
    category: "todas",
    brands: [],
    soloDisponibles: false,
  });
  const [sort, setSort] = useState("default");
  const [page, setPage] = useState(1);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  const filtered = useMemo(() => {
    let result = allProducts;
    if (filters.category !== "todas") {
      result = result.filter((p) => p.category === (filters.category as Category));
    }
    if (filters.brands.length > 0) {
      result = result.filter((p) =>
        filters.brands.some((b) => p.brand.toLowerCase().includes(b.toLowerCase()))
      );
    }
    if (filters.soloDisponibles) {
      result = result.filter((p) => p.disponible);
    }
    // Sort
    if (sort === "name_asc") result = [...result].sort((a, b) => a.name.localeCompare(b.name));
    if (sort === "name_desc") result = [...result].sort((a, b) => b.name.localeCompare(a.name));
    if (sort === "price_asc") result = [...result].sort((a, b) => a.price - b.price);
    if (sort === "price_desc") result = [...result].sort((a, b) => b.price - a.price);
    return result;
  }, [allProducts, filters, sort]);

  const visible = filtered.slice(0, page * PAGE_SIZE);
  const hasMore = visible.length < filtered.length;

  const handleFiltersChange = (f: Filters) => {
    setFilters(f);
    setPage(1);
  };

  const handleSort = (value: string) => {
    setSort(value);
    setPage(1);
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Page header */}
      <div className="mb-8">
        <h1 className="text-3xl font-normal text-gray-900">Tienda</h1>
        <p className="text-gray-500 mt-1 text-sm">
          {allProducts.length} productos disponibles
        </p>
      </div>

      <div className="flex gap-8">
        {/* Sidebar — desktop */}
        <div className="hidden lg:block w-56 shrink-0">
          <FilterSidebar
            filters={filters}
            onChange={handleFiltersChange}
            totalCount={allProducts.length}
            filteredCount={filtered.length}
          />
        </div>

        {/* Main */}
        <div className="flex-1 min-w-0">
          {/* Sort bar */}
          <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-100">
            <div className="flex items-center gap-3">
              {/* Mobile filters toggle */}
              <button
                onClick={() => setMobileFiltersOpen(true)}
                className="lg:hidden flex items-center gap-2 text-sm text-gray-600 border border-gray-200 rounded-lg px-3 py-2 hover:border-gray-300 transition-colors"
              >
                <SlidersHorizontal size={15} />
                Filtros
              </button>
              <span className="text-sm text-gray-400">
                {filtered.length} {filtered.length === 1 ? "producto" : "productos"}
              </span>
            </div>

            {/* Sort dropdown */}
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-500 hidden sm:block">Ordenar por:</label>
              <select
                value={sort}
                onChange={(e) => handleSort(e.target.value)}
                className="text-sm border border-gray-200 rounded-lg px-3 py-2 text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
              >
                {SORT_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Active filter chips */}
          {(filters.category !== "todas" || filters.brands.length > 0 || filters.soloDisponibles) && (
            <div className="flex flex-wrap gap-2 mb-5">
              {filters.category !== "todas" && (
                <span className="inline-flex items-center gap-1.5 text-xs bg-violet-100 text-violet-700 px-3 py-1 rounded-full">
                  {filters.category}
                  <button onClick={() => handleFiltersChange({ ...filters, category: "todas" })}>
                    <X size={12} />
                  </button>
                </span>
              )}
              {filters.brands.map((b) => (
                <span key={b} className="inline-flex items-center gap-1.5 text-xs bg-violet-100 text-violet-700 px-3 py-1 rounded-full">
                  {b}
                  <button onClick={() => handleFiltersChange({ ...filters, brands: filters.brands.filter((x) => x !== b) })}>
                    <X size={12} />
                  </button>
                </span>
              ))}
              {filters.soloDisponibles && (
                <span className="inline-flex items-center gap-1.5 text-xs bg-green-100 text-green-700 px-3 py-1 rounded-full">
                  Solo disponibles
                  <button onClick={() => handleFiltersChange({ ...filters, soloDisponibles: false })}>
                    <X size={12} />
                  </button>
                </span>
              )}
            </div>
          )}

          {/* Product grid */}
          {visible.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {visible.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          ) : (
            <div className="py-20 text-center">
              <p className="text-gray-400 text-sm">No hay productos con estos filtros.</p>
              <button
                onClick={() => handleFiltersChange({ category: "todas", brands: [], soloDisponibles: false })}
                className="mt-4 text-sm text-violet-600 hover:underline"
              >
                Limpiar filtros
              </button>
            </div>
          )}

          {/* Load more */}
          {hasMore && (
            <div className="text-center mt-10">
              <button
                onClick={() => setPage((p) => p + 1)}
                className="px-8 py-3 rounded-xl border border-gray-200 text-gray-600 text-sm hover:border-violet-300 hover:text-violet-600 transition-colors"
              >
                Cargar más · {filtered.length - visible.length} productos restantes
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Mobile filters drawer */}
      {mobileFiltersOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/30" onClick={() => setMobileFiltersOpen(false)} />
          <div className="absolute right-0 top-0 bottom-0 w-72 bg-white shadow-xl overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-semibold text-gray-900">Filtros</h3>
              <button onClick={() => setMobileFiltersOpen(false)} className="text-gray-400 hover:text-gray-700">
                <X size={20} />
              </button>
            </div>
            <FilterSidebar
              filters={filters}
              onChange={(f) => { handleFiltersChange(f); setMobileFiltersOpen(false); }}
              totalCount={allProducts.length}
              filteredCount={filtered.length}
            />
          </div>
        </div>
      )}
    </div>
  );
}
