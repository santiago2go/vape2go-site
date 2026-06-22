"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { track } from "@/lib/analytics";
import AuthShell from "@/components/AuthShell";
import GoogleButton from "@/components/GoogleButton";
import Turnstile from "@/components/Turnstile";

export default function LoginPage() {
  const { signInWithPassword, signInWithMagicLink, session, loading } = useAuth();
  const router = useRouter();
  const [mode, setMode] = useState<"password" | "magic">("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [token, setToken] = useState<string | null>(null);
  const [captchaReset, setCaptchaReset] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && session) router.replace("/cuenta/");
  }, [loading, session, router]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!token) { setError("Completa la verificación de seguridad."); return; }
    setBusy(true);
    if (mode === "password") {
      const { error } = await signInWithPassword(email.trim(), password, token);
      if (error) { setError(traducir(error)); setToken(null); setCaptchaReset((k) => k + 1); }
      else {
        track("login");
        router.replace("/cuenta/");
      }
    } else {
      const { error } = await signInWithMagicLink(email.trim(), token);
      if (error) { setError(traducir(error)); setToken(null); setCaptchaReset((k) => k + 1); }
      else setSent(true);
    }
    setBusy(false);
  }

  return (
    <AuthShell
      title="Entrar"
      subtitle="Accede a tu cuenta, tus órdenes y tus puntos."
      footer={
        <>
          ¿No tienes cuenta?{" "}
          <Link href="/registro/" className="text-violet-600 font-semibold hover:text-violet-700">
            Crear cuenta
          </Link>
        </>
      }
    >
      {sent ? (
        <div className="rounded-xl bg-green-50 border border-green-200 p-4 text-sm text-green-800">
          Te enviamos un enlace de acceso a <strong>{email}</strong>. Revisa tu correo.
        </div>
      ) : (
        <form onSubmit={onSubmit} className="space-y-4">
          <Field label="Correo electrónico" type="email" value={email} onChange={setEmail} required autoComplete="email" />
          {mode === "password" && (
            <Field label="Contraseña" type="password" value={password} onChange={setPassword} required autoComplete="current-password" />
          )}
          <Turnstile onToken={setToken} resetKey={captchaReset} />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={busy}
            className="w-full bg-violet-600 text-white font-semibold text-sm py-3.5 rounded-xl hover:bg-violet-700 transition-colors disabled:opacity-50"
          >
            {busy ? "Un momento…" : mode === "password" ? "Entrar" : "Enviar enlace de acceso"}
          </button>
          <button
            type="button"
            onClick={() => { setMode(mode === "password" ? "magic" : "password"); setError(null); }}
            className="w-full text-xs text-gray-500 hover:text-gray-700 transition-colors"
          >
            {mode === "password" ? "Prefiero un enlace mágico por correo" : "Prefiero usar contraseña"}
          </button>
          <GoogleButton label="Entrar con Google" />
        </form>
      )}
    </AuthShell>
  );
}

function Field({ label, type, value, onChange, required, autoComplete }: {
  label: string; type: string; value: string; onChange: (v: string) => void; required?: boolean; autoComplete?: string;
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
    </label>
  );
}

function traducir(msg: string): string {
  if (/invalid login credentials/i.test(msg)) return "Correo o contraseña incorrectos.";
  if (/email not confirmed/i.test(msg)) return "Confirma tu correo antes de entrar (revisa tu bandeja).";
  if (/rate limit/i.test(msg)) return "Demasiados intentos. Espera un momento e intenta de nuevo.";
  return msg;
}
