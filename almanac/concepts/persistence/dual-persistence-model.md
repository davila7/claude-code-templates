---
title: "Dual Persistence Model"
summary: "Why this repository uses Supabase for component download tracking and Neon for command usage, release monitoring, collections, health checks, and dashboard APIs."
topics: [concepts]
sources:
  - id: supabase-downloads
    type: file
    path: api/track-download-supabase.js
  - id: command-usage
    type: file
    path: api/track-command-usage.js
  - id: neon-lib
    type: file
    path: api/_lib/neon.js
  - id: dashboard-neon-lib
    type: file
    path: dashboard/src/lib/api/neon.ts
  - id: migrations-dir
    type: file
    path: database/migrations/
  - id: api-readme
    type: file
    path: api/README.md
  - id: collections-api
    type: file
    path: dashboard/src/pages/api/collections/index.ts
  - id: collection-items-api
    type: file
    path: dashboard/src/pages/api/collections/items.ts
  - id: collection-share-api
    type: file
    path: dashboard/src/pages/api/collections/share.ts
  - id: website-events-api
    type: file
    path: dashboard/src/pages/api/track-website-events.ts
  - id: health-check-api
    type: file
    path: dashboard/src/pages/api/health-check.ts
---

# Dual Persistence Model

The dual persistence model is the repository's split between Supabase and Neon. Supabase is used by the component download tracking endpoint, which writes raw install events to `component_downloads` and updates aggregate `download_stats` [@supabase-downloads]. Neon is used for command usage logs, release monitoring tables, dashboard collection APIs, website events, installation outcome tracking, health checks, and other server-side dashboard data paths [@command-usage] [@dashboard-neon-lib] [@api-readme]. The practical rule is that download counts have a dedicated Supabase endpoint, while most newer PostgreSQL-backed API surfaces use Neon.

## Supabase Download Tracking

`api/track-download-supabase.js` constructs a Supabase service client from `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` [@supabase-downloads]. It accepts only POST requests, validates component type and name, captures client IP, country, user agent, CLI version, and component metadata, then inserts a row into `component_downloads` [@supabase-downloads].

The same endpoint also upserts a compact aggregate row in `download_stats` using `component_type` and `component_name` as the conflict target [@supabase-downloads]. If the aggregate update fails, the endpoint logs the error but does not fail the request, so raw download logging is treated as more important than the derived count update [@supabase-downloads].

The API README marks `/api/track-download-supabase` as the critical component installation tracking endpoint and explicitly names Supabase as its database, with `component_downloads` and `download_stats` as the relevant tables [@api-readme]. That is the clearest documented boundary for the Supabase side of the split.

## Neon As The Shared API Database

Neon is wrapped by small helpers that read `NEON_DATABASE_URL` and return the serverless Neon SQL client. The API helper reads from `process.env`, while the dashboard helper can read from either `import.meta.env` or `process.env` [@neon-lib] [@dashboard-neon-lib]. That helper pattern is repeated across API and dashboard runtime code, making Neon the default SQL persistence layer for many newer endpoints.

`api/track-command-usage.js` is the simplest Neon example. It validates command names against a fixed allowlist, then inserts command, CLI version, Node version, platform, architecture, session id, and metadata into `command_usage_logs` [@command-usage]. The migration directory defines `command_usage_logs`, an aggregate `command_usage_stats` table, indexes, a trigger to update stats after inserts, and views for daily usage, platform distribution, and popular commands over thirty days [@migrations-dir].

The same migration directory also defines release-monitoring tables for Claude Code versions, parsed changes, Discord notification logs, and monitoring metadata [@migrations-dir]. The API README identifies `/api/claude-code-check` as the release monitor and names Neon tables such as `claude_code_versions` and `claude_code_changes` [@api-readme].

## Dashboard-Owned Neon Data

Dashboard collection APIs also use Neon. The collections index endpoint authenticates the Clerk user, fetches `user_collections`, fetches matching `collection_items`, groups items by collection id, and creates new collections with per-user positions [@collections-api]. The collection items endpoint verifies collection ownership before adding, deleting, or moving items, and it prevents duplicate component paths within a collection [@collection-items-api].

Sharing is another Neon-backed dashboard feature. The share endpoint toggles `share_slug` and `is_public`, generates an eight-character slug with retry checks, and exposes a public read path that returns only public-safe collection and item fields [@collection-share-api]. That public response deliberately avoids internal ids and Clerk user ids, using Clerk only to derive a display name when possible [@collection-share-api].

Neon is also used for dashboard analytics and monitoring. The website events endpoint batches up to fifty validated events into `website_events` with session, visitor, referrer, country, and screen-width fields [@website-events-api]. The health check endpoint probes production API routes, writes results into `api_health_logs`, and sends Discord alerts when endpoints fail or time out [@health-check-api].

## Why The Split Matters

This split means contributors should not assume one database owns all production state. Download tracking depends on Supabase credentials and table names, while command usage, release monitoring, collections, website events, and health logs depend on `NEON_DATABASE_URL` [@supabase-downloads] [@neon-lib] [@dashboard-neon-lib]. The migration directory currently documents some Neon tables, especially command usage and release monitoring, but API code also references additional Neon tables such as collection, event, and health-log tables [@migrations-dir] [@collections-api] [@website-events-api] [@health-check-api].

The safe mental model is to identify the endpoint first, then follow its database helper. If the route imports Supabase or writes `component_downloads`, it belongs to the download-counting side. If it uses the Neon SQL helper or imports `@neondatabase/serverless`, it belongs to the shared PostgreSQL side.
