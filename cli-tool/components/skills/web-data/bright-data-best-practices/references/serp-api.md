# SERP API Reference

## Table of Contents

- [Overview](#overview)
- [Authentication](#authentication)
- [REST API (Recommended)](#rest-api-recommended)
- [Proxy Interface](#proxy-interface)
- [Request Parameters](#request-parameters)
- [Google Search Parameters](#google-search-parameters)
- [Bing Search Parameters](#bing-search-parameters)
- [Parsed JSON Output](#parsed-json-output)
- [Async Requests](#async-requests)
- [Billing Model](#billing-model)
- [Best Practices](#best-practices)

---

## Overview

Bright Data SERP API extracts structured search engine results from Google, Bing, Yandex, and DuckDuckGo. It automatically handles proxy management, CAPTCHA solving, and delivers results in under 5 seconds.

**What it returns:**
- Organic results (title, description, link, rank)
- Paid advertisements (top, bottom, product listing, premium)
- Local business listings (snack pack)
- Shopping results
- Related searches and "People Also Ask"
- Knowledge panels
- Specialized SERP features (maps, trends, reviews, lens, hotels, flights)

---

## Authentication

```bash
export BRIGHTDATA_API_KEY="your-api-key"
export BRIGHTDATA_SERP_ZONE="your-serp-zone-name"
```

API keys are auto-generated when you create a SERP API zone. Additional keys can be generated in Account Settings. Setting expiration dates on keys is recommended for security.

---

## REST API (Recommended)

**Endpoint:** `POST https://api.brightdata.com/request`

**Header:** `Authorization: Bearer YOUR_API_KEY`

### Google Search

```python
import requests

response = requests.post(
    "https://api.brightdata.com/request",
    headers={"Authorization": f"Bearer {API_KEY}"},
    json={
        "zone": "YOUR_SERP_ZONE",
        "url": "https://www.google.com/search?q=python+web+scraping",
        "format": "raw"
    }
)
html = response.text
```

### Google Search with Parsed JSON

```python
response = requests.post(
    "https://api.brightdata.com/request",
    headers={"Authorization": f"Bearer {API_KEY}"},
    json={
        "zone": "YOUR_SERP_ZONE",
        "url": "https://www.google.com/search?q=python+web+scraping&brd_json=1",
        "format": "raw"
    }
)
data = response.json()
for result in data.get("organic", []):
    print(result["title"], result["link"])
```

```javascript
const response = await fetch("https://api.brightdata.com/request", {
  method: "POST",
  headers: {
    "Authorization": `Bearer ${API_KEY}`,
    "Content-Type": "application/json"
  },
  body: JSON.stringify({
    zone: "YOUR_SERP_ZONE",
    url: "https://www.google.com/search?q=python+web+scraping&brd_json=1",
    format: "raw"
  })
});
const data = await response.json();
```

```bash
curl -H "Authorization: Bearer $BRIGHTDATA_API_KEY" \
     -H "Content-Type: application/json" \
     -d '{"zone":"'"$BRIGHTDATA_SERP_ZONE"'","url":"https://www.google.com/search?q=python+web+scraping&brd_json=1","format":"raw"}' \
     https://api.brightdata.com/request
```

---

## Proxy Interface

Route search requests through Bright Data's proxy endpoint.

- **Host:** `brd.superproxy.io`
- **Port:** `33335`
- **Credentials:** `brd-customer-{CUSTOMER_ID}-zone-{ZONE_NAME}:{ZONE_PASSWORD}`

```python
proxies = {
    "http": "http://brd-customer-CUSTOMER_ID-zone-ZONE_NAME:PASSWORD@brd.superproxy.io:33335",
    "https": "http://brd-customer-CUSTOMER_ID-zone-ZONE_NAME:PASSWORD@brd.superproxy.io:33335"
}
response = requests.get(
    "https://www.google.com/search?q=python+web+scraping&brd_json=1",
    proxies=proxies,
    verify="/path/to/brightdata-cert.crt"  # Install Bright Data SSL cert
)
```

---

## Request Parameters

Core parameters shared across all SERP endpoints:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `zone` | string | Yes | SERP zone name |
| `url` | string | Yes | Full search URL with query params included |
| `format` | string | Yes | `"raw"` (HTML/JSON) or `"json"` (structured response wrapper) |
| `country` | string | No | 2-letter ISO country code for proxy geo-targeting |
| `async` | boolean | No | `true` for async mode |

---

## Google Search Parameters

All parameters are appended to the Google URL as query string parameters.

### Localization

| Parameter | Description | Example |
|-----------|-------------|---------|
| `gl` | 2-letter country code for search location | `gl=us` |
| `hl` | 2-letter language code for page language | `hl=en` |

### Search Type

| Parameter | Description | Values |
|-----------|-------------|--------|
| `tbm` | Search type | `isch` (images), `nws` (news), `vid` (videos) |
| `udm` | Alternative search types | `28` (shopping), `39` (short videos) |
| `ibp` | Jobs search | `htl;jobs` |

### Pagination

| Parameter | Description | Example |
|-----------|-------------|---------|
| `start` | Result offset | `0`, `10`, `20` (each page = 10) |
| `num` | Number of results | **Deprecated** as of September 2025 |

### Geo-Location

| Parameter | Description |
|-----------|-------------|
| `uule` | Encoded location string for precise geo-targeting |

### Device & Browser

| Parameter | Description | Values |
|-----------|-------------|--------|
| `brd_mobile` | Device type | `0` (desktop), `1` (random mobile), `ios`, `ipad`, `android`, `android_tablet` |
| `brd_browser` | Browser type | `chrome`, `safari`, `firefox` |

### Output Format

| Parameter | Description | Values |
|-----------|-------------|--------|
| `brd_json` | Enable parsed JSON output | `1` (JSON), `html` (JSON + raw HTML) |

### Special Features

| Parameter | Description | Values |
|-----------|-------------|--------|
| `brd_ai_overview` | Increase likelihood of AI Overview results | `2` |

### Hotel Search (via Google Search URL)

| Parameter | Description | Example |
|-----------|-------------|---------|
| `hotel_occupancy` | Number of guests | `1`–`4` |
| `hotel_dates` | Check-in/check-out | `2025-06-01,2025-06-07` |

---

## Google Maps Parameters

Append to `https://www.google.com/maps/search/...`:

| Parameter | Description |
|-----------|-------------|
| `gl`, `hl` | Localization |
| `@latitude,longitude,zoom` | GPS coordinates for location search |
| `fid` | Feature ID for place overview |
| `brd_accomodation_type` | Filter: `hotels` or `vacation_rentals` |

---

## Google Trends Parameters

Append to `https://trends.google.com/trends/explore`:

| Parameter | Description | Values |
|-----------|-------------|--------|
| `brd_json` | Required — returns parsed results | `1` |
| `brd_trends` | Widget type | `timeseries`, `geo_map`, or both |
| `geo` | 2-letter country code | `us`, `gb` |
| `hl` | Language code | `en` |
| `date` | Time range | `now 1-H`, `today 12-m`, custom dates |
| `cat` | Category ID | integer |
| `gprop` | Google property filter | `images`, `news`, `froogle`, `youtube` |

---

## Google Reviews Parameters

| Parameter | Description | Values |
|-----------|-------------|--------|
| `fid` | Feature ID for the place | string |
| `hl` | Language code | `en` |
| `sort` | Sort method | `qualityScore`, `newestFirst`, `ratingHigh`, `ratingLow` |
| `filter` | Keyword filter | string |
| `start` | Pagination offset | integer |
| `num` | Results per page | max `20` |

---

## Google Lens Parameters

| Parameter | Description | Values |
|-----------|-------------|--------|
| `url` | Image URL for reverse search | string |
| `hl` | Language code | `en` |
| `brd_lens` | Specific tab results | `products`, `homework`, `visual_matches`, `exact_matches` |

---

## Google Hotels Parameters

| Parameter | Description | Values |
|-----------|-------------|--------|
| `gl`, `hl` | Localization | ISO codes |
| `brd_dates` | Check-in/check-out dates | `YYYY-MM-DD,YYYY-MM-DD` |
| `brd_occupancy` | Guest count or breakdown | `2` or `2,5,7` (adults,child-ages) |
| `brd_free_cancellation` | Filter for free cancellation | `true`/`false` |
| `brd_accomodation_type` | Accommodation type | string |
| `brd_currency` | 3-letter currency code | `USD`, `EUR` |
| `brd_mobile` | Device type | `0`, `1`, `ios`, etc. |
| `brd_json` | Output format | `1` |

---

## Google Flights Parameters

| Parameter | Description |
|-----------|-------------|
| `gl`, `hl` | Localization |
| `tfs` | Flight search parameter string |
| `curr` | Currency code for prices |

---

## Bing Search Parameters

**Note:** Microsoft retired Bing Search APIs on August 11, 2025. Bright Data continues supporting their SERP API for Bing domain.

| Parameter | Description | Values |
|-----------|-------------|--------|
| `setLang` | Language code | `en-US`, `fr-FR` (4-letter preferred) |
| `location` | Used with latitude/longitude | paired with `mkt` |
| `cc` | 2-character country code | `us`, `gb` |
| `mkt` | Market specification | `en-US` |
| `first` | Result offset (pagination) | `1`, `11`, `21` (increment by 10) |
| `safesearch` | Adult content filter | `off`, `moderate` (default), `strict` |
| `brd_mobile` | Device type | `0`, `1`, `ios`, `android`, etc. |
| `brd_browser` | Browser type | `chrome`, `safari`, `firefox` |

---

## Parsed JSON Output

Add `brd_json=1` to the Google search URL to receive structured JSON instead of HTML.

```python
url = "https://www.google.com/search?q=best+laptops+2025&brd_json=1&gl=us&hl=en"
```

### Response Structure

```json
{
  "general": {
    "search_engine": "google",
    "query": "best laptops 2025",
    "results_cnt": 1240000000,
    "language": "en",
    "device": "desktop"
  },
  "organic": [
    {
      "rank": 1,
      "global_rank": 1,
      "title": "Best Laptops 2025",
      "link": "https://example.com/best-laptops",
      "description": "...",
      "sitelinks": []
    }
  ],
  "paid": [],
  "product_listing_ads": [],
  "knowledge_graph": {},
  "people_also_ask": [],
  "related_searches": [],
  "maps": [],
  "news": [],
  "videos": [],
  "recipes": [],
  "perspectives": []
}
```

### Key Fields

| Field | Description |
|-------|-------------|
| `organic[].rank` | Position within organic results component |
| `organic[].global_rank` | Overall position across entire SERP |
| `organic[].title` | Page title |
| `organic[].link` | URL |
| `organic[].description` | Snippet |
| `general.results_cnt` | Total results count (desktop only — not available on mobile) |

For raw HTML + parsed JSON: use `brd_json=html`.

---

## Async Requests

### Setup
Enable in Control Panel: SERP zone → Advanced Options → Toggle "Asynchronous requests" ON.

**Webhook allowlist IPs** (add these to your server firewall):
- `100.27.150.189`
- `18.214.10.85`

### Async Flow

**Step 1: Submit request**

```python
response = requests.post(
    "https://api.brightdata.com/request",
    params={"async": "1"},
    headers={"Authorization": f"Bearer {API_KEY}"},
    json={
        "zone": "YOUR_SERP_ZONE",
        "url": "https://www.google.com/search?q=python+web+scraping&brd_json=1",
        "format": "raw"
    }
)
response_id = response.headers.get("x-response-id")
```

**Step 2: Retrieve result**

```python
result = requests.get(
    "https://api.brightdata.com/serp/get_result",
    params={"response_id": response_id},
    headers={"Authorization": f"Bearer {API_KEY}"}
)
data = result.json()
```

### Async Key Facts
- Responses typically complete within **5 minutes**, stored for **48 hours**
- `99.99%` success rate in async mode
- Retrieve result using `response_id` from `x-response-id` header
- Collect/retrieve calls are **not billed** — only the initial submission

---

## Billing Model

| Mode | Billing |
|------|---------|
| Standard | Per 1,000 **successful** requests only |
| Async collect/retrieve | **Not billed** — only submission is billed |
| Automatic retries | Charged once for the successful response, not per retry |
| Failed requests | **Not charged** |

What's included at no extra cost: parsing (JSON/Markdown/HTML), proxy management, CAPTCHA handling, geotargeting, desktop and mobile user agent support.

---

## Best Practices

### 1. Always use `brd_json=1` for data pipelines
HTML parsing is brittle. Use `brd_json=1` to get structured data that won't break when Google changes its layout.

```python
url = "https://www.google.com/search?q=your+query&brd_json=1&gl=us&hl=en"
```

### 2. Set locale parameters (`gl` + `hl`) for consistent results
Without locale params, results vary by server location. Always set both for reproducible, region-correct results.

```python
# Good: explicit locale
"url": "https://www.google.com/search?q=coffee+shops&gl=us&hl=en"

# Bad: no locale, results depend on IP
"url": "https://www.google.com/search?q=coffee+shops"
```

### 3. Use `brd_mobile` for mobile SERP data
Mobile and desktop SERPs differ significantly. Match your target audience.

```python
# Mobile results
"url": "https://www.google.com/search?q=restaurants+near+me&brd_mobile=1&brd_json=1"
```

### 4. Paginate with `start` parameter
Each page offset is 10 results. To get page 3: `start=20`.

```python
for page in range(5):
    url = f"https://www.google.com/search?q=python+tutorials&brd_json=1&start={page * 10}"
```

### 5. Use async for high-volume pipelines
For bulk queries (monitoring rankings, scraping many keywords), async mode gives `99.99%` success rate and you're not charged for collect/retrieve calls.

### 6. Use `brd_ai_overview=2` when AI Overview data is needed
This parameter increases the likelihood that Google's AI Overview appears in results.

### 7. Filter by search type with `tbm`
Don't scrape the wrong SERP type. Use `tbm=nws` for news, `tbm=isch` for images, etc.

### 8. Use `Enhanced Ads` zone setting for ad-heavy research
Enable "Enhanced Ads" in your zone settings to fetch a larger, more diverse range of ads, simulating incognito browsing.

### 9. Note: `num` parameter is deprecated
As of September 2025, the `num` parameter no longer controls result count. Use pagination via `start` instead.
