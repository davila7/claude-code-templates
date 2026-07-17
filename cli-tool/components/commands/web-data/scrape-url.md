---
name: scrape-url
allowed-tools: Bash(curl:*), Bash(python3:*), Bash(awk:*), Bash(grep:*), Bash(cut:*), Bash(head:*), Bash(echo:*)
argument-hint: "[url] | [url] parsed | [url] country=US"
description: "Scrape any web page through the ScrapeUnblocker anti-bot API and return its HTML or AI-parsed JSON. Use when a page is blocked (403/429, captcha) or needs a real browser to render."
---

# Scrape a URL with ScrapeUnblocker

Fetch the target page through ScrapeUnblocker, bypassing anti-bot protection (Cloudflare, DataDome, PerimeterX, Akamai, Shape).

Target: $ARGUMENTS

## Requirements

- An API key in the `SCRAPEUNBLOCKER_KEY` environment variable (get one at https://app.scrapeunblocker.com).
- `python3` on `PATH` (used to URL-encode the target and to truncate output safely).

## Steps

1. Parse `$ARGUMENTS`: the **first token is the URL**. Only the tokens **after** the URL are treated as flags - if one of them is `parsed`, request AI-parsed JSON (`parsed_data=true`); if one is `country=XX`, add `proxy_country=XX`. (Flags are never matched against the URL itself, so a URL containing `parsed` or `country=` does not change the request.)
2. URL-encode the target URL.
3. Call the API and print the result:

!`URL_RAW=$(echo "$ARGUMENTS" | awk '{print $1}'); command -v python3 >/dev/null 2>&1 || { echo "python3 is required for URL encoding"; exit 1; }; ENC=$(python3 -c "import urllib.parse,sys;print(urllib.parse.quote(sys.argv[1],safe=''))" "$URL_RAW"); FLAGS=$(echo "$ARGUMENTS" | cut -s -d' ' -f2-); EXTRA=""; echo "$FLAGS" | grep -qw parsed && EXTRA="$EXTRA&parsed_data=true"; CC=$(echo "$FLAGS" | grep -oE 'country=[A-Za-z]{2}' | head -1 | cut -d= -f2); [ -n "$CC" ] && EXTRA="$EXTRA&proxy_country=$CC"; curl -s -X POST "https://api.scrapeunblocker.com/getPageSource?url=$ENC$EXTRA" -H "X-ScrapeUnblocker-Key: ${SCRAPEUNBLOCKER_KEY:?set SCRAPEUNBLOCKER_KEY}" | python3 -c "import sys; d=sys.stdin.buffer.read(); lim=20000; sys.stdout.write(d[:lim].decode('utf-8','replace')); (len(d)>lim) and sys.stderr.write('\n[output truncated to %d bytes]\n' % lim)"`

4. Summarize the result for the user. If they asked for specific fields, extract them; otherwise describe the page.

## Notes

- For structured fields (price, title, etc.), pass `parsed` to get clean JSON instead of HTML.
- If the result looks like a block/captcha page, retry once or add `country=US` (or the relevant country).
- Docs: https://developers.scrapeunblocker.com
