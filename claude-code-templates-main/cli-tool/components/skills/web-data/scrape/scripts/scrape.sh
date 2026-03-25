#!/bin/bash
# Bright Data Web Scraper (markdown output)

URL="$1"

if [ -z "$URL" ]; then
    echo "Usage: $0 \"url\"" >&2
    exit 1
fi

if [ -z "${BRIGHTDATA_API_KEY:-}" ]; then
    echo "Error: BRIGHTDATA_API_KEY is not set." >&2
    echo "Get a key from https://brightdata.com/cp" >&2
    exit 1
fi

if [ -z "${BRIGHTDATA_UNLOCKER_ZONE:-}" ]; then
    echo "Error: BRIGHTDATA_UNLOCKER_ZONE is not set." >&2
    echo "Create a zone at brightdata.com/cp" >&2
    exit 1
fi

# Call Bright Data API
PAYLOAD=$(jq -n \
    --arg url "$URL" \
    --arg zone "$BRIGHTDATA_UNLOCKER_ZONE" \
    '{
        url: $url,
        zone: $zone,
        format: "raw",
        data_format: "markdown"
    }')

curl -s -X POST 'https://api.brightdata.com/request' \
    -H "Authorization: Bearer $BRIGHTDATA_API_KEY" \
    -H 'Content-Type: application/json' \
    -d "$PAYLOAD"
