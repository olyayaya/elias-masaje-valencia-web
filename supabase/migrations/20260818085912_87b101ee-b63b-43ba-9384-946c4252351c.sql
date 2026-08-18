-- Append-only audit tables: signed-in users may read (admin RLS), never write.
REVOKE INSERT, UPDATE, DELETE ON public.content_history FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.media_aliases FROM authenticated;
-- Roles table is managed by admins through RLS; keep read-only at grant level too
-- would break admin role management, so leave DML in place there.
GRANT SELECT ON public.content_history TO authenticated;
GRANT SELECT ON public.media_aliases TO authenticated;
GRANT ALL ON public.content_history, public.media_aliases TO service_role;