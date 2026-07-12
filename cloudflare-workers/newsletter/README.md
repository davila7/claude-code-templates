# Newsletter — Biweekly Community Components Email

Cloudflare Worker that composes and sends a simple email featuring trending
components (one Skill, Agent, MCP, Hook and Setting per send, in that fixed
order) to the community, every two weeks.

## Architecture

- **Subscribers live in Neon** (`email_subscribers` table, migration
  `database/migrations/003_create_email_subscribers.sql`), synced from Clerk
  (the source of truth for accounts). Columns include a per-subscriber
  `unsubscribe_token` (UUID) and `last_sent_at` / `unsubscribed_at`.
- **Delivery via Resend's transactional batch API** (`POST /emails/batch`,
  100 emails per call) — deliberately NOT Resend Broadcasts/Audiences, whose
  marketing-contacts quota gets expensive at this audience size. The
  transactional Pro plan (50K emails/month) covers the biweekly cadence
  (~10.8K subscribers × 2 sends/month ≈ 22K) with room to grow.
- **Unsubscribe is owned by this worker**: every email carries a tokenized
  link to the public `GET/POST /unsubscribe` endpoint here, plus RFC 8058
  `List-Unsubscribe` / `List-Unsubscribe-Post` headers for one-click
  unsubscribe in Gmail and friends. Unsubscribed rows are excluded from all
  future sends.
- **Rotating content**: component picks are weighted-random by recent
  downloads; subjects, catalog intro, per-component sentences, stat phrasing
  and closers rotate from pools, so no two emails read the same. Data comes
  from the live `trending-data.json` + `components.json`. Body is plain text
  plus minimal HTML (bold + underlined titles, clickable links).
- **Zero npm runtime deps**: Neon is queried over its HTTP SQL API with
  `fetch()`.

## Schedule & chunking

The cron fires **every 10 minutes on Sundays 16:00–17:50 UTC**
(`*/10 16-17 * * SUN`) but only sends on **even ISO weeks** (biweekly —
Cloudflare cron can't express "every 2 weeks"). Each firing processes up to
1,000 pending subscribers (10 Resend batches; the Workers free plan allows 50
subrequests per invocation), marks them `last_sent_at`, and later firings
drain the rest. When nothing is pending a firing is a cheap no-op — which
also makes cron double-fires harmless.

## Endpoints

```bash
# Preview the generated email WITHOUT sending (hit repeatedly to see rotation)
curl "https://aitmpl-newsletter.<subdomain>.workers.dev/preview?format=text" \
  -H "Authorization: Bearer $TRIGGER_SECRET"

# Dry run (counts the pending chunk, composes, sends nothing)
curl -X POST "https://aitmpl-newsletter.<subdomain>.workers.dev/trigger?send=false" \
  -H "Authorization: Bearer $TRIGGER_SECRET"

# Real send: ONE chunk of up to 1,000 pending subscribers per call.
# Repeat until the response shows remaining: 0.
curl -X POST "https://aitmpl-newsletter.<subdomain>.workers.dev/trigger" \
  -H "Authorization: Bearer $TRIGGER_SECRET"

# Public unsubscribe (linked from every email)
# GET/POST /unsubscribe?token=<uuid>

# Incremental Clerk sync (also runs automatically before scheduled sends)
curl -X POST "https://aitmpl-newsletter.<subdomain>.workers.dev/sync" \
  -H "Authorization: Bearer $TRIGGER_SECRET"

# Campaign engagement stats (opens, clicks per link, bounces, unsubscribes)
curl "https://aitmpl-newsletter.<subdomain>.workers.dev/stats?campaign=newsletter-2026-07-26" \
  -H "Authorization: Bearer $TRIGGER_SECRET"

# Health
curl "https://aitmpl-newsletter.<subdomain>.workers.dev/status"
```

## Subscriber sync

Initial load was a one-off script (all verified Clerk users). From then on the
worker syncs **incrementally and automatically before every scheduled send**:
it walks Clerk newest-first and stops at the first page where every user is
already known, so a run typically costs 1–3 subrequests. Known emails under a
new Clerk account are skipped (no duplicates); rows are never deleted so
unsubscribe state survives. `POST /sync` (auth) runs it manually.

## Open/click tracking

Domain-level open & click tracking (subdomain `track.aitmpl.com`) applies to
these transactional sends. Engagement flows back via a Resend **webhook**
(`email.opened/clicked/bounced/complained` → `POST /webhooks/resend`,
svix-signature verified, no SDK) into the Neon `email_events` table
(migration `004_create_email_events.sql`). Every email is tagged
`campaign=newsletter-YYYY-MM-DD`, and `GET /stats` (auth, optional
`?campaign=`) aggregates unique opens, clicks per link, bounces, complaints
and subscriber/unsubscribe totals per campaign.

## Development & Deploy

```bash
cd cloudflare-workers/newsletter
npm run dev          # Local dev (http://localhost:8787)
npx wrangler deploy  # Deploy
```

## Configuration

Public vars in `wrangler.toml` `[vars]`: `DASHBOARD_URL`, `RESEND_FROM_EMAIL`,
`UNSUBSCRIBE_BASE_URL` (this worker's public URL).

Secrets (via `wrangler secret put <KEY>`):

| Secret | Purpose |
|---|---|
| `RESEND_API_KEY` | Resend API key (transactional sends) |
| `NEON_DATABASE_URL` | Neon Postgres connection string (email_subscribers + email_events) |
| `CLERK_SECRET_KEY` | Clerk production key (incremental subscriber sync) |
| `RESEND_WEBHOOK_SECRET` | svix signing secret for `/webhooks/resend` |
| `NEWSLETTER_REPLY_TO` | Reply-to address for the newsletter |
| `TRIGGER_SECRET` | Auth for `/trigger`, `/preview`, `/sync`, `/stats` |
| `SENTRY_DSN` | Optional — error reporting + cron check-ins (`newsletter-weekly` monitor slug) |

## History

- 2026-07: first sends went out as Resend Broadcasts to segments; that path
  was abandoned when the full audience (10.8K) exceeded the marketing
  contacts quota (Pro marketing tier for 25K contacts costs $180/mo vs $20/mo
  transactional). The `claude-docs-monitor` worker was decommissioned to free
  the account's 5th cron-trigger slot for this worker.
