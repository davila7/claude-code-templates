---
name: scrape-url
allowed-tools: Bash
argument-hint: "[url] | [url] parsed | [url] country=US"
description: "Scrape any web page through the ScrapeUnblocker anti-bot API and return its HTML or AI-parsed JSON. Use when a page is blocked (403/429, captcha) or needs a real browser to render."
---

# Scrape a URL with ScrapeUnblocker

Fetch the target page through ScrapeUnblocker, bypassing anti-bot protection (Cloudflare, DataDome, PerimeterX, Akamai, Shape).

Target: $ARGUMENTS

## Requirements

- An API key in the `SCRAPEUNBLOCKER_KEY` environment variable (get one at https://app.scrapeunblocker.com).

## Steps

1. Parse `$ARGUMENTS`: the first token is the URL. If it contains `parsed`, request AI-parsed JSON (`parsed_data=true`). If it contains `country=XX`, add `proxy_country=XX`.
2. URL-encode the target URL.
3. Call the API and print the result:

!`URL_RAW=$(echo "$ARGUMENTS" | awk '{print $1}'); ENC=$(python3 -c "import urllib.parse,sys;print(urllib.parse.quote(sys.argv[1],safe=''))" "$URL_RAW"); EXTRA=""; echo "$ARGUMENTS" | grep -q parsed && EXTRA="$EXTRA&parsed_data=true"; CC=$(echo "$ARGUMENTS" | grep -oE 'country=[A-Za-z]{2}' | cut -d= -f2); [ -n "$CC" ] && EXTRA="$EXTRA&proxy_country=$CC"; curl -s -X POST "https://api.scrapeunblocker.com/getPageSource?url=$ENC$EXTRA" -H "X-ScrapeUnblocker-Key: ${SCRAPEUNBLOCKER_KEY:?set SCRAPEUNBLOCKER_KEY}" | head -c 4000`

4. Summarize the result for the user. If they asked for specific fields, extract them; otherwise describe the page.

## Notes

- For structured fields (price, title, etc.), pass `parsed` to get clean JSON instead of HTML.
- If the result looks like a block/captcha page, retry once or add `country=US` (or the relevant country).
- Docs: https://developers.scrapeunblocker.com
