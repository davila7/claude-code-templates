-- Supabase (download tracking project): close the `rls_disabled_in_public`
-- advisor finding. Run in the Supabase SQL editor; not part of the Neon
-- migrations above.
--
-- Every legitimate client of this database uses the service_role key, which
-- bypasses RLS:
--   - dashboard/src/pages/api/track-download-supabase.ts (writes)
--   - cloudflare-workers/pulse (reads)
--   - scripts/generate_{components_json,trending_data}.py via the
--     SUPABASE_API_KEY secret (reads) -- this secret must hold the
--     service_role key, not the anon key, BEFORE this migration runs.
--
-- So RLS is enabled with no policies: anon and authenticated get nothing.

-- 0. Inspect first: public tables and their RLS state.
SELECT c.relname AS table_name, c.relrowsecurity AS rls_enabled
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p')
ORDER BY 1;

-- 1. Enable RLS on every public table that lacks it, and drop the default
--    grants Supabase gives anon/authenticated (defense in depth).
DO $$
DECLARE
  t record;
BEGIN
  FOR t IN
    SELECT c.relname
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p')
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t.relname);
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM anon, authenticated', t.relname);
  END LOOP;
END $$;

-- 2. Verify: every row should show rls_enabled = true and anon_select = false.
SELECT c.relname AS table_name,
       c.relrowsecurity AS rls_enabled,
       has_table_privilege('anon', c.oid, 'SELECT') AS anon_select
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p')
ORDER BY 1;

-- Rollback (only if a reader you missed breaks):
--   ALTER TABLE public.<table> DISABLE ROW LEVEL SECURITY;
--   GRANT SELECT ON TABLE public.<table> TO anon;
