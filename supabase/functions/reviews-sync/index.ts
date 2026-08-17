import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

/**
 * Admin-only review sync.
 *
 * Credentials live exclusively in Edge Function secrets — nothing is ever
 * returned to the browser but counters and a status string. When a source is
 * not connected the function answers `not_configured` instead of guessing or
 * scraping. No review is ever invented here.
 */

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

const REQUIRED: Record<string, string[]> = {
  google: [
    'GOOGLE_BUSINESS_PROFILE_CLIENT_ID',
    'GOOGLE_BUSINESS_PROFILE_CLIENT_SECRET',
    'GOOGLE_BUSINESS_PROFILE_REFRESH_TOKEN',
    'GOOGLE_BUSINESS_ACCOUNT_ID',
    'GOOGLE_BUSINESS_LOCATION_ID',
  ],
  tripadvisor: ['TRIPADVISOR_CONTENT_API_KEY', 'TRIPADVISOR_LOCATION_ID'],
};

const TIMEOUT_MS = 15_000;
const MAX_REVIEWS = 200;

interface NormalizedReview {
  source: string;
  external_review_id: string;
  author_name: string;
  author_avatar_url: string | null;
  rating: number;
  review_text: string;
  review_language: string | null;
  reviewed_at: string | null;
  original_url: string | null;
}

const httpsOnly = (v: unknown): string | null => {
  if (typeof v !== 'string' || !v) return null;
  try {
    const u = new URL(v);
    return u.protocol === 'https:' ? u.toString() : null;
  } catch {
    return null;
  }
};

const clip = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

const fetchWithTimeout = async (url: string, init: RequestInit) => {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: ac.signal });
  } finally {
    clearTimeout(timer);
  }
};

const STAR_WORDS: Record<string, number> = { ONE: 1, TWO: 2, THREE: 3, FOUR: 4, FIVE: 5 };

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
  if (!res.ok) throw new Error('google token exchange failed');
  const data = await res.json();
  if (!data.access_token) throw new Error('google token missing');
  return data.access_token as string;
}

async function fetchGoogle(): Promise<NormalizedReview[]> {
  const token = await googleAccessToken();
  const account = Deno.env.get('GOOGLE_BUSINESS_ACCOUNT_ID')!;
  const location = Deno.env.get('GOOGLE_BUSINESS_LOCATION_ID')!;
  const url = `https://mybusiness.googleapis.com/v4/accounts/${encodeURIComponent(account)}/locations/${encodeURIComponent(location)}/reviews?pageSize=50`;
  const res = await fetchWithTimeout(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`google reviews request failed (${res.status})`);
  const data = await res.json();
  const list = Array.isArray(data.reviews) ? data.reviews : [];
  return list.slice(0, MAX_REVIEWS).map((r: Record<string, any>) => ({
    source: 'google',
    external_review_id: clip(r.reviewId ?? r.name, 200),
    author_name: clip(r.reviewer?.displayName, 120) || 'Google user',
    author_avatar_url: httpsOnly(r.reviewer?.profilePhotoUrl),
    rating: STAR_WORDS[String(r.starRating)] ?? 0,
    review_text: clip(r.comment, 5000),
    review_language: null,
    reviewed_at: r.createTime ?? null,
    original_url: httpsOnly(r.reviewReply?.uri) ?? null,
  }));
}

async function fetchTripadvisor(): Promise<NormalizedReview[]> {
  const key = Deno.env.get('TRIPADVISOR_CONTENT_API_KEY')!;
  const loc = Deno.env.get('TRIPADVISOR_LOCATION_ID')!;
  const url = `https://api.content.tripadvisor.com/api/v1/location/${encodeURIComponent(loc)}/reviews?key=${encodeURIComponent(key)}&language=en`;
  const res = await fetchWithTimeout(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`tripadvisor request failed (${res.status})`);
  const data = await res.json();
  const list = Array.isArray(data.data) ? data.data : [];
  return list.slice(0, MAX_REVIEWS).map((r: Record<string, any>) => ({
    source: 'tripadvisor',
    external_review_id: clip(String(r.id ?? ''), 200),
    author_name: clip(r.user?.username, 120) || 'TripAdvisor user',
    author_avatar_url: httpsOnly(r.user?.avatar?.small?.url),
    rating: Number(r.rating) || 0,
    review_text: clip(r.text, 5000),
    review_language: clip(r.lang, 12) || null,
    reviewed_at: r.published_date ?? null,
    original_url: httpsOnly(r.url),
  }));
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization') ?? '';
    if (!authHeader.startsWith('Bearer ')) return json({ error: 'unauthorized' }, 401);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const authed = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData } = await authed.auth.getUser();
    const user = userData?.user;
    if (!user) return json({ error: 'unauthorized' }, 401);

    const { data: isAdmin } = await authed.rpc('has_role', { _user_id: user.id, _role: 'admin' });
    if (!isAdmin) return json({ error: 'forbidden' }, 403);

    const body = await req.json().catch(() => ({}));
    const source = String((body as { source?: string }).source ?? '');
    if (!REQUIRED[source]) return json({ error: 'invalid source' }, 400);

    const missing = REQUIRED[source].filter((name) => !Deno.env.get(name));
    if (missing.length) {
      return json({ status: 'not_configured', source, missing_secrets: missing });
    }

    const fetched = source === 'google' ? await fetchGoogle() : await fetchTripadvisor();
    const valid = fetched.filter(
      (r) => r.external_review_id && r.author_name && r.rating >= 1 && r.rating <= 5,
    );
    const skipped = fetched.length - valid.length;

    const admin = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    const { data: existing, error: readErr } = await admin
      .from('reviews')
      .select('external_review_id')
      .eq('source', source);
    if (readErr) throw new Error('reviews table unavailable');
    const known = new Set((existing ?? []).map((r: { external_review_id: string }) => r.external_review_id));

    const now = new Date().toISOString();
    // Upsert on (source, external_review_id): visible / pinned stay untouched
    // because they are simply not part of the payload.
    const { error: upsertErr } = await admin
      .from('reviews')
      .upsert(
        valid.map((r) => ({ ...r, last_synced_at: now })),
        { onConflict: 'source,external_review_id' },
      );
    if (upsertErr) throw new Error('failed to store reviews');

    const imported = valid.filter((r) => !known.has(r.external_review_id)).length;

    return json({
      status: 'ok',
      source,
      imported,
      updated: valid.length - imported,
      skipped,
    });
  } catch (e) {
    // Message only — never headers, tokens or request bodies.
    console.error('reviews-sync failed:', e instanceof Error ? e.message : 'unknown error');
    return json({ status: 'error', error: 'sync failed' }, 500);
  }
});
