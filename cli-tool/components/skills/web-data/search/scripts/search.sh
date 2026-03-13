#!/bin/bash
# Bright Data Google Search (parsed_light JSON)

QUERY="$1"
CURSOR="${2:-0}"

if [ -z "$QUERY" ]; then
    echo "Usage: $0 \"query\" [cursor]" >&2
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

# Build Google search URL with pagination
START=$((CURSOR * 10))
ENCODED_QUERY=$(printf '%s' "$QUERY" | jq -sRr @uri)
SEARCH_URL="https://www.google.com/search?q=${ENCODED_QUERY}&start=${START}"

# Call Bright Data API
PAYLOAD=$(jq -n \
    --arg url "$SEARCH_URL" \
    --arg zone "$BRIGHTDATA_UNLOCKER_ZONE" \
    '{
        url: $url,
        zone: $zone,
        format: "raw",
        data_format: "parsed_light"
    }')

RESPONSE=$(curl -s -X POST 'https://api.brightdata.com/request' \
    -H "Authorization: Bearer $BRIGHTDATA_API_KEY" \
    -H 'Content-Type: application/json' \
    -d "$PAYLOAD")

# Extract and clean organic results
echo "$RESPONSE" | jq '{
    organic: [.organic[]? | select(.link and .title) | {
        link: .link,
        title: .title,
        description: (.description // "")
    }]
}'
