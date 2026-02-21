#!/usr/bin/env bash
set -euo pipefail

# Deploy script for claude-code-templates monorepo
# Ensures the correct Vercel project is targeted for each app.
#
# Usage:
#   ./scripts/deploy.sh site        # Deploy www.aitmpl.com
#   ./scripts/deploy.sh dashboard   # Deploy app.aitmpl.com
#   ./scripts/deploy.sh all         # Deploy both

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

# Project IDs (from .vercel/project.json files — not secrets)
SITE_PROJECT_ID="prj_ZGc6LE2OuRSOHMW6JmFMbQGAL0Ok"
DASHBOARD_PROJECT_ID="prj_2JukYUxVtEfvZWXojMUfRX9eGDEH"
ORG_ID="team_Fit4cCT6phNeyeqs82jaOUGC"

deploy_site() {
  echo "=> Deploying www.aitmpl.com (main site + API)..."
  VERCEL_ORG_ID="$ORG_ID" \
  VERCEL_PROJECT_ID="$SITE_PROJECT_ID" \
    npx vercel --prod --yes --cwd "$REPO_ROOT"
  echo "=> www.aitmpl.com deployed."
}

deploy_dashboard() {
  echo "=> Deploying app.aitmpl.com (dashboard)..."
  VERCEL_ORG_ID="$ORG_ID" \
  VERCEL_PROJECT_ID="$DASHBOARD_PROJECT_ID" \
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
