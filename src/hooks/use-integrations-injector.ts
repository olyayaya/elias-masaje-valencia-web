import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useConsent } from "@/hooks/use-consent";
import { initSentry, cacheSentryDsn } from "@/lib/sentry";

/**
 * Reads integration codes from site_content (category = "integrations") and
 * injects the matching tracking / verification tags into the document head.
 *
 * Mounted once at the app root so codes go live across every public page as
 * soon as the user pastes them in the dashboard.
 *
 * Consent gating:
 *  - GA4 + GTM (tracking) are injected only when the visitor has granted
 *    "analytics" consent via ConsentBanner.
 *  - Verification meta tags (Search Console, Google Workspace) are not
 *    tracking and always inject.
 *
 * The static GA4 tag in index.html stays loaded but runs in Google Consent
 * Mode v2 default-denied until the banner publishes an update.
 */
export function useIntegrationsInjector() {
  const consent = useConsent();
  const analyticsGranted = !!consent?.categories.analytics;

  useEffect(() => {
    const cleanup: Array<() => void> = [];

    const inject = async () => {
      const { data } = await supabase
        .from("site_content")
        .select("content_key, value_es")
        .eq("category", "integrations");
      if (!data) return;

      const map: Record<string, string> = {};
      data.forEach((r: { content_key: string; value_es: string | null }) => {
        if (r.value_es?.trim()) map[r.content_key] = r.value_es.trim();
      });

      // ── Sentry error reporting ─────────────────────────────────────────
      // Not tracking / no PII — always initialised, including on /dashboard,
      // so integration failures and blank-screen crashes are reported.
      const sentryDsn = map.integration_sentry_dsn || null;
      cacheSentryDsn(sentryDsn);
      initSentry(sentryDsn);

      // Don't run analytics in the editor preview / dashboard
      if (window.location.pathname.startsWith("/dashboard")) return;

      // ── Google Analytics 4 ─────────────────────────────────────────────
      // Prefer the connected Google Analytics connector; fall back to the
      // dashboard setting so existing setups keep working.
      const connectorGa4 = import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_ANALYTICS_API_KEY?.trim();
      const ga4 = connectorGa4 || map.integration_ga4_id;
      if (analyticsGranted && ga4 && /^G-[A-Z0-9]+$/i.test(ga4)) {
        const s1 = document.createElement("script");
        s1.async = true;
        s1.src = `https://www.googletagmanager.com/gtag/js?id=${ga4}`;
        document.head.appendChild(s1);
        const s2 = document.createElement("script");
        s2.text = `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${ga4}');`;
        document.head.appendChild(s2);
        cleanup.push(() => { s1.remove(); s2.remove(); });
      }

      // ── Google Tag Manager ─────────────────────────────────────────────
      const gtm = map.integration_gtm_id;
      if (analyticsGranted && gtm && /^GTM-[A-Z0-9]+$/i.test(gtm)) {
        const s = document.createElement("script");
        s.text = `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${gtm}');`;
        document.head.appendChild(s);

        // Check for existing static GTM noscript (from index.html) before injecting a duplicate
        const existingNoscript = Array.from(document.body.querySelectorAll("noscript")).find((el) =>
          el.querySelector('iframe[src*="googletagmanager.com/ns.html"]')
        );
        if (existingNoscript) {
          const iframe = existingNoscript.querySelector('iframe');
          if (iframe) iframe.setAttribute("src", `https://www.googletagmanager.com/ns.html?id=${gtm}`);
        } else {
          const noscript = document.createElement("noscript");
          noscript.innerHTML = `<iframe src="https://www.googletagmanager.com/ns.html?id=${gtm}" height="0" width="0" style="display:none;visibility:hidden"></iframe>`;
          document.body.prepend(noscript);
          cleanup.push(() => noscript.remove());
        }
        cleanup.push(() => s.remove());
      }

      // ── Verification meta tags (not tracking — always inject) ──────────
      const verifications: [string, string][] = [
        ["google-site-verification", map.integration_gsc_verification],
        ["google-site-verification", map.integration_google_workspace_verification],
      ];
      verifications.forEach(([name, content]) => {
        if (!content) return;
        // 1) Full <meta ... content="X" /> pasted
        const metaMatch = content.match(/content=["']([^"']+)["']/i);
        let value = metaMatch ? metaMatch[1] : content.trim();
        // 2) Google HTML-file reference: googleXXXX.html → use XXXX as token
        if (name === "google-site-verification" && /^google[a-z0-9]+\.html$/i.test(value)) {
          value = value.replace(/^google/i, "").replace(/\.html$/i, "");
        }
        const meta = document.createElement("meta");
        meta.setAttribute("name", name);
        meta.setAttribute("content", value);
        document.head.appendChild(meta);
        cleanup.push(() => meta.remove());
      });
    };

    inject();
    return () => { cleanup.forEach((fn) => fn()); };
  }, [analyticsGranted]);
}
