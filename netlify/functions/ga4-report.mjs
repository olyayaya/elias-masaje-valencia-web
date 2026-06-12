// Netlify Function: real Google Analytics 4 metrics for the dashboard.
//
// Reads two env vars (set in Netlify → Site configuration → Environment variables):
//   GA4_PROPERTY_ID    – the GA4 *numeric* property id (e.g. "456789123"),
//                        NOT the "G-XXXX" measurement id.
//   GA4_SERVICE_ACCOUNT – the full service-account JSON key (paste as-is).
//
// The service account must have the Analytics Data API enabled in its Google
// Cloud project and be granted Viewer access on the GA4 property.
//
// If either env var is missing, it returns { configured: false } so the
// dashboard shows a "connect GA" notice instead of any fake numbers.
//
// Zero external dependencies — the service-account JWT is signed with the
// built-in node:crypto, then exchanged for an access token.

import crypto from "node:crypto";

const b64url = (buf) =>
  Buffer.from(buf).toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");

async function getAccessToken(sa) {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const claims = {
    iss: sa.client_email,
    scope: "https://www.googleapis.com/auth/analytics.readonly",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  };
  const unsigned = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(claims))}`;
  const signer = crypto.createSign("RSA-SHA256");
  signer.update(unsigned);
  signer.end();
  const signature = b64url(signer.sign(sa.private_key));
  const assertion = `${unsigned}.${signature}`;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });
  if (!res.ok) throw new Error(`token exchange failed: ${res.status} ${await res.text()}`);
  return (await res.json()).access_token;
}

async function runReport(propertyId, token, body) {
  const res = await fetch(
    `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );
  if (!res.ok) throw new Error(`runReport failed: ${res.status} ${await res.text()}`);
  return res.json();
}

export default async (req) => {
  const days = Math.min(365, Math.max(1, parseInt(new URL(req.url).searchParams.get("days") || "30", 10)));

  const propertyId = process.env.GA4_PROPERTY_ID;
  const saRaw = process.env.GA4_SERVICE_ACCOUNT;
  if (!propertyId || !saRaw) {
    return Response.json({ configured: false });
  }

  let sa;
  try {
    sa = JSON.parse(saRaw);
  } catch {
    return Response.json({ configured: false, error: "GA4_SERVICE_ACCOUNT is not valid JSON" });
  }

  try {
    const token = await getAccessToken(sa);
    const dateRanges = [{ startDate: `${days}daysAgo`, endDate: "today" }];

    // Totals (no date dimension — users/sessions are not additive across days).
    const totalsRep = await runReport(propertyId, token, {
      dateRanges,
      metrics: [
        { name: "screenPageViews" },
        { name: "totalUsers" },
        { name: "sessions" },
        { name: "averageSessionDuration" },
      ],
    });
    const m = totalsRep.rows?.[0]?.metricValues ?? [];
    const totals = {
      views: Math.round(Number(m[0]?.value || 0)),
      users: Math.round(Number(m[1]?.value || 0)),
      sessions: Math.round(Number(m[2]?.value || 0)),
      avgSessionDuration: Math.round(Number(m[3]?.value || 0)), // seconds
    };

    // Page views per day for the sparkline.
    const byDayRep = await runReport(propertyId, token, {
      dateRanges,
      dimensions: [{ name: "date" }],
      metrics: [{ name: "screenPageViews" }],
      orderBys: [{ dimension: { dimensionName: "date" } }],
    });
    const byDay = (byDayRep.rows ?? []).map((row) => {
      const d = row.dimensionValues[0].value; // YYYYMMDD
      return { date: `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`, views: Number(row.metricValues[0].value || 0) };
    });

    return new Response(JSON.stringify({ configured: true, days, totals, byDay }), {
      headers: { "Content-Type": "application/json", "Cache-Control": "private, max-age=300" },
    });
  } catch (err) {
    return Response.json({ configured: true, error: String(err?.message || err) }, { status: 502 });
  }
};
