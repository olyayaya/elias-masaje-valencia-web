import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

interface AuthContextType {
  /** The current Supabase session, or null when signed out. */
  session: Session | null;
  user: User | null;
  /** True until the initial session lookup resolves — gate redirects on this. */
  loading: boolean;
  /**
   * Send a magic sign-in link to `email`. Only an already-created user can sign
   * in (shouldCreateUser: false) — there is no public self-signup.
   */
  signInWithMagicLink: (email: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    // Seed from any persisted session, then keep in sync. onAuthStateChange
    // also fires on sign-in/out and token refresh, so the UI reacts without
    // a reload.
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      if (!mounted) return;
      setSession(next);
      setLoading(false);
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const signInWithMagicLink = async (email: string) => {
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        // Land back on the dashboard; supabase-js (detectSessionInUrl) exchanges
        // the link's token for a session on arrival.
        emailRedirectTo: `${window.location.origin}/dashboard`,
        // Only an existing user (the owner) can sign in — no self-signup.
        shouldCreateUser: false,
      },
    });
    return { error: error?.message ?? null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ session, user: session?.user ?? null, loading, signInWithMagicLink, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};
