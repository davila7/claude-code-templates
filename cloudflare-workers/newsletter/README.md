# Newsletter — Weekly Community Components Email

Cloudflare Worker that composes and sends a simple weekly email featuring
trending components (one Skill, Agent, MCP, Hook and Setting per send, in
that fixed order) as a [Resend](https://resend.com) **Broadcast**.

- **Rotating selection**: each category pick is weighted-random by recent
  downloads — popular components appear more often, but every send differs.
- **Rotating copy**: subjects, catalog intro, per-component sentences, stat
  phrasing and closers are drawn from pools, so no two emails read the same.
- **Minimal formatting**: plain-text body plus a simple HTML version (bold +
  underlined component titles, clickable links, no styling beyond that).
- **Unsubscribe built-in**: the body carries `{{{RESEND_UNSUBSCRIBE_URL}}}`;
  Resend replaces it per recipient, hosts the unsubscribe page, and skips
  unsubscribed contacts on future broadcasts automatically.
- **Replies** go to `NEWSLETTER_REPLY_TO`.
- **Tracking**: open/click tracking enabled on the `aitmpl.com` domain with
  tracking subdomain `track.aitmpl.com`. Per-broadcast metrics (delivered,
  opens, clicks per link) at resend.com/broadcasts.
- Data sources: `https://www.aitmpl.com/trending-data.json` and
  `/components.json` (static dashboard assets).

## Safety gate

The broadcast targets the segment in the `RESEND_SEGMENT_ID` secret. Point it
at a small pilot segment for tests, or the full-audience segment for
community-wide sends. Nothing outside that segment can receive the email.

## Schedule

Cron: Sundays 16:00 UTC (`0 16 * * SUN`). Note: the Cloudflare account's free
plan allows 5 cron triggers; this slot was freed by decommissioning the
`claude-docs-monitor` worker (2026-07).

## Endpoints

```bash
# Preview the generated email WITHOUT sending (hit repeatedly to see rotation)
curl "https://aitmpl-newsletter.<subdomain>.workers.dev/preview?format=text" \
  -H "Authorization: Bearer $TRIGGER_SECRET"

# Dry run (full runner, no send)
curl -X POST "https://aitmpl-newsletter.<subdomain>.workers.dev/trigger?send=false" \
  -H "Authorization: Bearer $TRIGGER_SECRET"

# Real send: creates + sends a Broadcast to RESEND_SEGMENT_ID
curl -X POST "https://aitmpl-newsletter.<subdomain>.workers.dev/trigger" \
  -H "Authorization: Bearer $TRIGGER_SECRET"

# Health
curl "https://aitmpl-newsletter.<subdomain>.workers.dev/status"
```

## Development & Deploy

```bash
cd cloudflare-workers/newsletter
npm run dev          # Local dev (http://localhost:8787)
npx wrangler deploy  # Deploy
```

## Configuration

Public vars live in `wrangler.toml` `[vars]`: `DASHBOARD_URL`,
`RESEND_FROM_EMAIL`.

Secrets (via `wrangler secret put <KEY>`):

| Secret | Purpose |
|---|---|
| `RESEND_API_KEY` | Resend **full access** API key (broadcasts + segments) |
| `RESEND_SEGMENT_ID` | Segment the broadcast targets (pilot or full audience) |
| `NEWSLETTER_REPLY_TO` | Reply-to address for the newsletter |
| `TRIGGER_SECRET` | Auth for `/trigger` and `/preview` |
| `SENTRY_DSN` | Optional — error reporting + cron check-ins (`newsletter-weekly` monitor slug) |

## Growing the audience

Contacts are loaded from Clerk (production instance) into Resend segments.
The pilot batches were loaded with an ad-hoc script (Clerk API → `resend
contacts create` + `add-segment`); the full-audience sync follows the same
pattern over all users. Resend excludes unsubscribed/bounced contacts
automatically.
