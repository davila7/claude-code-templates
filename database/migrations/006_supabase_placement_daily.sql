-- Supabase (download tracking project): impressions and clicks of every paid
-- or partner placement on aitmpl.com, so a sponsor can be told what a slot
-- delivers. Run in the Supabase SQL editor, like 003-005.
--
-- Written by dashboard/src/pages/api/spot.ts (one RPC call per event), read by
-- pulse (cloudflare-workers/pulse, SPONSORS section) and by placement_report().
--
-- Privacy: daily counters only. No IP, no user agent, no cookie, no visitor id:
-- a row says "on this day, this placement had N impressions from this country".
-- That is also why there is no "unique visitors" per placement.
--
-- Placement id: '<kind>/<key>', e.g. 'featured/forte' (FEATURED_ITEMS in
-- dashboard/src/lib/constants.ts) or 'sponsored/<sponsored_ads.id>' (CCT Ads).
-- Surface: where it was shown ('home', 'featured_page', 'grid', 'search', ...).
-- Event:
--   impression  at least half of it (or 30% of the screen, if it is taller)
--               was on screen for one second; counted once per page view
--   click       a click on an aitmpl.com link inside it (e.g. card -> /featured/x)
--   cta         a click on a link to another site inside it (the sponsor's site)
--   copy        the install command inside it was copied
-- Country: Cloudflare's cf-ipcountry, '--' when unknown.

CREATE TABLE IF NOT EXISTS public.placement_daily (
  day        date   NOT NULL,
  placement  text   NOT NULL CHECK (placement ~ '^[a-z]+/[A-Za-z0-9_-]{1,64}$'),
  surface    text   NOT NULL CHECK (surface ~ '^[a-z_]{1,24}$'),
  event      text   NOT NULL CHECK (event IN ('impression', 'click', 'cta', 'copy')),
  country    text   NOT NULL DEFAULT '--' CHECK (country ~ '^([A-Z]{2}|--)$'),
  n          bigint NOT NULL DEFAULT 0,
  PRIMARY KEY (day, placement, surface, event, country)
);

-- Only service_role (the dashboard endpoint, pulse) reads or writes it.
ALTER TABLE public.placement_daily ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.placement_daily FROM anon, authenticated;

-- Atomic +1. PostgREST upserts cannot increment, hence the function.
CREATE OR REPLACE FUNCTION public.record_placement_event(
  p_placement text,
  p_surface   text,
  p_event     text,
  p_country   text DEFAULT '--'
) RETURNS void
LANGUAGE sql
SET search_path = public
AS $$
  INSERT INTO public.placement_daily AS d (day, placement, surface, event, country, n)
  VALUES ((now() AT TIME ZONE 'utc')::date, p_placement, p_surface, p_event, coalesce(p_country, '--'), 1)
  ON CONFLICT (day, placement, surface, event, country)
  DO UPDATE SET n = d.n + 1;
$$;

-- One row per placement and surface for [p_from, p_to] (UTC days, inclusive).
-- click_rate = clicks / impressions, cta_rate = (cta + copy) / impressions,
-- us_share = share of impressions from the US.
CREATE OR REPLACE FUNCTION public.placement_report(
  p_from date DEFAULT ((now() AT TIME ZONE 'utc')::date - 30),
  p_to   date DEFAULT ((now() AT TIME ZONE 'utc')::date - 1)
) RETURNS TABLE (
  placement   text,
  surface     text,
  impressions bigint,
  clicks      bigint,
  ctas        bigint,
  copies      bigint,
  click_rate  numeric,
  cta_rate    numeric,
  us_share    numeric,
  first_day   date,
  last_day    date
)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT
    placement,
    surface,
    coalesce(sum(n) FILTER (WHERE event = 'impression'), 0)::bigint          AS impressions,
    coalesce(sum(n) FILTER (WHERE event = 'click'), 0)::bigint               AS clicks,
    coalesce(sum(n) FILTER (WHERE event = 'cta'), 0)::bigint                 AS ctas,
    coalesce(sum(n) FILTER (WHERE event = 'copy'), 0)::bigint                AS copies,
    round(100.0 * coalesce(sum(n) FILTER (WHERE event = 'click'), 0)
          / nullif(sum(n) FILTER (WHERE event = 'impression'), 0), 2)        AS click_rate,
    round(100.0 * coalesce(sum(n) FILTER (WHERE event IN ('cta', 'copy')), 0)
          / nullif(sum(n) FILTER (WHERE event = 'impression'), 0), 2)        AS cta_rate,
    round(100.0 * coalesce(sum(n) FILTER (WHERE event = 'impression' AND country = 'US'), 0)
          / nullif(sum(n) FILTER (WHERE event = 'impression'), 0), 1)        AS us_share,
    min(day)                                                                 AS first_day,
    max(day)                                                                 AS last_day
  FROM public.placement_daily
  WHERE day BETWEEN p_from AND p_to
  GROUP BY placement, surface
  ORDER BY placement, surface;
$$;

REVOKE ALL ON FUNCTION public.record_placement_event(text, text, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.placement_report(date, date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_placement_event(text, text, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.placement_report(date, date) TO service_role;

NOTIFY pgrst, 'reload schema';

-- Checks:
-- SELECT * FROM public.placement_report();                          -- last 30 full days
-- SELECT * FROM public.placement_report('2026-12-01', '2026-12-31'); -- a calendar month
-- Impressions by country for one placement (the sponsor's "where are they from"):
-- SELECT country, sum(n) AS impressions,
--        round(100.0 * sum(n) / sum(sum(n)) OVER (), 1) AS pct
-- FROM public.placement_daily
-- WHERE placement = 'featured/forte' AND event = 'impression'
--   AND day >= current_date - 30
-- GROUP BY country ORDER BY impressions DESC LIMIT 15;
