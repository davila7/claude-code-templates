-- Supabase (download tracking project): returning installers per week (IVS),
-- new installers, and how many of each week's new installers come back.
-- Run in the Supabase SQL editor, like 003 and 004; not part of the Neon
-- migrations above. It creates one read-only function and changes no data.
--
-- Definitions (traction plan, 2026-11-07):
--   installer       an IPv4 address, or the /64 network of an IPv6 address.
--                   IP-days with more than 50 rows (scripts) are dropped
--                   first, counted per raw IP before the /64 grouping.
--   week            ISO week in UTC, Monday 00:00 to Sunday 24:00.
--   active          installers with at least one download in the week.
--   returning       active installers that also downloaded in any of the 8
--                   previous weeks. This is the north star (IVS).
--   new             active minus returning.
--   class           per installer and week, from the signals CLI 1.32 sends
--                   (rows since 2026-11-03 20:00 UTC): agent if any row has
--                   client_agent; else person if any row has client_is_tty
--                   true; else script if any row has it false; else unknown
--                   (older CLIs, and every row before that date).
--   new_back_w1     of the week's new installers, those active the next week.
--   new_back_w4     of the week's new installers, those active in any of the
--                   next 4 weeks. Control metric: the IVS also rises when only
--                   more people arrive.
-- Columns that depend on weeks after p_until are NULL until those weeks end.
--
-- Baseline, reproduced with this query on 2026-11-08: returning installers
-- 621 / 544 / 423 / 447 / 361 for the weeks of 2026-09-28 to 2026-10-26
-- (444 a week in October, 12.7% of active); new installers 3,775 / 2,878 /
-- 2,773 / 2,737 for 2026-10-05 to 2026-10-26. Return of new installers, cohorts
-- 2026-08-10 to 2026-09-28: next week 3.9% to 5.8%, within 4 weeks 6.8% to
-- 8.4%. (The plan's 6.8% to 8.5% counted a cohort as "first seen since
-- 2026-07-13", a look-back that grew from 4 to 12 weeks; here it is always the
-- same 8 weeks that define "new".)
--
-- Cost: the scan starts 8 weeks before the first reported week and uses
-- idx_download_timestamp (a date filter on created_at times out). p_weeks is
-- clamped to 1..26. 13 weeks took 1.8 s on 2026-11-08 (431K rows); PostgREST
-- stops a request at 8 s (authenticator statement_timeout).
--
-- Callers: cloudflare-workers/pulse, with the service_role key, as
--   POST /rest/v1/rpc/weekly_returning_installers   {"p_weeks": 8}
-- and by hand:
--   SELECT * FROM public.weekly_returning_installers();                   -- 12 weeks up to now
--   SELECT * FROM public.weekly_returning_installers(13, '2026-11-08 00:00+00');

CREATE OR REPLACE FUNCTION public.weekly_returning_installers(
  p_weeks integer DEFAULT 12,
  p_until timestamptz DEFAULT now()
)
RETURNS TABLE (
  week_start date,
  week_complete boolean,
  active_installers integer,
  returning_installers integer,
  new_installers integer,
  returning_pct numeric,
  agent_active integer,
  agent_returning integer,
  person_active integer,
  person_returning integer,
  script_active integer,
  script_returning integer,
  unknown_active integer,
  unknown_returning integer,
  new_back_w1 integer,
  new_back_w1_pct numeric,
  new_back_w4 integer,
  new_back_w4_pct numeric
)
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  WITH params AS (
    SELECT coalesce(p_until, now()) AS until_tz,
           coalesce(p_until, now()) AT TIME ZONE 'UTC' AS until_ts,
           (date_trunc('week', coalesce(p_until, now()) AT TIME ZONE 'UTC')
             - make_interval(weeks => least(greatest(coalesce(p_weeks, 12), 1), 26) - 1))::date AS first_wk
  ),
  base AS (
    SELECT d.ip_address,
           d.download_timestamp AT TIME ZONE 'UTC' AS ts,
           d.client_agent,
           d.client_is_tty
    FROM public.component_downloads d
    WHERE d.download_timestamp >= (SELECT (first_wk - 56)::timestamp AT TIME ZONE 'UTC' FROM params)
      AND d.download_timestamp < (SELECT until_tz FROM params)
      AND d.ip_address IS NOT NULL
  ),
  busy AS (
    SELECT ip_address, ts::date AS d
    FROM base
    GROUP BY 1, 2
    HAVING count(*) > 50
  ),
  installer_weeks AS (
    SELECT CASE WHEN family(b.ip_address) = 6
                THEN network(set_masklen(b.ip_address, 64))::text
                ELSE host(b.ip_address) END AS installer,
           date_trunc('week', b.ts)::date AS wk,
           CASE WHEN bool_or(b.client_agent IS NOT NULL) THEN 'agent'
                WHEN bool_or(b.client_is_tty) THEN 'person'
                WHEN bool_or(NOT b.client_is_tty) THEN 'script'
                ELSE 'unknown' END AS cls
    FROM base b
    LEFT JOIN busy x ON x.ip_address = b.ip_address AND x.d = b.ts::date
    WHERE x.ip_address IS NULL
    GROUP BY 1, 2
  ),
  flags AS (
    SELECT wk,
           cls,
           coalesce(lag(wk) OVER w >= wk - 56, false) AS is_returning,
           coalesce(lead(wk) OVER w = wk + 7, false) AS back_w1,
           coalesce(lead(wk) OVER w <= wk + 28, false) AS back_w4
    FROM installer_weeks
    WINDOW w AS (PARTITION BY installer ORDER BY wk)
  )
  SELECT f.wk,
         (f.wk + 7)::timestamp <= p.until_ts,
         count(*)::integer,
         count(*) FILTER (WHERE f.is_returning)::integer,
         count(*) FILTER (WHERE NOT f.is_returning)::integer,
         round(100.0 * count(*) FILTER (WHERE f.is_returning) / count(*), 1),
         count(*) FILTER (WHERE f.cls = 'agent')::integer,
         count(*) FILTER (WHERE f.cls = 'agent' AND f.is_returning)::integer,
         count(*) FILTER (WHERE f.cls = 'person')::integer,
         count(*) FILTER (WHERE f.cls = 'person' AND f.is_returning)::integer,
         count(*) FILTER (WHERE f.cls = 'script')::integer,
         count(*) FILTER (WHERE f.cls = 'script' AND f.is_returning)::integer,
         count(*) FILTER (WHERE f.cls = 'unknown')::integer,
         count(*) FILTER (WHERE f.cls = 'unknown' AND f.is_returning)::integer,
         CASE WHEN (f.wk + 14)::timestamp <= p.until_ts
              THEN count(*) FILTER (WHERE NOT f.is_returning AND f.back_w1)::integer END,
         CASE WHEN (f.wk + 14)::timestamp <= p.until_ts
              THEN round(100.0 * count(*) FILTER (WHERE NOT f.is_returning AND f.back_w1)
                         / nullif(count(*) FILTER (WHERE NOT f.is_returning), 0), 1) END,
         CASE WHEN (f.wk + 35)::timestamp <= p.until_ts
              THEN count(*) FILTER (WHERE NOT f.is_returning AND f.back_w4)::integer END,
         CASE WHEN (f.wk + 35)::timestamp <= p.until_ts
              THEN round(100.0 * count(*) FILTER (WHERE NOT f.is_returning AND f.back_w4)
                         / nullif(count(*) FILTER (WHERE NOT f.is_returning), 0), 1) END
  FROM flags f
  CROSS JOIN params p
  WHERE f.wk >= p.first_wk
  GROUP BY f.wk, p.until_ts
  ORDER BY f.wk
$$;

COMMENT ON FUNCTION public.weekly_returning_installers(integer, timestamptz) IS
  'Returning installers per ISO week (IVS), new installers, and the next-week and 4-week return of new installers. See database/migrations/005_weekly_returning_installers.sql.';

-- Only the service_role key (pulse, scripts) may call it. Supabase grants
-- EXECUTE on new public functions to anon and authenticated by default.
REVOKE ALL ON FUNCTION public.weekly_returning_installers(integer, timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.weekly_returning_installers(integer, timestamptz) TO service_role;

-- Make PostgREST see the function right away.
NOTIFY pgrst, 'reload schema';

-- Check: anon must be false, service_role true; then the October baseline.
-- SELECT has_function_privilege('anon', 'public.weekly_returning_installers(integer, timestamptz)', 'EXECUTE') AS anon,
--        has_function_privilege('service_role', 'public.weekly_returning_installers(integer, timestamptz)', 'EXECUTE') AS service_role;
-- SELECT week_start, active_installers, returning_installers, new_installers
-- FROM public.weekly_returning_installers(6, '2026-11-02 00:00+00');

-- Rollback:
--   DROP FUNCTION IF EXISTS public.weekly_returning_installers(integer, timestamptz);
