# Web Unlocker API Reference

## Table of Contents

- [Overview](#overview)
- [Authentication](#authentication)
- [REST API (Recommended)](#rest-api-recommended)
- [Proxy Interface](#proxy-interface)
- [All Request Parameters](#all-request-parameters)
- [Special Headers](#special-headers)
- [Response Structure](#response-structure)
- [Async Requests](#async-requests)
- [Output Formats](#output-formats)
- [Features](#features)
- [Billing Model](#billing-model)
- [Best Practices](#best-practices)
- [Anti-Patterns](#anti-patterns)

---

## Overview

Web Unlocker is Bright Data's HTTP-based unlocking proxy. It automatically selects the best proxy network, handles anti-bot protections, solves CAPTCHAs, and retries failed attempts. Use it for non-interactive data extraction where you need HTML, JSON, markdown, or screenshots of web pages via a simple HTTP request.

**When to use Web Unlocker vs other APIs:**

| Need | Use |
|------|-----|
| Scrape any webpage by URL | Web Unlocker |
| Search engine results (Google, Bing) | SERP API |
| Structured data from known platforms | Web Scraper API |
| Click, scroll, fill forms, run JS | Browser API |
| Browser automation libraries (Playwright/Puppeteer) | Browser API, NOT Web Unlocker |

---

## Authentication

Get your API key from the Bright Data Control Panel → Account Settings, or from your zone's Overview tab.

```bash
# Environment variable (recommended)
export BRIGHTDATA_API_KEY="your-api-key"
export BRIGHTDATA_UNLOCKER_ZONE="your-zone-name"
```

---

## REST API (Recommended)

**Endpoint:** `POST https://api.brightdata.com/request`

**Header:** `Authorization: Bearer YOUR_API_KEY`

### Minimal Request

```python
import requests

response = requests.post(
    "https://api.brightdata.com/request",
    headers={"Authorization": f"Bearer {API_KEY}"},
    json={
        "zone": "YOUR_ZONE_NAME",
        "url": "https://example.com",
        "format": "raw"
    }
)
print(response.text)
```

```javascript
const response = await fetch("https://api.brightdata.com/request", {
  method: "POST",
  headers: {
    "Authorization": `Bearer ${API_KEY}`,
    "Content-Type": "application/json"
  },
  body: JSON.stringify({
    zone: "YOUR_ZONE_NAME",
    url: "https://example.com",
    format: "raw"
  })
});
const html = await response.text();
```

```bash
curl -H "Authorization: Bearer $BRIGHTDATA_API_KEY" \
     -H "Content-Type: application/json" \
     -d '{"zone":"'"$BRIGHTDATA_UNLOCKER_ZONE"'","url":"https://example.com","format":"raw"}' \
     https://api.brightdata.com/request
```

---

## Proxy Interface

Alternative to the REST API — route requests through a proxy endpoint.

- **Host:** `brd.superproxy.io`
- **Port:** `33335`
- **Credentials:** `brd-customer-{CUSTOMER_ID}-zone-{ZONE_NAME}:{ZONE_PASSWORD}`

```python
import requests

proxies = {
    "http": "http://brd-customer-CUSTOMER_ID-zone-ZONE_NAME:PASSWORD@brd.superproxy.io:33335",
    "https": "http://brd-customer-CUSTOMER_ID-zone-ZONE_NAME:PASSWORD@brd.superproxy.io:33335"
}
# Install Bright Data's SSL certificate to avoid SSL errors
response = requests.get("https://example.com", proxies=proxies, verify="/path/to/brightdata-cert.crt")
```

Special proxy username flags (append to username string):
- `-country-XX` → Geo-target to country (e.g., `-country-us`)
- `-ua-mobile` → Use mobile user agent
- `-debug-full` → Enable debug header in response

---

## All Request Parameters

### REST API Body Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `zone` | string | Yes | Zone name from your Control Panel |
| `url` | string | Yes | Target URL (must include `http://` or `https://`) |
| `format` | string | Yes | `"raw"` (HTML string) or `"json"` (structured JSON) |
| `method` | string | No | HTTP verb, default `"GET"`. Use `"POST"` with `body` for POST requests |
| `body` | string | No | POST body payload (use with `"method": "POST"`) |
| `country` | string | No | 2-letter ISO country code for geo-targeting (e.g., `"us"`, `"gb"`). Auto-selected if omitted |
| `data_format` | string | No | Transform output: `"markdown"` or `"screenshot"` |
| `async` | boolean | No | Set `true` to use asynchronous mode. Returns `response_id` immediately |

---

## Special Headers

Used with the **proxy interface**. Pass in proxy username or as custom request headers.

| Header | Value | Description |
|--------|-------|-------------|
| `x-unblock-data-format` | `"markdown"` or `"screenshot"` | Convert response to markdown or PNG screenshot |
| `x-unblock-expect` | CSS selector, text, or body content | Wait for this element/text before returning response. Prevents partial page loads |
| `x-unblock-url-fragment` | The `#fragment` part of URL | Handle hash-fragmented URLs in a single request |
| `x-unblock-city` | City name string | Amazon-specific: simulate city selection |
| `x-unblock-zipcode` | ZIP code string | Amazon-specific: simulate ZIP code for region-specific content |

**Proxy username flags** (appended to username):
- `-ua-mobile` → Uses mobile user agents instead of desktop
- `-debug-full` → Adds `x-brd-debug` response header with: request ID, traffic metrics, billing status, destination IP, headers used, peer info, render status

---

## Response Structure

### Synchronous (format: "json")

```json
{
  "status": 200,
  "headers": {
    "content-type": "text/html",
    "...": "..."
  },
  "body": "<html>...</html>"
}
```

### Synchronous (format: "raw")

Returns the raw HTML/content as a string directly.

### Error Codes

| Code | Meaning | Action |
|------|---------|--------|
| `200` | Success | Process response |
| `400` | Bad Request | Check required fields: `zone`, `url`, `format` |
| `401` | Unauthorized | Verify API key |

---

## Async Requests

### Setup

Enable in Control Panel: Your Zone → Advanced Options → Toggle "Asynchronous requests" ON.

### Flow

**Step 1: Submit request**

```python
response = requests.post(
    "https://api.brightdata.com/unblocker/req",
    params={"zone": "YOUR_ZONE_NAME"},
    headers={"Authorization": f"Bearer {API_KEY}"},
    json={"url": "https://example.com"}
)
response_id = response.json()["response_id"]
```

**Step 2: Poll for result**

```python
import time

while True:
    result = requests.get(
        "https://api.brightdata.com/unblocker/get_result",
        params={"response_id": response_id},
        headers={"Authorization": f"Bearer {API_KEY}"}
    )
    if result.status_code == 200:
        print(result.json()["body"])
        break
    time.sleep(5)
```

### Async Key Facts
- Responses typically complete within **5 minutes**, up to **8 hours** during peak
- Results stored for **48 hours**
- Better for slow-responding sites or large-scale URL processing
- Use webhooks for production: set webhook URL in zone settings to receive push notifications

---

## Output Formats

### HTML (default)
Raw HTML string. Use `format: "raw"`.

### Markdown
Clean markdown extracted from the page. Best for LLM consumption.

**REST API:**
```json
{ "zone": "...", "url": "...", "format": "raw", "data_format": "markdown" }
```

**Proxy:**
Add header: `x-unblock-data-format: markdown`

### Screenshot
PNG screenshot of the rendered page. Useful for debugging and visual verification.

**REST API:**
```json
{ "zone": "...", "url": "...", "format": "raw", "data_format": "screenshot" }
```

---

## Features

### CAPTCHA Solving
Enabled by default. Automatically solves CAPTCHAs encountered during requests. Can be disabled in Advanced Settings for a lightweight solution when CAPTCHA solving isn't needed.

### Premium Domains
Certain high-difficulty websites require additional resources. Enable "Premium Domains" in zone settings during creation. Only requests targeting premium-classified domains are billed at the higher rate.

### Geolocation Targeting
Auto-selects optimal IP location. Override with `country` parameter (REST API) or `-country-XX` (proxy). Country-level targeting only (not city-level—use Browser API for that).

### Mobile User Agent
Append `-ua-mobile` to proxy username, or use via proxy username flag, to use mobile-specific user agents.

### Auto-Throttling
System automatically adjusts based on success rates:
- Default threshold: 70% success rate
- Automatically applies better-performing configurations
- When custom headers/cookies are enabled: customizable threshold

### Debug Header
Add `-debug-full` to proxy username to receive `x-brd-debug` response header containing: request ID, traffic metrics, billing status, destination IP, headers used, peer info, render status.

### Success Rate API
Query domain-specific success rates for the past 7 days:
```bash
GET https://api.brightdata.com/unblocker/success_rate/?zone=YOUR_ZONE&domain=example.com
Authorization: Bearer YOUR_API_KEY
```

---

## Custom Headers & Cookies (Advanced)

Override automatically-generated headers and cookies.

**When to use:** When you need to pass specific session cookies, authentication headers, or custom values to reach a particular site version.

**How to enable:** Control Panel → Your Zone → Advanced Options → Toggle "Custom Headers & Cookies" ON.

**Critical billing note:** Enabling custom headers/cookies means you are **billed for 100% of requests** (both successful and failed), because you are taking control of request parameters. Standard mode only bills for successes.

**Restrictions:**
- Custom values must be from a compliance-pre-approved list
- Unlisted values require approval from the compliance team
- Cannot pass authentication/login credentials

---

## Billing Model

| Mode | Billing |
|------|---------|
| Standard | CPM — billed per 1,000 **successful** requests only |
| Custom Headers/Cookies enabled | Billed for **all** requests (successful + failed) |
| Async collect/retrieve calls | **Not billed** — only the initial submission is billed |

Monitor usage via the "Traffic" column in My Proxies (CPM = cost per 1,000 successful requests).

---

## Best Practices

### 1. Start with direct API endpoint targeting
Many sites expose clean API endpoints. Try hitting the API directly first — it often succeeds without extra config and is cheaper.

```python
# Try the API endpoint first
response = requests.post(
    "https://api.brightdata.com/request",
    headers={"Authorization": f"Bearer {API_KEY}"},
    json={"zone": ZONE, "url": "https://site.com/api/products.json", "format": "raw"}
)
```

### 2. Fall back to main webpage if API fails
If the direct API endpoint fails, scrape the primary webpage instead.

### 3. Use Browser API for complex JS-heavy scenarios
When you need to execute JavaScript, click elements, or interact with the page — don't try to force Web Unlocker. Use Browser API.

### 4. Use `x-unblock-expect` to prevent partial loads
For pages that load content progressively, specify an expected element to ensure the content you need is present.

```json
{
  "zone": "...",
  "url": "https://example.com/products",
  "format": "raw",
  "headers": { "x-unblock-expect": ".product-list" }
}
```

### 5. Use markdown format for LLM pipelines
When feeding scraped content to an LLM, use `data_format: "markdown"` to get clean, structured text without HTML noise.

### 6. Use async for bulk/large-scale processing
Async improves stability for slow sites and enables processing large batches of URLs without blocking.

### 7. Use geolocation for region-restricted content
Pass `country` parameter when you need region-specific content (prices, availability, localized pages).

```json
{ "zone": "...", "url": "https://example.com", "format": "raw", "country": "de" }
```

### 8. Monitor success rates before custom header mode
Check your domain success rates via the API before enabling custom headers (which changes billing to 100%).

---

## Anti-Patterns

**DO NOT use Web Unlocker with browser automation libraries.**
- Puppeteer, Playwright, Selenium → use **Browser API** instead
- Chrome, Firefox, Edge → use **Bright Data proxy networks** (Residential, ISP, etc.)
- Anti-detect browsers (Adspower, Multilogin) → use proxy networks

Web Unlocker is optimized for singular HTTP requests, not browser sessions.

**DO NOT enable custom headers unless necessary.**
Enabling custom headers changes billing from success-only to 100% of all requests.

**DO NOT ignore the `x-unblock-expect` header for paginated/dynamic content.**
Without it, you may receive partial pages before JavaScript has populated content.
