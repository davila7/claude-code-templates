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
