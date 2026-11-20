# Sponsor metrics

What a sponsor asks before paying, where each number comes from, and how to get
it. Started 2026-11-18 after Forte asked for visitors, slot impressions, CTR,
region split and terms, and we had only the first and the fourth.

| Sponsor asks | Source | How to get it |
|---|---|---|
| Monthly visitors | GA4 (property in team memory), `activeUsers` / `screenPageViews` | pulse `SPONSOR KIT` section, last 30 complete days |
| Region split, US share | GA4 `countryId`: share of users **and** of engaged sessions | same section. Use the engaged share for bot-heavy countries (Singapore: ~6% of users, almost no engagement) |
| Impressions of the slot | `placement_daily` (Supabase, migration 006), `event = 'impression'` | `SELECT * FROM placement_report()` or the pulse section |
| Clicks, CTR | `click` (to an aitmpl.com page, e.g. card → `/featured/x`), `cta` (link to the sponsor's site), `copy` (install command copied) | `placement_report()`: `click_rate`, `cta_rate` |
| Where the slot's viewers are | `placement_daily.country` | query at the end of migration 006 |
| Traffic where the slot sits | GA4 views of `/` | pulse section, `Home page` line |

On demand (no Telegram): `POST https://pulse-weekly-report.<subdomain>.workers.dev/trigger?source=sponsors&send=false`
with `Authorization: Bearer $TRIGGER_SECRET`. A calendar month for an invoice or an
end-of-month report: `SELECT * FROM placement_report('2026-12-01', '2026-12-31');`.

## How a placement is counted

Any element with `data-spot="<kind>/<key>"` and `data-spot-surface="<where>"`
(`lib/placements.ts`) is watched by `lib/placement-tracking.ts`, started in
`DashboardLayout.astro`:

- **impression**: at least half of the element (or 30% of the screen, if the
  element is taller) visible for 1 s in a visible tab, once per page view
  (IAB viewability). `data-spot-view="load"` counts on page load instead, for a
  whole sponsor page.
- **click** / **cta**: a click on a link inside it, same site / another site.
  `data-spot-ignore` skips a link (a page's own "Back" link).
- **copy**: a click on an element marked `data-spot-copy` inside it.

Kinds: `featured/<slug>` (`FEATURED_ITEMS`, home card + `/featured/<slug>` page)
and `sponsored/<uuid>` (CCT Ads, `sponsored_ads.id` in aitmpl-ads). The endpoint
(`/api/spot`) accepts only featured slugs that exist and UUID-shaped sponsored
keys, drops bots by user agent, drops cross-site posts (`Sec-Fetch-Site`), and
stores a daily counter per placement, surface, event and country. Nothing that
identifies a person is stored (see `/privacy#placement-counts`), so there are no
unique visitors per placement.

The path and attribute names avoid words that ad-block lists match (`ad`,
`sponsor`, `track`, `beacon`, `analytics`, `pixel`). Keep it that way: renaming
the endpoint to `/api/ads/...` would silently lose part of a developer audience.

## Limits to say out loud to a sponsor

- Counts are first-party and filtered (JS required, bot user agents dropped,
  viewability rule). They are lower than raw page views by design.
- Anyone can post to a public endpoint; the checks stop casual inflation, not a
  determined one. Do not bill per impression on these numbers; quote them as
  delivery reporting.
- GA4 covers every page only since 2026-11-03, so no full month exists before
  2026-12-03. Until then a monthly figure is a projection.
- The README sponsor (Proxy-Seller) is on GitHub: we cannot count its impressions,
  and its clicks are measured by the sponsor's own link.

## Adding a placement

1. Put `data-spot` + `data-spot-surface` on its root element (a new surface or
   kind goes in `lib/placements.ts` **and** the CHECK in migration 006).
2. A new kind needs a key check in `src/pages/api/spot.ts`.
3. For CCT Ads, the grid card and the Cmd+K row get
   `data-spot={`sponsored/${ad.id}`}` with surface `grid` / `search` (needs the
   contract-2 `id` from PR #1451).
