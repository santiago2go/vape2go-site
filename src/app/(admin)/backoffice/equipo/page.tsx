"use client";

import { useEffect, useMemo, useState } from "react";
import { Search, ShieldCheck, ShieldAlert, Lock, Users, UserCog, Store, X } from "lucide-react";
import { getSupabase } from "@/lib/supabase";
import { type ProfileRow, digitsOnly, relTime } from "@/lib/backoffice";
import { useAuth } from "@/lib/auth-context";
import { Card, Spinner, EmptyState, SectionHeader } from "@/components/backoffice/ui";

type Role = "customer" | "operator" | "supervisor" | "staff" | "admin";

const ROLE_RANK: Record<Role, number> = { admin: 0, supervisor: 1, staff: 2, operator: 3, customer: 4 };

const ROLE_META: Record<Role, { label: string; badge: string; dot: string; tile: string }> = {
  admin: {
    label: "Admin",
    badge: "bg-violet-100 text-violet-700 ring-violet-200",
    dot: "bg-violet-500",
    tile: "bg-violet-50/70 text-violet-600 ring-violet-100",
  },
  supervisor: {
    label: "Supervisor",
    badge: "bg-amber-100 text-amber-700 ring-amber-200",
    dot: "bg-amber-500",
    tile: "bg-amber-50/70 text-amber-600 ring-amber-100",
  },
  staff: {
    label: "Staff",
    badge: "bg-sky-100 text-sky-700 ring-sky-200",
    dot: "bg-sky-500",
    tile: "bg-sky-50/70 text-sky-600 ring-sky-100",
  },
  operator: {
    label: "Operativo",
    badge: "bg-teal-100 text-teal-700 ring-teal-200",
    dot: "bg-teal-500",
    tile: "bg-teal-50/70 text-teal-600 ring-teal-100",
  },
  customer: {
    label: "Cliente",
    badge: "bg-slate-100 text-slate-600 ring-slate-200",
    dot: "bg-slate-400",
    tile: "bg-slate-50/70 text-slate-500 ring-slate-100",
  },
};

const ROLE_OPTS: [Role, string][] = [
  ["customer", "Cliente"],
  ["operator", "Operativo (cajera)"],
  ["supervisor", "Supervisor"],
  ["staff", "Staff"],
  ["admin", "Admin"],
];

/** Normaliza el `role` (puede venir null o con valores viejos) a un Role válido. */
function normRole(r: string | null): Role {
  return r === "admin" || r === "staff" || r === "operator" || r === "supervisor" ? r : "customer";
}

function fmtDate(iso: string): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("es-DO", { day: "2-digit", month: "short", year: "numeric" });
}

export default function EquipoPage() {
  const { user, profile } = useAuth();
  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  // Solo un administrador completo (role='admin') puede cambiar roles; RLS lo exige.
  const canManage = profile?.role === "admin";

  async function load() {
    const sb = getSupabase();
    if (!sb) {
      setLoading(false);
      return;
    }
    const { data } = await sb
      .from("profiles")
      .select("id,email,full_name,phone,role,created_at")
      .order("created_at", { ascending: false })
      .limit(1000);
    setProfiles((data as ProfileRow[]) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Ordena: admins/staff arriba, luego por fecha de registro (más reciente primero).
  const rows = useMemo(() => {
    return [...profiles].sort((a, b) => {
      const ra = ROLE_RANK[normRole(a.role)] - ROLE_RANK[normRole(b.role)];
      if (ra !== 0) return ra;
      return (b.created_at ?? "").localeCompare(a.created_at ?? "");
    });
  }, [profiles]);

  const counts = useMemo(() => {
    let admins = 0, staff = 0, ops = 0, customers = 0;
    for (const p of profiles) {
      const r = normRole(p.role);
      if (r === "admin") admins += 1;
      else if (r === "staff") staff += 1;
      else if (r === "operator" || r === "supervisor") ops += 1;
      else customers += 1;
    }
    return { admins, staff, ops, customers, access: admins + staff + ops, total: profiles.length };
  }, [profiles]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const qd = digitsOnly(search);
    if (!q) return rows;
    return rows.filter(
      (r) =>
        (r.full_name ?? "").toLowerCase().includes(q) ||
        (r.email ?? "").toLowerCase().includes(q) ||
        (qd.length >= 3 && digitsOnly(r.phone).includes(qd))
    );
  }, [rows, search]);

  async function changeRole(target: ProfileRow, newRole: Role) {
    const currentRole = normRole(target.role);
    if (currentRole === newRole || busyId) return;

    setErr(null);
    setOk(null);

    // Salvaguarda: nunca dejar el sistema sin ningún admin.
    if (currentRole === "admin" && newRole !== "admin" && counts.admins <= 1) {
      setErr("No puedes quitar el último administrador del sistema.");
      return;
    }

    // Confirmación al otorgar rol de admin.
    if (newRole === "admin") {
      if (!window.confirm("Los admin pueden cambiar accesos y ver todo. ¿Continuar?")) return;
    }

    // Confirmación al quitarte a TI mismo el acceso al backoffice.
    const isSelf = target.id === user?.id;
    if (isSelf && newRole === "customer") {
      if (!window.confirm("Vas a quitarte tu propio acceso al backoffice. ¿Seguro que quieres continuar?")) return;
    }

    const sb = getSupabase();
    if (!sb) return;

    setBusyId(target.id);
    // .select() nos deja detectar cuando RLS bloquea silenciosamente (0 filas, sin error).
    const { data, error } = await sb
      .from("profiles")
      .update({ role: newRole })
      .eq("id", target.id)
      .select("id,role");

    if (error) {
      setErr(
        /row-level security|policy/i.test(error.message)
          ? "Solo un administrador puede cambiar roles."
          : error.message
      );
      setBusyId(null);
      return;
    }
    if (!data || data.length === 0) {
      // La política USING no dejó tocar la fila: no eres admin completo.
      setErr("Solo un administrador puede cambiar roles.");
      setBusyId(null);
      return;
    }

    const who = target.full_name || target.email || "el usuario";
    setOk(`Rol de ${who} actualizado a ${ROLE_META[newRole].label}.`);
    await load();
    setBusyId(null);
  }

  if (loading) return <Spinner label="Cargando equipo…" />;

  const sb = getSupabase();
  if (!sb) {
    return (
      <EmptyState
        icon={<ShieldCheck size={28} />}
        title="Backoffice no disponible"
        hint="Se necesita conexión con Supabase para gestionar accesos."
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Panel explicativo del modelo de acceso */}
      <div className="flex items-start gap-3 rounded-2xl border border-violet-200/70 bg-violet-50/60 p-4">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-violet-100 text-violet-600">
          <ShieldCheck size={18} />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-800">Modelo de acceso</p>
          <p className="mt-0.5 text-xs leading-relaxed text-slate-600">
            Solo usuarios con rol <b className="text-violet-700">Admin</b> o <b className="text-sky-700">Staff</b> pueden
            entrar al backoffice. Los <b>clientes</b> (todo el que se registra en la tienda) NO tienen acceso. La data
            está protegida por RLS aunque intenten la URL directa.
          </p>
        </div>
      </div>

      {/* Contadores */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <CountTile label="Con acceso" value={counts.access} role="admin" icon={<ShieldCheck size={16} />} />
        <CountTile label="Admins" value={counts.admins} role="admin" />
        <CountTile label="Operativos" value={counts.ops} role="operator" icon={<Store size={16} />} />
        <CountTile label="Clientes" value={counts.customers} role="customer" icon={<Users size={16} />} />
      </div>

      <SectionHeader
        title="Equipo / Accesos"
        subtitle="Gestiona quién puede entrar al backoffice y con qué nivel."
        action={
          <span className="hidden items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-500 sm:inline-flex">
            <UserCog size={13} /> {counts.total} usuarios
          </span>
        }
      />

      {/* Avisos */}
      {!canManage && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-700">
          <Lock size={14} className="shrink-0" />
          Estás en modo lectura: solo un administrador completo puede cambiar roles.
        </div>
      )}
      {err && (
        <div className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700">
          <ShieldAlert size={14} className="mt-0.5 shrink-0" />
          <span className="flex-1">{err}</span>
          <button onClick={() => setErr(null)} className="shrink-0 rounded p-0.5 hover:bg-rose-100" aria-label="Cerrar aviso">
            <X size={13} />
          </button>
        </div>
      )}
      {ok && (
        <div className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700">
          <ShieldCheck size={14} className="mt-0.5 shrink-0" />
          <span className="flex-1">{ok}</span>
          <button onClick={() => setOk(null)} className="shrink-0 rounded p-0.5 hover:bg-emerald-100" aria-label="Cerrar aviso">
            <X size={13} />
          </button>
        </div>
      )}

      {/* Buscador */}
      <div className="relative max-w-xs">
        <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nombre o correo…"
          className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm text-slate-800 shadow-sm outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-500/30"
        />
      </div>

      {/* Tabla */}
      <Card className="overflow-hidden">
        {filtered.length === 0 ? (
          <EmptyState title="Sin usuarios" hint="Ajusta la búsqueda o espera nuevos registros." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-left text-[11px] uppercase tracking-wide text-slate-400">
                  <th className="px-4 py-3 font-semibold">Usuario</th>
                  <th className="px-4 py-3 font-semibold">Teléfono</th>
                  <th className="px-4 py-3 font-semibold">Rol</th>
                  <th className="px-4 py-3 font-semibold">Registro</th>
                  <th className="px-4 py-3 text-right font-semibold">Acceso</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((p) => {
                  const role = normRole(p.role);
                  const isSelf = p.id === user?.id;
                  const isLastAdmin = role === "admin" && counts.admins <= 1;
                  return (
                    <tr key={p.id} className="transition hover:bg-slate-50/60">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <p className="font-medium text-slate-800">{p.full_name || "Sin nombre"}</p>
                          {isSelf && (
                            <span className="rounded-full bg-violet-100 px-1.5 py-0.5 text-[10px] font-semibold text-violet-600">
                              Tú
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-400">{p.email || "—"}</p>
                      </td>
                      <td className="px-4 py-3 text-slate-600">{p.phone || "—"}</td>
                      <td className="px-4 py-3">
                        <RoleBadge role={role} />
                      </td>
                      <td className="px-4 py-3 text-slate-500" title={relTime(p.created_at)}>
                        {fmtDate(p.created_at)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end">
                          <RoleSwitch
                            current={role}
                            busy={busyId === p.id}
                            readOnly={!canManage}
                            readOnlyTitle="Solo un administrador completo puede cambiar roles."
                            disabledRoles={isLastAdmin ? ["customer", "staff", "operator", "supervisor"] : []}
                            disabledTitle="No puedes quitar el último administrador del sistema."
                            onPick={(r) => changeRole(p, r)}
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <p className="text-[11px] leading-relaxed text-slate-400">
        Los cambios de rol se aplican al instante y quedan protegidos por RLS: aunque alguien fuerce la petición, la base
        rechaza el cambio si no es un administrador completo.
      </p>
    </div>
  );
}

/* ---------- Badge de rol (con dot) ---------- */

function RoleBadge({ role }: { role: Role }) {
  const m = ROLE_META[role];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${m.badge}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${m.dot}`} />
      {m.label}
    </span>
  );
}

/* ---------- Selector segmentado de rol ---------- */

function RoleSwitch({
  current,
  busy,
  readOnly,
  readOnlyTitle,
  disabledRoles,
  onPick,
}: {
  current: Role;
  busy: boolean;
  readOnly: boolean;
  readOnlyTitle: string;
  disabledRoles: Role[];
  disabledTitle: string;
  onPick: (r: Role) => void;
}) {
  return (
    <select
      value={current}
      disabled={busy || readOnly}
      title={readOnly ? readOnlyTitle : undefined}
      onChange={(e) => {
        const r = e.target.value as Role;
        if (r !== current) onPick(r);
      }}
      className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 shadow-sm outline-none transition focus:border-violet-400 focus:ring-2 focus:ring-violet-500/30 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {ROLE_OPTS.map(([r, label]) => (
        <option key={r} value={r} disabled={disabledRoles.includes(r)}>
          {label}
        </option>
      ))}
    </select>
  );
}

/* ---------- Tile de conteo ---------- */

function CountTile({
  label,
  value,
  role,
  icon,
}: {
  label: string;
  value: number;
  role: Role;
  icon?: React.ReactNode;
}) {
  const m = ROLE_META[role];
  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-medium uppercase tracking-wide text-slate-400">{label}</span>
        <span className={`grid h-6 w-6 place-items-center rounded-lg ring-1 ring-inset ${m.tile}`}>
          {icon ?? <span className={`h-2 w-2 rounded-full ${m.dot}`} />}
        </span>
      </div>
      <p className="mt-2 text-2xl font-semibold tabular-nums text-slate-900">{value}</p>
    </div>
  );
}
