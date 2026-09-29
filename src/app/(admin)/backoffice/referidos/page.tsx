"use client";

import { useCallback, useEffect, useState } from "react";
import { Ticket, Plus, ToggleLeft, ToggleRight } from "lucide-react";
import { getSupabase } from "@/lib/supabase";
import { type AffiliateRow } from "@/lib/backoffice";
import { Card, Spinner, Button, Field, TextInput, EmptyState, Pill } from "@/components/backoffice/ui";

export default function ReferidosPage() {
  const [rows, setRows] = useState<AffiliateRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ code: "", business_name: "", discount_value: "10", commission_pct: "10" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(() => {
    const sb = getSupabase();
    if (!sb) {
      setLoading(false);
      return;
    }
    sb.from("affiliates")
      .select("id,code,business_name,discount_type,discount_value,commission_pct,active")
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        setRows((data as AffiliateRow[]) ?? []);
        setLoading(false);
      });
  }, []);

  useEffect(load, [load]);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const sb = getSupabase();
    if (!sb) return;
    if (!form.code.trim() || !form.business_name.trim()) {
      setErr("Código y negocio son obligatorios.");
      return;
    }
    setBusy(true);
    setErr(null);
    const { error } = await sb.from("affiliates").insert({
      code: form.code.trim().toUpperCase(),
      business_name: form.business_name.trim(),
      discount_value: Number(form.discount_value) || 0,
      commission_pct: Number(form.commission_pct) || 0,
    });
    setBusy(false);
    if (error) {
      setErr(error.message);
      return;
    }
    setForm({ code: "", business_name: "", discount_value: "10", commission_pct: "10" });
    load();
  }

  async function toggle(id: string, active: boolean | null) {
    const sb = getSupabase();
    if (!sb) return;
    await sb.from("affiliates").update({ active: !active }).eq("id", id);
    load();
  }

  const activos = rows.filter((r) => r.active).length;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 sm:max-w-md">
        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          <span className="text-[11px] font-medium uppercase tracking-wide text-slate-400">Afiliados</span>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{rows.length}</p>
        </div>
        <div className="rounded-2xl border border-violet-200 bg-gradient-to-br from-violet-50 to-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          <span className="text-[11px] font-medium uppercase tracking-wide text-slate-400">Activos</span>
          <p className="mt-2 text-2xl font-semibold text-violet-700">{activos}</p>
        </div>
      </div>

      {/* Alta */}
      <Card className="p-5">
        <div className="mb-4 flex items-center gap-2">
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-violet-100 text-violet-600">
            <Plus size={15} />
          </span>
          <h2 className="text-[15px] font-semibold text-slate-800">Nuevo afiliado / cupón QR</h2>
        </div>
        <form onSubmit={add} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Código (QR)">
            <TextInput value={form.code} onChange={(v) => setForm((f) => ({ ...f, code: v.toUpperCase() }))} placeholder="EJ: BARBER10" />
          </Field>
          <Field label="Negocio">
            <TextInput value={form.business_name} onChange={(v) => setForm((f) => ({ ...f, business_name: v }))} placeholder="Nombre del negocio" />
          </Field>
          <Field label="Descuento %">
            <TextInput value={form.discount_value} onChange={(v) => setForm((f) => ({ ...f, discount_value: v }))} />
          </Field>
          <Field label="Comisión %">
            <TextInput value={form.commission_pct} onChange={(v) => setForm((f) => ({ ...f, commission_pct: v }))} />
          </Field>
          <div className="sm:col-span-2 lg:col-span-4">
            <Button type="submit" disabled={busy}>
              <Plus size={16} /> {busy ? "Agregando…" : "Agregar afiliado"}
            </Button>
            {err && <span className="ml-3 text-sm text-rose-600">{err}</span>}
          </div>
        </form>
      </Card>

      {/* Lista */}
      {loading ? (
        <Spinner label="Cargando afiliados…" />
      ) : (
        <Card className="overflow-hidden">
          {rows.length === 0 ? (
            <EmptyState icon={<Ticket size={28} />} title="Aún no hay afiliados" hint="Crea el primer código QR para empezar a repartir cupones." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/70 text-left text-[11px] uppercase tracking-wide text-slate-400">
                    <th className="px-4 py-3 font-semibold">Código</th>
                    <th className="px-4 py-3 font-semibold">Negocio</th>
                    <th className="px-4 py-3 text-right font-semibold">Descuento</th>
                    <th className="px-4 py-3 text-right font-semibold">Comisión</th>
                    <th className="px-4 py-3 text-center font-semibold">Estado</th>
                    <th className="px-4 py-3 text-right font-semibold">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map((a) => (
                    <tr key={a.id} className="transition hover:bg-slate-50/60">
                      <td className="px-4 py-3">
                        <span className="rounded-md bg-slate-100 px-2 py-1 font-mono text-xs font-semibold text-slate-700">{a.code}</span>
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-800">{a.business_name || "—"}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-slate-700">
                        {a.discount_value ?? 0}
                        {a.discount_type === "amount" ? " DOP" : "%"}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-slate-700">{a.commission_pct ?? 0}%</td>
                      <td className="px-4 py-3 text-center">
                        {a.active ? <Pill tone="emerald">Activo</Pill> : <Pill tone="slate">Inactivo</Pill>}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => toggle(a.id, a.active)}
                          className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition ${
                            a.active ? "text-slate-500 hover:bg-slate-100" : "text-violet-600 hover:bg-violet-50"
                          }`}
                        >
                          {a.active ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}
                          {a.active ? "Desactivar" : "Activar"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
