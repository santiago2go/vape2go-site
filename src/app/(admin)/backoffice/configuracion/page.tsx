"use client";

import { useEffect, useState } from "react";
import { Truck, MessageCircle, Mail, Landmark, Check, Clock, Siren, Bike, Plus, X, MapPin } from "lucide-react";
import { getSupabase } from "@/lib/supabase";
import { type StoreConfig } from "@/lib/backoffice";
import { Card, Spinner, Button, Field, TextInput, Pill } from "@/components/backoffice/ui";

type ConfigKey = keyof StoreConfig;
type SaveKey = ConfigKey | "hours" | "orders_paused" | "riders" | "zones";

const EMPTY: StoreConfig = { delivery: {}, transfer: {}, whatsapp: {}, order_notify: {} };

/* ---------- Zonas de entrega ---------- */

interface Zone {
  name: string;
  fee: number;
  free_over: number;
  tier: string;
  active: boolean;
}
const TIER_ORDER = ["Centro", "Sur", "Periferia", "Por verificar"];

/* ---------- Horario ---------- */

type DayKey = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";
interface DayHours {
  open: string;
  close: string;
  closed: boolean;
}
type HoursConfig = Record<DayKey, DayHours>;

const DAYS: { key: DayKey; label: string }[] = [
  { key: "mon", label: "Lunes" },
  { key: "tue", label: "Martes" },
  { key: "wed", label: "Miércoles" },
  { key: "thu", label: "Jueves" },
  { key: "fri", label: "Viernes" },
  { key: "sat", label: "Sábado" },
  { key: "sun", label: "Domingo" },
];

const DEFAULT_DAY: DayHours = { open: "09:00", close: "21:00", closed: false };
const DEFAULT_HOURS: HoursConfig = {
  mon: { ...DEFAULT_DAY },
  tue: { ...DEFAULT_DAY },
  wed: { ...DEFAULT_DAY },
  thu: { ...DEFAULT_DAY },
  fri: { ...DEFAULT_DAY },
  sat: { ...DEFAULT_DAY },
  sun: { ...DEFAULT_DAY },
};

/* ---------- Emergencia ---------- */

interface PausedConfig {
  active: boolean;
  message: string;
}
const DEFAULT_PAUSE_MSG = "En este momento no estamos recibiendo pedidos. ¡Vuelve pronto!";
const DEFAULT_PAUSED: PausedConfig = { active: false, message: DEFAULT_PAUSE_MSG };

export default function ConfiguracionPage() {
  const [cfg, setCfg] = useState<StoreConfig>(EMPTY);
  const [riders, setRiders] = useState<string[]>([]);
  const [newRider, setNewRider] = useState("");
  const [zones, setZones] = useState<Zone[]>([]);
  const [hours, setHours] = useState<HoursConfig>(DEFAULT_HOURS);
  const [paused, setPaused] = useState<PausedConfig>(DEFAULT_PAUSED);
  const [pausedSaved, setPausedSaved] = useState<PausedConfig>(DEFAULT_PAUSED);
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<SaveKey | null>(null);
  const [savedKey, setSavedKey] = useState<SaveKey | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const sb = getSupabase();
    if (!sb) {
      setLoading(false);
      return;
    }
    sb.from("store_config")
      .select("key,value")
      .then(({ data }) => {
        const next: StoreConfig = { delivery: {}, transfer: {}, whatsapp: {}, order_notify: {} };
        for (const r of (data as Array<{ key: string; value: unknown }> | null) ?? []) {
          if (r.key in next) {
            (next as unknown as Record<string, unknown>)[r.key] = r.value ?? {};
          } else if (r.key === "hours" && r.value && typeof r.value === "object") {
            const v = r.value as Partial<Record<DayKey, Partial<DayHours>>>;
            setHours((prev) => {
              const merged = { ...prev };
              for (const d of DAYS) {
                const dv = v[d.key];
                if (dv)
                  merged[d.key] = {
                    open: dv.open ?? merged[d.key].open,
                    close: dv.close ?? merged[d.key].close,
                    closed: dv.closed ?? merged[d.key].closed,
                  };
              }
              return merged;
            });
          } else if (r.key === "riders" && Array.isArray(r.value)) {
            setRiders((r.value as unknown[]).filter((x): x is string => typeof x === "string"));
          } else if (r.key === "orders_paused" && r.value && typeof r.value === "object") {
            const v = r.value as Partial<PausedConfig>;
            const p: PausedConfig = { active: !!v.active, message: v.message ?? DEFAULT_PAUSE_MSG };
            setPaused(p);
            setPausedSaved(p);
          } else if (r.key === "zones" && Array.isArray(r.value)) {
            setZones(
              (r.value as unknown[]).filter(
                (x): x is Zone => !!x && typeof x === "object" && "name" in (x as object)
              )
            );
          }
        }
        setCfg(next);
        setLoading(false);
      });
  }, []);

  async function saveValue(key: SaveKey, value: unknown, upsert = false): Promise<boolean> {
    const sb = getSupabase();
    if (!sb) return false;
    setSavingKey(key);
    setSavedKey(null);
    setErr(null);
    const resp = upsert
      ? await sb.from("store_config").upsert({ key, value }, { onConflict: "key" })
      : await sb.from("store_config").update({ value }).eq("key", key);
    setSavingKey(null);
    if (resp.error) {
      setErr(resp.error.message);
      return false;
    }
    setSavedKey(key);
    window.setTimeout(() => setSavedKey((k) => (k === key ? null : k)), 2500);
    return true;
  }

  function setDay(key: DayKey, patch: Partial<DayHours>) {
    setHours((h) => ({ ...h, [key]: { ...h[key], ...patch } }));
  }

  async function savePaused() {
    const ok = await saveValue("orders_paused", paused, true);
    if (ok) setPausedSaved(paused);
  }

  // Guarda el array de riders (upsert: crea la fila si no existe). Optimista con
  // reversión si Supabase rechaza el cambio.
  async function saveRiders(next: string[]) {
    const prev = riders;
    setRiders(next);
    const ok = await saveValue("riders", next, true);
    if (!ok) setRiders(prev);
  }

  function addRider() {
    const name = newRider.trim();
    if (!name) return;
    if (riders.some((r) => r.toLowerCase() === name.toLowerCase())) {
      setNewRider("");
      return;
    }
    setNewRider("");
    void saveRiders([...riders, name]);
  }

  function removeRider(name: string) {
    void saveRiders(riders.filter((r) => r !== name));
  }

  const pausedDirty = JSON.stringify(paused) !== JSON.stringify(pausedSaved);

  if (loading) return <Spinner label="Cargando configuración…" />;

  return (
    <div className="max-w-3xl space-y-4">
      {err && <p className="rounded-lg bg-rose-50 px-4 py-2 text-sm text-rose-600 ring-1 ring-inset ring-rose-100">{err}</p>}

      {/* ---------- Emergencia / Pausar pedidos ---------- */}
      <Card className="p-5">
        <div className="mb-4 flex items-center gap-3">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-rose-100 text-rose-600">
            <Siren size={16} />
          </span>
          <div>
            <h2 className="text-[15px] font-semibold text-slate-800">Emergencia · Pausar pedidos</h2>
            <p className="text-xs text-slate-500">
              Detén las órdenes al instante. Los clientes verán un aviso y no podrán completar la compra.
            </p>
          </div>
        </div>

        {/* Estado actual (persistido) */}
        <div
          className={`flex items-center gap-3 rounded-xl px-4 py-3 ring-1 ring-inset ${
            pausedSaved.active
              ? "bg-rose-50 text-rose-700 ring-rose-200"
              : "bg-emerald-50 text-emerald-700 ring-emerald-200"
          }`}
        >
          <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${pausedSaved.active ? "bg-rose-500" : "bg-emerald-500"}`} />
          <div className="min-w-0">
            <p className="text-sm font-semibold">
              {pausedSaved.active ? "Pedidos PAUSADOS" : "Recibiendo pedidos con normalidad"}
            </p>
            <p className="text-xs opacity-80">
              {pausedSaved.active
                ? "El carrito y el checkout están bloqueados para los clientes."
                : "La tienda acepta órdenes (según el horario configurado)."}
            </p>
          </div>
        </div>

        {/* Toggle grande */}
        <div className="mt-4 flex items-center justify-between rounded-xl border border-slate-200 px-4 py-3">
          <div className="min-w-0">
            <p className="text-sm font-medium text-slate-800">{paused.active ? "Pausar pedidos" : "Recibir pedidos"}</p>
            <p className="text-xs text-slate-500">
              {paused.active
                ? "Los clientes verán tu mensaje y no podrán pedir."
                : "Activa la pausa para bloquear el checkout."}
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={paused.active}
            aria-label="Pausar pedidos"
            onClick={() => setPaused((p) => ({ ...p, active: !p.active }))}
            className={`relative inline-flex h-8 w-14 shrink-0 items-center rounded-full transition-colors ${
              paused.active ? "bg-rose-500" : "bg-emerald-500"
            }`}
          >
            <span
              className={`inline-block h-6 w-6 transform rounded-full bg-white shadow transition-transform ${
                paused.active ? "translate-x-7" : "translate-x-1"
              }`}
            />
          </button>
        </div>

        {/* Mensaje al cliente (solo cuando se va a pausar) */}
        {paused.active && (
          <div className="mt-4">
            <Field label="Mensaje para el cliente" hint="Se muestra en el carrito y el checkout mientras esté pausado.">
              <textarea
                value={paused.message}
                onChange={(e) => setPaused((p) => ({ ...p, message: e.target.value }))}
                rows={3}
                placeholder={DEFAULT_PAUSE_MSG}
                className="w-full resize-none rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm outline-none transition focus:border-violet-400 focus:ring-2 focus:ring-violet-500/30"
              />
            </Field>
          </div>
        )}

        {/* Acción */}
        <div className="mt-4 flex items-center gap-3">
          <button
            type="button"
            onClick={savePaused}
            disabled={savingKey === "orders_paused"}
            className={`inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition disabled:cursor-not-allowed disabled:opacity-50 ${
              paused.active ? "bg-rose-600 shadow-rose-600/20 hover:bg-rose-700" : "bg-emerald-600 shadow-emerald-600/20 hover:bg-emerald-700"
            }`}
          >
            {savingKey === "orders_paused" ? "Guardando…" : paused.active ? "Pausar pedidos" : "Reanudar pedidos"}
          </button>
          {pausedDirty && <Pill tone="amber">Sin guardar</Pill>}
          {savedKey === "orders_paused" && (
            <span className="inline-flex items-center gap-1 text-sm font-medium text-emerald-600">
              <Check size={15} /> Guardado
            </span>
          )}
        </div>
      </Card>

      {/* ---------- Horario de atención ---------- */}
      <Section
        icon={<Clock size={16} />}
        title="Horario de atención"
        subtitle="Fuera de este horario, los clientes verán un aviso y no podrán completar el pedido."
        onSave={() => saveValue("hours", hours, true)}
        saving={savingKey === "hours"}
        saved={savedKey === "hours"}
      >
        <div className="rounded-xl border border-slate-200 px-4 py-1">
          {DAYS.map((d) => {
            const day = hours[d.key];
            return (
              <div
                key={d.key}
                className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-slate-100 py-2.5 last:border-0"
              >
                <span className="w-24 shrink-0 text-sm font-medium text-slate-700">{d.label}</span>
                {day.closed ? (
                  <span className="text-sm text-slate-400">Cerrado</span>
                ) : (
                  <div className="flex items-center gap-2">
                    <div className="w-28">
                      <TextInput type="time" value={day.open} onChange={(v) => setDay(d.key, { open: v })} />
                    </div>
                    <span className="text-slate-400">–</span>
                    <div className="w-28">
                      <TextInput type="time" value={day.close} onChange={(v) => setDay(d.key, { close: v })} />
                    </div>
                  </div>
                )}
                <label className="ml-auto flex items-center gap-2 text-xs font-medium text-slate-600">
                  <input
                    type="checkbox"
                    checked={day.closed}
                    onChange={(e) => setDay(d.key, { closed: e.target.checked })}
                    className="h-4 w-4 accent-violet-600"
                  />
                  Cerrado
                </label>
              </div>
            );
          })}
        </div>
      </Section>

      <Section
        icon={<Truck size={16} />}
        title="Delivery"
        subtitle="Tarifa base de respaldo. Con zonas activas, manda la tarifa por sector (abajo)."
        onSave={() => saveValue("delivery", cfg.delivery)}
        saving={savingKey === "delivery"}
        saved={savedKey === "delivery"}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Costo del delivery (RD$)">
            <TextInput
              value={String(cfg.delivery.fee ?? "")}
              onChange={(v) => setCfg((c) => ({ ...c, delivery: { ...c.delivery, fee: Number(v) || 0 } }))}
            />
          </Field>
          <Field label="Gratis a partir de (RD$)" hint="0 desactiva el delivery gratis.">
            <TextInput
              value={String(cfg.delivery.free_over ?? "")}
              onChange={(v) => setCfg((c) => ({ ...c, delivery: { ...c.delivery, free_over: Number(v) || 0 } }))}
            />
          </Field>
        </div>
      </Section>

      {/* ---------- Zonas de entrega ---------- */}
      <ZonasCard
        zones={zones}
        setZones={setZones}
        onSave={() => saveValue("zones", zones, true)}
        saving={savingKey === "zones"}
        saved={savedKey === "zones"}
      />

      {/* ---------- Riders / Repartidores ---------- */}
      <Card className="p-5">
        <div className="mb-4 flex items-center gap-3">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-violet-100 text-violet-600">
            <Bike size={16} />
          </span>
          <div>
            <h2 className="text-[15px] font-semibold text-slate-800">Riders / Repartidores</h2>
            <p className="text-xs text-slate-500">Los repartidores propios que aparecen al despachar una orden a ruta.</p>
          </div>
        </div>

        {riders.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50/60 px-4 py-6 text-center text-sm text-slate-400">
            Aún no hay riders. Agrega el primero abajo.
          </p>
        ) : (
          <ul className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200">
            {riders.map((name) => (
              <li key={name} className="flex items-center justify-between gap-3 px-3 py-2.5">
                <span className="flex min-w-0 items-center gap-2 text-sm font-medium text-slate-700">
                  <Bike size={14} className="shrink-0 text-slate-400" />
                  <span className="truncate">{name}</span>
                </span>
                <button
                  type="button"
                  onClick={() => removeRider(name)}
                  disabled={savingKey === "riders"}
                  aria-label={`Eliminar ${name}`}
                  title="Eliminar rider"
                  className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-slate-400 transition hover:bg-rose-50 hover:text-rose-600 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <X size={15} />
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-3 flex items-center gap-2">
          <input
            value={newRider}
            onChange={(e) => setNewRider(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addRider();
              }
            }}
            placeholder="Nombre del rider"
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm outline-none transition focus:border-violet-400 focus:ring-2 focus:ring-violet-500/30"
          />
          <Button onClick={addRider} disabled={!newRider.trim() || savingKey === "riders"} size="sm">
            <Plus size={14} /> Agregar rider
          </Button>
        </div>

        {(savingKey === "riders" || savedKey === "riders") && (
          <div className="mt-3 flex items-center gap-2 text-sm">
            {savingKey === "riders" ? (
              <span className="text-slate-400">Guardando…</span>
            ) : (
              <span className="inline-flex items-center gap-1 font-medium text-emerald-600">
                <Check size={15} /> Guardado
              </span>
            )}
          </div>
        )}
      </Card>

      <Section
        icon={<MessageCircle size={16} />}
        title="WhatsApp"
        subtitle="El número que se muestra en el checkout y los correos."
        onSave={() => saveValue("whatsapp", cfg.whatsapp)}
        saving={savingKey === "whatsapp"}
        saved={savedKey === "whatsapp"}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Número">
            <TextInput value={cfg.whatsapp.number ?? ""} onChange={(v) => setCfg((c) => ({ ...c, whatsapp: { ...c.whatsapp, number: v } }))} />
          </Field>
          <Field label="Etiqueta (opcional)">
            <TextInput value={cfg.whatsapp.label ?? ""} onChange={(v) => setCfg((c) => ({ ...c, whatsapp: { ...c.whatsapp, label: v } }))} />
          </Field>
        </div>
      </Section>

      <Section
        icon={<Mail size={16} />}
        title="Buzón de órdenes"
        subtitle="Correo que recibe la notificación de cada orden nueva."
        onSave={() => saveValue("order_notify", cfg.order_notify)}
        saving={savingKey === "order_notify"}
        saved={savedKey === "order_notify"}
      >
        <Field label="Correo">
          <TextInput value={cfg.order_notify.email ?? ""} onChange={(v) => setCfg((c) => ({ ...c, order_notify: { ...c.order_notify, email: v } }))} />
        </Field>
      </Section>

      <Section
        icon={<Landmark size={16} />}
        title="Datos de transferencia"
        subtitle="Se muestran al cliente que paga por transferencia."
        onSave={() => saveValue("transfer", cfg.transfer)}
        saving={savingKey === "transfer"}
        saved={savedKey === "transfer"}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Banco">
            <TextInput value={cfg.transfer.bank ?? ""} onChange={(v) => setCfg((c) => ({ ...c, transfer: { ...c.transfer, bank: v } }))} />
          </Field>
          <Field label="Cuenta">
            <TextInput value={cfg.transfer.account ?? ""} onChange={(v) => setCfg((c) => ({ ...c, transfer: { ...c.transfer, account: v } }))} />
          </Field>
          <Field label="Tipo de cuenta">
            <TextInput value={cfg.transfer.account_type ?? ""} onChange={(v) => setCfg((c) => ({ ...c, transfer: { ...c.transfer, account_type: v } }))} />
          </Field>
          <Field label="Titular">
            <TextInput value={cfg.transfer.holder ?? ""} onChange={(v) => setCfg((c) => ({ ...c, transfer: { ...c.transfer, holder: v } }))} />
          </Field>
          <Field label="Cédula / RNC">
            <TextInput value={cfg.transfer.id_doc ?? ""} onChange={(v) => setCfg((c) => ({ ...c, transfer: { ...c.transfer, id_doc: v } }))} />
          </Field>
        </div>
      </Section>
    </div>
  );
}

function Section({
  icon,
  title,
  subtitle,
  children,
  onSave,
  saving,
  saved,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  children: React.ReactNode;
  onSave: () => void;
  saving: boolean;
  saved: boolean;
}) {
  return (
    <Card className="p-5">
      <div className="mb-4 flex items-center gap-3">
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-violet-100 text-violet-600">{icon}</span>
        <div>
          <h2 className="text-[15px] font-semibold text-slate-800">{title}</h2>
          <p className="text-xs text-slate-500">{subtitle}</p>
        </div>
      </div>
      {children}
      <div className="mt-4 flex items-center gap-3">
        <Button onClick={onSave} disabled={saving} size="sm">
          {saving ? "Guardando…" : "Guardar"}
        </Button>
        {saved && (
          <span className="inline-flex items-center gap-1 text-sm font-medium text-emerald-600">
            <Check size={15} /> Guardado
          </span>
        )}
      </div>
    </Card>
  );
}

function ZonasCard({ zones, setZones, onSave, saving, saved }: {
  zones: Zone[];
  setZones: React.Dispatch<React.SetStateAction<Zone[]>>;
  onSave: () => void;
  saving: boolean;
  saved: boolean;
}) {
  const [newName, setNewName] = useState("");
  const [newTier, setNewTier] = useState("Centro");
  const [newFee, setNewFee] = useState("100");

  function patch(idx: number, p: Partial<Zone>) {
    setZones((zs) => zs.map((z, i) => (i === idx ? { ...z, ...p } : z)));
  }
  function remove(idx: number) {
    setZones((zs) => zs.filter((_, i) => i !== idx));
  }
  function add() {
    const name = newName.trim();
    if (!name) return;
    if (zones.some((z) => z.name.toLowerCase() === name.toLowerCase())) {
      setNewName("");
      return;
    }
    const freeDefault = newTier === "Centro" || newTier === "Sur" ? 800 : 0;
    setZones((zs) => [
      ...zs,
      { name, tier: newTier, fee: Number(newFee) || 0, free_over: freeDefault, active: newTier !== "Por verificar" },
    ]);
    setNewName("");
  }

  const tiers = TIER_ORDER.filter((t) => zones.some((z) => z.tier === t));
  const activeCount = zones.filter((z) => z.active).length;

  return (
    <Card className="p-5">
      <div className="mb-4 flex items-center gap-3">
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-violet-100 text-violet-600">
          <MapPin size={16} />
        </span>
        <div>
          <h2 className="text-[15px] font-semibold text-slate-800">Zonas de entrega</h2>
          <p className="text-xs text-slate-500">
            Sectores cubiertos, su tarifa y umbral de envío gratis. El cliente solo elige entre los{" "}
            <strong>activos</strong> ({activeCount}). Las inactivas quedan “por verificar”.
          </p>
        </div>
      </div>

      <div className="space-y-4">
        {tiers.map((tier) => (
          <div key={tier}>
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-slate-400">{tier}</p>
            <div className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200">
              {zones.map((z, i) =>
                z.tier === tier ? (
                  <ZoneRow key={i} z={z} onPatch={(p) => patch(i, p)} onRemove={() => remove(i)} />
                ) : null
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Agregar sector */}
      <div className="mt-4 flex flex-wrap items-end gap-2 rounded-xl border border-dashed border-slate-200 bg-slate-50/60 p-3">
        <label className="min-w-[140px] flex-1">
          <span className="mb-1 block text-[11px] font-medium text-slate-500">Nuevo sector</span>
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                add();
              }
            }}
            placeholder="Nombre del sector"
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm outline-none transition focus:border-violet-400 focus:ring-2 focus:ring-violet-500/30"
          />
        </label>
        <label className="w-32">
          <span className="mb-1 block text-[11px] font-medium text-slate-500">Zona</span>
          <select
            value={newTier}
            onChange={(e) => setNewTier(e.target.value)}
            className="w-full rounded-lg border border-slate-200 bg-white px-2 py-2 text-sm text-slate-800 shadow-sm outline-none transition focus:border-violet-400"
          >
            {TIER_ORDER.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </label>
        <label className="w-24">
          <span className="mb-1 block text-[11px] font-medium text-slate-500">RD$</span>
          <input
            value={newFee}
            onChange={(e) => setNewFee(e.target.value)}
            inputMode="numeric"
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm outline-none transition focus:border-violet-400 focus:ring-2 focus:ring-violet-500/30"
          />
        </label>
        <Button onClick={add} disabled={!newName.trim()} size="sm">
          <Plus size={14} /> Agregar
        </Button>
      </div>

      <div className="mt-4 flex items-center gap-3">
        <Button onClick={onSave} disabled={saving} size="sm">
          {saving ? "Guardando…" : "Guardar zonas"}
        </Button>
        {saved && (
          <span className="inline-flex items-center gap-1 text-sm font-medium text-emerald-600">
            <Check size={15} /> Guardado
          </span>
        )}
      </div>
    </Card>
  );
}

function ZoneRow({ z, onPatch, onRemove }: {
  z: Zone; onPatch: (p: Partial<Zone>) => void; onRemove: () => void;
}) {
  return (
    <div className={`flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2.5 ${z.active ? "" : "bg-slate-50/70"}`}>
      <button
        type="button"
        role="switch"
        aria-checked={z.active}
        aria-label={`${z.name} activa`}
        onClick={() => onPatch({ active: !z.active })}
        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${z.active ? "bg-emerald-500" : "bg-slate-300"}`}
      >
        <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${z.active ? "translate-x-6" : "translate-x-1"}`} />
      </button>
      <span className={`min-w-0 flex-1 truncate text-sm font-medium ${z.active ? "text-slate-700" : "text-slate-400"}`}>{z.name}</span>
      <label className="flex items-center gap-1 text-xs text-slate-500">
        RD$
        <input
          value={String(z.fee ?? "")}
          onChange={(e) => onPatch({ fee: Number(e.target.value) || 0 })}
          inputMode="numeric"
          className="w-16 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-800 shadow-sm outline-none transition focus:border-violet-400 focus:ring-2 focus:ring-violet-500/30"
        />
      </label>
      <label className="flex items-center gap-1 text-xs text-slate-500" title="Envío gratis desde este monto (0 = sin gratis)">
        gratis≥
        <input
          value={String(z.free_over ?? "")}
          onChange={(e) => onPatch({ free_over: Number(e.target.value) || 0 })}
          inputMode="numeric"
          className="w-16 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-800 shadow-sm outline-none transition focus:border-violet-400 focus:ring-2 focus:ring-violet-500/30"
        />
      </label>
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Eliminar ${z.name}`}
        title="Eliminar"
        className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"
      >
        <X size={15} />
      </button>
    </div>
  );
}
