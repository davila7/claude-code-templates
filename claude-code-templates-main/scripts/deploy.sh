#!/usr/bin/env bash
set -euo pipefail

# Deploy script for claude-code-templates
# Deploys the Astro dashboard which serves both www.aitmpl.com and app.aitmpl.com
#
# Required env vars (from .env):
#   VERCEL_ORG_ID, VERCEL_DASHBOARD_PROJECT_ID
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
for var in VERCEL_ORG_ID VERCEL_DASHBOARD_PROJECT_ID; do
  if [[ -z "${!var:-}" ]]; then
    echo "Error: $var is not set. Add it to .env" >&2
    exit 1
  fi
done

deploy() {
  echo "=> Deploying www.aitmpl.com + app.aitmpl.com (Astro dashboard)..."
  VERCEL_ORG_ID="$VERCEL_ORG_ID" \
  VERCEL_PROJECT_ID="$VERCEL_DASHBOARD_PROJECT_ID" \
    npx vercel --prod --yes --cwd "$REPO_ROOT"
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
