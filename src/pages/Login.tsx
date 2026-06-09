import { useState, FormEvent } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { Loader2, MailCheck } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useI18n } from "@/i18n/context";
import { useDashboardT } from "@/i18n/dashboard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const Login = () => {
  const { session, loading, signInWithMagicLink } = useAuth();
  const { locale } = useI18n();
  const dt = useDashboardT(locale);
  const location = useLocation();

  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  // Where to send the user after they click the link — back to whatever
  // protected route they were trying to reach, defaulting to the dashboard.
  const from = (location.state as { from?: string } | null)?.from ?? "/dashboard";

  // Already signed in (e.g. persisted session, or returned from the link) →
  // skip the form entirely.
  if (!loading && session) {
    return <Navigate to={from} replace />;
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const { error: linkError } = await signInWithMagicLink(email.trim());
    setSubmitting(false);
    if (linkError) {
      setError(dt.auth.genericError);
      return;
    }
    // Always show the same confirmation regardless of whether the address has
    // access — avoids leaking which emails are registered.
    setSent(true);
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-xl font-semibold text-foreground tracking-tight">{dt.auth.title}</h1>
          <p className="text-sm text-muted-foreground mt-1">{dt.auth.subtitle}</p>
        </div>

        {sent ? (
          <div className="rounded-lg border border-border bg-secondary/40 p-6 text-center space-y-2">
            <MailCheck className="mx-auto text-foreground" size={24} />
            <p className="text-sm font-medium text-foreground">{dt.auth.linkSentTitle}</p>
            <p className="text-sm text-muted-foreground">{dt.auth.linkSentBody}</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email">{dt.auth.email}</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={submitting}
              />
            </div>

            {error && (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            )}

            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 className="animate-spin" size={16} />
                  {dt.auth.sendingLink}
                </>
              ) : (
                dt.auth.sendLink
              )}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
};

export default Login;
