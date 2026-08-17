---
name: scrapeunblocker-best-practices
description: "Build production-ready ScrapeUnblocker integrations. Reference for developers using coding assistants (Claude Code, Cursor, etc.) to scrape any URL with built-in anti-bot bypass (Cloudflare, DataDome, PerimeterX, Akamai, Shape). Covers the getPageSource endpoint (raw HTML / AI-parsed JSON), serpApi (Google results), getImage, country targeting, render waits, and retries."
user-invocable: false
---

# ScrapeUnblocker API

ScrapeUnblocker renders web pages behind anti-bot protection and returns the HTML, AI-parsed structured JSON, Google search results, or images. One API key, a handful of endpoints. Get a key at https://app.scrapeunblocker.com and read the docs at https://developers.scrapeunblocker.com.

## Choosing the right endpoint

| Use case | Endpoint | Notes |
|----------|----------|-------|
| Fetch a page's fully rendered HTML | `POST /getPageSource` | Bypasses anti-bot, runs a real browser |
| Structured data (product, article, listing) without writing parsers | `POST /getPageSource?parsed_data=true` | Returns AI-parsed JSON (Schema.org / `__NEXT_DATA__` / AI rules) |
| Google search results | `POST /serpApi` | Structured organic results |
| Download an image behind protection | `POST /getImage` | Returns raw bytes |

Always pick the most specific endpoint: use `parsed_data=true` before writing your own HTML parsing, and `serpApi` before scraping Google HTML by hand.

## Authentication

Every request is authenticated with your API key in a header:

```bash
curl -X POST "https://api.scrapeunblocker.com/getPageSource?url=https%3A%2F%2Fexample.com" \
  -H "X-ScrapeUnblocker-Key: YOUR_API_KEY"
```

The URL must be URL-encoded and passed as the `url` query parameter.

## Useful parameters (getPageSource)

| Parameter | Purpose |
|-----------|---------|
| `parsed_data=true` | Return AI-parsed JSON instead of raw HTML |
| `proxy_country=US` | Route through a specific country (ISO alpha-2) |
| `method=css` + `value=#price` | Wait for a CSS selector before capturing |
| `method=js` + `value=...` | Wait for a JS expression to be truthy |
| `method_timeout=15` | Cap (seconds) for the render-wait method |
| `time_sleep=3` | Extra seconds to wait after load |

## Best practices

- **Encode the target URL.** Pass it URL-encoded in the `url` query parameter, not raw.
- **Prefer parsed data.** For product/article/listing pages, `parsed_data=true` returns clean JSON and saves you brittle per-site parsers.
- **Target the right country.** If a page is geo-restricted or localized, set `proxy_country` to match.
- **Use render waits for JS-heavy pages.** If content loads late, wait on a selector (`method=css`) or a JS condition (`method=js`) instead of a fixed sleep.
- **Retry transient failures.** Anti-bot pages occasionally need a second attempt; retry with backoff on 5xx or empty results. The official SDKs retry automatically.
- **Validate the response.** Occasionally a returned page can itself be a block/captcha page; check for expected content before trusting it.

## Common mistakes to avoid

These trip people up most often:

- **Endpoints are POST, not GET.** A `GET` returns `405 Method Not Allowed`.
- **Parameters go in the query string, not a JSON body.** Even for POST, pass
  `url`, `parsed_data`, `proxy_country`, etc. as query parameters.
- **Use the documented parameter names.** It's `proxy_country` (not `country`)
  and `method_timeout` (not `timeout`). Browser rendering always happens, so
  there is no `render` or `js` flag to enable it.
- **HTTP 200 does not always mean success.** A returned page can itself be a
  block/captcha page. Always validate that the expected content is present
  before trusting the response.

## Official SDKs and MCP

Rather than call the HTTP API directly, use an official client:

- Python: `pip install scrapeunblocker`
- Node.js: `npm install scrapeunblocker`
- Ruby: `gem install scrapeunblocker`
- PHP: `composer require scrapeunblocker/client`
- MCP server (Claude and other assistants): `npx -y scrapeunblocker-mcp`

Each reads the API key from the `SCRAPEUNBLOCKER_KEY` environment variable.
