#!/usr/bin/env bash
set -euo pipefail

# Deploy script for claude-code-templates
# Deploys the Astro dashboard (Cloudflare Pages) which serves both
# www.aitmpl.com and app.aitmpl.com
#
# Required env vars (from .env):
#   CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID
#
# Usage:
#   ./scripts/deploy.sh           # Deploy www + app.aitmpl.com
#   ./scripts/deploy.sh dashboard # Same as above (backwards compat)

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

# Load .env if present
if [[ -f "$REPO_ROOT/.env" ]]; then
  set -a
  source "$REPO_ROOT/.env"
  set +a
fi

# Validate required vars
for var in CLOUDFLARE_API_TOKEN CLOUDFLARE_ACCOUNT_ID; do
  if [[ -z "${!var:-}" ]]; then
    echo "Error: $var is not set. Add it to .env" >&2
    exit 1
  fi
done

deploy() {
  echo "=> Building dashboard..."
  npm --prefix "$REPO_ROOT/dashboard" install
  npm --prefix "$REPO_ROOT/dashboard" run build
  echo "=> Deploying www.aitmpl.com + app.aitmpl.com (Cloudflare Pages)..."
  CLOUDFLARE_API_TOKEN="$CLOUDFLARE_API_TOKEN" \
  CLOUDFLARE_ACCOUNT_ID="$CLOUDFLARE_ACCOUNT_ID" \
    npx wrangler pages deploy "$REPO_ROOT/dashboard/dist" --project-name=aitmpl-dashboard --commit-dirty=true
  echo "=> Deployed successfully."
}

case "${1:-}" in
  ""|dashboard|all)
    deploy
    ;;
  *)
    echo "Usage: $0 [dashboard]"
    echo ""
    echo "  Deploys the Astro dashboard serving www.aitmpl.com + app.aitmpl.com"
    exit 1
    ;;
esac
