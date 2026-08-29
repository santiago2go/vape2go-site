"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Search, Plus, Minus, Trash2, ShoppingCart, Store, Banknote, CreditCard,
  ArrowRightLeft, Check, X, Loader2, ReceiptText, UserSearch, ScanLine, Printer,
} from "lucide-react";
import { getSupabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { formatDOP, cdnImage, CATEGORIES, type Category } from "@/data/catalog-meta";
import { Card, Spinner, EmptyState, Field, TextInput, Button } from "@/components/backoffice/ui";
import { useBarcodeScanner } from "@/hooks/useBarcodeScanner";

type PosProduct = { sku: string; name: string | null; price: number | null; compare_at_price: number | null; stock: number | null; brand?: string; category?: string; image?: string };
type CartLine = { sku: string; name: string; price: number; qty: number; stock: number };
type PayMethod = "cash" | "card" | "transfer";
type Receipt = { id: string; total: number; items: { name: string; qty: number; unit_price: number }[]; payment_method: string; created_at: string };
type RecentSale = { id: string; created_at: string; customer_name: string | null; total: number; payment_method: string; items: { qty: number }[] | null };
type ProformaData = {
  folio: string | null; createdAt: string; cashier: string;
  items: { name: string; qty: number; unit_price: number }[];
  total: number; payment_method: string; isQuote: boolean;
};

const PAY_OPTS: { id: PayMethod; label: string; icon: React.ComponentType<{ size?: number }> }[] = [
  { id: "cash", label: "Efectivo", icon: Banknote },
  { id: "card", label: "Tarjeta", icon: CreditCard },
  { id: "transfer", label: "Transferencia", icon: ArrowRightLeft },
];

const PAY_LABEL: Record<string, string> = { cash: "Efectivo", card: "Tarjeta", azul: "Tarjeta", transfer: "Transferencia", toke: "Toke" };
const NAP = { name: "VAPE 2 GO", addr: "Plaza Comercial Bolívar, primer piso, Padre Las Casas", wa: "+1 829 722 4238" };

export default function PosPage() {
  const { session, profile } = useAuth();
  const [products, setProducts] = useState<PosProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [brandFilter, setBrandFilter] = useState("");
  const [catFilter, setCatFilter] = useState<Category | "all">("all");

  const [cart, setCart] = useState<CartLine[]>([]);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [pay, setPay] = useState<PayMethod>("cash");
  const [orderType, setOrderType] = useState<"local" | "whatsapp">("local");

  const [submitting, setSubmitting] = useState(false);
  const [lookup, setLookup] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [recent, setRecent] = useState<RecentSale[]>([]);

  const [proforma, setProforma] = useState<ProformaData | null>(null);
  const [mounted, setMounted] = useState(false);
  const [barcodeMap, setBarcodeMap] = useState<Map<string, string>>(new Map());
  const [learn, setLearn] = useState<string | null>(null);
  const [scanToast, setScanToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const toastId = useRef(0);

  const loadProducts = useCallback(async () => {
    const sb = getSupabase();
    if (!sb) { setLoading(false); return; }
    const { data } = await sb
      .from("available_products")
      .select("sku,name,price,compare_at_price,stock")
      .order("name", { ascending: true })
      .limit(2000);
    let rows = (data as PosProduct[]) ?? [];
    // Enriquecer con marca/categoría/imagen del catálogo (para navegar por marca como en la web).
    try {
      const lite = (await import("@/data/products-lite.json")).default as {
        sku: string | number; brand?: string; category?: string; image?: string;
      }[];
      const meta = new Map(lite.map((l) => [String(l.sku), l]));
      rows = rows.map((p) => {
        const m = meta.get(String(p.sku));
        return m ? { ...p, brand: m.brand, category: m.category, image: m.image } : p;
      });
    } catch { /* si el catálogo no carga, el POS sigue con búsqueda por nombre/SKU */ }
    setProducts(rows);
    setLoading(false);
  }, []);

  const loadRecent = useCallback(async () => {
    const sb = getSupabase();
    if (!sb) return;
    // orders_ops = ventana operativa (RLS por rol). Solo el rol operativo obtiene filas.
    const { data } = await sb
      .from("orders_ops")
      .select("id,created_at,customer_name,total,payment_method,items")
      .eq("channel", "TIENDA")
      .order("created_at", { ascending: false })
      .limit(30);
    setRecent((data as RecentSale[]) ?? []);
  }, []);

  const loadBarcodes = useCallback(async () => {
    const sb = getSupabase();
    if (!sb) return;
    try {
      const { data, error } = await sb.from("product_barcodes").select("barcode,sku");
      if (error) return; // 42P01 / RLS → degrada, mapa vacío (POS sigue con búsqueda + match SKU)
      setBarcodeMap(new Map((data ?? []).map((r: { barcode: string; sku: string }) => [String(r.barcode), String(r.sku)])));
    } catch { /* degrada */ }
  }, []);

  useEffect(() => { loadProducts(); loadRecent(); loadBarcodes(); }, [loadProducts, loadRecent, loadBarcodes]);

  // Kiosco: rehidrata el carrito (sobrevive recargas / cortes / redirect por sesión) y lo persiste.
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem("pos_cart_v1");
      if (saved) setCart(JSON.parse(saved) as CartLine[]);
    } catch { /* carrito corrupto: ignora */ }
    setMounted(true);
  }, []);
  useEffect(() => {
    if (!mounted) return;
    try { window.localStorage.setItem("pos_cart_v1", JSON.stringify(cart)); } catch { /* cuota */ }
  }, [cart, mounted]);

  // Limpia el gate de impresión (afterprint no dispara si cancelan el diálogo → respaldo por focus).
  useEffect(() => {
    const clear = () => document.documentElement.removeAttribute("data-printing");
    window.addEventListener("afterprint", clear);
    window.addEventListener("focus", clear);
    return () => { window.removeEventListener("afterprint", clear); window.removeEventListener("focus", clear); };
  }, []);

  const brands = useMemo(() => {
    const counts = new Map<string, number>();
    for (const p of products) if (p.brand) counts.set(p.brand, (counts.get(p.brand) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [products]);

  const bySku = useMemo(() => new Map(products.map((p) => [p.sku, p])), [products]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = products.filter((p) => {
      if (catFilter !== "all" && p.category !== catFilter) return false;
      if (brandFilter && p.brand !== brandFilter) return false;
      if (q && !((p.name ?? "").toLowerCase().includes(q) || p.sku.toLowerCase().includes(q))) return false;
      return true;
    });
    // Sin filtros: limita para no pintar todo de golpe; con filtro: muestra todo (hasta 200).
    const noFilter = !q && !brandFilter && catFilter === "all";
    return noFilter ? list.slice(0, 60) : list.slice(0, 200);
  }, [products, search, brandFilter, catFilter]);

  const total = useMemo(() => cart.reduce((a, l) => a + l.price * l.qty, 0), [cart]);
  const units = useMemo(() => cart.reduce((a, l) => a + l.qty, 0), [cart]);

  function addToCart(p: PosProduct) {
    const price = Number(p.price) || 0;
    const stock = Number(p.stock) || 0;
    if (price <= 0 || stock <= 0) return;
    setCart((prev) => {
      const i = prev.findIndex((l) => l.sku === p.sku);
      if (i >= 0) {
        const line = prev[i];
        if (line.qty >= stock) return prev; // no exceder stock
        const next = [...prev];
        next[i] = { ...line, qty: line.qty + 1 };
        return next;
      }
      return [...prev, { sku: p.sku, name: p.name ?? p.sku, price, qty: 1, stock }];
    });
  }

  function flash(msg: string, ok: boolean) {
    const id = ++toastId.current;
    setScanToast({ msg, ok });
    window.setTimeout(() => { if (toastId.current === id) setScanToast(null); }, 1600);
  }

  // Escáner: resuelve un código a producto y lo agrega al carrito, o abre el modo aprendizaje.
  const addByBarcode = useCallback((raw: string) => {
    const code = raw.trim();
    if (!code) return;
    // El lector tipea el código en el input enfocado (buscador / nombre / celular / correo):
    // quítalo de donde haya caído y saca el foco para que el próximo escaneo no ensucie ningún campo.
    const strip = (v: string) => (v.endsWith(code) ? v.slice(0, -code.length) : v);
    setSearch(strip); setName(strip); setPhone(strip); setEmail(strip);
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    let prod = bySku.get(code);                       // 1) el código YA es un SKU (~23% EAN)
    if (!prod) { const sku = barcodeMap.get(code); if (sku) prod = bySku.get(sku); } // 2) mapa aprendido
    if (prod) {
      const stock = Number(prod.stock) || 0, price = Number(prod.price) || 0;
      if (stock <= 0 || price <= 0) { flash(`${prod.name ?? prod.sku}: sin stock`, false); return; }
      addToCart(prod);
      flash(`✓ ${prod.name ?? prod.sku}`, true);
      return;
    }
    setLearn(code);                                   // 3) desconocido → aprendizaje
    flash(`Código no reconocido: ${code}`, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bySku, barcodeMap]);

  async function teachBarcode(barcode: string, prod: PosProduct) {
    setBarcodeMap((m) => new Map(m).set(barcode, prod.sku)); // optimista
    addToCart(prod);
    setLearn(null);
    flash(`✓ ${prod.name ?? prod.sku} (código guardado)`, true);
    const sb = getSupabase();
    if (!sb) return;
    try {
      const uid = session?.user?.id ?? null;
      const { error } = await sb.from("product_barcodes").upsert({ barcode, sku: prod.sku, created_by: uid }, { onConflict: "barcode" });
      if (error) flash("No se guardó el mapeo (venta OK igual)", false);
    } catch { /* la venta sigue; el mapeo se reintenta la próxima */ }
  }

  function setQty(sku: string, delta: number) {
    setCart((prev) =>
      prev.flatMap((l) => {
        if (l.sku !== sku) return [l];
        const q = Math.max(0, Math.min(l.stock, l.qty + delta));
        return q === 0 ? [] : [{ ...l, qty: q }];
      })
    );
  }

  function removeLine(sku: string) {
    setCart((prev) => prev.filter((l) => l.sku !== sku));
  }

  async function lookupCustomer() {
    const sb = getSupabase();
    const p = phone.replace(/[^\d]/g, "");
    if (!sb || p.length < 7) return;
    setLookup(true);
    const { data } = await sb.rpc("pos_lookup_customer", { p_phone: phone.trim() });
    const hit = Array.isArray(data) ? (data[0] as { customer_name: string | null } | undefined) : undefined;
    if (hit?.customer_name && !name.trim()) setName(hit.customer_name);
    setLookup(false);
  }

  async function cobrar() {
    setError(null);
    if (cart.length === 0) { setError("Agrega al menos un producto."); return; }
    if (!name.trim()) { setError("Escribe el nombre del cliente."); return; }
    const token = session?.access_token;
    if (!token) { setError("Tu sesión expiró. Vuelve a entrar."); return; }

    setSubmitting(true);
    try {
      const res = await fetch("/.netlify/functions/pos-order", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
        body: JSON.stringify({
          items: cart.map((l) => ({ sku: l.sku, qty: l.qty })),
          customer: { name: name.trim(), phone: phone.trim() || null, email: email.trim() || null },
          payment_method: pay,
          channel: orderType === "whatsapp" ? "WHATSAPP" : "TIENDA",
        }),
      });
      const j = await res.json();
      if (!res.ok || !j.ok) { setError(j?.error || "No pudimos registrar la venta."); setSubmitting(false); return; }
      setReceipt(j.receipt as Receipt);
      setCart([]); setName(""); setPhone(""); setEmail(""); setPay("cash"); setOrderType("local");
      loadRecent();
      loadProducts();
    } catch {
      setError("Error de red. Revisa la conexión e intenta de nuevo.");
    }
    setSubmitting(false);
  }

  // -------- Proforma (impresión térmica 80mm por el navegador) --------
  function launchPrint(data: ProformaData) {
    setProforma(data);
    requestAnimationFrame(() => {
      document.documentElement.setAttribute("data-printing", "proforma");
      window.print();
      // NOTA: la gaveta de efectivo NO se abre desde el navegador. Es un comando ESC/POS
      // (kick RJ11, 0x1B 0x70…) que enviará el futuro agente/.exe local o WebSerial.
      window.setTimeout(() => document.documentElement.removeAttribute("data-printing"), 800);
    });
  }
  function printQuote() {
    if (cart.length === 0) return;
    launchPrint({
      folio: null, createdAt: new Date().toISOString(), cashier: profile?.full_name || "Mostrador",
      items: cart.map((l) => ({ name: l.name, qty: l.qty, unit_price: l.price })),
      total, payment_method: pay, isQuote: true,
    });
  }
  function printReceipt() {
    if (!receipt) return;
    launchPrint({
      folio: receipt.id, createdAt: receipt.created_at, cashier: profile?.full_name || "Mostrador",
      items: receipt.items, total: Number(receipt.total) || 0, payment_method: receipt.payment_method, isQuote: false,
    });
  }

  // Escáner keyboard-wedge (desactivado mientras hay recibo o modal de aprendizaje abierto).
  useBarcodeScanner({ onScan: addByBarcode, enabled: !receipt && !learn });

  if (loading) return <Spinner label="Cargando el mostrador…" />;

  return (
    <div className="space-y-5">
      {/* Encabezado */}
      <div className="flex items-center gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-violet-100 text-violet-600">
          <Store size={20} />
        </span>
        <div>
          <h1 className="text-lg font-semibold text-slate-800">Mostrador · Nueva venta</h1>
          <p className="text-xs text-slate-500">Vende en la tienda. Descuenta el mismo inventario y queda registrada al instante.</p>
        </div>
        <span className="ml-auto hidden rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-500 sm:inline-flex">
          {profile?.full_name || "Caja"} · {profile?.role}
        </span>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_380px]">
        {/* -------- Catálogo / picker -------- */}
        <div className="space-y-3">
          <div className="relative">
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar producto por nombre o SKU…"
              className="w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm text-slate-800 shadow-sm outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-500/30"
            />
          </div>

          {/* Filtros: categoría + marca (navegar el catálogo como en la web) */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex flex-wrap gap-1.5">
              {(["all", ...CATEGORIES.map((c) => c.id)] as (Category | "all")[]).map((c) => {
                const active = catFilter === c;
                const label = c === "all" ? "Todo" : CATEGORIES.find((x) => x.id === c)?.label ?? c;
                return (
                  <button
                    key={c}
                    onClick={() => setCatFilter(c)}
                    className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                      active ? "bg-violet-600 text-white" : "bg-white text-slate-500 ring-1 ring-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
            <select
              value={brandFilter}
              onChange={(e) => setBrandFilter(e.target.value)}
              className="ml-auto rounded-lg border border-slate-200 bg-white py-2 pl-3 pr-8 text-xs font-medium text-slate-700 shadow-sm outline-none focus:border-violet-400"
            >
              <option value="">Todas las marcas</option>
              {brands.map(([b, n]) => (
                <option key={b} value={b}>{b} ({n})</option>
              ))}
            </select>
            {(brandFilter || catFilter !== "all") && (
              <button
                onClick={() => { setBrandFilter(""); setCatFilter("all"); }}
                className="rounded-lg px-2 py-1.5 text-xs font-medium text-slate-400 hover:text-slate-700"
              >
                Limpiar
              </button>
            )}
          </div>

          {filtered.length === 0 ? (
            <EmptyState icon={<Search size={26} />} title="Sin resultados" hint="Prueba otro nombre o SKU." />
          ) : (
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
              {filtered.map((p) => {
                const price = Number(p.price) || 0;
                const stock = Number(p.stock) || 0;
                const strike = (p.compare_at_price ?? 0) > price;
                const inCart = cart.find((l) => l.sku === p.sku)?.qty ?? 0;
                return (
                  <button
                    key={p.sku}
                    onClick={() => addToCart(p)}
                    disabled={stock <= 0 || price <= 0}
                    className="group relative flex flex-col rounded-xl border border-slate-200 bg-white p-3 text-left shadow-sm transition hover:border-violet-300 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {inCart > 0 && (
                      <span className="absolute right-2 top-2 grid h-5 min-w-5 place-items-center rounded-full bg-violet-600 px-1 text-[11px] font-bold text-white tabular-nums">
                        {inCart}
                      </span>
                    )}
                    {p.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={cdnImage(p.image, 160)!} alt="" loading="lazy" className="mb-2 h-20 w-full rounded-lg bg-slate-50 object-contain" />
                    ) : (
                      <div className="mb-2 grid h-20 w-full place-items-center rounded-lg bg-slate-50 text-slate-300">
                        <Store size={20} />
                      </div>
                    )}
                    <span className="line-clamp-2 min-h-[2.4em] text-[13px] font-medium leading-snug text-slate-800">{p.name || p.sku}</span>
                    <span className="mt-1.5 flex items-baseline gap-1.5">
                      <span className="text-sm font-bold tabular-nums text-slate-900">{formatDOP(price)}</span>
                      {strike && <span className="text-[11px] text-slate-400 line-through">{formatDOP(p.compare_at_price ?? 0)}</span>}
                    </span>
                    <span className="mt-1 text-[11px] tabular-nums text-slate-400">{stock} en stock</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* -------- Ticket -------- */}
        <div className="space-y-4">
          <Card className="flex flex-col overflow-hidden">
            <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3">
              <ShoppingCart size={16} className="text-violet-500" />
              <span className="text-sm font-semibold text-slate-800">Ticket</span>
              {units > 0 && (
                <span className="ml-auto rounded-full bg-violet-100 px-2 py-0.5 text-[11px] font-semibold text-violet-700 tabular-nums">
                  {units} {units === 1 ? "unidad" : "unidades"}
                </span>
              )}
            </div>

            {cart.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-slate-400">Toca un producto para agregarlo.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {cart.map((l) => (
                  <li key={l.sku} className="flex items-center gap-2 px-4 py-2.5">
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-medium leading-snug text-slate-800">{l.name}</p>
                      <p className="text-[11px] tabular-nums text-slate-400">{formatDOP(l.price)} c/u</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button onClick={() => setQty(l.sku, -1)} className="grid h-9 w-9 place-items-center rounded-md border border-slate-200 text-slate-500 hover:bg-slate-50" aria-label="Menos">
                        <Minus size={13} />
                      </button>
                      <span className="w-6 text-center text-sm font-semibold tabular-nums text-slate-800">{l.qty}</span>
                      <button onClick={() => setQty(l.sku, +1)} disabled={l.qty >= l.stock} className="grid h-9 w-9 place-items-center rounded-md border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-40" aria-label="Más">
                        <Plus size={13} />
                      </button>
                    </div>
                    <span className="w-20 text-right text-[13px] font-semibold tabular-nums text-slate-900">{formatDOP(l.price * l.qty)}</span>
                    <button onClick={() => removeLine(l.sku)} className="grid h-9 w-9 place-items-center rounded-md text-slate-300 hover:bg-rose-50 hover:text-rose-500" aria-label="Quitar">
                      <Trash2 size={13} />
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50/60 px-4 py-3">
              <span className="text-sm font-medium text-slate-500">Total</span>
              <span className="text-xl font-bold tabular-nums text-slate-900">{formatDOP(total)}</span>
            </div>
          </Card>

          {/* Tipo de pedido: mostrador (cobra + entrega ya) o WhatsApp (pendiente de entrega) */}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setOrderType("local")}
              className={`flex items-center justify-center gap-1.5 rounded-xl border px-3 py-2.5 text-sm font-semibold transition ${
                orderType === "local" ? "border-violet-500 bg-violet-50 text-violet-700 ring-1 ring-violet-500/30" : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
              }`}
            >
              🏪 En el local
            </button>
            <button
              type="button"
              onClick={() => setOrderType("whatsapp")}
              className={`flex items-center justify-center gap-1.5 rounded-xl border px-3 py-2.5 text-sm font-semibold transition ${
                orderType === "whatsapp" ? "border-emerald-500 bg-emerald-50 text-emerald-700 ring-1 ring-emerald-500/30" : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
              }`}
            >
              📱 WhatsApp
            </button>
          </div>
          {orderType === "whatsapp" && (
            <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-[11px] leading-relaxed text-emerald-700">
              Pedido para <b>entrega</b>: queda <b>pendiente</b> (no cobrado), suena en el panel y el correo sale marcado como WhatsApp. Coordina la entrega con el cliente.
            </p>
          )}

          {/* Cliente */}
          <Card className="space-y-3 p-4">
            <Field label="Nombre del cliente">
              <TextInput value={name} onChange={setName} placeholder="Nombre y apellido" />
            </Field>
            <Field label="Celular (opcional — para su historial)">
              <div className="flex gap-2">
                <div className="flex-1"><TextInput value={phone} onChange={setPhone} placeholder="809-000-0000" type="tel" /></div>
                <Button variant="secondary" size="sm" onClick={lookupCustomer} disabled={lookup || phone.replace(/[^\d]/g, "").length < 7} title="Buscar cliente por su número">
                  {lookup ? <Loader2 size={14} className="animate-spin" /> : <UserSearch size={14} />}
                </Button>
              </div>
            </Field>
            <Field label="Correo (opcional)">
              <TextInput value={email} onChange={setEmail} placeholder="cliente@correo.com" type="email" />
            </Field>
          </Card>

          {/* Pago */}
          <div className="grid grid-cols-3 gap-2">
            {PAY_OPTS.map((o) => {
              const Icon = o.icon;
              const active = pay === o.id;
              return (
                <button
                  key={o.id}
                  onClick={() => setPay(o.id)}
                  className={`flex flex-col items-center gap-1 rounded-xl border px-2 py-3 text-xs font-semibold transition ${
                    active ? "border-violet-500 bg-violet-50 text-violet-700 ring-1 ring-violet-500/30" : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
                  }`}
                >
                  <Icon size={18} />
                  {o.label}
                </button>
              );
            })}
          </div>

          {error && (
            <div className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700">
              <X size={14} className="mt-0.5 shrink-0" />
              <span className="flex-1">{error}</span>
            </div>
          )}

          <Button variant="success" onClick={cobrar} disabled={submitting || cart.length === 0} className="w-full py-3 text-base">
            {submitting ? <><Loader2 size={18} className="animate-spin" /> Registrando…</> : <><Check size={18} /> {orderType === "whatsapp" ? "Registrar pedido" : "Cobrar"} {formatDOP(total)}</>}
          </Button>
          <Button variant="secondary" onClick={printQuote} disabled={cart.length === 0} className="w-full">
            <Printer size={16} /> Proforma / Cotización
          </Button>
        </div>
      </div>

      {/* Ventas recientes */}
      {recent.length > 0 && (
        <Card className="overflow-hidden">
          <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3">
            <ReceiptText size={16} className="text-slate-400" />
            <span className="text-sm font-semibold text-slate-800">Ventas recientes de la tienda</span>
          </div>
          <ul className="divide-y divide-slate-100">
            {recent.map((s) => (
              <li key={s.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                <span className="tabular-nums text-slate-400">{new Date(s.created_at).toLocaleTimeString("es-DO", { hour: "2-digit", minute: "2-digit" })}</span>
                <span className="min-w-0 flex-1 truncate font-medium text-slate-700">{s.customer_name || "Cliente"}</span>
                <span className="text-[11px] text-slate-400">{PAY_LABEL[s.payment_method] ?? s.payment_method}</span>
                <span className="text-[11px] tabular-nums text-slate-400">{(s.items ?? []).reduce((a, i) => a + (Number(i.qty) || 0), 0)} u</span>
                <span className="w-24 text-right font-semibold tabular-nums text-slate-800">{formatDOP(Number(s.total) || 0)}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* Recibo (modal) */}
      {receipt && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/50 p-4" onClick={() => setReceipt(null)}>
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-full bg-emerald-100 text-emerald-600">
              <Check size={26} />
            </div>
            <h2 className="text-center text-lg font-semibold text-slate-800">Venta registrada</h2>
            <p className="mt-0.5 text-center text-xs text-slate-400">Ticket #{receipt.id.slice(0, 8).toUpperCase()}</p>

            <ul className="mt-4 max-h-52 space-y-1 overflow-y-auto border-y border-slate-100 py-3 text-sm">
              {receipt.items.map((it, k) => (
                <li key={k} className="flex justify-between gap-2">
                  <span className="min-w-0 text-slate-600">{it.qty}× {it.name}</span>
                  <span className="tabular-nums text-slate-500">{formatDOP((Number(it.unit_price) || 0) * (Number(it.qty) || 0))}</span>
                </li>
              ))}
            </ul>

            <div className="mt-3 flex items-center justify-between">
              <span className="text-sm text-slate-500">{PAY_LABEL[receipt.payment_method] ?? receipt.payment_method}</span>
              <span className="text-xl font-bold tabular-nums text-slate-900">{formatDOP(Number(receipt.total) || 0)}</span>
            </div>

            <Button variant="secondary" onClick={printReceipt} className="mt-4 w-full">
              <Printer size={16} /> Imprimir proforma
            </Button>
            <Button variant="primary" onClick={() => setReceipt(null)} className="mt-2 w-full">
              Nueva venta
            </Button>
          </div>
        </div>
      )}

      {/* Toast del escáner */}
      {scanToast && (
        <div className={`fixed bottom-5 left-1/2 z-[80] -translate-x-1/2 rounded-full px-4 py-2 text-sm font-semibold text-white shadow-lg ${scanToast.ok ? "bg-emerald-600" : "bg-rose-600"}`}>
          {scanToast.msg}
        </div>
      )}

      {/* Modo aprendizaje: código nuevo → elige el producto (se guarda para la próxima) */}
      {learn && (
        <LearnModal barcode={learn} products={products} onClose={() => setLearn(null)} onPick={(p) => teachBarcode(learn, p)} />
      )}

      {/* Proforma imprimible (portal a body para escapar del chrome del BO) */}
      {mounted && proforma && createPortal(<ProformaSheet data={proforma} />, document.body)}
    </div>
  );
}

function LearnModal({ barcode, products, onClose, onPick }: {
  barcode: string; products: PosProduct[]; onClose: () => void; onPick: (p: PosProduct) => void;
}) {
  const [q, setQ] = useState("");
  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    const base = products.filter((p) => (Number(p.stock) || 0) > 0 && (Number(p.price) || 0) > 0);
    if (!s) return base.slice(0, 30);
    return base.filter((p) =>
      (p.name ?? "").toLowerCase().includes(s) || p.sku.toLowerCase().includes(s) || (p.brand ?? "").toLowerCase().includes(s)
    ).slice(0, 60);
  }, [products, q]);
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/50 p-4" onClick={onClose}>
      <div className="flex max-h-[85vh] w-full max-w-lg flex-col rounded-2xl bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-amber-100 text-amber-600"><ScanLine size={18} /></span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-slate-800">Código nuevo: <span className="font-mono">{barcode}</span></p>
            <p className="text-xs text-slate-500">Elige a qué producto pertenece.</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"><X size={18} /></button>
        </div>
        <div className="relative my-3">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nombre, marca o SKU…"
            className="w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm outline-none focus:border-violet-400" />
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {list.length === 0 ? (
            <EmptyState icon={<Search size={26} />} title="Sin resultados" hint="Prueba otro nombre." />
          ) : (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {list.map((p) => (
                <button key={p.sku} onClick={() => onPick(p)}
                  className="flex flex-col rounded-xl border border-slate-200 bg-white p-2.5 text-left hover:border-violet-300 hover:shadow-sm">
                  {p.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={cdnImage(p.image, 160)!} alt="" loading="lazy" className="mb-1.5 h-16 w-full rounded-lg bg-slate-50 object-contain" />
                  ) : (
                    <div className="mb-1.5 grid h-16 w-full place-items-center rounded-lg bg-slate-50 text-slate-300"><Store size={18} /></div>
                  )}
                  <span className="line-clamp-2 text-[12px] font-medium leading-snug text-slate-800">{p.name || p.sku}</span>
                  <span className="mt-0.5 text-xs font-bold text-slate-900">{formatDOP(Number(p.price) || 0)}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ProformaSheet({ data }: { data: ProformaData }) {
  const when = new Date(data.createdAt).toLocaleString("es-DO", { dateStyle: "short", timeStyle: "short" });
  return (
    <div id="pos-proforma">
      <div className="pf-brand">{NAP.name}</div>
      <div className="pf-muted">{NAP.addr}</div>
      <div className="pf-muted">WhatsApp {NAP.wa}</div>
      <hr className="pf-hr" />
      <div className="pf-row"><span>{data.isQuote ? "COTIZACIÓN" : "PROFORMA"}</span><span>{when}</span></div>
      {data.folio && <div className="pf-row"><span>Folio</span><span>#{data.folio.slice(0, 8).toUpperCase()}</span></div>}
      <div className="pf-row"><span>Cajera</span><span>{data.cashier}</span></div>
      <hr className="pf-hr" />
      {data.items.map((it, i) => (
        <div key={i}>
          <div className="pf-item-name">{it.name}</div>
          <div className="pf-row">
            <span>{it.qty} × {formatDOP(it.unit_price)}</span>
            <span className="pf-item-sub">{formatDOP(it.unit_price * it.qty)}</span>
          </div>
        </div>
      ))}
      <hr className="pf-hr" />
      <div className="pf-row pf-total"><span>TOTAL</span><span>{formatDOP(data.total)}</span></div>
      <div className="pf-row"><span>Pago</span><span>{PAY_LABEL[data.payment_method] ?? data.payment_method}</span></div>
      {data.isQuote && <div className="pf-muted">* Cotización — no descuenta inventario.</div>}
      <hr className="pf-hr" />
      <div className="pf-legal">PROFORMA — no es comprobante fiscal con valor tributario. Válida mientras se formaliza la facturación.</div>
      <div className="pf-muted" style={{ marginTop: 6 }}>¡Gracias por su compra!</div>
    </div>
  );
}
