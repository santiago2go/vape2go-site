"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { useCart } from "@/lib/cart-context";
import { useLiveStock } from "@/lib/live-stock-context";
import { getSupabase } from "@/lib/supabase";
import { track } from "@/lib/analytics";
import { formatDOP, WHATSAPP_URL } from "@/data/catalog-meta";
import Turnstile from "@/components/Turnstile";
import OrderChannels from "@/components/OrderChannels";
import { useOrderAvailability, OrderUnavailableModal } from "@/components/OrderAvailability";

interface DeliveryConfig {
  fee: number;
  free_over: number;
}
interface Zone {
  name: string;
  fee: number;
  free_over: number;
  tier: string;
  active: boolean;
}
interface TransferConfig {
  bank?: string;
  account?: string;
  account_type?: string;
  id_doc?: string;
  holder?: string;
}
interface WhatsappConfig {
  number?: string;
  display?: string;
  label?: string;
}
interface OrderResult {
  id: string;
  subtotal: number;
  discount_applied: number;
  delivery_fee: number;
  total: number;
  payment_method: "cash" | "transfer";
  status: string;
}
interface SavedAddress {
  id: string;
  label: string;
  line1: string;
  line2: string | null;
  delivery_notes: string | null;
  phone: string | null;
  is_default: boolean;
}

const CREATE_ORDER_URL = "/.netlify/functions/create-order";
const TURNSTILE_ENABLED = Boolean(process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY);

// Número dominicano (10 dígitos) → enlace wa.me con el código de país "1" antepuesto.
function waLink(number: string): string {
  return `https://wa.me/1${number.replace(/\D/g, "")}`;
}

// Aviso de despacho para transferencias (se muestra en el form y en la confirmación).
const DISPATCH_NOTE =
  "Tu pedido se despacha en cuanto confirmemos que los fondos llegaron a nuestra cuenta. Envía el comprobante por WhatsApp.";

export default function CheckoutPage() {
  const router = useRouter();
  const { user, profile, signUp, session } = useAuth();
  const { items, count, hydrated, clear } = useCart();
  const { get, isAvailable } = useLiveStock();
  const availability = useOrderAvailability();

  const isGuest = !user;

  const [form, setForm] = useState({
    name: "",
    phone: "",
    email: "",
    password: "",
    addressLabel: "Casa",
    zone: "",
    addressLine1: "",
    addressLine2: "",
    deliveryNotes: "",
    cashAmount: "",
  });
  const [terms, setTerms] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "transfer">("cash");
  const [delivery, setDelivery] = useState<DeliveryConfig | null>(null);
  const [zones, setZones] = useState<Zone[]>([]);
  const [transfer, setTransfer] = useState<TransferConfig | null>(null);
  const [whatsapp, setWhatsapp] = useState<WhatsappConfig | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [captchaReset, setCaptchaReset] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [order, setOrder] = useState<OrderResult | null>(null);
  const [wasGuest, setWasGuest] = useState(false);
  const [accountCreated, setAccountCreated] = useState(false);
  // Libreta de direcciones del usuario logueado (elegir una guardada o agregar otra).
  const [savedAddresses, setSavedAddresses] = useState<SavedAddress[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<string | "new">("new");

  const prefilled = useRef(false);
  const addressesLoaded = useRef(false);
  const trackedBegin = useRef(false);
  // Resolver para esperar un token Turnstile FRESCO (el de la orden ya se consumió).
  const freshResolver = useRef<((t: string | null) => void) | null>(null);

  function set<K extends keyof typeof form>(k: K, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  // Recibe cada token del Turnstile; si hay una espera pendiente y el token es
  // válido (no vacío), la resuelve.
  const handleToken = useCallback((t: string) => {
    setToken(t);
    if (t && freshResolver.current) {
      const resolve = freshResolver.current;
      freshResolver.current = null;
      resolve(t);
    }
  }, []);

  // Resetea el captcha y espera el token nuevo (invisible/managed → transparente).
  const waitForFreshToken = useCallback((timeoutMs = 3500): Promise<string | null> => {
    return new Promise((resolve) => {
      freshResolver.current = resolve;
      setCaptchaReset((k) => k + 1);
      window.setTimeout(() => {
        if (freshResolver.current) {
          freshResolver.current = null;
          resolve(null);
        }
      }, timeoutMs);
    });
  }, []);

  // begin_checkout una sola vez al montar
  useEffect(() => {
    if (trackedBegin.current) return;
    trackedBegin.current = true;
    void track("begin_checkout");
  }, []);

  // Carrito vacío → volver al carrito (solo tras hidratar y si no acabamos de completar)
  useEffect(() => {
    if (hydrated && count === 0 && !done && !busy) {
      router.replace("/carrito/");
    }
  }, [hydrated, count, done, busy, router]);

  // Config de tienda: delivery + transfer
  useEffect(() => {
    const sb = getSupabase();
    if (!sb) return;
    sb.from("store_config")
      .select("key,value")
      .then(({ data }) => {
        const rows = (data as Array<{ key: string; value: unknown }> | null) ?? [];
        for (const r of rows) {
          if (r.key === "delivery") {
            const v = r.value as DeliveryConfig;
            setDelivery({ fee: Number(v?.fee) || 0, free_over: Number(v?.free_over) || 0 });
          }
          if (r.key === "transfer") setTransfer((r.value as TransferConfig) ?? null);
          if (r.key === "whatsapp") setWhatsapp((r.value as WhatsappConfig) ?? null);
          if (r.key === "zones" && Array.isArray(r.value)) {
            setZones((r.value as Zone[]).filter((z) => z && z.active));
          }
        }
      });
  }, []);

  // Prefill: nombre/celular del perfil, con fallback a los metadatos de Google
  // (el login con Google no siempre llena full_name en el profile).
  useEffect(() => {
    if (prefilled.current) return;
    const meta = (user?.user_metadata ?? {}) as { full_name?: string; name?: string };
    const metaName = meta.full_name || meta.name || "";
    if (profile?.full_name || profile?.phone || metaName) {
      prefilled.current = true;
      setForm((f) => ({
        ...f,
        name: f.name || profile?.full_name || metaName || "",
        phone: f.phone || profile?.phone || "",
      }));
    }
  }, [profile, user]);

  // Carga la libreta de direcciones del usuario y prellena con la predeterminada.
  // Corre UNA sola vez (guard): el objeto `user` cambia de referencia en cada
  // refresh de sesión, y sin el guard el efecto re-seteaba la dirección elegida.
  useEffect(() => {
    const sb = getSupabase();
    if (!sb || !user) return;
    if (addressesLoaded.current) return;
    let active = true;
    sb.from("addresses")
      .select("id,label,line1,line2,delivery_notes,phone,is_default")
      .order("is_default", { ascending: false })
      .order("created_at", { ascending: true })
      .then(({ data }) => {
        if (!active) return;
        addressesLoaded.current = true;
        const rows = (data as SavedAddress[] | null) ?? [];
        setSavedAddresses(rows);
        const def = rows[0];
        if (!def) return;
        setSelectedAddressId(def.id);
        setForm((f) => ({
          ...f,
          addressLabel: f.addressLine1 ? f.addressLabel : def.label || f.addressLabel,
          addressLine1: f.addressLine1 || def.line1 || "",
          addressLine2: f.addressLine2 || def.line2 || "",
          deliveryNotes: f.deliveryNotes || def.delivery_notes || "",
          phone: f.phone || def.phone || "",
        }));
      });
    return () => {
      active = false;
    };
  }, [user]);

  // Aplica una dirección guardada al formulario (botón del selector).
  function applyAddress(a: SavedAddress) {
    setSelectedAddressId(a.id);
    setForm((f) => ({
      ...f,
      addressLabel: a.label || "Casa",
      addressLine1: a.line1 || "",
      addressLine2: a.line2 || "",
      deliveryNotes: a.delivery_notes || "",
      phone: f.phone || a.phone || "",
    }));
  }

  // Cambia a "otra dirección" (nueva) y limpia los campos de dirección.
  function startNewAddress() {
    setSelectedAddressId("new");
    setForm((f) => ({ ...f, addressLabel: "Casa", addressLine1: "", addressLine2: "", deliveryNotes: "" }));
  }

  // Resumen EN VIVO
  const subtotal = items.reduce((sum, it) => {
    const live = get(it.sku);
    if (!live || !isAvailable(it.sku)) return sum;
    return sum + live.price * it.qty;
  }, 0);
  // Delivery por sector: si hay zonas activas, la tarifa sale del sector elegido
  // (null = aún sin elegir → se muestra "Elige tu sector"). Si no hay zonas
  // configuradas, cae al delivery plano.
  const selectedZone = zones.find((z) => z.name === form.zone) ?? null;
  const deliveryFee: number | null =
    zones.length > 0
      ? selectedZone
        ? selectedZone.free_over > 0 && subtotal >= selectedZone.free_over
          ? 0
          : selectedZone.fee
        : null
      : delivery && delivery.free_over > 0 && subtotal >= delivery.free_over
        ? 0
        : delivery?.fee ?? 0;
  const total = subtotal + (deliveryFee ?? 0);

  // WhatsApp clickeable (enlace wa.me + texto legible). Cae al placeholder global
  // si aún no hay número configurado en store_config.
  const waHref = whatsapp?.number ? waLink(whatsapp.number) : WHATSAPP_URL;
  const waLabel = whatsapp?.display || whatsapp?.number || null;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (availability.ready && !availability.accepting) { setError(availability.message || "En este momento no estamos recibiendo pedidos."); return; }
    if (!form.name.trim()) { setError("Necesitamos tu nombre."); return; }
    if (!form.phone.trim()) { setError("Necesitamos tu celular para coordinar la entrega."); return; }
    if (!form.addressLine1.trim()) { setError("Agrega tu dirección de entrega."); return; }
    if (zones.length > 0 && !form.zone) { setError("Selecciona tu sector de entrega."); return; }
    if (paymentMethod === "cash") {
      const amt = Number(form.cashAmount);
      if (!form.cashAmount.trim() || !Number.isFinite(amt) || amt < total) {
        setError('Dinos con cuánto vas a pagar en efectivo (o toca "Exacto").');
        return;
      }
    }
    if (isGuest) {
      if (!form.email.trim()) { setError("Ingresa tu correo para crear tu cuenta y seguir tus pedidos."); return; }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) { setError("El correo no parece válido."); return; }
      if (form.password.length < 8) { setError("La contraseña debe tener al menos 8 caracteres."); return; }
      if (!terms) { setError("Acepta los Términos y la Política de Privacidad para continuar."); return; }
    }
    if (!token) { setError("Completa la verificación de seguridad."); return; }
    if (count === 0) { setError("Tu carrito está vacío."); return; }

    // Email para el payload: guest → el que escribió; logueado → su email real.
    const customerEmail = (isGuest ? form.email.trim() : (profile?.email || user?.email || "")).trim();

    setBusy(true);
    try {
      // 1) Crear la orden. Pase lo que pase después, NO perdemos la venta.
      const res = await fetch(CREATE_ORDER_URL, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          // el user_id se deriva de este JWT en el servidor (no del body)
          ...(session?.access_token ? { authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({
          items: items.map((i) => ({ sku: i.sku, product_id: i.id, name: i.name, qty: i.qty, image: i.image })),
          payment_method: paymentMethod,
          cash_amount: paymentMethod === "cash" && form.cashAmount ? Number(form.cashAmount) : undefined,
          customer: {
            name: form.name.trim(),
            phone: form.phone.trim(),
            email: customerEmail || undefined,
            address: {
              label: form.addressLabel,
              zone: form.zone || undefined,
              line1: form.addressLine1.trim(),
              line2: form.addressLine2.trim(),
              delivery_notes: form.deliveryNotes.trim(),
            },
          },
          turnstileToken: token,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) {
        setError(data?.error || "No pudimos procesar tu orden. Intenta de nuevo.");
        setToken(null);
        setCaptchaReset((k) => k + 1);
        setBusy(false);
        return;
      }
      const ord = data.order as OrderResult;

      // 2) Best-effort: crear la cuenta del guest (la orden YA existe, así que
      //    cualquier fallo aquí se ignora). Necesita su propio token Turnstile.
      let created = false;
      if (isGuest) {
        let signupToken: string | undefined = token ?? undefined;
        if (TURNSTILE_ENABLED) {
          const fresh = await waitForFreshToken();
          signupToken = fresh ?? undefined;
        }
        try {
          const { error: suErr } = await signUp({
            email: form.email.trim(),
            password: form.password,
            fullName: form.name.trim(),
            phone: form.phone.trim(),
            addressLine1: form.addressLine1.trim(),
            addressLine2: form.addressLine2.trim(),
            deliveryNotes: form.deliveryNotes.trim(),
            addressLabel: form.addressLabel,
            marketingConsent: true,
            termsAccepted: true,
            captchaToken: signupToken,
          });
          created = !suErr;
        } catch {
          created = false; // el email ya existe u otro error → lo ignoramos
        }
      }

      // 3) Best-effort: guardar/actualizar la dirección en la libreta del usuario
      //    logueado (la orden YA existe; cualquier fallo aquí se ignora). Esto es lo
      //    que faltaba: para quien entra con Google la dirección nunca se guardaba.
      if (!isGuest && user) {
        try {
          const sb = getSupabase();
          if (sb) {
            const addr = {
              label: form.addressLabel,
              line1: form.addressLine1.trim(),
              line2: form.addressLine2.trim() || null,
              delivery_notes: form.deliveryNotes.trim() || null,
              phone: form.phone.trim() || null,
            };
            if (selectedAddressId !== "new") {
              await sb.from("addresses").update(addr).eq("id", selectedAddressId);
            } else {
              await sb
                .from("addresses")
                .insert({ ...addr, user_id: user.id, is_default: addressesLoaded.current && savedAddresses.length === 0 });
            }
          }
        } catch {
          // guardar la dirección es opcional; no bloquea la orden ya creada
        }
      }

      setWasGuest(isGuest);
      setAccountCreated(created);
      setOrder(ord);
      void track("purchase", { props: { orderId: ord.id } });
      clear();
      setDone(true);
    } catch {
      setError("Hubo un problema de conexión. Intenta de nuevo.");
      setToken(null);
      setCaptchaReset((k) => k + 1);
    } finally {
      setBusy(false);
    }
  }

  // Pantalla de confirmación
  if (done && order) {
    const shortId = order.id.slice(0, 8).toUpperCase();
    return (
      <div className="max-w-3xl mx-auto px-4 py-12">
        <div className="rounded-2xl bg-green-50 border border-green-200 p-6 space-y-4">
          <div className="text-4xl">✅</div>
          <h1 className="text-2xl text-green-900" style={{ fontFamily: "var(--font-heading)" }}>
            ¡Orden recibida!
          </h1>
          <p className="text-sm text-green-800">
            Tu orden <strong>#{shortId}</strong> fue creada. Te contactaremos por WhatsApp para
            coordinar la entrega.
          </p>
          <div className="flex items-center justify-between text-sm bg-white rounded-xl border border-green-100 px-4 py-3">
            <span className="text-gray-500">Total</span>
            <span className="text-violet-700 font-bold">{formatDOP(order.total)}</span>
          </div>
          {order.payment_method === "cash" && form.cashAmount && Number(form.cashAmount) >= order.total && (
            <div className="flex items-center justify-between text-sm bg-white rounded-xl border border-green-100 px-4 py-3">
              <span className="text-gray-500">Pagas con {formatDOP(Number(form.cashAmount))} · cambio</span>
              <span className="font-semibold text-emerald-700">{formatDOP(Number(form.cashAmount) - order.total)}</span>
            </div>
          )}

          {order.payment_method === "transfer" && (
            <div className="bg-white rounded-xl border border-green-100 p-4 space-y-3 text-sm">
              <p className="font-semibold text-gray-900">Datos para la transferencia</p>
              {transfer ? (
                <div className="space-y-2">
                  {transfer.bank && <Row label="Banco" value={transfer.bank} />}
                  {transfer.account && <Row label="Cuenta" value={transfer.account} />}
                  {transfer.account_type && <Row label="Tipo" value={transfer.account_type} />}
                  {transfer.holder && <Row label="Titular" value={transfer.holder} />}
                  {transfer.id_doc && <Row label="Cédula/RNC" value={transfer.id_doc} />}
                </div>
              ) : (
                <p className="text-xs text-gray-500">
                  Te enviaremos los datos de la cuenta por WhatsApp.
                </p>
              )}
              {waLabel && (
                <div className="flex items-center justify-between gap-3">
                  <span className="text-gray-500">WhatsApp</span>
                  <a href={waHref} target="_blank" rel="noopener noreferrer" className="font-medium text-violet-700 hover:text-violet-800">
                    {waLabel}
                  </a>
                </div>
              )}
              <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-xs text-amber-800 space-y-1.5">
                <p>⚠️ {DISPATCH_NOTE}</p>
                <a href={waHref} target="_blank" rel="noopener noreferrer" className="inline-block font-semibold underline hover:text-amber-900">
                  Enviar comprobante por WhatsApp →
                </a>
              </div>
            </div>
          )}

          {wasGuest && accountCreated && (
            <div className="bg-white rounded-xl border border-green-100 p-4 text-sm text-gray-700">
              Te creamos una cuenta para seguir tus pedidos. Revisa tu correo{" "}
              <strong>{form.email}</strong> para confirmarla.
            </div>
          )}
          {wasGuest && !accountCreated && (
            <div className="bg-white rounded-xl border border-green-100 p-4 text-sm text-gray-700">
              ¿Ya tienes cuenta?{" "}
              <Link href="/entrar/" className="text-violet-600 font-semibold hover:text-violet-700">
                Inicia sesión
              </Link>{" "}
              para ver tus pedidos.
            </div>
          )}
        </div>
        <div className="mt-6 flex flex-col sm:flex-row gap-3">
          <Link href="/catalogo/" className="flex-1 text-center bg-violet-600 text-white font-semibold text-sm py-3.5 rounded-xl hover:bg-violet-700 transition-colors">
            Seguir comprando
          </Link>
          <Link href="/cuenta/" className="flex-1 text-center border border-gray-200 text-gray-500 hover:bg-gray-50 rounded-xl py-3.5 text-sm font-medium transition-colors">
            Ver mis órdenes
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      <OrderUnavailableModal state={availability} />

      <h1 className="text-3xl text-gray-900 mb-8" style={{ fontFamily: "var(--font-heading)" }}>
        Finalizar compra
      </h1>

      <form onSubmit={onSubmit} className="grid md:grid-cols-5 gap-8">
        {/* Datos de entrega */}
        <div className="md:col-span-3 space-y-4">
          <Field label="Nombre completo" value={form.name} onChange={(v) => set("name", v)} required autoComplete="name" />
          <Field label="Celular (WhatsApp)" type="tel" value={form.phone} onChange={(v) => set("phone", v)} required autoComplete="tel" hint="Lo usamos para coordinar tu entrega" />

          <div className="pt-2 mt-2 border-t border-gray-100 space-y-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Dirección de entrega</p>
            {!isGuest && savedAddresses.length > 0 && (
              <AddressPicker
                addresses={savedAddresses}
                selectedId={selectedAddressId}
                onPick={applyAddress}
                onNew={startNewAddress}
              />
            )}
            {zones.length > 0 && (
              <ZoneSelect zones={zones} value={form.zone} onChange={(v) => set("zone", v)} waHref={waHref} />
            )}
            <SelectField label="Nombre de la dirección" value={form.addressLabel} onChange={(v) => set("addressLabel", v)} options={["Casa", "Trabajo", "Otro"]} />
            <Field label="Dirección" value={form.addressLine1} onChange={(v) => set("addressLine1", v)} required autoComplete="address-line1" hint="Calle y número (dentro de tu sector)" />
            <Field label="Apartamento, piso o casa" value={form.addressLine2} onChange={(v) => set("addressLine2", v)} autoComplete="address-line2" hint="Opcional" />
            <TextareaField label="Referencias / indicaciones de entrega" value={form.deliveryNotes} onChange={(v) => set("deliveryNotes", v)} hint="Opcional — punto de referencia, color de la casa, portón, etc." />
          </div>

          {/* Crear cuenta (solo invitados) — order-first: no perdemos la venta */}
          {isGuest && (
            <div className="pt-2 mt-2 border-t border-gray-100 space-y-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Crea tu cuenta</p>
                <p className="text-xs text-gray-400 mt-1">Te creamos una cuenta para que sigas tus pedidos y guardes tus datos.</p>
              </div>
              <Field label="Correo electrónico" type="email" value={form.email} onChange={(v) => set("email", v)} required autoComplete="email" />
              <Field label="Contraseña" type="password" value={form.password} onChange={(v) => set("password", v)} required autoComplete="new-password" hint="Mínimo 8 caracteres" />
              <label className="flex items-start gap-2.5 text-xs text-gray-600 leading-relaxed">
                <input type="checkbox" checked={terms} onChange={(e) => setTerms(e.target.checked)} className="mt-0.5 accent-violet-600" />
                <span>
                  He leído y acepto los{" "}
                  <Link href="/terminos/" target="_blank" className="text-violet-600 underline hover:text-violet-700">Términos de Servicio</Link>{" "}
                  y la{" "}
                  <Link href="/privacidad/" target="_blank" className="text-violet-600 underline hover:text-violet-700">Política de Privacidad</Link>.
                </span>
              </label>
              <p className="text-[11px] text-gray-400">
                ¿Ya tienes cuenta?{" "}
                <Link href="/entrar/" className="text-violet-600 font-medium hover:text-violet-700">Inicia sesión</Link>{" "}
                para prellenar tus datos.
              </p>
            </div>
          )}
        </div>

        {/* Resumen de orden */}
        <div className="md:col-span-2">
          <div className="rounded-2xl border border-gray-200 p-5 space-y-4 md:sticky md:top-20">
            <h2 className="text-lg text-gray-900" style={{ fontFamily: "var(--font-heading)" }}>
              Tu orden
            </h2>

            <div className="space-y-2">
              {items.map((it) => {
                const live = get(it.sku);
                const available = isAvailable(it.sku);
                return (
                  <div key={it.sku} className="flex items-start justify-between gap-2 text-sm">
                    <span className="text-gray-600 min-w-0">
                      <span className="font-medium text-gray-900">{it.qty}×</span> {it.name}
                    </span>
                    {available && live ? (
                      <span className="text-gray-900 shrink-0">{formatDOP(live.price * it.qty)}</span>
                    ) : (
                      <span className="text-red-600 text-xs shrink-0">Agotado</span>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="border-t border-gray-100 pt-3 space-y-1.5 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-gray-500">Subtotal</span>
                <span className="text-gray-900">{formatDOP(subtotal)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-500">Delivery{selectedZone ? ` · ${selectedZone.tier}` : ""}</span>
                <span className="text-gray-900">
                  {deliveryFee === null ? (
                    <span className="text-gray-400">Elige tu sector</span>
                  ) : deliveryFee === 0 ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-green-700 ring-1 ring-green-200">
                      Gratis
                    </span>
                  ) : (
                    formatDOP(deliveryFee)
                  )}
                </span>
              </div>
              <div className="flex items-center justify-between pt-1.5 border-t border-gray-100">
                <span className="font-semibold text-gray-900">Total</span>
                <span className="text-violet-700 font-bold text-base">{formatDOP(total)}</span>
              </div>
            </div>

            {/* Método de pago (junto a Confirmar orden) */}
            <div className="pt-1 border-t border-gray-100 space-y-2.5">
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Método de pago</p>
              <PaymentOption
                checked={paymentMethod === "cash"}
                onSelect={() => setPaymentMethod("cash")}
                title="Efectivo contra entrega"
                subtitle="Pagas en efectivo cuando recibas tu pedido."
              />
              <PaymentOption
                checked={paymentMethod === "transfer"}
                onSelect={() => setPaymentMethod("transfer")}
                title="Transferencia bancaria"
                subtitle="Transfiere el total y envía el comprobante por WhatsApp."
              />
              {paymentMethod === "cash" && (
                <CashAmountField total={total} value={form.cashAmount} onChange={(v) => set("cashAmount", v)} />
              )}
              {paymentMethod === "transfer" && (
                <div className="rounded-xl border border-violet-200 bg-violet-50/40 p-4 space-y-3 text-sm">
                  {transfer && (
                    <div className="space-y-2">
                      {transfer.bank && <Row label="Banco" value={transfer.bank} />}
                      {transfer.account && <Row label="Cuenta" value={transfer.account} />}
                      {transfer.account_type && <Row label="Tipo" value={transfer.account_type} />}
                      {transfer.holder && <Row label="Titular" value={transfer.holder} />}
                      {transfer.id_doc && <Row label="Cédula/RNC" value={transfer.id_doc} />}
                    </div>
                  )}
                  {waLabel && (
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-gray-500">WhatsApp</span>
                      <a href={waHref} target="_blank" rel="noopener noreferrer" className="font-medium text-violet-700 hover:text-violet-800">
                        {waLabel}
                      </a>
                    </div>
                  )}
                  <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-xs text-amber-800">
                    ⚠️ {DISPATCH_NOTE}
                  </div>
                </div>
              )}
            </div>

            {/* Aquí es donde el cliente descubre que no hay tarjeta: dale la salida
                (PedidosYa) y el canal asistido (WhatsApp) antes de que abandone. */}
            <OrderChannels variant="inline" />

            <Turnstile onToken={handleToken} resetKey={captchaReset} />
            {availability.ready && !availability.accepting && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
                ⚠️ {availability.message}
              </div>
            )}
            {error && <p className="text-sm text-red-600">{error}</p>}

            <button
              type="submit"
              disabled={busy || (availability.ready && !availability.accepting)}
              className="w-full bg-violet-600 text-white font-semibold text-sm py-3.5 rounded-xl hover:bg-violet-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {busy ? "Procesando…" : availability.ready && !availability.accepting ? "Pedidos no disponibles" : "Confirmar orden"}
            </button>
            <p className="text-[11px] text-gray-400 text-center">
              El precio y el delivery se confirman al momento de la entrega.
            </p>
          </div>
        </div>
      </form>
    </div>
  );
}

function PaymentOption({ checked, onSelect, title, subtitle }: {
  checked: boolean; onSelect: () => void; title: string; subtitle: string;
}) {
  return (
    <label
      className={`flex items-start gap-3 rounded-xl border p-3.5 cursor-pointer transition-colors ${
        checked ? "border-violet-500 bg-violet-50/50" : "border-gray-200 hover:bg-gray-50"
      }`}
    >
      <input
        type="radio"
        name="payment_method"
        checked={checked}
        onChange={onSelect}
        className="mt-0.5 accent-violet-600"
      />
      <span>
        <span className="block text-sm font-medium text-gray-900">{title}</span>
        <span className="block text-xs text-gray-500 mt-0.5">{subtitle}</span>
      </span>
    </label>
  );
}

function CashAmountField({ total, value, onChange }: {
  total: number; value: string; onChange: (v: string) => void;
}) {
  const amt = Number(value);
  const valid = value !== "" && Number.isFinite(amt) && amt >= total;
  const low = value !== "" && Number.isFinite(amt) && amt < total;
  return (
    <div className="rounded-xl border border-violet-200 bg-violet-50/40 p-3 space-y-2">
      <label className="block">
        <span className="block text-xs font-medium text-gray-700 mb-1.5">
          ¿Con cuánto vas a pagar? <span className="font-normal text-gray-400">— para llevarte el cambio</span>
        </span>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">RD$</span>
            <input
              type="number"
              inputMode="numeric"
              min={total}
              value={value}
              onChange={(e) => onChange(e.target.value)}
              placeholder={String(Math.max(Math.round(total), 0))}
              className="w-full rounded-xl border border-gray-300 bg-white pl-11 pr-4 py-3 text-sm text-gray-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-violet-500"
            />
          </div>
          <button
            type="button"
            onClick={() => onChange(String(Math.round(total)))}
            className="shrink-0 rounded-xl border border-gray-300 bg-white px-3 text-xs font-semibold text-violet-600 hover:bg-violet-50"
          >
            Exacto
          </button>
        </div>
      </label>
      {valid && (
        <p className="text-xs text-emerald-700">Cambio a llevar: <strong>{formatDOP(amt - total)}</strong></p>
      )}
      {low && (
        <p className="text-xs text-red-600">Debe ser al menos el total ({formatDOP(total)}).</p>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-gray-500">{label}</span>
      <span className="text-gray-900 font-medium text-right">{value}</span>
    </div>
  );
}

function Field({ label, type = "text", value, onChange, required, autoComplete, hint }: {
  label: string; type?: string; value: string; onChange: (v: string) => void; required?: boolean; autoComplete?: string; hint?: string;
}) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-gray-600 mb-1.5">{label}</span>
      <input
        type={type}
        value={value}
        required={required}
        autoComplete={autoComplete}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm text-gray-900 shadow-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-violet-500"
      />
      {hint && <span className="block text-[11px] text-gray-400 mt-1">{hint}</span>}
    </label>
  );
}

function SelectField({ label, value, onChange, options }: {
  label: string; value: string; onChange: (v: string) => void; options: string[];
}) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-gray-600 mb-1.5">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm text-gray-900 shadow-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-violet-500"
      >
        {options.map((o) => (
          <option key={o} value={o}>{o}</option>
        ))}
      </select>
    </label>
  );
}

function ZoneSelect({ zones, value, onChange, waHref }: {
  zones: Zone[]; value: string; onChange: (v: string) => void; waHref: string;
}) {
  // Agrupar por tier preservando el orden Centro → Sur → Periferia.
  const order = ["Centro", "Sur", "Periferia"];
  const tiers = [...new Set(zones.map((z) => z.tier))].sort(
    (a, b) => (order.indexOf(a) + 1 || 99) - (order.indexOf(b) + 1 || 99)
  );
  return (
    <label className="block">
      <span className="block text-xs font-medium text-gray-600 mb-1.5">Sector de entrega</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required
        className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm text-gray-900 shadow-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-violet-500"
      >
        <option value="">Selecciona tu sector…</option>
        {tiers.map((tier) => {
          const group = zones.filter((z) => z.tier === tier);
          const fee = group[0]?.fee ?? 0;
          return (
            <optgroup key={tier} label={fee === 0 ? `${tier} · ENVÍO GRATIS` : `${tier} · RD$${fee}`}>
              {group.map((z) => (
                <option key={z.name} value={z.name}>{z.name}</option>
              ))}
            </optgroup>
          );
        })}
      </select>
      {zones.some((z) => z.fee === 0) && (
        <span className="mt-2 flex items-start gap-2 rounded-lg bg-green-50 px-3 py-2 text-[12px] leading-snug text-green-800 ring-1 ring-green-200">
          <span aria-hidden="true" className="mt-px text-sm">🛵</span>
          <span>
            <strong className="font-bold">Envío GRATIS</strong> en{" "}
            {zones.filter((z) => z.fee === 0).length} sectores del centro de Santiago —
            sin monto mínimo.
          </span>
        </span>
      )}
      <span className="mt-1 block text-[11px] text-gray-400">
        ¿No aparece tu sector?{" "}
        <a href={waHref} target="_blank" rel="noopener noreferrer" className="text-violet-600 underline hover:text-violet-700">
          Escríbenos por WhatsApp
        </a>{" "}
        y coordinamos la entrega.
      </span>
    </label>
  );
}

function TextareaField({ label, value, onChange, hint }: {
  label: string; value: string; onChange: (v: string) => void; hint?: string;
}) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-gray-600 mb-1.5">{label}</span>
      <textarea
        value={value}
        rows={2}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm text-gray-900 shadow-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-violet-500 resize-none"
      />
      {hint && <span className="block text-[11px] text-gray-400 mt-1">{hint}</span>}
    </label>
  );
}

// Selector de direcciones guardadas para el usuario logueado: elige una de la
// libreta o "otra dirección" para escribir una nueva (se guarda al confirmar).
function AddressPicker({ addresses, selectedId, onPick, onNew }: {
  addresses: SavedAddress[]; selectedId: string | "new"; onPick: (a: SavedAddress) => void; onNew: () => void;
}) {
  return (
    <div className="space-y-2">
      <span className="block text-xs font-medium text-gray-600">Elige una dirección guardada</span>
      <div className="space-y-2">
        {addresses.map((a) => {
          const active = selectedId === a.id;
          return (
            <button
              type="button"
              key={a.id}
              onClick={() => onPick(a)}
              className={`w-full rounded-xl border p-3 text-left transition-colors ${
                active
                  ? "border-violet-500 bg-violet-50 ring-1 ring-violet-500"
                  : "border-gray-200 bg-white hover:border-violet-300"
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-gray-900">{a.label}</span>
                {a.is_default && (
                  <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-violet-700">
                    Predeterminada
                  </span>
                )}
              </div>
              <p className="mt-0.5 truncate text-xs text-gray-600">
                {a.line1}{a.line2 ? `, ${a.line2}` : ""}
              </p>
            </button>
          );
        })}
        <button
          type="button"
          onClick={onNew}
          className={`w-full rounded-xl border border-dashed p-3 text-left text-sm transition-colors ${
            selectedId === "new"
              ? "border-violet-500 text-violet-600"
              : "border-gray-300 text-gray-500 hover:border-violet-300"
          }`}
        >
          + Enviar a otra dirección
        </button>
      </div>
      <p className="text-[11px] text-gray-400">
        Puedes editar los campos de abajo; guardamos los cambios en tu libreta.
      </p>
    </div>
  );
}
