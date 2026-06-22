"use client";

import { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { track } from "@/lib/analytics";
import AuthShell from "@/components/AuthShell";
import Turnstile from "@/components/Turnstile";
import GoogleButton from "@/components/GoogleButton";

export default function RegisterPage() {
  const { signUp } = useAuth();
  const [form, setForm] = useState({ fullName: "", email: "", phone: "", password: "" });
  const [consent, setConsent] = useState(false);
  const [terms, setTerms] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [captchaReset, setCaptchaReset] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  function set<K extends keyof typeof form>(k: K, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!terms) { setError("Debes aceptar los Términos y la Política de Privacidad para continuar."); return; }
    if (!token) { setError("Completa la verificación de seguridad."); return; }
    if (form.password.length < 8) { setError("La contraseña debe tener al menos 8 caracteres."); return; }
    setBusy(true);
    const { error, needsConfirmation } = await signUp({
      email: form.email.trim(),
      password: form.password,
      fullName: form.fullName.trim(),
      phone: form.phone.trim(),
      marketingConsent: consent,
      termsAccepted: terms,
      captchaToken: token ?? undefined,
    });
    if (error) { setError(traducir(error)); setToken(null); setCaptchaReset((k) => k + 1); }
    else { track("signup"); setDone(true); void needsConfirmation; }
    setBusy(false);
  }

  return (
    <AuthShell
      title="Crear cuenta"
      subtitle="Guarda tus datos, sigue tus órdenes y acumula puntos."
      footer={
        <>
          ¿Ya tienes cuenta?{" "}
          <Link href="/entrar/" className="text-violet-600 font-semibold hover:text-violet-700">
            Entrar
          </Link>
        </>
      }
    >
      {done ? (
        <div className="rounded-xl bg-green-50 border border-green-200 p-4 text-sm text-green-800">
          ¡Casi listo! Te enviamos un correo a <strong>{form.email}</strong> para confirmar
          tu cuenta. Haz clic en el enlace y vuelve a entrar.
        </div>
      ) : (
        <form onSubmit={onSubmit} className="space-y-4">
          <Field label="Nombre completo" value={form.fullName} onChange={(v) => set("fullName", v)} autoComplete="name" />
          <Field label="Correo electrónico" type="email" value={form.email} onChange={(v) => set("email", v)} required autoComplete="email" />
          <Field label="Teléfono (WhatsApp)" type="tel" value={form.phone} onChange={(v) => set("phone", v)} autoComplete="tel" />
          <Field label="Contraseña" type="password" value={form.password} onChange={(v) => set("password", v)} required autoComplete="new-password" hint="Mínimo 8 caracteres" />

          <label className="flex items-start gap-2.5 text-xs text-gray-600 leading-relaxed">
            <input type="checkbox" checked={terms} onChange={(e) => setTerms(e.target.checked)} className="mt-0.5 accent-violet-600" required />
            <span>
              He leído y acepto los{" "}
              <Link href="/terminos/" target="_blank" className="text-violet-600 underline hover:text-violet-700">Términos de Servicio</Link>{" "}
              y la{" "}
              <Link href="/privacidad/" target="_blank" className="text-violet-600 underline hover:text-violet-700">Política de Privacidad</Link>.
            </span>
          </label>

          <label className="flex items-start gap-2.5 text-xs text-gray-500 leading-relaxed">
            <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5 accent-violet-600" />
            <span>Quiero recibir ofertas y novedades por correo/WhatsApp (opcional).</span>
          </label>

          <Turnstile onToken={setToken} resetKey={captchaReset} />
          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={busy}
            className="w-full bg-violet-600 text-white font-semibold text-sm py-3.5 rounded-xl hover:bg-violet-700 transition-colors disabled:opacity-50"
          >
            {busy ? "Creando cuenta…" : "Crear mi cuenta"}
          </button>
          <p className="text-[11px] text-gray-400 text-center">
            Confirmo que soy mayor de 18 años.
          </p>
          <GoogleButton label="Registrarme con Google" />
        </form>
      )}
    </AuthShell>
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
        className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
      />
      {hint && <span className="block text-[11px] text-gray-400 mt-1">{hint}</span>}
    </label>
  );
}

function traducir(msg: string): string {
  if (/already registered|already exists/i.test(msg)) return "Ese correo ya tiene una cuenta. Intenta entrar.";
  if (/rate limit/i.test(msg)) return "Demasiados intentos. Espera un momento.";
  if (/password/i.test(msg)) return "La contraseña no cumple los requisitos (mínimo 8 caracteres).";
  return msg;
}
