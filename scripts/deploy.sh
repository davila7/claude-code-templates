#!/usr/bin/env bash
set -euo pipefail

# Deploy script for claude-code-templates monorepo
# Ensures the correct Vercel project is targeted for each app.
#
# Required env vars (from .env):
#   VERCEL_ORG_ID, VERCEL_SITE_PROJECT_ID, VERCEL_DASHBOARD_PROJECT_ID
#
# Usage:
#   ./scripts/deploy.sh site        # Deploy www.aitmpl.com
#   ./scripts/deploy.sh dashboard   # Deploy app.aitmpl.com
#   ./scripts/deploy.sh all         # Deploy both

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

# Load .env if present
if [[ -f "$REPO_ROOT/.env" ]]; then
  set -a
  source "$REPO_ROOT/.env"
  set +a
fi

# Validate required vars
for var in VERCEL_ORG_ID VERCEL_SITE_PROJECT_ID VERCEL_DASHBOARD_PROJECT_ID; do
  if [[ -z "${!var:-}" ]]; then
    echo "Error: $var is not set. Add it to .env" >&2
    exit 1
  fi
done

deploy_site() {
  echo "=> Deploying www.aitmpl.com (main site + API)..."
  VERCEL_ORG_ID="$VERCEL_ORG_ID" \
  VERCEL_PROJECT_ID="$VERCEL_SITE_PROJECT_ID" \
    npx vercel --prod --yes --cwd "$REPO_ROOT"
  echo "=> www.aitmpl.com deployed."
}

deploy_dashboard() {
  echo "=> Deploying app.aitmpl.com (dashboard)..."
  VERCEL_ORG_ID="$VERCEL_ORG_ID" \
  VERCEL_PROJECT_ID="$VERCEL_DASHBOARD_PROJECT_ID" \
    npx vercel --prod --yes --cwd "$REPO_ROOT"
  echo "=> app.aitmpl.com deployed."
}

case "${1:-}" in
  site)
    deploy_site
    ;;
  dashboard)
    deploy_dashboard
    ;;
  all)
    deploy_site
    deploy_dashboard
    ;;
  *)
    echo "Usage: $0 {site|dashboard|all}"
    echo ""
    echo "  site       Deploy www.aitmpl.com (main site + API)"
    echo "  dashboard  Deploy app.aitmpl.com (Astro dashboard)"
    echo "  all        Deploy both"
    exit 1
    ;;
esac
