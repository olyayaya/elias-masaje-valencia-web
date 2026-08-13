import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useHead } from "@/hooks/use-head";

type OAuthNamespace = {
  getAuthorizationDetails: (id: string) => Promise<{ data: any; error: { message: string } | null }>;
  approveAuthorization: (id: string) => Promise<{ data: any; error: { message: string } | null }>;
  denyAuthorization: (id: string) => Promise<{ data: any; error: { message: string } | null }>;
};

const oauth = () => (supabase.auth as unknown as { oauth: OAuthNamespace }).oauth;

const OAuthConsent = () => {
  useHead({
    title: "Autorizar acceso | Elias Masaje",
    description: "Autoriza una aplicación para conectarse a tu cuenta de Elias Masaje.",
    robots: "noindex, nofollow",
    noSocial: true,
  });

  const [params] = useSearchParams();
  const authorizationId = params.get("authorization_id") ?? "";
  const [details, setDetails] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!authorizationId) return setError("Missing authorization_id");
      const { data: sess } = await supabase.auth.getSession();
      if (!sess.session) {
        const next = window.location.pathname + window.location.search;
        window.location.href = "/auth?next=" + encodeURIComponent(next);
        return;
      }
      const { data, error: err } = await oauth().getAuthorizationDetails(authorizationId);
      if (!active) return;
      if (err) return setError(err.message);
      const immediate = data?.redirect_url ?? data?.redirect_to;
      if (immediate && !data?.client) {
        window.location.href = immediate;
        return;
      }
      setDetails(data);
    })();
    return () => {
      active = false;
    };
  }, [authorizationId]);

  const decide = async (approve: boolean) => {
    setBusy(true);
    const { data, error: err } = approve
      ? await oauth().approveAuthorization(authorizationId)
      : await oauth().denyAuthorization(authorizationId);
    if (err) {
      setBusy(false);
      return setError(err.message);
    }
    const target = data?.redirect_url ?? data?.redirect_to;
    if (!target) {
      setBusy(false);
      return setError("No redirect returned by the authorization server.");
    }
    window.location.href = target;
  };

  return (
    <main className="min-h-screen flex items-center justify-center px-4 py-16">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 shadow-sm">
        {error ? (
          <>
            <h1 className="font-display text-2xl text-foreground mb-2">No se pudo cargar la autorización</h1>
            <p className="text-sm text-muted-foreground break-words">{error}</p>
          </>
        ) : !details ? (
          <div className="flex items-center gap-3 text-muted-foreground text-sm">
            <Loader2 className="animate-spin" size={18} /> Cargando…
          </div>
        ) : (
          <>
            <h1 className="font-display text-2xl text-foreground mb-2">
              Conectar {details.client?.name ?? "una aplicación"}
            </h1>
            <p className="text-sm text-muted-foreground mb-6">
              {details.client?.name ?? "Esta aplicación"} podrá usar las herramientas de Elias Masaje en tu nombre
              (reservas, servicios, blog y estadísticas).
            </p>
            <div className="flex gap-3">
              <button
                disabled={busy}
                onClick={() => decide(true)}
                className="flex-1 px-4 py-2.5 rounded-lg bg-foreground text-background text-sm font-medium hover:opacity-90 disabled:opacity-50"
              >
                {busy ? "…" : "Autorizar"}
              </button>
              <button
                disabled={busy}
                onClick={() => decide(false)}
                className="flex-1 px-4 py-2.5 rounded-lg border border-border text-foreground text-sm font-medium hover:bg-secondary disabled:opacity-50"
              >
                Denegar
              </button>
            </div>
          </>
        )}
      </div>
    </main>
  );
};

export default OAuthConsent;
