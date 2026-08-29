"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  ClipboardList,
  Store,
  Users,
  Boxes,
  Ticket,
  Settings,
  Target,
  Star,
  ShieldCheck,
  LogOut,
  Menu,
  X,
  Zap,
  ExternalLink,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import OrderAlert from "@/components/OrderAlert";

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ size?: number; strokeWidth?: number }>;
}

const NAV: NavItem[] = [
  { href: "/backoffice/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/backoffice/ordenes/", label: "Órdenes", icon: ClipboardList },
  { href: "/backoffice/pos/", label: "Tienda", icon: Store },
  { href: "/backoffice/clientes/", label: "Clientes", icon: Users },
  { href: "/backoffice/crm/", label: "CRM", icon: Target },
  { href: "/backoffice/inventario/", label: "Inventario", icon: Boxes },
  { href: "/backoffice/reviews/", label: "Reseñas", icon: Star },
  { href: "/backoffice/referidos/", label: "Referidos", icon: Ticket },
  { href: "/backoffice/equipo/", label: "Equipo", icon: ShieldCheck },
  { href: "/backoffice/configuracion/", label: "Configuración", icon: Settings },
];

// Vista recortada del rol operativo (operator/supervisor, cost-blind): solo POS + Inventario.
const OPERATOR_NAV: NavItem[] = [
  { href: "/backoffice/pos/", label: "Tienda", icon: Store },
  { href: "/backoffice/inventario/", label: "Inventario", icon: Boxes },
];

function sectionTitle(pathname: string): string {
  const hit = [...NAV].reverse().find((n) => n.href !== "/backoffice/" && pathname.startsWith(n.href));
  return hit ? hit.label : "Dashboard";
}

export default function BackofficeLayout({ children }: { children: React.ReactNode }) {
  const { loading, session, isOperator, isBackoffice, configured, profile, user, signOut } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [navOpen, setNavOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  // Recuerda si el menú lateral quedó oculto (útil en el mostrador touch para dar más espacio).
  useEffect(() => {
    if (typeof window !== "undefined") setCollapsed(window.localStorage.getItem("bo_sidebar_collapsed") === "1");
  }, []);
  const toggleCollapsed = () =>
    setCollapsed((c) => {
      const next = !c;
      if (typeof window !== "undefined") window.localStorage.setItem("bo_sidebar_collapsed", next ? "1" : "0");
      return next;
    });

  // Nav según rol: el operativo (operator/supervisor) ve solo POS + Inventario.
  const nav = isOperator ? OPERATOR_NAV : NAV;

  // Cierra el drawer al navegar (móvil).
  useEffect(() => setNavOpen(false), [pathname]);

  useEffect(() => {
    if (loading || !configured) return;
    // Sin sesión o sin rol de backoffice → fuera.
    if (!session || !isBackoffice) {
      router.replace("/entrar/");
      return;
    }
    // Route-guard central: el operativo solo puede estar en sus rutas permitidas.
    // NO es la barrera de seguridad (eso es RLS); solo evita renderizar pantallas vacías.
    if (isOperator && !OPERATOR_NAV.some((n) => pathname.startsWith(n.href))) {
      router.replace("/backoffice/pos/");
    }
  }, [loading, configured, session, isBackoffice, isOperator, pathname, router]);

  // ---- Gates -------------------------------------------------------------
  if (!configured) {
    return (
      <GateScreen
        title="Backoffice no disponible"
        body="El panel estará disponible cuando se configure el backend (Supabase)."
      />
    );
  }
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f8f8fc]">
        <span className="h-6 w-6 animate-spin rounded-full border-2 border-slate-300 border-t-violet-500" />
      </div>
    );
  }
  if (!session || !isBackoffice) {
    return (
      <GateScreen
        title="Acceso restringido"
        body="Necesitas una cuenta autorizada para entrar al backoffice."
        cta={{ label: "Ir a entrar", href: "/entrar/" }}
      />
    );
  }

  async function handleSignOut() {
    await signOut();
    router.replace("/");
  }

  const name = profile?.full_name || user?.email || "Admin";

  return (
    <div className="backoffice min-h-screen bg-[#f8f8fc] text-slate-800">
      {/* Ringtone global de órdenes nuevas (Realtime, canal seguro cost-blind) */}
      <OrderAlert />

      {/* Sidebar — fijo en desktop, drawer en móvil */}
      <Sidebar items={nav} pathname={pathname} open={navOpen} collapsed={collapsed} onClose={() => setNavOpen(false)} />

      {/* Backdrop del drawer móvil */}
      {navOpen && (
        <button
          aria-label="Cerrar menú"
          onClick={() => setNavOpen(false)}
          className="fixed inset-0 z-30 bg-slate-900/40 backdrop-blur-[1px] lg:hidden"
        />
      )}

      {/* Zona de contenido */}
      <div className={`transition-[padding] duration-300 ${collapsed ? "" : "lg:pl-60"}`}>
        {/* Topbar */}
        <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-slate-200 bg-white/85 px-4 backdrop-blur-md sm:px-6">
          <button
            onClick={() => setNavOpen(true)}
            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 lg:hidden"
            aria-label="Abrir menú"
          >
            <Menu size={20} />
          </button>
          {/* Ocultar/mostrar el menú lateral en desktop (más espacio en el mostrador) */}
          <button
            onClick={toggleCollapsed}
            className="hidden rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 lg:inline-flex"
            aria-label={collapsed ? "Mostrar menú" : "Ocultar menú"}
            title={collapsed ? "Mostrar menú" : "Ocultar menú"}
          >
            {collapsed ? <PanelLeftOpen size={20} /> : <PanelLeftClose size={20} />}
          </button>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-slate-800">{sectionTitle(pathname)}</p>
            <p className="hidden text-[11px] text-slate-400 sm:block">Vape 2 Go · Backoffice</p>
          </div>

          <div className="ml-auto flex items-center gap-2 sm:gap-3">
            <Link
              href="/"
              className="hidden items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-800 sm:inline-flex"
            >
              Ver tienda <ExternalLink size={13} />
            </Link>
            <div className="hidden text-right sm:block">
              <p className="max-w-[160px] truncate text-xs font-medium text-slate-700">{name}</p>
              <p className="text-[10px] uppercase tracking-wide text-violet-500">{profile?.role ?? "admin"}</p>
            </div>
            <div className="grid h-8 w-8 place-items-center rounded-full bg-violet-100 text-xs font-bold text-violet-700 ring-1 ring-violet-200">
              {(name[0] || "A").toUpperCase()}
            </div>
            <button
              onClick={handleSignOut}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
              title="Cerrar sesión"
              aria-label="Cerrar sesión"
            >
              <LogOut size={17} />
            </button>
          </div>
        </header>

        <main className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6 sm:py-8">{children}</main>
      </div>
    </div>
  );
}

function Sidebar({ items, pathname, open, collapsed, onClose }: { items: NavItem[]; pathname: string; open: boolean; collapsed: boolean; onClose: () => void }) {
  return (
    <aside
      className={`fixed inset-y-0 left-0 z-40 flex w-60 flex-col bg-[#17151f] text-slate-300 transition-transform duration-300 ease-out ${
        collapsed ? "lg:-translate-x-full" : "lg:translate-x-0"
      } ${open ? "translate-x-0" : "-translate-x-full"}`}
    >
      {/* Marca */}
      <div className="flex h-14 items-center gap-2.5 border-b border-white/5 px-5">
        <div className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-violet-500 to-violet-700 text-white shadow-sm shadow-violet-900/40">
          <Zap size={16} strokeWidth={2.5} />
        </div>
        <div className="leading-tight">
          <p className="text-sm font-semibold text-white">Vape 2 Go</p>
          <p className="text-[10px] uppercase tracking-[0.16em] text-violet-300/80">Backoffice</p>
        </div>
        <button onClick={onClose} className="ml-auto rounded-lg p-1 text-slate-400 hover:bg-white/5 hover:text-white lg:hidden" aria-label="Cerrar menú">
          <X size={18} />
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-4">
        <p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">Gestión</p>
        {items.map((item) => {
          const active =
            item.href === "/backoffice/" ? pathname === "/backoffice/" || pathname === "/backoffice" : pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                active ? "bg-white/[0.07] text-white" : "text-slate-400 hover:bg-white/[0.04] hover:text-slate-100"
              }`}
            >
              {active && <span className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-violet-400" />}
              <Icon size={18} strokeWidth={active ? 2.4 : 2} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-white/5 px-5 py-4">
        <p className="text-[11px] leading-relaxed text-slate-500">
          Escrituras protegidas por RLS de administrador. El inventario y el catálogo se editan en el sheet Master.
        </p>
      </div>
    </aside>
  );
}

function GateScreen({ title, body, cta }: { title: string; body: string; cta?: { label: string; href: string } }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f8f8fc] px-4">
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <div className="mx-auto mb-4 grid h-11 w-11 place-items-center rounded-xl bg-violet-100 text-violet-600">
          <Zap size={20} />
        </div>
        <h1 className="text-lg font-semibold text-slate-800" style={{ fontFamily: "var(--font-body), system-ui, sans-serif" }}>
          {title}
        </h1>
        <p className="mt-2 text-sm text-slate-500">{body}</p>
        {cta && (
          <Link
            href={cta.href}
            className="mt-5 inline-flex items-center justify-center rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-violet-700"
          >
            {cta.label}
          </Link>
        )}
      </div>
    </div>
  );
}
