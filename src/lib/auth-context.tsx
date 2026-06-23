"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import { getSupabase, isSupabaseConfigured } from "./supabase";

export interface Profile {
  id: string;
  email: string | null;
  full_name: string | null;
  phone: string | null;
  role: "customer" | "staff" | "admin";
  age_verified: boolean;
  marketing_consent: boolean;
  loyalty_points: number;
}

interface AuthState {
  configured: boolean;
  loading: boolean;
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  isAdmin: boolean;
  signInWithPassword: (email: string, password: string, captchaToken?: string) => Promise<{ error: string | null }>;
  signUp: (args: SignUpArgs) => Promise<{ error: string | null; needsConfirmation: boolean }>;
  signInWithMagicLink: (email: string, captchaToken?: string) => Promise<{ error: string | null }>;
  signInWithGoogle: () => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

interface SignUpArgs {
  email: string;
  password: string;
  fullName?: string;
  phone?: string;
  addressLine1?: string;
  addressLine2?: string;
  deliveryNotes?: string;
  addressLabel?: string;
  marketingConsent?: boolean;
  termsAccepted?: boolean;
  captchaToken?: string;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);

  const supabase = getSupabase();

  const loadProfile = useCallback(
    async (userId: string) => {
      if (!supabase) return;
      const { data } = await supabase
        .from("profiles")
        .select("id,email,full_name,phone,role,age_verified,marketing_consent,loyalty_points")
        .eq("id", userId)
        .single();
      setProfile((data as Profile) ?? null);
    },
    [supabase]
  );

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }
    let active = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      if (data.session?.user) loadProfile(data.session.user.id);
      setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      if (newSession?.user) loadProfile(newSession.user.id);
      else setProfile(null);
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, [supabase, loadProfile]);

  const signInWithPassword = useCallback(
    async (email: string, password: string, captchaToken?: string) => {
      if (!supabase) return { error: "Auth no configurado" };
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
        options: captchaToken ? { captchaToken } : undefined,
      });
      return { error: error?.message ?? null };
    },
    [supabase]
  );

  const signUp = useCallback(
    async ({ email, password, fullName, phone, addressLine1, addressLine2, deliveryNotes, addressLabel, marketingConsent, termsAccepted, captchaToken }: SignUpArgs) => {
      if (!supabase) return { error: "Auth no configurado", needsConfirmation: false };
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName ?? "",
            phone: phone ?? "",
            address_line1: addressLine1 ?? "",
            address_line2: addressLine2 ?? "",
            delivery_notes: deliveryNotes ?? "",
            address_label: addressLabel ?? "",
            age_verified: true, // ya pasó el AgeGate 18+ para llegar aquí
            marketing_consent: marketingConsent ?? false,
            terms_accepted: termsAccepted ?? false,
          },
          captchaToken,
          emailRedirectTo:
            typeof window !== "undefined" ? `${window.location.origin}/cuenta/` : undefined,
        },
      });
      return {
        error: error?.message ?? null,
        needsConfirmation: Boolean(data.user && !data.session),
      };
    },
    [supabase]
  );

  const signInWithMagicLink = useCallback(
    async (email: string, captchaToken?: string) => {
      if (!supabase) return { error: "Auth no configurado" };
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          captchaToken,
          emailRedirectTo:
            typeof window !== "undefined" ? `${window.location.origin}/cuenta/` : undefined,
        },
      });
      return { error: error?.message ?? null };
    },
    [supabase]
  );

  const signInWithGoogle = useCallback(async () => {
    if (!supabase) return { error: "Auth no configurado" };
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo:
          typeof window !== "undefined" ? `${window.location.origin}/cuenta/` : undefined,
      },
    });
    return { error: error?.message ?? null };
  }, [supabase]);

  const signOut = useCallback(async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
    setProfile(null);
  }, [supabase]);

  const refreshProfile = useCallback(async () => {
    if (session?.user) await loadProfile(session.user.id);
  }, [session, loadProfile]);

  const value: AuthState = {
    configured: isSupabaseConfigured,
    loading,
    session,
    user: session?.user ?? null,
    profile,
    isAdmin: profile?.role === "admin" || profile?.role === "staff",
    signInWithPassword,
    signUp,
    signInWithMagicLink,
    signInWithGoogle,
    signOut,
    refreshProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth debe usarse dentro de <AuthProvider>");
  return ctx;
}
