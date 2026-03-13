# Web Scraper API Reference

## Table of Contents

- [Overview](#overview)
- [Authentication](#authentication)
- [Choosing Sync vs Async](#choosing-sync-vs-async)
- [Synchronous Requests](#synchronous-requests)
- [Asynchronous Requests](#asynchronous-requests)
- [Monitor Progress](#monitor-progress)
- [Download Results](#download-results)
- [Scraper Types](#scraper-types)
- [Output Formats](#output-formats)
- [Billing Model](#billing-model)
- [Best Practices](#best-practices)

---

## Overview

Bright Data Web Scraper API provides pre-built scrapers ("datasets") for 100+ popular websites including Amazon, LinkedIn, Instagram, TikTok, YouTube, Facebook, and more. You provide input (URLs or keywords), and receive clean structured JSON/CSV data without writing any scraping logic.

**Supported domains include:** Amazon, eBay, Walmart, LinkedIn, Instagram, TikTok, YouTube, Facebook, Reddit, Twitter/X, Crunchbase, ZoomInfo, and many more.

---

## Authentication

```bash
export BRIGHTDATA_API_KEY="your-api-key"
```

Get your API key from: `https://brightdata.com/cp/setting/users`

All requests use Bearer token authentication:
```
Authorization: Bearer YOUR_API_KEY
```

---

## Choosing Sync vs Async

| Factor | Synchronous (`/scrape`) | Asynchronous (`/trigger`) |
|--------|------------------------|---------------------------|
| Input size | Up to **20 URLs** | Any size — built for bulk |
| Response time | Immediate (within 1 min) | Background job — poll for completion |
| Timeout behavior | Returns 202 + `snapshot_id` if >1 min | N/A — always async |
| Best for | Real-time single lookups | Large batches, scheduled jobs |

---

## Synchronous Requests

**Endpoint:** `POST https://api.brightdata.com/datasets/v3/scrape`

Results are returned immediately in the response body.

### Request Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `dataset_id` | string | Yes | Identifies which scraper to use (from the Scraper Library) |
| `format` | string | No | Output format: `json` (default), `ndjson`, `jsonl`, or `csv` |
| `custom_output_fields` | string | No | Pipe-separated field names to filter output (e.g., `url\|title\|price`) |
| `include_errors` | boolean | No | Include error reporting in results |

### Request Body

```json
{
  "input": [
    { "url": "https://www.amazon.com/dp/B09X7M8TBQ" },
    { "url": "https://www.amazon.com/dp/B0B7CTCPKN" }
  ]
}
```

### Python Example

```python
import requests

response = requests.post(
    "https://api.brightdata.com/datasets/v3/scrape",
    params={
        "dataset_id": "gd_l7q7dkf244hwjntr0",  # Amazon product dataset_id
        "format": "json"
    },
    headers={
        "Authorization": f"Bearer {API_KEY}",
        "Content-Type": "application/json"
    },
    json={
        "input": [
            {"url": "https://www.amazon.com/dp/B09X7M8TBQ"},
            {"url": "https://www.amazon.com/dp/B0B7CTCPKN"}
        ]
    }
)

if response.status_code == 200:
    data = response.json()
    for item in data:
        print(item["title"], item["price"])
elif response.status_code == 202:
    # Processing exceeded 1-minute timeout — use snapshot_id for async retrieval
    snapshot_id = response.json().get("snapshot_id")
    print(f"Processing... poll with snapshot_id: {snapshot_id}")
```

```javascript
const response = await fetch(
  "https://api.brightdata.com/datasets/v3/scrape?dataset_id=gd_l7q7dkf244hwjntr0&format=json",
  {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      input: [
        { url: "https://www.amazon.com/dp/B09X7M8TBQ" }
      ]
    })
  }
);

if (response.status === 200) {
  const data = await response.json();
  console.log(data);
} else if (response.status === 202) {
  const { snapshot_id } = await response.json();
  // Poll for completion
}
```

### Response Codes (Sync)

| Code | Meaning |
|------|---------|
| `200 OK` | Data returned directly in response body |
| `202 Accepted` | Processing exceeded 1-minute timeout — response includes `snapshot_id` for async retrieval |

---

## Asynchronous Requests

Use `/trigger` for large batches or when you don't need an immediate response.

**Endpoint:** `POST https://api.brightdata.com/datasets/v3/trigger`

### Request Parameters (same as sync plus)

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `dataset_id` | string | Yes | Scraper identifier |
| `format` | string | No | `json`, `ndjson`, `jsonl`, `csv` |
| `custom_output_fields` | string | No | Pipe-separated field names |
| `include_errors` | boolean | No | Include errors in output |
| `notify` | string | No | Webhook URL to receive completion notification |
| `output` | object | No | External storage delivery config (S3, GCS, etc.) |

### Python Example (Trigger + Poll)

```python
import requests
import time

# Step 1: Trigger the job
trigger_response = requests.post(
    "https://api.brightdata.com/datasets/v3/trigger",
    params={
        "dataset_id": "gd_l7q7dkf244hwjntr0",
        "format": "json"
    },
    headers={
        "Authorization": f"Bearer {API_KEY}",
        "Content-Type": "application/json"
    },
    json={
        "input": [
            {"url": "https://www.amazon.com/dp/B09X7M8TBQ"},
            # ... hundreds more URLs
        ]
    }
)
snapshot_id = trigger_response.json()["snapshot_id"]

# Step 2: Poll until ready
while True:
    progress = requests.get(
        f"https://api.brightdata.com/datasets/v3/progress/{snapshot_id}",
        headers={"Authorization": f"Bearer {API_KEY}"}
    )
    status = progress.json()["status"]
    print(f"Status: {status}")

    if status == "ready":
        break
    elif status == "failed":
        raise Exception("Scraping job failed")

    time.sleep(10)

# Step 3: Download results
results = requests.get(
    f"https://api.brightdata.com/datasets/v3/snapshot/{snapshot_id}",
    params={"format": "json"},
    headers={"Authorization": f"Bearer {API_KEY}"}
)
data = results.json()
```

---

## Monitor Progress

**Endpoint:** `GET https://api.brightdata.com/datasets/v3/progress/{snapshot_id}`

```python
response = requests.get(
    f"https://api.brightdata.com/datasets/v3/progress/{snapshot_id}",
    headers={"Authorization": f"Bearer {API_KEY}"}
)
status = response.json()["status"]
```

### Status Values

| Status | Description |
|--------|-------------|
| `starting` | Job initialization |
| `running` | Data collection in progress |
| `ready` | Results available for download |
| `failed` | Job failed |

### Error Responses

| Code | Meaning |
|------|---------|
| `401` | Missing or invalid API key |
| `404` | Snapshot ID not found |

---

## Download Results

**Endpoint:** `GET https://api.brightdata.com/datasets/v3/snapshot/{snapshot_id}`

```python
response = requests.get(
    f"https://api.brightdata.com/datasets/v3/snapshot/{snapshot_id}",
    params={"format": "json"},
    headers={"Authorization": f"Bearer {API_KEY}"}
)
data = response.json()
```

### Snapshot Lifecycle
- Snapshots are available for **30 days** after collection
- Download in JSON, NDJSON, JSONL, or CSV format

---

## Scraper Types

The Scraper Library contains pre-built scrapers organized by type:

### PDP Scrapers (Product/Profile Detail)
- Accept one or more URLs
- Return detailed data for each URL
- Example: Amazon product page → price, title, reviews, specs

### Discovery Scrapers
- Accept search terms, keywords, or category URLs
- Return lists of results to explore
- Example: Amazon search → list of matching products

### Finding Dataset IDs
1. Go to `https://brightdata.com/cp/datasets` (Scraper Library)
2. Select the platform and data type you need
3. Each scraper has a unique `dataset_id` shown in the API reference

---

## Output Formats

| Format | Description |
|--------|-------------|
| `json` | Standard JSON array (default) |
| `ndjson` | Newline-delimited JSON (one object per line) — good for streaming large results |
| `jsonl` | Same as ndjson |
| `csv` | CSV format |

### Custom Output Fields

Filter returned fields to reduce payload size:

```python
params = {
    "dataset_id": "gd_l7q7dkf244hwjntr0",
    "format": "json",
    "custom_output_fields": "url|title|price|rating"  # pipe-separated
}
```

Nested fields use dot notation: `about.updated_on`

---

## Billing Model

| Scenario | Billing |
|----------|---------|
| Standard | Per **delivered record** — starting from $0.70/1,000 records |
| Failed due to user input error | **Billable** — resources were consumed processing the invalid input |
| Sync timeout (202) → async retrieval | Single charge for the records, not double |
| Real-time mode | Up to 20 URL inputs per call |

**Data retention:** Collected snapshots available for **30 days**.

---

## Best Practices

### 1. Use sync for ≤20 URLs, async for larger batches
Sync is simpler for small jobs. For anything larger, use `/trigger` with polling.

```python
if len(urls) <= 20:
    # Use /scrape for immediate results
    endpoint = "https://api.brightdata.com/datasets/v3/scrape"
else:
    # Use /trigger for bulk
    endpoint = "https://api.brightdata.com/datasets/v3/trigger"
```

### 2. Handle 202 responses in sync mode
If your sync request takes >1 minute, you'll get a 202 with `snapshot_id`. Always handle this case:

```python
if response.status_code == 202:
    snapshot_id = response.json()["snapshot_id"]
    # Fall through to polling logic
```

### 3. Use webhooks for production async workflows
Polling is fine for development. In production, configure `notify` URL to receive push notifications:

```python
json={
    "input": [...],
    "notify": "https://your-server.com/webhook/brightdata"
}
```

### 4. Use `custom_output_fields` to reduce payload
Only request fields you need. This reduces bandwidth and response size:

```python
params={"custom_output_fields": "url|title|price|availability"}
```

### 5. Use `ndjson` format for large result sets
NDJSON is more memory-efficient for large datasets since you can stream-process line by line:

```python
for line in response.iter_lines():
    record = json.loads(line)
    process(record)
```

### 6. Check data retention (30 days)
Download your snapshots within 30 days. After that, the data is gone.

### 7. Validate inputs before submitting
Submitting invalid URLs/inputs that fail due to user error is still billable. Validate URLs before sending:

```python
from urllib.parse import urlparse

def is_valid_url(url: str) -> bool:
    parsed = urlparse(url)
    return parsed.scheme in ("http", "https") and bool(parsed.netloc)

urls = [u for u in raw_urls if is_valid_url(u)]
```

### 8. Use delivery to external storage for large jobs
Instead of downloading via the API, configure delivery to S3/GCS in the trigger request for large datasets:

```python
json={
    "input": [...],
    "output": {
        "type": "s3",
        "bucket": "your-bucket",
        "prefix": "brightdata/results/"
    }
}
```
