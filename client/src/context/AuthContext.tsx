import type { Session, User } from "@supabase/supabase-js";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "../lib/supabase";

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  isTenant: boolean;
  tenantId: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function friendlyAuthError(message: string): string {
  if (message.includes("Invalid login credentials")) return "Email ou senha inválidos";
  return message;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function resolveTenantId(user: User | null) {
    if (!user) return null;
    const { data } = await supabase
      .from("tenant_accounts")
      .select("tenant_id")
      .eq("user_id", user.id)
      .maybeSingle();
    return data?.tenant_id ?? null;
  }

  useEffect(() => {
    let cancelled = false;

    supabase.auth.getSession().then(async ({ data }) => {
      const tid = await resolveTenantId(data.session?.user ?? null);
      if (cancelled) return;
      setSession(data.session);
      setTenantId(tid);
      setLoading(false);
    });

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setLoading(true);
      resolveTenantId(newSession?.user ?? null).then((tid) => {
        if (cancelled) return;
        setSession(newSession);
        setTenantId(tid);
        setLoading(false);
      });
    });

    return () => {
      cancelled = true;
      subscription.subscription.unsubscribe();
    };
  }, []);

  async function login(email: string, password: string) {
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw new Error(friendlyAuthError(error.message));
      const tid = await resolveTenantId(data.session?.user ?? null);
      setSession(data.session);
      setTenantId(tid);
    } finally {
      setLoading(false);
    }
  }

  async function logout() {
    await supabase.auth.signOut();
    setSession(null);
    setTenantId(null);
  }

  return (
    <AuthContext.Provider
      value={{
        user: session?.user ?? null,
        loading,
        isTenant: tenantId !== null,
        tenantId,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth deve ser usado dentro de AuthProvider");
  return ctx;
}
