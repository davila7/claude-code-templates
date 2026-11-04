-- Supabase (download tracking project): close the `rls_disabled_in_public`
-- advisor finding on component_downloads, download_stats and section_config.
-- Run by hand in the Supabase SQL editor; not part of the Neon migrations above.
-- Applied: both steps, 2026-11-04. Re-running is safe (idempotent).
--
-- Scoped to these three tables on purpose. The same project also hosts the
-- courses app (user_progress, membership_plans, user_memberships, ...), whose
-- RLS policies need the default anon/authenticated table grants. A blanket
-- REVOKE over every public table breaks it.
--
-- Who touches these tables:
--   - dashboard/src/pages/api/track-download-supabase.ts: writes, service_role
--   - cloudflare-workers/pulse: reads, service_role
--   - scripts/generate_components_json.py and generate_trending_data.py
--     (update-json-data.yml): read component_downloads with the anon key in
--     SUPABASE_API_KEY, selecting explicit non-PII columns only
--   - nothing reads download_stats or section_config with anon/authenticated
-- service_role has BYPASSRLS and keeps its own grants, so it is unaffected.
--
-- Avoid 03:00-03:15 UTC (the nightly update-json-data run).

-- Step 1: stop every anon/authenticated write, and lock the two tables nobody
-- reads. component_downloads keeps anon SELECT until step 2.
BEGIN;
SET LOCAL lock_timeout = '5s';

REVOKE ALL ON TABLE public.component_downloads, public.download_stats, public.section_config
  FROM anon, authenticated;
GRANT SELECT ON TABLE public.component_downloads TO anon;

REVOKE ALL ON SEQUENCE public.component_downloads_id_seq, public.download_stats_id_seq
  FROM anon, authenticated;

ALTER TABLE public.download_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.section_config ENABLE ROW LEVEL SECURITY;
COMMIT;

-- Step 2: close the read of ip_address and user_agent. Run only after the
-- generate_trending_data.py change that selects explicit columns is on main,
-- or the nightly run gets 401 and silently keeps yesterday's trending data.
BEGIN;
SET LOCAL lock_timeout = '5s';

REVOKE SELECT ON TABLE public.component_downloads FROM anon;
GRANT SELECT (id, component_type, component_name, category, download_timestamp,
              country, client_agent, client_entrypoint, client_is_tty)
  ON public.component_downloads TO anon;

ALTER TABLE public.component_downloads ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Catalog reads non-PII columns" ON public.component_downloads;
CREATE POLICY "Catalog reads non-PII columns" ON public.component_downloads
  FOR SELECT TO anon USING (true);
COMMIT;

-- Verify after each step.
-- Privileges: anon should only show SELECT on component_downloads (plus the
-- column grant after step 2); authenticated should show nothing.
SELECT t AS table_name, r AS role,
       has_table_privilege(r, 'public.' || t, 'SELECT') AS sel,
       has_table_privilege(r, 'public.' || t, 'INSERT') AS ins,
       has_table_privilege(r, 'public.' || t, 'UPDATE') AS upd,
       has_table_privilege(r, 'public.' || t, 'DELETE') AS del
FROM unnest(ARRAY['component_downloads', 'download_stats', 'section_config']) AS t,
     unnest(ARRAY['anon', 'authenticated']) AS r
ORDER BY 1, 2;
-- Writes as anon must now fail with 42501 (EXPLAIN never executes):
--   BEGIN READ ONLY; SET LOCAL ROLE anon;
--   EXPLAIN DELETE FROM public.component_downloads WHERE id > 0;
--   ROLLBACK;
-- After step 2, EXPLAIN SELECT ip_address FROM public.component_downloads as
-- anon must fail with 42501, and EXPLAIN SELECT id, component_type must not.
-- Then re-run the Security Advisor: rls_disabled_in_public should be gone
-- (an INFO rls_enabled_no_policy on download_stats and section_config is fine).

-- Rollback, if a reader that was missed breaks:
--   step 2: GRANT SELECT ON TABLE public.component_downloads TO anon;
--   step 1: GRANT SELECT ON TABLE public.<table> TO anon;  (reads only)
-- Never restore INSERT/UPDATE/DELETE for anon or authenticated.
