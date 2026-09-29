"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Search, Star, Check, X, MessageSquareQuote, Clock, ThumbsUp } from "lucide-react";
import { getSupabase } from "@/lib/supabase";
import { relTime } from "@/lib/backoffice";
import { Card, Pill, Button, Spinner, EmptyState } from "@/components/backoffice/ui";

type ReviewStatus = "pending" | "approved" | "rejected";

interface ReviewRow {
  id: string;
  sku: string;
  product_id: string | null;
  product_name: string | null;
  user_id: string | null;
  customer_name: string | null;
  customer_email: string | null;
  rating: number;
  comment: string | null;
  status: ReviewStatus;
  order_id: string | null;
  created_at: string;
}

type StatusFilter = "all" | ReviewStatus;

const STATUS_TABS: [StatusFilter, string][] = [
  ["all", "Todas"],
  ["pending", "Pendientes"],
  ["approved", "Aprobadas"],
  ["rejected", "Rechazadas"],
];

function statusPillTone(s: ReviewStatus): "amber" | "emerald" | "slate" {
  return s === "pending" ? "amber" : s === "approved" ? "emerald" : "slate";
}

function statusLabel(s: ReviewStatus): string {
  return s === "pending" ? "Pendiente" : s === "approved" ? "Aprobada" : "Rechazada";
}

/** Estrellas 1-5 llenas/vacías. */
function Stars({ rating, size = 14 }: { rating: number; size?: number }) {
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`${rating} de 5 estrellas`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          size={size}
          className={i <= rating ? "fill-amber-400 text-amber-400" : "fill-slate-200 text-slate-200"}
        />
      ))}
    </span>
  );
}

export default function ReviewsPage() {
  const [reviews, setReviews] = useState<ReviewRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [search, setSearch] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    const sb = getSupabase();
    if (!sb) {
      setLoading(false);
      return;
    }
    try {
      const { data, error } = await sb
        .from("product_reviews")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(1000);
      if (error) throw error;
      setReviews((data as ReviewRow[]) ?? []);
    } catch {
      // La tabla puede no existir todavía: degradamos a estado vacío sin romper.
      setReviews([]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function moderate(id: string, status: ReviewStatus) {
    const sb = getSupabase();
    if (!sb) return;
    setBusyId(id);
    setErr(null);
    // Actualización optimista para respuesta inmediata; se reconcilia con refetch.
    setReviews((prev) => prev.map((r) => (r.id === id ? { ...r, status } : r)));
    const { error } = await sb.from("product_reviews").update({ status }).eq("id", id);
    if (error) setErr(error.message);
    await load();
    setBusyId(null);
  }

  const counts = useMemo(() => {
    let pending = 0;
    let approved = 0;
    let rejected = 0;
    let sum = 0;
    for (const r of reviews) {
      if (r.status === "pending") pending += 1;
      else if (r.status === "approved") approved += 1;
      else rejected += 1;
      sum += r.rating || 0;
    }
    const avg = reviews.length ? sum / reviews.length : 0;
    return { pending, approved, rejected, avg, total: reviews.length };
  }, [reviews]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return reviews.filter((r) => {
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (!q) return true;
      return (
        (r.product_name ?? "").toLowerCase().includes(q) ||
        (r.sku ?? "").toLowerCase().includes(q) ||
        (r.customer_name ?? "").toLowerCase().includes(q) ||
        (r.customer_email ?? "").toLowerCase().includes(q)
      );
    });
  }, [reviews, search, statusFilter]);

  if (loading) return <Spinner label="Cargando reseñas…" />;

  return (
    <div className="space-y-6">
      {/* Contadores */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Metric label="Reseñas" value={counts.total} icon={<MessageSquareQuote size={16} />} />
        <Metric label="Pendientes" value={counts.pending} icon={<Clock size={16} />} tone="amber" />
        <Metric label="Aprobadas" value={counts.approved} icon={<ThumbsUp size={16} />} tone="violet" />
        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium uppercase tracking-wide text-slate-400">Rating promedio</span>
            <span className="grid h-6 w-6 place-items-center rounded-lg bg-amber-100 text-amber-500">
              <Star size={16} className="fill-amber-400 text-amber-400" />
            </span>
          </div>
          <div className="mt-2 flex items-center gap-2">
            <p className="text-2xl font-semibold tabular-nums text-slate-900">
              {counts.total ? counts.avg.toFixed(1) : "—"}
            </p>
            {counts.total > 0 && <Stars rating={Math.round(counts.avg)} />}
          </div>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="inline-flex flex-wrap gap-0.5 rounded-xl border border-slate-200 bg-white p-0.5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          {STATUS_TABS.map(([key, label]) => {
            const active = statusFilter === key;
            const n =
              key === "all"
                ? counts.total
                : key === "pending"
                ? counts.pending
                : key === "approved"
                ? counts.approved
                : counts.rejected;
            return (
              <button
                key={key}
                onClick={() => setStatusFilter(key)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                  active ? "bg-violet-600 text-white shadow-sm shadow-violet-600/20" : "text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                }`}
              >
                {label} <span className={active ? "text-violet-100" : "text-slate-400"}>· {n}</span>
              </button>
            );
          })}
        </div>

        <div className="relative min-w-[220px] sm:max-w-xs">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar producto o cliente…"
            className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm text-slate-800 shadow-sm outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-500/30"
          />
        </div>
      </div>

      {err && (
        <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-600">{err}</p>
      )}

      {/* Lista de reseñas */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={<MessageSquareQuote size={28} />}
          title="Sin reseñas"
          hint="Cuando un cliente deje una reseña aparecerá aquí para que la modere."
        />
      ) : (
        <Card className="divide-y divide-slate-100">
          {filtered.map((r) => (
            <div key={r.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0 flex-1 space-y-1.5">
                {/* Producto */}
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold text-slate-800">{r.product_name || "Producto"}</p>
                  <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500">
                    {r.sku}
                  </span>
                  <Pill tone={statusPillTone(r.status)}>{statusLabel(r.status)}</Pill>
                </div>
                {/* Quién + estrellas */}
                <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-slate-500">
                  <Stars rating={r.rating} />
                  <span className="font-medium text-slate-700">{r.customer_name || "Anónimo"}</span>
                  {r.customer_email && <span className="text-slate-400">· {r.customer_email}</span>}
                  <span className="text-slate-300">· {relTime(r.created_at)}</span>
                </div>
                {/* Comentario */}
                {r.comment && (
                  <p className="max-w-2xl text-sm leading-relaxed text-slate-600">“{r.comment}”</p>
                )}
              </div>

              {/* Moderación */}
              <div className="flex shrink-0 items-center gap-2">
                <Button
                  variant="success"
                  size="sm"
                  onClick={() => moderate(r.id, "approved")}
                  disabled={busyId === r.id || r.status === "approved"}
                  title="Aprobar reseña"
                >
                  <Check size={14} /> Aprobar
                </Button>
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => moderate(r.id, "rejected")}
                  disabled={busyId === r.id || r.status === "rejected"}
                  title="Rechazar reseña"
                >
                  <X size={14} /> Rechazar
                </Button>
              </div>
            </div>
          ))}
        </Card>
      )}

      <p className="text-[11px] text-slate-400">
        Las reseñas aprobadas se publican en la ficha del producto y alimentan el rating con estrellas para SEO.
      </p>
    </div>
  );
}

/* ---------- Tile ---------- */

function Metric({
  label,
  value,
  icon,
  tone = "slate",
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  tone?: "slate" | "violet" | "amber";
}) {
  const tones: Record<string, string> = {
    slate: "bg-slate-100 text-slate-500",
    violet: "bg-violet-100 text-violet-600",
    amber: "bg-amber-100 text-amber-600",
  };
  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-medium uppercase tracking-wide text-slate-400">{label}</span>
        <span className={`grid h-6 w-6 place-items-center rounded-lg ${tones[tone]}`}>{icon}</span>
      </div>
      <p className="mt-2 text-2xl font-semibold tabular-nums text-slate-900">{value}</p>
    </div>
  );
}
