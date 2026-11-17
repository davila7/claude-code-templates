-- Supabase (download tracking project): RLS on the download-tracking tables.
-- Run in the Supabase SQL editor; not part of the Neon migrations above.
-- Mirrors what is live since 2026-11 (checked 2026-11-08).
--
-- Scoped to these two tables on purpose: the same database's public schema
-- holds another app's tables (course_access, user_memberships, ...) with their
-- own policies and grants. Never run a blanket "every public table" change here.
--
-- Clients:
--   - dashboard/src/pages/api/track-download-supabase.ts: service_role (writes)
--   - cloudflare-workers/pulse: service_role (reads)
--   - scripts/generate_{components_json,trending_data}.py: SUPABASE_API_KEY,
--     the anon key, reading only the non-PII columns granted below. Both
--     scripts must name their columns: `select=*` is denied.

ALTER TABLE public.component_downloads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.download_stats ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.component_downloads FROM anon, authenticated;
REVOKE ALL ON TABLE public.download_stats FROM anon, authenticated;

-- ip_address and user_agent stay service_role only.
GRANT SELECT (id, component_type, component_name, category, country,
              download_timestamp, client_agent, client_entrypoint, client_is_tty)
  ON public.component_downloads TO anon;

DROP POLICY IF EXISTS "Catalog reads non-PII columns" ON public.component_downloads;
CREATE POLICY "Catalog reads non-PII columns" ON public.component_downloads
  FOR SELECT TO anon USING (true);

-- Verify: rls_enabled = true; anon_select = false (table-level; the column grants
-- above are what anon gets).
SELECT c.relname AS table_name,
       c.relrowsecurity AS rls_enabled,
       has_table_privilege('anon', c.oid, 'SELECT') AS anon_select
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relname IN ('component_downloads', 'download_stats');
