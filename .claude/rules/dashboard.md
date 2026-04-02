---
paths:
  - "dashboard/**"
---

# Dashboard — www.aitmpl.com & app.aitmpl.com

Astro 5 + React islands + Tailwind v4 application. Single Vercel project serving both domains.

## Stack

- **Framework**: Astro 5, `output: 'server'`
- **UI**: React islands for interactivity, Tailwind v4
- **Auth**: Clerk (via `window.Clerk` global, no ClerkProvider per island)
- **Data**: `components.json` and `trending-data.json` from `dashboard/public/`
- **APIs**: Astro API routes in `dashboard/src/pages/api/`

## API Routes

- Export named HTTP methods: `export const GET: APIRoute`, `export const POST: APIRoute`
- Use shared libs from `dashboard/src/lib/api/` (cors, neon, auth)
- CORS via `corsResponse()` / `jsonResponse()` from `dashboard/src/lib/api/cors.ts`

## React Islands

- Keep islands small and self-contained
- Auth: use `window.Clerk` global, never wrap in ClerkProvider
- Data fetching: load from same-origin JSON or API routes

## Featured Pages

Two files to edit:
- `dashboard/src/lib/constants.ts` — `FEATURED_ITEMS` array (metadata, install command, links)
- `dashboard/src/pages/featured/[slug].astro` — HTML content per slug

## Local Dev

```bash
cd dashboard && npm install && npx astro dev --port 4321
```

## Deployment

Always use the `deployer` agent. Never deploy manually. Node pinned to 22.x (v24 breaks Vercel builds).
