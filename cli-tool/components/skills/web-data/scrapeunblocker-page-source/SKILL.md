---
name: scrapeunblocker-page-source
description: "Fetch the fully rendered HTML of any web page through ScrapeUnblocker, bypassing anti-bot protection (Cloudflare, DataDome, PerimeterX, Akamai, Shape). Use when a normal request is blocked (403/429, captcha, 'access denied') or when a page needs a real browser to render. Covers the getPageSource endpoint, render waits, and country targeting."
user-invocable: false
---

# Fetching page HTML with ScrapeUnblocker

Use ScrapeUnblocker's `getPageSource` endpoint to get the fully rendered HTML of a page that would otherwise block you.

## Basic request

```bash
curl -X POST "https://api.scrapeunblocker.com/getPageSource?url=https%3A%2F%2Fexample.com" \
  -H "X-ScrapeUnblocker-Key: YOUR_API_KEY"
```

The `url` must be URL-encoded. The response body is the page HTML.

## With the SDK

```python
from scrapeunblocker import ScrapeUnblockerClient

su = ScrapeUnblockerClient()  # reads SCRAPEUNBLOCKER_KEY
html = su.get_page_source("https://example.com")
```

```ts
import { ScrapeUnblockerClient } from "scrapeunblocker";

const su = new ScrapeUnblockerClient(); // reads SCRAPEUNBLOCKER_KEY
const html = await su.getPageSource("https://example.com");
```

## Waiting for dynamic content

If the content you need loads via JavaScript after the initial HTML:

- Wait for a CSS selector: `method=css` and `value=#product-price`
- Wait for a JS condition: `method=js` and `value=document.querySelectorAll('.item').length>0`
- Cap the wait with `method_timeout=15` (seconds), or add a fixed `time_sleep=3`.

## Country targeting

Route through a specific country when a page is geo-restricted or localized:

```bash
curl -X POST "https://api.scrapeunblocker.com/getPageSource?url=<ENCODED_URL>&proxy_country=US" \
  -H "X-ScrapeUnblocker-Key: YOUR_API_KEY"
```

## Tips

- Retry on 5xx or empty results with a short backoff; the official SDKs do this automatically.
- Check the returned HTML actually contains what you expect before parsing it.
- For structured fields (price, title, etc.), prefer `parsed_data=true` (see the `scrapeunblocker-parsed-data` skill) over parsing HTML yourself.

Docs: https://developers.scrapeunblocker.com/guides/page-source
