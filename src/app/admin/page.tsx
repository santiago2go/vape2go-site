"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { getSupabase } from "@/lib/supabase";

type Tab = "funnel" | "users" | "orders" | "affiliates";

export default function AdminPage() {
  const { loading, session, isAdmin, configured } = useAuth();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("funnel");

  useEffect(() => {
    if (!loading && configured && (!session || !isAdmin)) router.replace("/");
  }, [loading, session, isAdmin, configured, router]);

  if (!configured) {
    return <Centered>El panel estará disponible cuando se configure el backend.</Centered>;
  }
  if (loading || !session) return <Centered>Cargando…</Centered>;
  if (!isAdmin) return <Centered>Sin permisos.</Centered>;

  return (
    <div className="max-w-6xl mx-auto px-4 py-12">
      <h1 className="text-3xl text-gray-900 mb-8" style={{ fontFamily: "var(--font-heading)" }}>
        Administración
      </h1>
      <div className="flex gap-1 border-b border-gray-200 mb-8 overflow-x-auto">
        {([["funnel", "Conversión"], ["users", "Usuarios"], ["orders", "Órdenes"], ["affiliates", "Cupones / Afiliados"]] as [Tab, string][]).map(
          ([id, label]) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 -mb-px transition-colors ${
                tab === id ? "border-violet-600 text-violet-700" : "border-transparent text-gray-500 hover:text-gray-800"
              }`}
            >
              {label}
            </button>
          )
        )}
      </div>

      {tab === "funnel" && <FunnelPanel />}
      {tab === "users" && <UsersPanel />}
      {tab === "orders" && <OrdersPanel />}
      {tab === "affiliates" && <AffiliatesPanel />}
    </div>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return <div className="max-w-3xl mx-auto px-4 py-24 text-center text-gray-400">{children}</div>;
}

// ---- Funnel ----------------------------------------------------------------
interface FunnelRow { day: string; home: number; listing: number; product: number; intent: number; orders: number; }

function FunnelPanel() {
  const [rows, setRows] = useState<FunnelRow[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const sb = getSupabase();
    if (!sb) return;
    sb.from("funnel_daily").select("*").limit(30).then(({ data }) => {
      setRows((data as FunnelRow[]) ?? []);
      setLoading(false);
    });
  }, []);

  const totals = rows.reduce(
    (a, r) => ({ home: a.home + r.home, listing: a.listing + r.listing, product: a.product + r.product, intent: a.intent + r.intent, orders: a.orders + r.orders }),
    { home: 0, listing: 0, product: 0, intent: 0, orders: 0 }
  );
  const pct = (n: number, base: number) => (base ? Math.round((n / base) * 100) : 0);

  if (loading) return <p className="text-sm text-gray-400">Cargando funnel…</p>;

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <FunnelStep label="Home" value={totals.home} pct={100} />
        <FunnelStep label="Listado" value={totals.listing} pct={pct(totals.listing, totals.home)} />
        <FunnelStep label="Producto" value={totals.product} pct={pct(totals.product, totals.home)} />
        <FunnelStep label="Intención" value={totals.intent} pct={pct(totals.intent, totals.home)} />
        <FunnelStep label="Orden" value={totals.orders} pct={pct(totals.orders, totals.home)} accent />
      </div>
      <p className="text-xs text-gray-400">Acumulado de los últimos {rows.length} días (sesiones únicas por paso).</p>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-gray-400 border-b border-gray-200">
            <th className="py-2">Día</th><th>Home</th><th>Listado</th><th>Producto</th><th>Intención</th><th>Orden</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.day} className="border-b border-gray-100 text-gray-700">
              <td className="py-2">{new Date(r.day).toLocaleDateString("es-DO")}</td>
              <td>{r.home}</td><td>{r.listing}</td><td>{r.product}</td><td>{r.intent}</td><td className="font-semibold text-violet-700">{r.orders}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function FunnelStep({ label, value, pct, accent }: { label: string; value: number; pct: number; accent?: boolean }) {
  return (
    <div className={`rounded-xl border p-4 ${accent ? "border-violet-200 bg-violet-50" : "border-gray-200"}`}>
      <p className="text-[11px] uppercase tracking-wide text-gray-400">{label}</p>
      <p className={`text-2xl ${accent ? "text-violet-700" : "text-gray-900"}`} style={{ fontFamily: "var(--font-heading)" }}>{value}</p>
      <p className="text-xs text-gray-400">{pct}%</p>
    </div>
  );
}

// ---- Users -----------------------------------------------------------------
interface UserRow { id: string; email: string; full_name: string; phone: string; role: string; loyalty_points: number; created_at: string; }

function UsersPanel() {
  const [rows, setRows] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const load = useCallback(() => {
    const sb = getSupabase();
    if (!sb) return;
    sb.from("profiles").select("id,email,full_name,phone,role,loyalty_points,created_at").order("created_at", { ascending: false }).limit(500)
      .then(({ data }) => { setRows((data as UserRow[]) ?? []); setLoading(false); });
  }, []);
  useEffect(load, [load]);

  async function changeRole(id: string, role: string) {
    const sb = getSupabase();
    if (!sb) return;
    await sb.from("profiles").update({ role }).eq("id", id);
    load();
  }

  if (loading) return <p className="text-sm text-gray-400">Cargando usuarios…</p>;
  return (
    <div>
      <p className="text-xs text-gray-400 mb-4">{rows.length} usuarios registrados.</p>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="text-left text-xs text-gray-400 border-b border-gray-200">
            <th className="py-2">Nombre</th><th>Correo</th><th>Teléfono</th><th>Puntos</th><th>Rol</th>
          </tr></thead>
          <tbody>
            {rows.map((u) => (
              <tr key={u.id} className="border-b border-gray-100 text-gray-700">
                <td className="py-2">{u.full_name || "—"}</td>
                <td>{u.email}</td>
                <td>{u.phone || "—"}</td>
                <td>{u.loyalty_points}</td>
                <td>
                  <select value={u.role} onChange={(e) => changeRole(u.id, e.target.value)} className="border border-gray-200 rounded-lg px-2 py-1 text-xs">
                    <option value="customer">customer</option>
                    <option value="staff">staff</option>
                    <option value="admin">admin</option>
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ---- Orders ----------------------------------------------------------------
interface OrderRow { id: string; status: string; total: number; customer_name: string; affiliate_code: string | null; created_at: string; }

function OrdersPanel() {
  const [rows, setRows] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const sb = getSupabase();
    if (!sb) return;
    sb.from("orders").select("id,status,total,customer_name,affiliate_code,created_at").order("created_at", { ascending: false }).limit(500)
      .then(({ data }) => { setRows((data as OrderRow[]) ?? []); setLoading(false); });
  }, []);
  if (loading) return <p className="text-sm text-gray-400">Cargando órdenes…</p>;
  if (!rows.length) return <p className="text-sm text-gray-400">Aún no hay órdenes (el checkout propio es Fase 1 del roadmap).</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead><tr className="text-left text-xs text-gray-400 border-b border-gray-200">
          <th className="py-2">Fecha</th><th>Cliente</th><th>Total</th><th>Cupón</th><th>Estado</th>
        </tr></thead>
        <tbody>
          {rows.map((o) => (
            <tr key={o.id} className="border-b border-gray-100 text-gray-700">
              <td className="py-2">{new Date(o.created_at).toLocaleDateString("es-DO")}</td>
              <td>{o.customer_name || "—"}</td>
              <td>RD${o.total.toLocaleString("es-DO")}</td>
              <td>{o.affiliate_code || "—"}</td>
              <td>{o.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ---- Affiliates ------------------------------------------------------------
interface AffRow { id: string; code: string; business_name: string; discount_type: string; discount_value: number; commission_pct: number; active: boolean; }

function AffiliatesPanel() {
  const [rows, setRows] = useState<AffRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ code: "", business_name: "", discount_value: "10", commission_pct: "10" });
  const load = useCallback(() => {
    const sb = getSupabase();
    if (!sb) return;
    sb.from("affiliates").select("id,code,business_name,discount_type,discount_value,commission_pct,active").order("created_at", { ascending: false })
      .then(({ data }) => { setRows((data as AffRow[]) ?? []); setLoading(false); });
  }, []);
  useEffect(load, [load]);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const sb = getSupabase();
    if (!sb) return;
    await sb.from("affiliates").insert({
      code: form.code.trim().toUpperCase(),
      business_name: form.business_name.trim(),
      discount_value: Number(form.discount_value),
      commission_pct: Number(form.commission_pct),
    });
    setForm({ code: "", business_name: "", discount_value: "10", commission_pct: "10" });
    load();
  }
  async function toggle(id: string, active: boolean) {
    const sb = getSupabase();
    if (!sb) return;
    await sb.from("affiliates").update({ active: !active }).eq("id", id);
    load();
  }

  return (
    <div className="space-y-8">
      <form onSubmit={add} className="grid sm:grid-cols-5 gap-3 items-end bg-gray-50 border border-gray-200 rounded-xl p-4">
        <Input label="Código (QR)" value={form.code} onChange={(v) => setForm((f) => ({ ...f, code: v }))} />
        <Input label="Negocio" value={form.business_name} onChange={(v) => setForm((f) => ({ ...f, business_name: v }))} />
        <Input label="Descuento %" value={form.discount_value} onChange={(v) => setForm((f) => ({ ...f, discount_value: v }))} />
        <Input label="Comisión %" value={form.commission_pct} onChange={(v) => setForm((f) => ({ ...f, commission_pct: v }))} />
        <button className="bg-violet-600 text-white text-sm font-semibold py-2.5 rounded-xl hover:bg-violet-700">Agregar</button>
      </form>

      {loading ? <p className="text-sm text-gray-400">Cargando…</p> : (
        <table className="w-full text-sm">
          <thead><tr className="text-left text-xs text-gray-400 border-b border-gray-200">
            <th className="py-2">Código</th><th>Negocio</th><th>Descuento</th><th>Comisión</th><th>Activo</th>
          </tr></thead>
          <tbody>
            {rows.map((a) => (
              <tr key={a.id} className="border-b border-gray-100 text-gray-700">
                <td className="py-2 font-mono">{a.code}</td>
                <td>{a.business_name}</td>
                <td>{a.discount_value}{a.discount_type === "percent" ? "%" : " DOP"}</td>
                <td>{a.commission_pct}%</td>
                <td><button onClick={() => toggle(a.id, a.active)} className={`text-xs px-2 py-1 rounded-lg ${a.active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>{a.active ? "Sí" : "No"}</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function Input({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block">
      <span className="block text-[11px] font-medium text-gray-500 mb-1">{label}</span>
      <input value={value} onChange={(e) => onChange(e.target.value)} className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
    </label>
  );
}
