# Deployment Guide

## Static Export Configuration

### next.config.ts

```ts
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  output: 'export',
}

export default nextConfig
```

This outputs a fully static site to the `out/` directory.

### Requirements for Static Export

1. **No server-side APIs** — No `api/` routes, no server actions
2. **Dynamic routes need `generateStaticParams()`** — Every `[param]` route must enumerate all values at build time
3. **Server/client split** — Dynamic route pages must be server components that delegate to client components (see component-patterns.md)
4. **No `next/image` optimization** — Use standard `<img>` tags or add `images: { unoptimized: true }` to config
5. **No middleware** — Not supported in static export

### Build Command

```bash
npm run build
```

Output: `./out/` directory with static HTML/CSS/JS

## Cloudflare Pages

### First Deploy

```bash
npx wrangler pages deploy out --project-name my-project --branch main
```

### Subsequent Deploys

```bash
npm run build && npx wrangler pages deploy out --project-name my-project --branch main
```

### deploy.sh Helper

The template includes a `deploy.sh` script:

```bash
#!/usr/bin/env bash
set -euo pipefail

PROJECT_NAME="${1:-prototype}"
BRANCH="${2:-main}"

echo "Building..."
npm run build

echo "Deploying to Cloudflare Pages: $PROJECT_NAME"
npx wrangler pages deploy out \
  --project-name "$PROJECT_NAME" \
  --branch "$BRANCH"

echo "Done! Check your Cloudflare dashboard for the URL."
```

Usage: `bash deploy.sh my-project main`

### Cloudflare Pages Settings

If using the Cloudflare dashboard:
- **Build command:** `npm run build`
- **Build output directory:** `out`
- **Framework preset:** None (or Next.js static)
- **Node.js version:** 18+

### Notes
- The `@opennextjs/cloudflare` dependency in the template is optional — it's only needed if migrating to SSR later
- For pure static, Wrangler Pages deploy is all you need

## Vercel

### CLI Deploy

```bash
npx vercel --prod
```

Vercel auto-detects Next.js and handles static export.

### Vercel Settings

- **Framework:** Next.js (auto-detected)
- **Build command:** `npm run build`
- **Output directory:** `out` (auto-detected with `output: 'export'`)

### Notes
- Vercel is the simplest option — zero config
- Free tier supports custom domains
- Automatic preview deployments on push

## GitHub Pages

### Setup

1. Build the project: `npm run build`
2. The output is in `out/`
3. Configure GitHub Pages to serve from the branch/directory

### GitHub Actions Workflow

```yaml
name: Deploy to GitHub Pages
on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm install
      - run: npm run build
      - uses: peaceiris/actions-gh-pages@v4
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: ./out
```

### Notes
- Add `basePath: '/repo-name'` to `next.config.ts` if deploying to a subpath
- GitHub Pages is free for public repos

## Local Preview

To preview the static build locally:

```bash
npm run build
npx serve out
```

Or use Python:

```bash
cd out && python3 -m http.server 3000
```
