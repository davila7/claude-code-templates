---
name: bright-data-best-practices
description: "Build production-ready Bright Data integrations with best practices baked in. Reference documentation for developers using coding assistants (Claude Code, Cursor, etc.) to implement web scraping, search, browser automation, and structured data extraction. Covers Web Unlocker API, SERP API, Web Scraper API, and Browser API (Scraping Browser)."
user-invocable: false
---

# Bright Data APIs

Bright Data provides infrastructure for web data extraction at scale. Four primary APIs cover different use cases — always pick the most specific tool for the job.

## Choosing the Right API

| Use Case | API | Why |
|----------|-----|-----|
| Scrape any webpage by URL (no interaction) | Web Unlocker | HTTP-based, auto-bypasses bot detection, cheapest |
| Google / Bing / Yandex search results | SERP API | Specialized for SERP extraction, returns structured data |
| Structured data from Amazon, LinkedIn, Instagram, TikTok, etc. | Web Scraper API | Pre-built scrapers, no parsing needed |
| Click, scroll, fill forms, run JS, intercept XHR | Browser API | Full browser automation |
| Puppeteer / Playwright / Selenium automation | Browser API | Connects via CDP/WebDriver |

## Authentication Pattern (All APIs)

All APIs share the same authentication model:

```bash
export BRIGHTDATA_API_KEY="your-api-key"         # From Control Panel > Account Settings
export BRIGHTDATA_UNLOCKER_ZONE="zone-name"       # Web Unlocker zone name
export BRIGHTDATA_SERP_ZONE="serp-zone-name"      # SERP API zone name
export BROWSER_AUTH="brd-customer-ID-zone-NAME:PASSWORD"  # Browser API credentials
```

REST API authentication header for Web Unlocker and SERP API:
```
Authorization: Bearer YOUR_API_KEY
```

---

## Web Unlocker API

HTTP-based scraping proxy. Best for simple page fetches without browser interaction.

**Endpoint:** `POST https://api.brightdata.com/request`

```python
import requests

response = requests.post(
    "https://api.brightdata.com/request",
    headers={"Authorization": f"Bearer {API_KEY}"},
    json={
        "zone": "YOUR_ZONE_NAME",
        "url": "https://example.com/product/123",
        "format": "raw"
    }
)
html = response.text
```

### Key Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `zone` | string | Zone name (required) |
| `url` | string | Target URL with `http://` or `https://` (required) |
| `format` | string | `"raw"` (HTML) or `"json"` (structured wrapper) (required) |
| `method` | string | HTTP verb, default `"GET"` |
| `country` | string | 2-letter ISO for geo-targeting (e.g., `"us"`, `"de"`) |
| `data_format` | string | Transform: `"markdown"` or `"screenshot"` |
| `async` | boolean | `true` for async mode |

### Quick Patterns

```python
# Get markdown (best for LLM input)
response = requests.post(
    "https://api.brightdata.com/request",
    headers={"Authorization": f"Bearer {API_KEY}"},
    json={"zone": ZONE, "url": url, "format": "raw", "data_format": "markdown"}
)

# Geo-targeted request
json={"zone": ZONE, "url": url, "format": "raw", "country": "de"}

# Screenshot for debugging
json={"zone": ZONE, "url": url, "format": "raw", "data_format": "screenshot"}

# Async for bulk processing
json={"zone": ZONE, "url": url, "format": "raw", "async": True}
```

**Critical rule:** Never use Web Unlocker with Puppeteer, Playwright, Selenium, or anti-detect browsers. Use Browser API instead.

See **[references/web-unlocker.md](references/web-unlocker.md)** for complete reference including proxy interface, special headers, async flow, features, and billing.

---

## SERP API

Structured search engine result extraction for Google, Bing, Yandex, DuckDuckGo.

**Endpoint:** `POST https://api.brightdata.com/request` (same as Web Unlocker)

```python
response = requests.post(
    "https://api.brightdata.com/request",
    headers={"Authorization": f"Bearer {API_KEY}"},
    json={
        "zone": "YOUR_SERP_ZONE",
        "url": "https://www.google.com/search?q=python+web+scraping&brd_json=1&gl=us&hl=en",
        "format": "raw"
    }
)
data = response.json()
for result in data.get("organic", []):
    print(result["rank"], result["title"], result["link"])
```

### Essential Google URL Parameters

| Parameter | Description | Example |
|-----------|-------------|---------|
| `q` | Search query | `q=python+web+scraping` |
| `brd_json` | Parsed JSON output | `brd_json=1` (always use for data pipelines) |
| `gl` | Country for search | `gl=us` |
| `hl` | Language | `hl=en` |
| `start` | Pagination offset | `start=10` (page 2), `start=20` (page 3) |
| `tbm` | Search type | `tbm=nws` (news), `tbm=isch` (images), `tbm=vid` (videos) |
| `brd_mobile` | Device | `brd_mobile=1` (mobile), `brd_mobile=ios` |
| `brd_browser` | Browser | `brd_browser=chrome` |
| `brd_ai_overview` | Trigger AI Overview | `brd_ai_overview=2` |
| `uule` | Encoded geo location | for precise location targeting |

**Note:** `num` parameter is **deprecated** as of September 2025. Use `start` for pagination.

### Parsed JSON Response Structure

```json
{
  "organic": [{"rank": 1, "global_rank": 1, "title": "...", "link": "...", "description": "..."}],
  "paid": [],
  "people_also_ask": [],
  "knowledge_graph": {},
  "related_searches": [],
  "general": {"results_cnt": 1240000000, "query": "..."}
}
```

### Bing Key Parameters

| Parameter | Description |
|-----------|-------------|
| `q` | Search query |
| `setLang` | Language (prefer 4-letter: `en-US`) |
| `cc` | Country code |
| `first` | Pagination (increment by 10: 1, 11, 21...) |
| `safesearch` | `off`, `moderate`, `strict` |
| `brd_mobile` | Device type |

### Async for Bulk SERP

```python
# Submit
response = requests.post(
    "https://api.brightdata.com/request",
    params={"async": "1"},
    headers={"Authorization": f"Bearer {API_KEY}"},
    json={"zone": SERP_ZONE, "url": "https://www.google.com/search?q=test&brd_json=1", "format": "raw"}
)
response_id = response.headers.get("x-response-id")

# Retrieve (retrieve calls are NOT billed)
result = requests.get(
    "https://api.brightdata.com/serp/get_result",
    params={"response_id": response_id},
    headers={"Authorization": f"Bearer {API_KEY}"}
)
```

**Billing:** Pay per 1,000 successful requests only. Async retrieve calls are not billed.

See **[references/serp-api.md](references/serp-api.md)** for complete reference including Maps, Trends, Reviews, Lens, Hotels, Flights parameters.

---

## Web Scraper API

Pre-built scrapers for structured data extraction from 100+ platforms. No parsing logic needed.

**Sync Endpoint:** `POST https://api.brightdata.com/datasets/v3/scrape`
**Async Endpoint:** `POST https://api.brightdata.com/datasets/v3/trigger`

```python
# Sync (up to 20 URLs, returns immediately)
response = requests.post(
    "https://api.brightdata.com/datasets/v3/scrape",
    params={"dataset_id": "YOUR_DATASET_ID", "format": "json"},
    headers={"Authorization": f"Bearer {API_KEY}"},
    json={"input": [{"url": "https://www.amazon.com/dp/B09X7M8TBQ"}]}
)

if response.status_code == 200:
    data = response.json()  # Results ready
elif response.status_code == 202:
    snapshot_id = response.json()["snapshot_id"]  # Poll for completion
```

### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `dataset_id` | string | Scraper identifier from the Scraper Library (required) |
| `format` | string | `json` (default), `ndjson`, `jsonl`, `csv` |
| `custom_output_fields` | string | Pipe-separated fields: `url\|title\|price` |
| `include_errors` | boolean | Include error info in results |

### Request Body

```json
{
  "input": [
    { "url": "https://www.amazon.com/dp/B09X7M8TBQ" },
    { "url": "https://www.amazon.com/dp/B0B7CTCPKN" }
  ]
}
```

### Poll for Async Results

```python
import time

# Trigger
snapshot_id = requests.post(
    "https://api.brightdata.com/datasets/v3/trigger",
    params={"dataset_id": DATASET_ID, "format": "json"},
    headers={"Authorization": f"Bearer {API_KEY}"},
    json={"input": [{"url": u} for u in urls]}
).json()["snapshot_id"]

# Poll
while True:
    status = requests.get(
        f"https://api.brightdata.com/datasets/v3/progress/{snapshot_id}",
        headers={"Authorization": f"Bearer {API_KEY}"}
    ).json()["status"]

    if status == "ready": break
    if status == "failed": raise Exception("Job failed")
    time.sleep(10)

# Download
data = requests.get(
    f"https://api.brightdata.com/datasets/v3/snapshot/{snapshot_id}",
    params={"format": "json"},
    headers={"Authorization": f"Bearer {API_KEY}"}
).json()
```

**Progress status values:** `starting` → `running` → `ready` | `failed`
**Data retention:** 30 days.
**Billing:** Per delivered record. Invalid input URLs that fail are still billable.

See **[references/web-scraper-api.md](references/web-scraper-api.md)** for complete reference including scraper types, output formats, delivery options, and billing details.

---

## Browser API (Scraping Browser)

Full browser automation via CDP/WebDriver. Handles CAPTCHA, fingerprinting, and anti-bot detection automatically.

**Connection:**
- Playwright/Puppeteer: `wss://${AUTH}@brd.superproxy.io:9222`
- Selenium: `https://${AUTH}@brd.superproxy.io:9515`

```javascript
const { chromium } = require("playwright-core");

const AUTH = process.env.BROWSER_AUTH;
const browser = await chromium.connectOverCDP(`wss://${AUTH}@brd.superproxy.io:9222`);
const page = await browser.newPage();
page.setDefaultNavigationTimeout(120000); // Always set to 2 minutes

await page.goto("https://example.com", { waitUntil: "domcontentloaded" });
const html = await page.content();
await browser.close();
```

```python
from playwright.async_api import async_playwright

async with async_playwright() as p:
    browser = await p.chromium.connect_over_cdp(f"wss://{AUTH}@brd.superproxy.io:9222")
    page = await browser.new_page()
    page.set_default_navigation_timeout(120000)
    await page.goto("https://example.com", wait_until="domcontentloaded")
    html = await page.content()
    await browser.close()
```

### Custom CDP Functions

| Function | Purpose |
|----------|---------|
| `Captcha.solve` | Manually trigger CAPTCHA solving |
| `Captcha.setAutoSolve` | Enable/disable auto CAPTCHA solving |
| `Proxy.setLocation` | Set precise geo location (call BEFORE goto) |
| `Proxy.useSession` | Maintain same IP across sessions |
| `Emulation.setDevice` | Apply device profile (iPhone 14, etc.) |
| `Emulation.getSupportedDevices` | List available device profiles |
| `Unblocker.enableAdBlock` | Block ads to save bandwidth |
| `Unblocker.disableAdBlock` | Re-enable ads |
| `Input.type` | Fast text input for bulk form filling |
| `Browser.addCertificate` | Install client SSL cert for session |
| `Page.inspect` | Get DevTools debug URL for live session |

```javascript
// CDP session pattern for custom functions
const client = await page.target().createCDPSession();

// CAPTCHA solve with timeout
const result = await client.send("Captcha.solve", { timeout: 30000 });

// Precise geo location (must be before goto)
await client.send("Proxy.setLocation", {
  latitude: 37.7749,
  longitude: -122.4194,
  distance: 10,
  strict: true
});

// Block unnecessary resources
await client.send("Network.setBlockedURLs", { urls: ["*google-analytics*", "*.ads.*"] });

// Device emulation
await client.send("Emulation.setDevice", { deviceName: "iPhone 14" });
```

### Session Rules
- **One initial navigation per session** — new URL = new session
- **Idle timeout:** 5 minutes
- **Max duration:** 30 minutes

### Geolocation
- Country-level: append `-country-us` to credentials username
- EU-wide: append `-country-eu` (routes through 29+ European countries)
- Precise: use `Proxy.setLocation` CDP command (before navigation)

### Error Codes

| Code | Issue | Fix |
|------|-------|-----|
| `407` | Wrong port | Playwright/Puppeteer → `9222`, Selenium → `9515` |
| `403` | Bad auth | Check credentials format and zone type |
| `503` | Service scaling | Wait 1 minute, reconnect |

**Billing:** Traffic-based only. Block images/CSS/fonts to reduce costs.

See **[references/browser-api.md](references/browser-api.md)** for complete reference including all CDP functions, bandwidth optimization, CAPTCHA patterns, and debugging.

---

## Detailed References

- **[references/web-unlocker.md](references/web-unlocker.md)** — Web Unlocker: full parameter list, proxy interface, special headers, async flow, features, billing, anti-patterns
- **[references/serp-api.md](references/serp-api.md)** — SERP API: all Google params (Maps, Trends, Reviews, Lens, Hotels, Flights), Bing params, parsed JSON structure, async, billing
- **[references/web-scraper-api.md](references/web-scraper-api.md)** — Web Scraper API: sync vs async, all parameters, polling, scraper types, output formats, billing
- **[references/browser-api.md](references/browser-api.md)** — Browser API: connection strings, session rules, all CDP functions, geo-targeting, bandwidth optimization, CAPTCHA, debugging, error codes
