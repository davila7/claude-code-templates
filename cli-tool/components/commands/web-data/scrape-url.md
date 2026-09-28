---
name: scrape-url
allowed-tools: Bash(python3:*)
argument-hint: "<url> [parsed] [country=XX]"
description: "Scrape any web page through the ScrapeUnblocker anti-bot API and return its HTML or AI-parsed JSON. Use when a page is blocked (403/429, captcha) or needs a real browser to render."
---

# Scrape a URL with ScrapeUnblocker

Fetch the target page through ScrapeUnblocker, bypassing anti-bot protection (Cloudflare, DataDome, PerimeterX, Akamai, Shape).

Arguments: $ARGUMENTS

## Requirements

- An API key in the `SCRAPEUNBLOCKER_KEY` environment variable (get one at https://app.scrapeunblocker.com/?utm_source=aitmpl&utm_medium=integration&utm_campaign=claude-code-templates).
- `python3` on `PATH` (standard library only).

## Steps

1. **Parse the arguments.** Split them on whitespace.
   - The first token is the target URL. It must start with `http://` or `https://`; otherwise stop and ask the user for a valid URL.
   - Every later token must be exactly one of the following, matched as a whole token:
     - `parsed` - return AI-parsed JSON instead of HTML.
     - `country=XX`, where `XX` is exactly two letters - route the request through that country.
   - If any later token is anything else (for example `mode=parsed` or `country=USA`), tell the user which token was not recognised and stop. Do not guess.

2. **Run the request** with the script below, filling in its three arguments:
   - `URL` - the target URL inside **single quotes**. If the URL itself contains a single quote, replace every `'` with `%27` first. The URL must appear only in this position; never paste it into the script body or anywhere else in the command.
   - `PARSED` - `1` if the `parsed` flag was given, otherwise `0`.
   - `COUNTRY` - the two-letter code, or an empty string `''`.

   Keep the heredoc delimiter quoted (`<<'PY'`) so the shell does not expand anything inside the script. The script passes the URL to the API as data, checks the HTTP status, saves the full response to a temporary file, and prints at most 20 KB.

```bash
python3 - 'URL' 'PARSED' 'COUNTRY' <<'PY'
import json, os, sys, tempfile, urllib.error, urllib.parse, urllib.request

LIMIT = 20000
url, parsed, country = sys.argv[1], sys.argv[2] == "1", sys.argv[3]
key = os.environ.get("SCRAPEUNBLOCKER_KEY")
if not key:
    sys.exit("SCRAPEUNBLOCKER_KEY is not set")
query = {"url": url}
if parsed:
    query["parsed_data"] = "true"
if country:
    query["proxy_country"] = country.upper()
req = urllib.request.Request(
    "https://api.scrapeunblocker.com/getPageSource?" + urllib.parse.urlencode(query),
    method="POST",
    headers={"X-ScrapeUnblocker-Key": key},
)
try:
    with urllib.request.urlopen(req, timeout=180) as resp:
        status, body = resp.status, resp.read()
        origin_status = resp.headers.get("X-Origin-Status")
except urllib.error.HTTPError as e:
    detail = e.read()[:500].decode("utf-8", "replace")
    sys.exit(f"ERROR: ScrapeUnblocker returned HTTP {e.code}: {detail}")
except (urllib.error.URLError, TimeoutError) as e:
    sys.exit(f"ERROR: request failed: {getattr(e, 'reason', e)}")
if origin_status:
    print(f"NOTE: the target site itself answered HTTP {origin_status}")
if not body.strip():
    sys.exit(f"ERROR: empty response (HTTP {status})")

fd, path = tempfile.mkstemp(prefix="scrapeunblocker-", suffix=".json" if parsed else ".html")
with os.fdopen(fd, "wb") as f:
    f.write(body)
print(f"HTTP {status}, {len(body)} bytes, full response saved to {path}")

if parsed:
    try:
        data = json.loads(body)
    except ValueError:
        sys.exit("ERROR: expected JSON but the response is not valid JSON (see the saved file)")
    text = json.dumps(data, indent=2, ensure_ascii=False)
    size = len(text.encode("utf-8"))
    if size <= LIMIT:
        print(text)
    else:
        if isinstance(data, dict):
            outline = {k: list(v)[:20] if isinstance(v, dict) else type(v).__name__ for k, v in list(data.items())[:20]}
        else:
            outline = f"list of {len(data)} items"
        print(f"Parsed JSON is {size} bytes, too large to print in full. Outline: {str(outline)[:2000]}")
        print("Read the fields you need from the saved file instead of guessing.")
else:
    print(body[:LIMIT].decode("utf-8", "ignore"))
    if len(body) > LIMIT:
        print(f"\n[HTML truncated to {LIMIT} bytes; the full page is in the saved file]")
PY
```

3. **Check the outcome before using it.**
   - If the script exits with an error (`ERROR: ...`), report that error to the user and stop. Do not summarize an error message as if it were page content.
   - An HTTP 200 does not always mean the page was delivered: the body can itself be a block or captcha page (titles such as "Just a moment...", "Access Denied"). If it looks like one, say so, and suggest retrying once or adding `country=XX`.
   - If the output was truncated or the parsed JSON was too large to print, read the fields you need from the saved file with `python3` instead of guessing.

4. **Summarize the result.** If the user asked for specific fields, extract them; otherwise describe the page.

## Notes

- For structured fields (price, title, etc.), pass `parsed` to get clean JSON instead of HTML.
- Docs: https://docs.scrapeunblocker.com/?utm_source=aitmpl&utm_medium=integration&utm_campaign=claude-code-templates
