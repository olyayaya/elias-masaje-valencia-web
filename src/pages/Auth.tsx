import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Loader2, HelpCircle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

type Mode = "signin" | "signup" | "forgot";

const Auth = () => {
  const navigate = useNavigate();
  const { user, isAdmin, loading } = useAuth();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && user && isAdmin) navigate("/dashboard", { replace: true });
  }, [user, isAdmin, loading, navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: `${window.location.origin}/dashboard` },
        });
        if (error) throw error;
        toast.success("Account created. Check your email if confirmation is required.");
      } else if (mode === "forgot") {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) throw error;
        toast.success("If that email is registered, a reset link is on its way.");
        setMode("signin");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Authentication failed");
    } finally {
      setSubmitting(false);
    }
  };

  const title =
    mode === "signin" ? "Sign in to manage your site"
    : mode === "signup" ? "Create your admin account"
    : "Reset your password";

  const cta =
    mode === "signin" ? "Sign in"
    : mode === "signup" ? "Create account"
    : "Send reset link";

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background px-6 py-10">
      <div className="w-full max-w-sm bg-card border border-border rounded-2xl p-8 shadow-sm">
        <div className="mb-6 text-center">
          <h1 className="text-xl font-semibold text-foreground">Elias Masaje</h1>
          <p className="text-xs text-muted-foreground mt-1">{title}</p>
        </div>

        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className="text-xs text-muted-foreground">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full mt-1 px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-foreground"
            />
          </div>
          {mode !== "forgot" && (
            <div>
              <label className="text-xs text-muted-foreground">Password</label>
              <input
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full mt-1 px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-foreground"
              />
            </div>
          )}
          <button
            type="submit"
            disabled={submitting}
            className="w-full flex items-center justify-center gap-2 px-3 py-2.5 text-sm font-medium bg-foreground text-background rounded-lg hover:opacity-90 disabled:opacity-50 transition"
          >
            {submitting && <Loader2 size={14} className="animate-spin" />}
            {cta}
          </button>
        </form>

        <div className="mt-4 space-y-2 text-center">
          {mode === "signin" && (
            <button
              onClick={() => setMode("forgot")}
              className="block w-full text-xs text-muted-foreground hover:text-foreground"
            >
              Forgot your password?
            </button>
          )}
          <button
            onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
            className="block w-full text-xs text-muted-foreground hover:text-foreground"
          >
            {mode === "signin" ? "Need an account? Sign up" : "Already have an account? Sign in"}
          </button>
        </div>

        <div className="mt-6 text-center">
          <Link to="/" className="text-xs text-muted-foreground hover:text-foreground">
            ← Back to site
          </Link>
        </div>
      </div>

      <div className="w-full max-w-sm mt-4 bg-card border border-border rounded-2xl p-5 shadow-sm">
        <div className="flex items-start gap-3">
          <HelpCircle size={18} className="mt-0.5 text-muted-foreground shrink-0" />
          <div>
            <h2 className="text-sm font-medium text-foreground">Admin access guide</h2>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
              Your admin account was created without a password. To enter the dashboard for the first time:
            </p>
            <ol className="mt-3 space-y-2 text-xs text-muted-foreground list-decimal list-inside leading-relaxed">
              <li>Enter your admin email above.</li>
              <li>Click <strong className="text-foreground">Forgot your password?</strong></li>
              <li>Open the reset email and click the link.</li>
              <li>On the reset page, choose a new password.</li>
              <li>You will be signed in and taken to the dashboard.</li>
            </ol>
            <p className="text-xs text-muted-foreground mt-3 leading-relaxed">
              If a reset link says it is invalid or expired, request a fresh one from this page.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Auth;
