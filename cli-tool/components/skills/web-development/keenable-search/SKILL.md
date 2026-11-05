---
name: keenable-search
description: Web search for agents using the Keenable API. Works without an API key through the free public endpoint; KEENABLE_API_KEY unlocks the keyed endpoint
---

# keenable-search

## Overview
Web search for current information using the [Keenable](https://keenable.ai/) search API. It returns ranked results with `title`, `url`, and a `snippet` of page text (the legacy `description` field is deprecated and usually empty). There's no SDK or MCP server to install. Once `curl` and `jq` are available, the public endpoint needs no Keenable API key.

## Prerequisites
- `curl`
- `jq` (builds the request body and parses results); verify with `command -v curl` and `command -v jq`

## Network access
This skill sends HTTPS POST requests to Keenable's search API at `https://api.keenable.ai/` (`/v1/search/public` without an API key, or `/v1/search` when `KEENABLE_API_KEY` is set). Search queries and the optional `X-Keenable-Title` attribution string leave the machine; result URLs are fetched separately if you open them with WebFetch.

## When to Use
- When you need current information from the web (docs, releases, news, pricing)
- When you need source URLs to cite or open with WebFetch
- When no search API key is configured and you still need a working web search

## Step-by-Step Guide
1. Run the search. Without a key, use the public endpoint:
   ```bash
   curl -sS --fail --connect-timeout 10 --max-time 30 https://api.keenable.ai/v1/search/public \
     -H "Content-Type: application/json" \
     -H "X-Keenable-Title: claude-code" \
     -d '{"query": "Next.js 15 caching changes", "max_results": 5}'
   ```
   On failure, `curl` prints the connection or HTTP error to stderr and exits non-zero (`--fail` treats 4xx/5xx as errors; `-S` shows the message even with `-s`).
2. If `KEENABLE_API_KEY` is set, use the keyed endpoint instead:
   ```bash
   curl -sS --fail --connect-timeout 10 --max-time 30 https://api.keenable.ai/v1/search \
     -H "Content-Type: application/json" \
     -H "X-API-Key: $KEENABLE_API_KEY" \
     -H "X-Keenable-Title: claude-code" \
     -d '{"query": "Next.js 15 caching changes", "max_results": 5}'
   ```
3. Read `results[]`. For each hit, use `title` and `url`, and summarize with the first ~500 characters of `snippet` (if `snippet` is empty, use legacy `description` when present). Skip hits without a `url`.
4. Open the most relevant URLs with WebFetch before quoting details, and cite them.

## Examples
Pick the endpoint automatically in one command:
```bash
set -o pipefail
command -v curl >/dev/null || { echo "curl is required" >&2; exit 1; }
command -v jq >/dev/null || { echo "jq is required" >&2; exit 1; }
q="bun 1.2 release notes"
if [ -n "$KEENABLE_API_KEY" ]; then
  url=https://api.keenable.ai/v1/search; auth=(-H "X-API-Key: $KEENABLE_API_KEY")
else
  url=https://api.keenable.ai/v1/search/public; auth=()
fi
body=$(mktemp)
trap 'rm -f "$body"' EXIT
http_code=$(curl -sS --connect-timeout 10 --max-time 30 -o "$body" -w '%{http_code}' \
  "$url" -H "Content-Type: application/json" -H "X-Keenable-Title: claude-code" "${auth[@]}" \
  -d "$(jq -n --arg q "$q" '{query: $q, max_results: 5}')" ) || {
  echo "Keenable search failed: curl exit $?" >&2; exit 1
}
if [ "$http_code" != "200" ]; then
  echo "Keenable search failed: HTTP $http_code" >&2
  cat "$body" >&2
  exit 1
fi
jq -r '.results[] | select((.url // "") != "") | "- \(.title): \(.url)\n  \(((if (.snippet // "") != "" then .snippet else (.description // "") end)[:500]))"' < "$body"
```

## Best Practices
- Keep `max_results` small (5–10) to save context
- Put API keys in environment variables, never in prompts or committed files
- Send `X-Keenable-Title` so requests are attributed to your tool

## Troubleshooting
- `429`: the public endpoint is rate-limited. Wait and retry, or set `KEENABLE_API_KEY`.
- `401`/`403` on `/v1/search`: check that `KEENABLE_API_KEY` is valid, or unset it to fall back to the public endpoint.
- Connection errors or non-200 HTTP status: read curl's stderr message or the response body from the example script before retrying.

## Related Skills
- exa-search, tavily-web, firecrawl-scraper
