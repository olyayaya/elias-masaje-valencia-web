import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";

const SITE_URL = "https://eliasmas.es";

interface TestResult {
  ok: boolean;
  error?: string;
  details?: string;
}

async function testGa4(id: string): Promise<TestResult> {
  if (!/^G-[A-Z0-9]+$/i.test(id)) return { ok: false, error: "Invalid format — expected G-XXXXXXXXXX" };
  try {
    const res = await fetch(`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}`);
    if (!res.ok) return { ok: false, error: `Google returned HTTP ${res.status}` };
    const body = await res.text();
    if (!body.includes(id)) return { ok: false, error: "Measurement ID not recognised by Google" };
    return { ok: true, details: `gtag.js loaded (${body.length} bytes)` };
  } catch (e) {
    return { ok: false, error: `Network error: ${(e as Error).message}` };
  }
}

async function testGtm(id: string): Promise<TestResult> {
  if (!/^GTM-[A-Z0-9]+$/i.test(id)) return { ok: false, error: "Invalid format — expected GTM-XXXXXXX" };
  try {
    const res = await fetch(`https://www.googletagmanager.com/gtm.js?id=${encodeURIComponent(id)}`);
    if (!res.ok) return { ok: false, error: `Google returned HTTP ${res.status}` };
    const body = await res.text();
    if (body.length < 200) return { ok: false, error: "Container empty or unpublished" };
    return { ok: true, details: `gtm.js loaded (${body.length} bytes)` };
  } catch (e) {
    return { ok: false, error: `Network error: ${(e as Error).message}` };
  }
}

function extractVerificationToken(metaName: string, raw: string): string {
  const trimmed = raw.trim();
  // Full <meta ... content="X" /> tag pasted
  const metaMatch = trimmed.match(/content=["']([^"']+)["']/i);
  if (metaMatch) return metaMatch[1].trim();
  // Google HTML file reference: googleXXXXX.html  (Google's filename = google<token>.html)
  if (metaName === "google-site-verification") {
    const fileMatch = trimmed.match(/^google([a-z0-9]+)\.html$/i);
    if (fileMatch) return fileMatch[1];
  }
  return trimmed;
}

async function testMetaTag(metaName: string, raw: string): Promise<TestResult> {
  const expected = extractVerificationToken(metaName, raw);
  if (!expected) return { ok: false, error: "Empty value" };
  try {
    const res = await fetch(SITE_URL, { headers: { "user-agent": "EliasMasaje-IntegrationTest/1.0" } });
    if (!res.ok) return { ok: false, error: `Site returned HTTP ${res.status}` };
    const html = await res.text();
    const re = new RegExp(`<meta[^>]+name=["']${metaName}["'][^>]+content=["']([^"']+)["']`, "ig");
    const matches = Array.from(html.matchAll(re)).map((m) => m[1].trim());
    if (matches.length === 0) return { ok: false, error: `Meta tag '${metaName}' not found on ${SITE_URL} yet — wait a moment after Save and try again.` };
    if (!matches.includes(expected)) {
      return { ok: false, error: `Meta tag found but content mismatch (live: ${matches[0].slice(0, 12)}…)` };
    }
    return { ok: true, details: `Verified on ${SITE_URL}` };
  } catch (e) {
    return { ok: false, error: `Network error: ${(e as Error).message}` };
  }
}

async function testTripadvisorUrl(raw: string): Promise<TestResult> {
  const url = raw.trim();
  if (!/^https?:\/\/(www\.)?tripadvisor\.[a-z.]+\//i.test(url)) {
    return { ok: false, error: "URL must point to tripadvisor.com (or a country TLD)" };
  }
  try {
    const res = await fetch(url, { headers: { "user-agent": "Mozilla/5.0 EliasMasaje-IntegrationTest/1.0" } });
    if (res.status >= 400) return { ok: false, error: `TripAdvisor returned HTTP ${res.status}` };
    return { ok: true, details: `Profile page reachable (HTTP ${res.status})` };
  } catch (e) {
    return { ok: false, error: `Network error: ${(e as Error).message}` };
  }
}


function testSeoKey(v: string): TestResult {
  const t = v.trim();
  if (t.length < 16) return { ok: false, error: "Key looks too short — most provider keys are 20+ characters" };
  if (/\s/.test(t)) return { ok: false, error: "Key contains whitespace — copy/paste error?" };
  return { ok: true, details: `Key stored (${t.length} chars). Provider call will validate at first use.` };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { kind, value } = await req.json();
    if (typeof kind !== "string" || typeof value !== "string") {
      return new Response(JSON.stringify({ ok: false, error: "Missing kind/value" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let result: TestResult;
    switch (kind) {
      case "integration_ga4_id": result = await testGa4(value); break;
      case "integration_gtm_id": result = await testGtm(value); break;
      case "integration_gsc_verification": result = await testMetaTag("google-site-verification", value); break;
      case "integration_bing_verification": result = await testMetaTag("msvalidate.01", value); break;
      case "integration_yandex_verification": result = await testMetaTag("yandex-verification", value); break;
      case "integration_seo_api_key": result = testSeoKey(value); break;
      default: result = { ok: false, error: `Unknown integration: ${kind}` };
    }

    return new Response(JSON.stringify({ ...result, testedAt: new Date().toISOString() }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
