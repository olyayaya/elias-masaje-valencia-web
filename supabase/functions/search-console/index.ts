import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const GATEWAY = "https://connector-gateway.lovable.dev/google_search_console";
const SITE_URL = "https://eliasmas.es/";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

async function requireAdmin(req: Request): Promise<{ ok: true } | { ok: false; res: Response }> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return { ok: false, res: json({ error: "Unauthorized" }, 401) };
  const token = authHeader.replace("Bearer ", "");
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );
  const { data: claims, error } = await supabase.auth.getClaims(token);
  if (error || !claims?.claims?.sub) return { ok: false, res: json({ error: "Unauthorized" }, 401) };
  const { data: role } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", claims.claims.sub as string)
    .eq("role", "admin")
    .maybeSingle();
  if (!role) return { ok: false, res: json({ error: "Forbidden" }, 403) };
  return { ok: true };
}

function gatewayHeaders() {
  const lovableKey = Deno.env.get("LOVABLE_API_KEY");
  const connKey = Deno.env.get("GOOGLE_SEARCH_CONSOLE_API_KEY");
  if (!lovableKey || !connKey) return null;
  return {
    Authorization: `Bearer ${lovableKey}`,
    "X-Connection-Api-Key": connKey,
    "Content-Type": "application/json",
  };
}

function coversTarget(siteUrl: string, target: URL) {
  if (siteUrl.startsWith("sc-domain:")) {
    const domain = siteUrl.slice("sc-domain:".length).toLowerCase();
    const host = target.hostname.toLowerCase();
    return host === domain || host.endsWith(`.${domain}`);
  }
  try {
    return target.href.startsWith(new URL(siteUrl).href);
  } catch {
    return false;
  }
}

const isoDay = (d: Date) => d.toISOString().slice(0, 10);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.res;

  const headers = gatewayHeaders();
  if (!headers) {
    return json({ error: "Search Console is not connected yet.", code: "not_connected" }, 400);
  }

  try {
    const body = await req.json().catch(() => ({}));
    const days = Math.min(Math.max(Number(body?.days) || 28, 7), 90);

    // 1. Resolve a verified property covering the site
    const sitesRes = await fetch(`${GATEWAY}/webmasters/v3/sites`, { headers });
    if (!sitesRes.ok) {
      const details = await sitesRes.text();
      return json({ error: "Could not list Search Console properties", status: sitesRes.status, details }, sitesRes.status);
    }
    const { siteEntry = [] } = (await sitesRes.json()) as {
      siteEntry?: { siteUrl: string; permissionLevel?: string }[];
    };
    const target = new URL(SITE_URL);
    const matches = siteEntry.filter(
      (e) => e.permissionLevel !== "siteUnverifiedUser" && coversTarget(e.siteUrl, target),
    );
    if (matches.length === 0) {
      return json({ error: "No verified Search Console property covers eliasmas.es", code: "no_property" }, 400);
    }
    const siteUrl = (body?.siteUrl && matches.find((m) => m.siteUrl === body.siteUrl)?.siteUrl) || matches[0].siteUrl;

    // 2. Query search analytics — Google data lags ~2 days
    const end = new Date(Date.now() - 2 * 864e5);
    const start = new Date(end.getTime() - (days - 1) * 864e5);
    const base = { startDate: isoDay(start), endDate: isoDay(end), type: "web" };

    const query = async (dimensions: string[], rowLimit: number) => {
      const res = await fetch(
        `${GATEWAY}/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`,
        { method: "POST", headers, body: JSON.stringify({ ...base, dimensions, rowLimit }) },
      );
      if (!res.ok) {
        const details = await res.text();
        throw new Error(`[${res.status}] ${details}`);
      }
      const data = (await res.json()) as { rows?: { keys: string[]; clicks: number; impressions: number; ctr: number; position: number }[] };
      return data.rows ?? [];
    };

    const [byDate, byQuery, byPage, byCountry] = await Promise.all([
      query(["date"], 100),
      query(["query"], 10),
      query(["page"], 10),
      query(["country"], 6),
    ]);

    const totals = byDate.reduce(
      (acc, r) => {
        acc.clicks += r.clicks;
        acc.impressions += r.impressions;
        acc.positionSum += r.position * r.impressions;
        return acc;
      },
      { clicks: 0, impressions: 0, positionSum: 0 },
    );

    // 3. Sitemap status (best effort)
    let sitemap: { path: string; errors: number; warnings: number; lastSubmitted?: string } | null = null;
    try {
      const smRes = await fetch(`${GATEWAY}/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/sitemaps`, { headers });
      if (smRes.ok) {
        const sm = (await smRes.json()) as { sitemap?: { path: string; errors?: string; warnings?: string; lastSubmitted?: string }[] };
        const first = sm.sitemap?.[0];
        if (first) {
          sitemap = {
            path: first.path,
            errors: Number(first.errors ?? 0),
            warnings: Number(first.warnings ?? 0),
            lastSubmitted: first.lastSubmitted,
          };
        }
      }
    } catch (_) { /* non-fatal */ }

    return json({
      siteUrl,
      range: { startDate: base.startDate, endDate: base.endDate, days },
      totals: {
        clicks: totals.clicks,
        impressions: totals.impressions,
        ctr: totals.impressions ? totals.clicks / totals.impressions : 0,
        position: totals.impressions ? totals.positionSum / totals.impressions : 0,
      },
      byDate: byDate.map((r) => ({ date: r.keys[0], clicks: r.clicks, impressions: r.impressions })),
      topQueries: byQuery.map((r) => ({ key: r.keys[0], clicks: r.clicks, impressions: r.impressions, ctr: r.ctr, position: r.position })),
      topPages: byPage.map((r) => ({ key: r.keys[0], clicks: r.clicks, impressions: r.impressions, ctr: r.ctr, position: r.position })),
      countries: byCountry.map((r) => ({ key: r.keys[0], clicks: r.clicks, impressions: r.impressions })),
      sitemap,
      fetchedAt: new Date().toISOString(),
    });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
