"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { getSupabase } from "@/lib/supabase";
import AddressBook from "@/components/AddressBook";

interface Order {
  id: string;
  status: string;
  total: number;
  created_at: string;
  items: { name: string; qty: number }[];
}

const STATUS_LABEL: Record<string, string> = {
  pending: "Pendiente", paid: "Pagada", shipped: "Enviada",
  delivered: "Entregada", cancelled: "Cancelada", refunded: "Reembolsada",
};

export default function AccountPage() {
  const { loading, session, profile, isAdmin, signOut, configured } = useAuth();
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(true);

  useEffect(() => {
    if (!loading && configured && !session) router.replace("/entrar/");
  }, [loading, session, configured, router]);

  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase || !session) return;
    supabase
      .from("orders")
      .select("id,status,total,created_at,items")
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        setOrders((data as Order[]) ?? []);
        setLoadingOrders(false);
      });
  }, [session]);

  if (loading || (!session && configured)) {
    return <div className="max-w-3xl mx-auto px-4 py-24 text-center text-gray-400">Cargando…</div>;
  }
  if (!configured) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-24 text-center text-gray-500">
        Las cuentas estarán disponibles muy pronto.
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-12 sm:py-16">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl text-gray-900" style={{ fontFamily: "var(--font-heading)" }}>
          Mi cuenta
        </h1>
        <button onClick={() => { void signOut(); router.replace("/"); }} className="text-sm text-gray-500 hover:text-gray-900">
          Cerrar sesión
        </button>
      </div>

      <div className="grid sm:grid-cols-3 gap-4 mb-10">
        <Stat label="Nombre" value={profile?.full_name || "—"} />
        <Stat label="Correo" value={profile?.email || session?.user?.email || "—"} />
        <Stat label="Puntos" value={String(profile?.loyalty_points ?? 0)} accent />
      </div>

      {isAdmin && (
        <Link href="/admin/" className="inline-flex items-center gap-2 mb-10 text-sm font-semibold text-violet-600 hover:text-violet-700">
          → Ir al panel de administración
        </Link>
      )}

      {session?.user?.id && <AddressBook userId={session.user.id} defaultPhone={profile?.phone} />}

      <h2 className="text-xl text-gray-900 mb-4" style={{ fontFamily: "var(--font-heading)" }}>Mis órdenes</h2>
      {loadingOrders ? (
        <p className="text-sm text-gray-400">Cargando órdenes…</p>
      ) : orders.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-200 p-8 text-center text-sm text-gray-400">
          Aún no tienes órdenes. <Link href="/catalogo/" className="text-violet-600 hover:text-violet-700">Explora el catálogo →</Link>
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map((o) => (
            <div key={o.id} className="border border-gray-200 rounded-xl p-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-900">
                  {o.items?.map((i) => `${i.qty}× ${i.name}`).join(", ") || "Orden"}
                </p>
                <p className="text-xs text-gray-400">{new Date(o.created_at).toLocaleDateString("es-DO")}</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold text-gray-900">RD${o.total.toLocaleString("es-DO")}</p>
                <span className="text-xs text-violet-600">{STATUS_LABEL[o.status] ?? o.status}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={`rounded-xl border p-4 ${accent ? "border-violet-200 bg-violet-50" : "border-gray-200 bg-white"}`}>
      <p className="text-[11px] uppercase tracking-wide text-gray-400 mb-1">{label}</p>
      <p className={`text-sm font-semibold truncate ${accent ? "text-violet-700" : "text-gray-900"}`}>{value}</p>
    </div>
  );
}
