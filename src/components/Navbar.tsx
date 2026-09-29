"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search, Menu, X, User, LogOut, LayoutDashboard, ShoppingBag } from "lucide-react";
import Logo from "./Logo";
import SearchModal from "./SearchModal";
import CategoryThumb from "./CategoryThumb";
import { CATEGORIES, PEDIDOSYA_URL, DIRECT_ORDERS } from "@/data/catalog-meta";
import { useAuth } from "@/lib/auth-context";
import { useCart } from "@/lib/cart-context";

export default function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const { session, isAdmin, signOut } = useAuth();
  const { count } = useCart();
  const router = useRouter();
  const accountRef = useRef<HTMLDivElement>(null);

  // El badge del carrito lee localStorage → solo se pinta tras montar (evita
  // mismatch de hydration entre el HTML estático y el estado hidratado).
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (accountRef.current && !accountRef.current.contains(e.target as Node)) setAccountOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  return (
    <>
      <nav className="sticky top-0 z-40 w-full bg-white/95 backdrop-blur-sm border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between gap-4">
          {/* Logo */}
          <Logo />

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-6">
            <Link href="/catalogo/" className="text-sm text-gray-500 hover:text-gray-900 transition-colors">
              Catálogo
            </Link>
            {CATEGORIES.map((cat) => (
              <Link
                key={cat.id}
                href={`/categoria/${cat.id}/`}
                className="text-sm text-gray-500 hover:text-gray-900 transition-colors"
              >
                {cat.label}
              </Link>
            ))}
          </div>

          {/* Right actions */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => setSearchOpen(true)}
              className="p-2 text-gray-500 hover:text-gray-900 transition-colors"
              aria-label="Buscar"
            >
              <Search size={18} />
            </button>
            {DIRECT_ORDERS && (
              <Link
                href="/carrito/"
                className="relative p-2 text-gray-500 hover:text-gray-900 transition-colors"
                aria-label="Carrito"
              >
                <ShoppingBag size={18} />
                {mounted && count > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 bg-violet-600 text-white text-[10px] font-bold rounded-full min-w-4 h-4 px-1 flex items-center justify-center">
                    {count}
                  </span>
                )}
              </Link>
            )}
            {session ? (
              <div className="relative" ref={accountRef}>
                <button
                  onClick={() => setAccountOpen((o) => !o)}
                  className="p-2 text-gray-500 hover:text-gray-900 transition-colors"
                  aria-label="Mi cuenta"
                  aria-expanded={accountOpen}
                >
                  <User size={18} />
                </button>
                {accountOpen && (
                  <div className="absolute right-0 mt-1 w-48 bg-white border border-gray-200 rounded-xl shadow-lg py-1.5 z-50">
                    <Link href="/cuenta/" onClick={() => setAccountOpen(false)} className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50">
                      <User size={15} /> Mi cuenta
                    </Link>
                    {isAdmin && (
                      <Link href="/backoffice/" onClick={() => setAccountOpen(false)} className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50">
                        <LayoutDashboard size={15} /> Backoffice
                      </Link>
                    )}
                    <button
                      onClick={() => { setAccountOpen(false); void signOut(); router.replace("/"); }}
                      className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-500 hover:bg-gray-50 border-t border-gray-100 mt-1"
                    >
                      <LogOut size={15} /> Cerrar sesión
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <Link
                href="/entrar/"
                className="p-2 text-gray-500 hover:text-gray-900 transition-colors"
                aria-label="Entrar"
              >
                <User size={18} />
              </Link>
            )}
            {DIRECT_ORDERS ? (
              <Link
                href="/catalogo/"
                className="hidden sm:inline-flex items-center bg-violet-600 text-white text-xs font-semibold px-4 py-2 rounded-lg hover:bg-violet-700 transition-colors ml-2"
              >
                Comprar ahora
              </Link>
            ) : (
              <a
                href={PEDIDOSYA_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="hidden sm:inline-flex items-center bg-violet-600 text-white text-xs font-semibold px-4 py-2 rounded-lg hover:bg-violet-700 transition-colors ml-2"
              >
                Pedir ahora
              </a>
            )}
            <button
              className="md:hidden p-2 text-gray-500 hover:text-gray-900 transition-colors"
              onClick={() => setMenuOpen(!menuOpen)}
              aria-label="Menú"
            >
              {menuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {menuOpen && (
          <div className="md:hidden bg-white border-t border-gray-100 px-4 py-4 space-y-1">
            <Link href="/catalogo/" onClick={() => setMenuOpen(false)} className="block py-2 text-sm text-gray-700 hover:text-violet-600 transition-colors font-medium">
              Catálogo completo
            </Link>
            {DIRECT_ORDERS && (
              <Link href="/carrito/" onClick={() => setMenuOpen(false)} className="flex items-center gap-2.5 py-2 text-sm text-gray-700 hover:text-violet-600 transition-colors font-medium">
                <ShoppingBag size={16} /> Carrito{mounted && count > 0 ? ` (${count})` : ""}
              </Link>
            )}
            {CATEGORIES.map((cat) => (
              <Link
                key={cat.id}
                href={`/categoria/${cat.id}/`}
                onClick={() => setMenuOpen(false)}
                className="flex items-center gap-2.5 py-2 text-sm text-gray-500 hover:text-gray-900 transition-colors"
              >
                <CategoryThumb category={cat.id} className="w-6 h-6 rounded-lg" />
                {cat.label}
              </Link>
            ))}
            <div className="pt-3 border-t border-gray-100 flex gap-3">
              {DIRECT_ORDERS ? (
                <Link href="/catalogo/" onClick={() => setMenuOpen(false)} className="flex-1 text-center text-sm py-2 rounded-lg bg-violet-600 text-white font-semibold hover:bg-violet-700 transition-colors">
                  Comprar ahora
                </Link>
              ) : (
                <a href={PEDIDOSYA_URL} target="_blank" rel="noopener noreferrer" className="flex-1 text-center text-sm py-2 rounded-lg bg-violet-600 text-white font-semibold hover:bg-violet-700 transition-colors">
                  PedidosYa
                </a>
              )}
            </div>
          </div>
        )}
      </nav>

      <SearchModal open={searchOpen} onClose={() => setSearchOpen(false)} />
    </>
  );
}
