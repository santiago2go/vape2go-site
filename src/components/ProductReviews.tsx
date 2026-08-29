"use client";

import { useEffect, useMemo, useState } from "react";
import { Star, MessageSquare, CheckCircle2 } from "lucide-react";
import { getSupabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";

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

interface Props {
  sku: string;
  productId: string;
  productName: string;
}

const dateFmt = new Intl.DateTimeFormat("es-DO", { day: "numeric", month: "long", year: "numeric" });

function fmtDate(iso: string): string {
  try {
    return dateFmt.format(new Date(iso));
  } catch {
    return "";
  }
}

/** Estrellas de solo lectura 1-5. */
function Stars({ rating, size = 16 }: { rating: number; size?: number }) {
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`${rating} de 5 estrellas`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          size={size}
          className={i <= Math.round(rating) ? "fill-amber-400 text-amber-400" : "fill-gray-200 text-gray-200"}
        />
      ))}
    </span>
  );
}

export default function ProductReviews({ sku, productId, productName }: Props) {
  const { profile } = useAuth();

  const [reviews, setReviews] = useState<ReviewRow[]>([]);
  const [loading, setLoading] = useState(true);

  // Formulario
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Prellena nombre/correo con la sesión si existe.
  useEffect(() => {
    if (profile?.full_name) setName((n) => n || profile.full_name || "");
    if (profile?.email) setEmail((e) => e || profile.email || "");
  }, [profile]);

  useEffect(() => {
    let active = true;
    const sb = getSupabase();
    if (!sb) {
      setLoading(false);
      return;
    }
    (async () => {
      try {
        const { data, error: qErr } = await sb
          .from("product_reviews")
          .select("*")
          .eq("sku", sku)
          .eq("status", "approved")
          .order("created_at", { ascending: false });
        if (qErr) throw qErr;
        if (active) setReviews((data as ReviewRow[]) ?? []);
      } catch {
        // La tabla puede no existir todavía: degradamos a vacío sin romper la ficha.
        if (active) setReviews([]);
      }
      if (active) setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [sku]);

  const stats = useMemo(() => {
    const count = reviews.length;
    if (!count) return { count: 0, avg: 0 };
    const avg = reviews.reduce((a, r) => a + (r.rating || 0), 0) / count;
    return { count, avg };
  }, [reviews]);

  // JSON-LD con aggregateRating + hasta 5 reseñas (solo si hay reseñas reales).
  const jsonLd = useMemo(() => {
    if (stats.count < 1) return null;
    return {
      "@context": "https://schema.org",
      "@type": "Product",
      name: productName,
      sku,
      aggregateRating: {
        "@type": "AggregateRating",
        ratingValue: Number(stats.avg.toFixed(1)),
        reviewCount: stats.count,
        bestRating: 5,
        worstRating: 1,
      },
      review: reviews.slice(0, 5).map((r) => ({
        "@type": "Review",
        author: { "@type": "Person", name: r.customer_name || "Cliente" },
        datePublished: r.created_at?.slice(0, 10),
        reviewRating: { "@type": "Rating", ratingValue: r.rating, bestRating: 5, worstRating: 1 },
        reviewBody: r.comment || "",
      })),
    };
  }, [reviews, stats, productName, sku]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (rating < 1) {
      setError("Elige una calificación de estrellas.");
      return;
    }
    const sb = getSupabase();
    if (!sb) {
      setError("Las reseñas no están disponibles en este momento.");
      return;
    }
    setSubmitting(true);
    try {
      const { error: insErr } = await sb.from("product_reviews").insert({
        sku,
        product_id: productId,
        product_name: productName,
        rating,
        comment: comment.trim() || null,
        customer_name: name.trim() || null,
        customer_email: email.trim() || null,
        user_id: profile?.id ?? null,
        status: "pending",
      });
      if (insErr) throw insErr;
      setSent(true);
      setComment("");
      setRating(0);
    } catch {
      setError("No pudimos enviar tu reseña. Inténtalo de nuevo más tarde.");
    }
    setSubmitting(false);
  }

  return (
    <section className="space-y-6 pt-6 border-t border-gray-100">
      {jsonLd && (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      )}

      {/* Encabezado + promedio */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h2 className="text-xl font-normal text-gray-900">Reseñas</h2>
        {!loading && stats.count > 0 && (
          <div className="flex items-center gap-2 text-sm">
            <Stars rating={stats.avg} />
            <span className="font-semibold text-gray-900">{stats.avg.toFixed(1)}</span>
            <span className="text-gray-400">
              · {stats.count} {stats.count === 1 ? "reseña" : "reseñas"}
            </span>
          </div>
        )}
      </div>

      {/* Lista de reseñas */}
      {loading ? (
        <p className="text-sm text-gray-400">Cargando reseñas…</p>
      ) : reviews.length === 0 ? (
        <div className="flex items-center gap-3 rounded-xl bg-gray-50 px-4 py-5 text-sm text-gray-500">
          <MessageSquare size={18} className="shrink-0 text-gray-400" />
          Todavía no hay reseñas de este producto. ¡Sé el primero en dejar la tuya!
        </div>
      ) : (
        <ul className="space-y-4">
          {reviews.map((r) => (
            <li key={r.id} className="rounded-xl border border-gray-100 bg-white p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-gray-900">{r.customer_name || "Cliente"}</p>
                <span className="text-xs text-gray-400">{fmtDate(r.created_at)}</span>
              </div>
              <div className="mt-1">
                <Stars rating={r.rating} size={14} />
              </div>
              {r.comment && <p className="mt-2 text-sm leading-relaxed text-gray-600">{r.comment}</p>}
            </li>
          ))}
        </ul>
      )}

      {/* Formulario: deja tu reseña */}
      <div className="rounded-2xl border border-violet-100 bg-violet-50/40 p-5 sm:p-6">
        {sent ? (
          <div className="flex items-start gap-3">
            <CheckCircle2 size={22} className="mt-0.5 shrink-0 text-green-600" />
            <div>
              <h3 className="text-base font-normal text-gray-900">¡Gracias!</h3>
              <p className="mt-1 text-sm text-gray-600">Tu reseña será revisada antes de publicarse.</p>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <h3 className="text-lg font-normal text-gray-900">Deja tu reseña</h3>

            {/* Selector de estrellas */}
            <div>
              <span className="mb-1.5 block text-sm font-medium text-gray-700">Tu calificación</span>
              <div className="flex items-center gap-1" role="radiogroup" aria-label="Calificación">
                {[1, 2, 3, 4, 5].map((i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setRating(i)}
                    onMouseEnter={() => setHover(i)}
                    onMouseLeave={() => setHover(0)}
                    className="rounded p-0.5 transition-transform hover:scale-110"
                    aria-label={`${i} ${i === 1 ? "estrella" : "estrellas"}`}
                    aria-pressed={rating === i}
                  >
                    <Star
                      size={28}
                      className={
                        i <= (hover || rating)
                          ? "fill-amber-400 text-amber-400"
                          : "fill-gray-200 text-gray-300"
                      }
                    />
                  </button>
                ))}
              </div>
            </div>

            {/* Comentario */}
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-gray-700">Comentario</span>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={3}
                placeholder="¿Qué te pareció el producto?"
                className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-800 outline-none transition focus:border-violet-400 focus:ring-2 focus:ring-violet-500/20"
              />
            </label>

            {/* Nombre + correo */}
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-gray-700">Nombre</span>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Tu nombre"
                  className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-800 outline-none transition focus:border-violet-400 focus:ring-2 focus:ring-violet-500/20"
                />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-gray-700">Correo</span>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="tucorreo@ejemplo.com"
                  className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-800 outline-none transition focus:border-violet-400 focus:ring-2 focus:ring-violet-500/20"
                />
              </label>
            </div>

            {error && <p className="text-sm text-rose-600">{error}</p>}

            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center justify-center rounded-xl bg-violet-600 px-6 py-3 text-sm font-semibold text-white shadow-sm shadow-violet-600/20 transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting ? "Enviando…" : "Enviar reseña"}
            </button>
          </form>
        )}
      </div>
    </section>
  );
}
