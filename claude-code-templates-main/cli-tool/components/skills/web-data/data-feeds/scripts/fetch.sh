#!/bin/bash
# Bright Data - Dataset Fetch with Polling
# Triggers a dataset collection and polls until results are ready

DATASET_ID="$1"
shift
INPUT_JSON="$1"

if [ -z "$DATASET_ID" ] || [ -z "$INPUT_JSON" ]; then
    echo "Usage: $0 <dataset_id> '<json_input>'" >&2
    echo "Example: $0 gd_l1viktl72bvl7bjuj0 '{\"url\":\"https://linkedin.com/in/someone\"}'" >&2
    exit 1
fi

if [ -z "${BRIGHTDATA_API_KEY:-}" ]; then
    echo "Error: BRIGHTDATA_API_KEY is not set." >&2
    echo "Get a key from https://brightdata.com/cp" >&2
    exit 1
fi

POLLING_TIMEOUT="${BRIGHTDATA_POLLING_TIMEOUT:-600}"

TRIGGER_RESPONSE=$(curl -s -X POST "https://api.brightdata.com/datasets/v3/trigger?dataset_id=${DATASET_ID}&include_errors=true" \
    -H "Authorization: Bearer $BRIGHTDATA_API_KEY" \
    -H "Content-Type: application/json" \
    -d "[$INPUT_JSON]")

SNAPSHOT_ID=$(echo "$TRIGGER_RESPONSE" | jq -r '.snapshot_id // empty')

if [ -z "$SNAPSHOT_ID" ]; then
    echo "Error: Failed to trigger dataset collection" >&2
    echo "$TRIGGER_RESPONSE" >&2
    exit 1
fi

echo "Triggered collection with snapshot ID: $SNAPSHOT_ID" >&2

ATTEMPTS=0
while [ $ATTEMPTS -lt $POLLING_TIMEOUT ]; do
    SNAPSHOT_RESPONSE=$(curl -s -X GET "https://api.brightdata.com/datasets/v3/snapshot/${SNAPSHOT_ID}?format=json" \
        -H "Authorization: Bearer $BRIGHTDATA_API_KEY")

    STATUS=$(echo "$SNAPSHOT_RESPONSE" | jq -r '.status // empty')

    if [ "$STATUS" = "running" ] || [ "$STATUS" = "building" ] || [ "$STATUS" = "starting" ]; then
        echo "Status: $STATUS - polling again (attempt $((ATTEMPTS + 1))/$POLLING_TIMEOUT)" >&2
        ATTEMPTS=$((ATTEMPTS + 1))
        sleep 1
        continue
    fi

    echo "Data received after $((ATTEMPTS + 1)) attempts" >&2
    echo "$SNAPSHOT_RESPONSE" | jq '.'
    exit 0
done

echo "Error: Timeout after $POLLING_TIMEOUT seconds waiting for data" >&2
exit 1
