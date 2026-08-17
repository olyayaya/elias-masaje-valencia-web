import { createClient } from 'npm:@supabase/supabase-js@2';
import {
  MAX_PAGES,
  MAX_REVIEWS,
  RATE_LIMIT_MS,
  asArray,
  cooldownRemainingMs,
  dedupe,
  googleLocationPath,
  isUsable,
  nextPageToken,
  normalizeGoogleReview,
  readJsonLimited,
  type NormalizedReview,
} from './normalize.ts';

/**
 * Admin-only review sync.
 *
 * Credentials live exclusively in Edge Function secrets — nothing is ever
 * returned to the browser but counters and a status string. When a source is
 * not connected the function answers `not_configured` instead of guessing or
 * scraping. No review is ever invented here, and no provider body, header or
 * token is ever logged.
 *
 * TripAdvisor is compliance-blocked: their Content API terms forbid selective
 * filtering/sorting and commingling their reviews with third-party content, so
 * that branch performs no external request at all and answers
 * `compliance_required`.
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200, extra: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json', ...extra },
  });

const REQUIRED: Record<string, string[]> = {
  google: [
    'GOOGLE_BUSINESS_PROFILE_CLIENT_ID',
    'GOOGLE_BUSINESS_PROFILE_CLIENT_SECRET',
    'GOOGLE_BUSINESS_PROFILE_REFRESH_TOKEN',
    'GOOGLE_BUSINESS_ACCOUNT_ID',
    'GOOGLE_BUSINESS_LOCATION_ID',
  ],
};

/** Known but never fetched. Answered before any network or secret lookup. */
const COMPLIANCE_BLOCKED = new Set(['tripadvisor']);

const TIMEOUT_MS = 15_000;

const fetchWithTimeout = async (url: string, init: RequestInit) => {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: ac.signal });
  } finally {
    clearTimeout(timer);
  }
};

async function googleAccessToken(): Promise<string> {
  const body = new URLSearchParams({
    client_id: Deno.env.get('GOOGLE_BUSINESS_PROFILE_CLIENT_ID')!,
    client_secret: Deno.env.get('GOOGLE_BUSINESS_PROFILE_CLIENT_SECRET')!,
    refresh_token: Deno.env.get('GOOGLE_BUSINESS_PROFILE_REFRESH_TOKEN')!,
    grant_type: 'refresh_token',
  });
  const res = await fetchWithTimeout('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!res.ok) throw new SyncError('google_auth_failed', 'Google rejected the stored credentials.');
  const data = await readJsonLimited(res);
  const token = data.access_token;
  if (typeof token !== 'string' || !token) {
    throw new SyncError('google_auth_failed', 'Google returned no access token.');
  }
  return token;
}

class SyncError extends Error {
  constructor(public code: string, message: string) {
    super(message);
  }
}

async function fetchGoogle(): Promise<NormalizedReview[]> {
  const token = await googleAccessToken();
  const path = googleLocationPath(
    Deno.env.get('GOOGLE_BUSINESS_ACCOUNT_ID')!,
    Deno.env.get('GOOGLE_BUSINESS_LOCATION_ID')!,
  );
  const out: NormalizedReview[] = [];
  let pageToken: string | null = null;
  for (let page = 0; page < MAX_PAGES && out.length < MAX_REVIEWS; page++) {
    const url =
      `https://mybusiness.googleapis.com/v4/${path}/reviews?pageSize=50` +
      (pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : '');
    const res = await fetchWithTimeout(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) {
      throw new SyncError('google_request_failed', `Google reviews request failed (${res.status}).`);
    }
    const data = await readJsonLimited(res);
    const batch = asArray(data.reviews).map(normalizeGoogleReview);
    if (batch.length === 0 && !nextPageToken(data)) break;
    out.push(...batch);
    pageToken = nextPageToken(data);
    if (!pageToken) break;
  }
  return dedupe(out).slice(0, MAX_REVIEWS);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

  // Authenticate first: method shape, secrets and state are all admin-only info.
  const authHeader = req.headers.get('Authorization') ?? '';
  if (!authHeader.startsWith('Bearer ')) return json({ error: 'unauthorized' }, 401);

  const authed = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData } = await authed.auth.getUser();
  const user = userData?.user;
  if (!user) return json({ error: 'unauthorized' }, 401);

  const { data: isAdmin } = await authed.rpc('has_role', { _user_id: user.id, _role: 'admin' });
  if (!isAdmin) return json({ error: 'forbidden' }, 403);

  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405, { Allow: 'POST, OPTIONS' });

  const admin = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  let source = '';

  const writeState = async (values: Record<string, unknown>) => {
    await admin.from('review_sync_state').upsert({ source, ...values }, { onConflict: 'source' });
  };

  try {
    const body = await req.json().catch(() => ({}));
    source = String((body as { source?: string }).source ?? '');
    if (COMPLIANCE_BLOCKED.has(source)) {
      // Not an error: a deliberate, documented refusal. No fetch, no storage
      // write, no sync state row for a source that is never synced.
      const blocked = source;
      source = '';
      return json({
        status: 'compliance_required',
        source: blocked,
        reason: 'tripadvisor_license_required',
      });
    }
    if (!REQUIRED[source]) return json({ error: 'invalid source' }, 400);

    // Durable cooldown: the gap is enforced from the stored attempt timestamp,
    // so a restarted instance cannot be used to hammer a provider.
    const { data: state } = await admin
      .from('review_sync_state')
      .select('last_attempt_at')
      .eq('source', source)
      .maybeSingle();
    const remaining = cooldownRemainingMs((state as { last_attempt_at?: string } | null)?.last_attempt_at);
    if (remaining > 0) {
      const retryAfter = Math.ceil(remaining / 1000);
      await writeState({ status: 'rate_limited', error_code: 'rate_limited', error_message: null });
      return json(
        { status: 'rate_limited', source, retry_after: retryAfter, cooldown_seconds: RATE_LIMIT_MS / 1000 },
        429,
        { 'Retry-After': String(retryAfter) },
      );
    }

    await writeState({ last_attempt_at: new Date().toISOString(), error_code: null, error_message: null });

    const missing = REQUIRED[source].filter((name) => !Deno.env.get(name));
    if (missing.length) {
      // Only an authenticated admin ever sees this, and only secret *names*.
      await writeState({
        status: 'not_configured',
        error_code: 'not_configured',
        error_message: 'Missing credentials.',
      });
      return json({ status: 'not_configured', source, missing_secrets: missing });
    }

    const fetched = await fetchGoogle();
    const valid = fetched.filter(isUsable);
    const skipped = fetched.length - valid.length;

    const { data: existing, error: readErr } = await admin
      .from('reviews')
      .select('external_review_id')
      .eq('source', source);
    if (readErr) throw new SyncError('storage_unavailable', 'The reviews table is not available.');
    const known = new Set(
      (existing ?? []).map((r: { external_review_id: string }) => r.external_review_id),
    );

    const now = new Date().toISOString();
    // Upsert on (source, external_review_id). visible / pinned / manual_priority
    // are deliberately absent from the payload, so a re-sync can never undo a
    // moderation decision.
    if (valid.length) {
      const { error: upsertErr } = await admin
        .from('reviews')
        .upsert(valid.map((r) => ({ ...r, last_synced_at: now })), {
          onConflict: 'source,external_review_id',
        });
      if (upsertErr) throw new SyncError('storage_write_failed', 'Failed to store reviews.');
    }

    const imported = valid.filter((r) => !known.has(r.external_review_id)).length;
    const updated = valid.length - imported;

    await writeState({
      status: 'ok',
      last_success_at: now,
      imported_count: imported,
      updated_count: updated,
      skipped_count: skipped,
      error_code: null,
      error_message: null,
    });

    return json({ status: 'ok', source, imported, updated, skipped });
  } catch (e) {
    const code = e instanceof SyncError ? e.code : 'sync_failed';
    const message = e instanceof SyncError ? e.message : 'The sync could not be completed.';
    // Message only — never headers, tokens or request bodies.
    console.error('reviews-sync failed:', code);
    if (source) {
      await writeState({ status: 'error', error_code: code, error_message: message }).catch(() => {});
    }
    return json({ status: 'error', source, error_code: code, error: message }, 500);
  }
});
