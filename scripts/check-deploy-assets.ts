/**
 * Post-deploy asset check.
 *
 * Verifies that the favicon files and the web manifest are reachable (HTTP 200)
 * in production, both with normal caching and on a "hard refresh"
 * (Cache-Control: no-cache, Pragma: no-cache) request.
 *
 * Usage:
 *   bunx tsx scripts/check-deploy-assets.ts
 *   bunx tsx scripts/check-deploy-assets.ts https://eliasmas.es
 */

const BASE = (process.argv[2] || process.env.DEPLOY_URL || "https://eliasmas.es").replace(/\/$/, "");

const ASSETS = [
  "/favicon.ico",
  "/favicon.png",
  "/icon-16.png",
  "/icon-32.png",
  "/icon-48.png",
  "/icon-192.png",
  "/icon-512.png",
  "/icon-maskable-512.png",
  "/apple-touch-icon.png",
  "/og-image.jpg",
  "/site.webmanifest",
];

type Result = { url: string; mode: string; ok: boolean; status: number | string; note?: string };

async function check(url: string, hardRefresh: boolean): Promise<Result> {
  const mode = hardRefresh ? "hard-refresh" : "cached";
  try {
    const res = await fetch(url, {
      redirect: "follow",
      headers: hardRefresh ? { "Cache-Control": "no-cache", Pragma: "no-cache" } : {},
    });
    const type = res.headers.get("content-type") || "";
    // Hosting SPA fallback returns index.html for missing files — treat that as a failure.
    const isHtmlFallback = !url.endsWith(".html") && type.includes("text/html");
    return {
      url,
      mode,
      ok: res.status === 200 && !isHtmlFallback,
      status: res.status,
      note: isHtmlFallback ? "served HTML fallback (file missing)" : type,
    };
  } catch (err) {
    return { url, mode, ok: false, status: "ERR", note: (err as Error).message };
  }
}

async function main() {
  console.log(`\nPost-deploy asset check → ${BASE}\n`);

  const results: Result[] = [];
  for (const path of ASSETS) {
    const url = `${BASE}${path}`;
    results.push(await check(url, false), await check(url, true));
  }

  // Validate manifest icon references resolve too.
  try {
    const manifest = await fetch(`${BASE}/site.webmanifest`, {
      headers: { "Cache-Control": "no-cache" },
    });
    if (manifest.ok) {
      const json: { icons?: Array<{ src: string }> } = await manifest.json();
      for (const icon of json.icons ?? []) {
        const url = new URL(icon.src, `${BASE}/`).toString();
        results.push(await check(url, true));
      }
    }
  } catch (err) {
    results.push({
      url: `${BASE}/site.webmanifest`,
      mode: "parse",
      ok: false,
      status: "ERR",
      note: (err as Error).message,
    });
  }

  for (const r of results) {
    console.log(`${r.ok ? "PASS" : "FAIL"}  ${String(r.status).padEnd(4)} [${r.mode}] ${r.url}${r.note ? `  — ${r.note}` : ""}`);
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed.`);
  if (failed.length) {
    console.error(`\n${failed.length} check(s) failed.`);
    process.exit(1);
  }
}

main();
