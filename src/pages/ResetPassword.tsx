import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useHead } from "@/hooks/use-head";

const ResetPassword = () => {
  useHead({
    title: "Restablecer contraseña | Elias Masaje",
    description: "Restablece la contraseña de tu cuenta de administración.",
    robots: "noindex, nofollow",
    noSocial: true,
  });
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    // Supabase parses the recovery token from the URL hash and emits
    // a PASSWORD_RECOVERY event. We only allow updating the password
    // after that event (or if a recovery session is already active).
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setReady(true);
    });

    // If user lands without a recovery hash, check for an existing session
    // so they can still update their password if signed in.
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session && window.location.hash.includes("type=recovery")) setReady(true);
    });

    // Allow the form to render even without the event firing yet — Supabase
    // sets the session synchronously from the hash on this page load.
    const t = setTimeout(() => setReady(true), 500);

    return () => {
      subscription.unsubscribe();
      clearTimeout(t);
    };
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) {
      toast.error("Passwords do not match");
      return;
    }
    setSubmitting(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast.success("Password updated. You're signed in.");
      navigate("/dashboard", { replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update password");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-6">
      <div className="w-full max-w-sm bg-card border border-border rounded-2xl p-8 shadow-sm">
        <div className="mb-6 text-center">
          <h1 className="text-xl font-semibold text-foreground">Set a new password</h1>
          <p className="text-xs text-muted-foreground mt-1">
            Enter and confirm your new password.
          </p>
        </div>

        {!ready ? (
          <div className="flex justify-center py-6">
            <Loader2 className="animate-spin text-muted-foreground" size={20} />
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-3">
            <div>
              <label className="text-xs text-muted-foreground">New password</label>
              <input
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full mt-1 px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-foreground"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Confirm password</label>
              <input
                type="password"
                required
                minLength={8}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="w-full mt-1 px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-foreground"
              />
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="w-full flex items-center justify-center gap-2 px-3 py-2.5 text-sm font-medium bg-foreground text-background rounded-lg hover:opacity-90 disabled:opacity-50 transition"
            >
              {submitting && <Loader2 size={14} className="animate-spin" />}
              Update password
            </button>
          </form>
        )}

        <div className="mt-6 text-center">
          <Link to="/auth" className="text-xs text-muted-foreground hover:text-foreground">
            ← Back to sign in
          </Link>
        </div>
      </div>
    </div>
  );
};

export default ResetPassword;
