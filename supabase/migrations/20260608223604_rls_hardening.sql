-- =============================================================================
-- RLS HARDENING — follow-up to the lockdown migration
-- =============================================================================
-- Closes two advisor warnings surfaced after the lockdown:
--
--   1. public_bucket_allows_listing — the `media public read` SELECT policy let
--      ANYONE enumerate every filename in the bucket via the storage API.
--      Public image *display* does NOT need this: the `media` bucket is public,
--      so images are served through the public CDN URL (getPublicUrl) which
--      bypasses RLS entirely. Only the dashboard's .list() calls need SELECT,
--      and those run authenticated. So restrict listing to authenticated.
--
--   2. log_content_change() is a trigger function but was EXECUTE-able by anon /
--      authenticated as an RPC (/rest/v1/rpc/log_content_change). Triggers fire
--      regardless of EXECUTE grants, so revoke direct RPC access.
-- =============================================================================

BEGIN;

-- 1. media bucket: listing is authenticated-only (public URLs still work)
DROP POLICY IF EXISTS "media public read" ON storage.objects;
CREATE POLICY "media authenticated read"
  ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'media');

-- 2. stop exposing the audit trigger function as a callable RPC
REVOKE EXECUTE ON FUNCTION public.log_content_change() FROM anon, authenticated, public;

COMMIT;
