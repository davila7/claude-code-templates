#!/bin/bash
# Capture a screenshot of any URL via Bright Data Web Unlocker
# Usage: bash screenshot.sh "https://target-site.com" "/tmp/output.png"

URL="$1"
OUTPUT="${2:-/tmp/target_screenshot.png}"

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

echo "Capturing screenshot of: $URL" >&2

curl -k -s -X POST 'https://api.brightdata.com/request' \
    -H "Authorization: Bearer $BRIGHTDATA_API_KEY" \
    -H 'Content-Type: application/json' \
    -d "{\"zone\":\"$BRIGHTDATA_UNLOCKER_ZONE\",\"url\":\"$URL\",\"format\":\"raw\",\"data_format\":\"screenshot\"}" \
    --output "$OUTPUT"

if [ $? -eq 0 ] && [ -s "$OUTPUT" ]; then
    echo "Screenshot saved to: $OUTPUT" >&2
    echo "$OUTPUT"
else
    echo "Error: Failed to capture screenshot" >&2
    exit 1
fi
