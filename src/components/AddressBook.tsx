"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, Pencil, Trash2, Star, MapPin } from "lucide-react";
import { getSupabase } from "@/lib/supabase";

interface Address {
  id: string;
  label: string;
  line1: string;
  line2: string | null;
  delivery_notes: string | null;
  phone: string | null;
  is_default: boolean;
}

const LABELS = ["Casa", "Trabajo", "Otro"];
const EMPTY = { label: "Casa", line1: "", line2: "", delivery_notes: "", phone: "" };

export default function AddressBook({ userId, defaultPhone }: { userId: string; defaultPhone?: string | null }) {
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const sb = getSupabase();
    if (!sb) { setLoading(false); return; }
    const { data, error } = await sb
      .from("addresses")
      .select("id,label,line1,line2,delivery_notes,phone,is_default")
      .order("is_default", { ascending: false })
      .order("created_at", { ascending: true });
    if (error) setError("No pudimos cargar tus direcciones.");
    setAddresses((data as Address[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  function startNew() { setForm({ ...EMPTY, phone: defaultPhone ?? "" }); setError(null); setEditing("new"); }
  function startEdit(a: Address) {
    setForm({ label: a.label, line1: a.line1, line2: a.line2 ?? "", delivery_notes: a.delivery_notes ?? "", phone: a.phone ?? "" });
    setError(null);
    setEditing(a.id);
  }

  async function save() {
    const sb = getSupabase();
    if (!sb) return;
    if (!form.line1.trim()) { setError("La dirección es obligatoria."); return; }
    setBusy(true); setError(null);
    const payload = {
      label: form.label,
      line1: form.line1.trim(),
      line2: form.line2.trim() || null,
      delivery_notes: form.delivery_notes.trim() || null,
      phone: form.phone.trim() || null,
    };
    let err = null;
    if (editing === "new") {
      const res = await sb.from("addresses").insert({ ...payload, user_id: userId, is_default: addresses.length === 0 });
      err = res.error;
    } else {
      const res = await sb.from("addresses").update(payload).eq("id", editing);
      err = res.error;
    }
    setBusy(false);
    if (err) { setError("No se pudo guardar. Intenta de nuevo."); return; }
    setEditing(null);
    await load();
  }

  async function remove(id: string) {
    const sb = getSupabase();
    if (!sb) return;
    if (!confirm("¿Borrar esta dirección?")) return;
    await sb.from("addresses").delete().eq("id", id);
    await load();
  }

  async function makeDefault(id: string) {
    const sb = getSupabase();
    if (!sb) return;
    await sb.from("addresses").update({ is_default: false }).eq("user_id", userId).eq("is_default", true);
    await sb.from("addresses").update({ is_default: true }).eq("id", id);
    await load();
  }

  return (
    <section className="mb-10">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl text-gray-900" style={{ fontFamily: "var(--font-heading)" }}>
          Mis direcciones
        </h2>
        {editing === null && (
          <button
            onClick={startNew}
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-violet-600 hover:text-violet-700"
          >
            <Plus size={16} /> Agregar
          </button>
        )}
      </div>

      {loading ? (
        <p className="text-sm text-gray-400">Cargando direcciones…</p>
      ) : (
        <div className="space-y-3">
          {addresses.map((a) =>
            editing === a.id ? (
              <AddressForm
                key={a.id}
                form={form}
                setForm={setForm}
                busy={busy}
                error={error}
                onSave={save}
                onCancel={() => setEditing(null)}
              />
            ) : (
              <div key={a.id} className="border border-gray-200 rounded-xl p-4 flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 min-w-0">
                  <MapPin size={18} className="text-violet-500 mt-0.5 shrink-0" />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-gray-900">{a.label}</span>
                      {a.is_default && (
                        <span className="text-[10px] font-semibold uppercase tracking-wide bg-violet-100 text-violet-700 px-2 py-0.5 rounded-full">
                          Predeterminada
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-600 mt-0.5">{a.line1}</p>
                    {a.line2 && <p className="text-sm text-gray-500">{a.line2}</p>}
                    {a.phone && <p className="text-xs text-gray-500 mt-0.5">Cel: {a.phone}</p>}
                    {a.delivery_notes && <p className="text-xs text-gray-400 mt-1">{a.delivery_notes}</p>}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {!a.is_default && (
                    <button onClick={() => makeDefault(a.id)} title="Marcar predeterminada" className="p-2 text-gray-400 hover:text-violet-600 transition-colors">
                      <Star size={15} />
                    </button>
                  )}
                  <button onClick={() => startEdit(a)} title="Editar" className="p-2 text-gray-400 hover:text-gray-700 transition-colors">
                    <Pencil size={15} />
                  </button>
                  <button onClick={() => remove(a.id)} title="Borrar" className="p-2 text-gray-400 hover:text-red-600 transition-colors">
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            )
          )}

          {editing === "new" && (
            <AddressForm
              form={form}
              setForm={setForm}
              busy={busy}
              error={error}
              onSave={save}
              onCancel={() => setEditing(null)}
            />
          )}

          {addresses.length === 0 && editing === null && (
            <div className="rounded-2xl border border-dashed border-gray-200 p-8 text-center text-sm text-gray-400">
              No tienes direcciones guardadas.{" "}
              <button onClick={startNew} className="text-violet-600 hover:text-violet-700 font-medium">
                Agregar una →
              </button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function AddressForm({
  form, setForm, busy, error, onSave, onCancel,
}: {
  form: typeof EMPTY;
  setForm: (f: typeof EMPTY) => void;
  busy: boolean;
  error: string | null;
  onSave: () => void;
  onCancel: () => void;
}) {
  const set = (k: keyof typeof EMPTY, v: string) => setForm({ ...form, [k]: v });
  return (
    <div className="border border-violet-200 bg-violet-50/40 rounded-xl p-4 space-y-3">
      <label className="block">
        <span className="block text-xs font-medium text-gray-600 mb-1.5">Nombre de la dirección</span>
        <select
          value={form.label}
          onChange={(e) => set("label", e.target.value)}
          className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-violet-500"
        >
          {LABELS.map((l) => <option key={l} value={l}>{l}</option>)}
        </select>
      </label>
      <Input label="Dirección" value={form.line1} onChange={(v) => set("line1", v)} placeholder="Calle, número y sector" />
      <Input label="Apartamento, piso o casa (opcional)" value={form.line2} onChange={(v) => set("line2", v)} />
      <Input label="Celular / WhatsApp" value={form.phone} onChange={(v) => set("phone", v)} placeholder="Contacto para la entrega" />
      <label className="block">
        <span className="block text-xs font-medium text-gray-600 mb-1.5">Referencias / indicaciones (opcional)</span>
        <textarea
          value={form.delivery_notes}
          rows={2}
          onChange={(e) => set("delivery_notes", e.target.value)}
          className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-violet-500 resize-none"
        />
      </label>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button
          onClick={onSave}
          disabled={busy}
          className="flex-1 bg-violet-600 text-white font-semibold text-sm py-2.5 rounded-lg hover:bg-violet-700 transition-colors disabled:opacity-50"
        >
          {busy ? "Guardando…" : "Guardar"}
        </button>
        <button
          onClick={onCancel}
          disabled={busy}
          className="px-4 text-sm text-gray-500 hover:text-gray-900 transition-colors"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}

function Input({ label, value, onChange, placeholder }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-gray-600 mb-1.5">{label}</span>
      <input
        type="text"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-500"
      />
    </label>
  );
}
