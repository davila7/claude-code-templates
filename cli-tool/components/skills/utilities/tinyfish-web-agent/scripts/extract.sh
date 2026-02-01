#!/usr/bin/env bash
#
# TinyFish web extract/scrape helper
#
# Usage:
#   extract.sh <url> <goal> [--stealth] [--proxy COUNTRY]
#
# Examples:
#   extract.sh "https://example.com" 'Extract product as JSON: {"name": str, "price": str}'
#   extract.sh "https://site.com" 'Get all links as JSON: [{"text": str, "url": str}]' --stealth
#   extract.sh "https://site.com" 'Extract items' --stealth --proxy US

set -euo pipefail

if [ $# -lt 2 ]; then
  echo "Usage: extract.sh <url> <goal> [--stealth] [--proxy COUNTRY]" >&2
  exit 1
fi

if [ -z "${MINO_API_KEY:-}" ]; then
  echo "Error: MINO_API_KEY environment variable not set" >&2
  exit 1
fi

URL="$1"
GOAL="$2"
shift 2

STEALTH=false
PROXY_COUNTRY=""

while [ $# -gt 0 ]; do
  case "$1" in
    --stealth)
      STEALTH=true
      shift
      ;;
    --proxy)
      PROXY_COUNTRY="$2"
      shift 2
      ;;
    *)
      echo "Unknown option: $1" >&2
      exit 1
      ;;
  esac
done

# Build JSON payload — escape URL and goal for safe embedding
JSON_URL=$(printf '%s' "$URL" | sed 's/\\/\\\\/g; s/"/\\"/g')
JSON_GOAL=$(printf '%s' "$GOAL" | sed 's/\\/\\\\/g; s/"/\\"/g')

PAYLOAD="{\"url\":\"${JSON_URL}\",\"goal\":\"${JSON_GOAL}\""

if [ "$STEALTH" = true ]; then
  PAYLOAD="${PAYLOAD},\"browser_profile\":\"stealth\""
fi

if [ -n "$PROXY_COUNTRY" ]; then
  PAYLOAD="${PAYLOAD},\"proxy_config\":{\"enabled\":true,\"country_code\":\"${PROXY_COUNTRY}\"}"
fi

PAYLOAD="${PAYLOAD}}"

echo "Extracting from ${URL}..." >&2

exec curl -N -s -X POST "https://mino.ai/v1/automation/run-sse" \
  -H "X-API-Key: ${MINO_API_KEY}" \
  -H "Content-Type: application/json" \
  -d "$PAYLOAD"
