# CCT Ads integration contract

Sponsored placements are written by the private `davila7/aitmpl-ads` service
(payments, review, admin) and rendered here. This file is kept identical in
both repos (`docs/ads-contract.md` there). Change it in both, the same day:
first the side that adds a field, then the side that reads it.

## 1. Database (shared Neon)

The public dashboard reads only the view, never the table:

```sql
CREATE VIEW sponsored_ads_live AS
SELECT id, component_type, component_path, component_name, starts_at, ends_at
FROM sponsored_ads
WHERE status = 'active' AND ends_at > now();
```

- Created by `aitmpl-ads/src/lib/ads/migration-002-review.sql`.
- `active` means paid **and** approved in review. Rows `pending` or
  `in_review` never appear in the view.
- `component_type` is plural (`agents`, `skills`, ...). `component_path` is
  the catalog `path` (relative to `cli-tool/components/<type>/`).
- Recommended: the public `NEON_DATABASE_URL` uses a role with `SELECT` on the
  view only (`ads_reader`).

## 2. `GET https://www.aitmpl.com/api/ads/active` (contract 2)

```json
{
  "contract": 2,
  "ads": [
    { "id": "uuid", "component_type": "skills", "component_path": "dev/name",
      "component_name": "name", "ends_at": "2026-12-01T00:00:00.000Z" }
  ]
}
```

- Ordered by `starts_at` (earliest buyer first). Never contains email, user,
  amounts or Stripe ids.
- Returns `{ "contract": 2, "ads": [] }` while `PUBLIC_ADS_ENABLED` is off and
  on any error (fail open).
- Contract 1 was the same without `id` and `contract`; readers must ignore
  unknown fields.
- Readers: `dashboard/src/lib/ads.ts` (grid, Cmd+K, component page) and
  `.github/workflows/promoted-component-lock.yml`.

## 3. `GET https://admin.aitmpl.com/api/ads/slot` (served by aitmpl-ads)

```json
{ "occupied": true, "occupied_until": "ISO-8601", "reason": "active" | "review" | "pending" | null,
  "component_type": "skills" | null, "component_name": "name" | null }
```

- `reason: "review"`: a paid ad waits for approval; `occupied_until` is an
  upper bound. `component_*` is only set for `active`.
- Reader: `dashboard/src/pages/promote.astro`.

## Rendering rules (project invariants)

- The sponsored component is shown in an extra slot labeled "Sponsored",
  above the organic grid and the Cmd+K results. The organic list is never
  reordered or trimmed; the component also keeps its organic position.
- Sponsored data never enters search ranking, category order, install
  recommendations or the Catalog API (`/api/v1/`).

## Planned (spec phase 5, not built)

`POST https://admin.aitmpl.com/api/ads/event` with
`{ "ad_id", "kind": "impression" | "click", "surface": "grid" | "search" | "page" }`,
sent with `navigator.sendBeacon`, no cookies or user id, skipped when the
browser sends Do Not Track.
