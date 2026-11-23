-- Supabase (download tracking project): daily summary of unique installers for
-- the public /trending page. Run in the Supabase SQL editor, like 003-006.
--
-- Why a summary table: scripts/generate_trending_data.py runs with the anon
-- key, which cannot read ip_address (003), and the all-time count scans every
-- row (21 s on 2026-11-20, 1.7M rows) while anon requests stop at 3 s. So
-- pg_cron recomputes the numbers once a day as postgres and anon reads one
-- row of aggregates. No IP, user agent or installer id leaves the function.
--
-- Definitions (same as 005, traction plan 2026-11-07):
--   installer   an IPv4 address, or the /64 network of an IPv6 address.
--               IP-days with more than 50 rows (scripts) are dropped first,
--               counted per raw IP before the /64 grouping.
--   window      whole UTC days. "current" = the 7 days before as_of (as_of =
--               today 00:00 UTC, exclusive), "previous" = the 7 days before.
--   returning   installers active in the current window that also installed
--               in the 56 days before it.
--   component   component_type (function-hook folded into mod) + component_name
--               as the CLI sent them. They are not validated here: the
--               generator keeps only names that exist in the catalog.
--
-- data (jsonb):
--   { "asOf": "2026-11-20", "totalInstallers": 175387,
--     "monthly":  [{"month": "2025-08", "new": 2418, "cumulative": 2418}, ...],
--     "window":   {"current": 2601, "previous": 2790, "returning": 340},
--     "components": [{"type": "agent", "name": "database/database-architect",
--                     "current": 386, "previous": 82}, ...] }
--   components holds every component with at least 3 installers in either
--   window, at most 1000, by current desc.

CREATE TABLE IF NOT EXISTS public.trending_installer_summary (
  id          smallint    PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  computed_at timestamptz NOT NULL DEFAULT now(),
  data        jsonb       NOT NULL
);

ALTER TABLE public.trending_installer_summary ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.trending_installer_summary FROM anon, authenticated;
GRANT SELECT ON public.trending_installer_summary TO anon;
DROP POLICY IF EXISTS "Public aggregates" ON public.trending_installer_summary;
CREATE POLICY "Public aggregates" ON public.trending_installer_summary
  FOR SELECT TO anon USING (true);

CREATE OR REPLACE FUNCTION public.refresh_trending_installer_summary()
RETURNS void
LANGUAGE plpgsql
SET search_path = ''
SET statement_timeout = '300s'
AS $$
DECLARE
  v_as_of timestamp := date_trunc('day', now() AT TIME ZONE 'UTC');
  v_data  jsonb;
BEGIN
  WITH base AS (
    SELECT d.ip_address,
           d.download_timestamp AT TIME ZONE 'UTC' AS ts,
           CASE WHEN d.component_type = 'function-hook' THEN 'mod' ELSE d.component_type END AS ctype,
           d.component_name AS cname
    FROM public.component_downloads d
    WHERE d.ip_address IS NOT NULL
      AND d.download_timestamp < (v_as_of AT TIME ZONE 'UTC')
  ),
  busy AS (
    SELECT ip_address, ts::date AS day FROM base GROUP BY 1, 2 HAVING count(*) > 50
  ),
  clean AS (
    SELECT CASE WHEN family(b.ip_address) = 6
                THEN network(set_masklen(b.ip_address, 64))::text
                ELSE host(b.ip_address) END AS installer,
           b.ts, b.ctype, b.cname
    FROM base b
    LEFT JOIN busy x ON x.ip_address = b.ip_address AND x.day = b.ts::date
    WHERE x.ip_address IS NULL
  ),
  first_seen AS (
    SELECT installer, date_trunc('month', min(ts)) AS m FROM clean GROUP BY 1
  ),
  monthly AS (
    SELECT to_char(m, 'YYYY-MM') AS month, count(*) AS n,
           sum(count(*)) OVER (ORDER BY m) AS cum
    FROM first_seen GROUP BY m
  ),
  recent AS (
    SELECT * FROM clean WHERE ts >= v_as_of - interval '63 days'
  ),
  win AS (
    SELECT count(DISTINCT installer) FILTER (WHERE ts >= v_as_of - interval '7 days') AS cur,
           count(DISTINCT installer) FILTER (WHERE ts >= v_as_of - interval '14 days'
                                               AND ts <  v_as_of - interval '7 days') AS prev
    FROM recent WHERE ts >= v_as_of - interval '14 days'
  ),
  per_installer AS (
    SELECT installer,
           bool_or(ts >= v_as_of - interval '7 days') AS in_cur,
           bool_or(ts <  v_as_of - interval '7 days') AS before
    FROM recent GROUP BY 1
  ),
  ret AS (
    SELECT count(*) FILTER (WHERE in_cur AND before) AS n FROM per_installer
  ),
  comp AS (
    SELECT ctype, cname,
           count(DISTINCT installer) FILTER (WHERE ts >= v_as_of - interval '7 days') AS cur,
           count(DISTINCT installer) FILTER (WHERE ts <  v_as_of - interval '7 days') AS prev
    FROM recent
    WHERE ts >= v_as_of - interval '14 days' AND ctype IS NOT NULL AND cname IS NOT NULL
    GROUP BY 1, 2
  ),
  comp_top AS (
    SELECT * FROM comp WHERE cur >= 3 OR prev >= 3 ORDER BY cur DESC, prev DESC LIMIT 1000
  )
  SELECT jsonb_build_object(
    'asOf', to_char(v_as_of, 'YYYY-MM-DD'),
    'totalInstallers', (SELECT count(*) FROM first_seen),
    'monthly', coalesce((SELECT jsonb_agg(jsonb_build_object('month', month, 'new', n, 'cumulative', cum) ORDER BY month) FROM monthly), '[]'::jsonb),
    'window', (SELECT jsonb_build_object('current', w.cur, 'previous', w.prev, 'returning', r.n) FROM win w, ret r),
    'components', coalesce((SELECT jsonb_agg(jsonb_build_object('type', ctype, 'name', cname, 'current', cur, 'previous', prev) ORDER BY cur DESC, prev DESC) FROM comp_top), '[]'::jsonb)
  ) INTO v_data;

  INSERT INTO public.trending_installer_summary AS s (id, computed_at, data)
  VALUES (1, now(), v_data)
  ON CONFLICT (id) DO UPDATE SET computed_at = excluded.computed_at, data = excluded.data;
END;
$$;

REVOKE ALL ON FUNCTION public.refresh_trending_installer_summary() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_trending_installer_summary() TO service_role;

-- Daily at 02:30 UTC, before update-json-data.yml (03:00 UTC) reads it.
CREATE EXTENSION IF NOT EXISTS pg_cron;
SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'refresh-trending-installer-summary';
SELECT cron.schedule('refresh-trending-installer-summary', '30 2 * * *',
                     'SELECT public.refresh_trending_installer_summary()');

SELECT public.refresh_trending_installer_summary();
