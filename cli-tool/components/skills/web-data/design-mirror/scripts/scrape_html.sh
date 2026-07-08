#!/bin/bash
# Scrape full HTML (including inline CSS) from any URL via Bright Data Web Unlocker
# Usage: bash scrape_html.sh "https://target-site.com" "/tmp/output.html"

URL="$1"
OUTPUT="${2:-/tmp/target_page.html}"

if [ -z "$URL" ]; then
    echo "Usage: $0 \"url\" [output_path]" >&2
    exit 1
fi

if [ -z "${BRIGHTDATA_API_KEY:-}" ]; then
    echo "Error: BRIGHTDATA_API_KEY is not set." >&2
    exit 1
fi

if [ -z "${BRIGHTDATA_UNLOCKER_ZONE:-}" ]; then
    echo "Error: BRIGHTDATA_UNLOCKER_ZONE is not set." >&2
    exit 1
fi

echo "Scraping HTML from: $URL" >&2

curl -k -s -X POST 'https://api.brightdata.com/request' \
    -H "Authorization: Bearer $BRIGHTDATA_API_KEY" \
    -H 'Content-Type: application/json' \
    -d "{\"zone\":\"$BRIGHTDATA_UNLOCKER_ZONE\",\"url\":\"$URL\",\"format\":\"raw\"}" \
    --output "$OUTPUT"

if [ $? -eq 0 ] && [ -s "$OUTPUT" ]; then
    echo "HTML saved to: $OUTPUT" >&2
    echo "$OUTPUT"
else
    echo "Error: Failed to scrape HTML" >&2
    exit 1
fi
