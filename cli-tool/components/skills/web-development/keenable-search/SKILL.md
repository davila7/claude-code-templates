---
name: keenable-search
description: Web search for agents using the Keenable API. Works without an API key through the free public endpoint; KEENABLE_API_KEY unlocks the keyed endpoint
---

# keenable-search

## Overview
Web search for current information using the [Keenable](https://keenable.ai/) search API. It returns ranked results with `title`, `url`, and a `snippet` of page text (the legacy `description` field is deprecated and usually empty). There's no SDK or MCP server to install. The free public endpoint needs no API key, so it works as soon as the skill is installed.

## Prerequisites
- `curl`
- `jq` (used to build the request body and parse results); check with `command -v jq`

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
2. If `KEENABLE_API_KEY` is set, use the keyed endpoint instead:
   ```bash
   curl -sS --fail --connect-timeout 10 --max-time 30 https://api.keenable.ai/v1/search \
     -H "Content-Type: application/json" \
     -H "X-API-Key: $KEENABLE_API_KEY" \
     -H "X-Keenable-Title: claude-code" \
     -d '{"query": "Next.js 15 caching changes", "max_results": 5}'
   ```
3. Read `results[]`. For each hit, use `title` and `url`, and summarize with the first ~500 characters of `snippet`. Skip hits without a `url`.
4. Open the most relevant URLs with WebFetch before quoting details, and cite them.

## Examples
Pick the endpoint automatically in one command:
```bash
set -o pipefail
command -v jq >/dev/null || { echo "jq is required" >&2; exit 1; }
q="bun 1.2 release notes"
if [ -n "$KEENABLE_API_KEY" ]; then
  url=https://api.keenable.ai/v1/search; auth=(-H "X-API-Key: $KEENABLE_API_KEY")
else
  url=https://api.keenable.ai/v1/search/public; auth=()
fi
curl -sS --fail --connect-timeout 10 --max-time 30 "$url" -H "Content-Type: application/json" -H "X-Keenable-Title: claude-code" "${auth[@]}" \
  -d "$(jq -n --arg q "$q" '{query: $q, max_results: 5}')" \
  | jq -r '.results[] | select(.url) | "- \(.title): \(.url)\n  \((.snippet // .description // "")[:500])"'
```

## Best Practices
- Keep `max_results` small (5–10) to save context
- Put API keys in environment variables, never in prompts or committed files
- Send `X-Keenable-Title` so requests are attributed to your tool

## Troubleshooting
- `429`: the public endpoint is rate-limited. Wait and retry, or set `KEENABLE_API_KEY`.
- `401`/`403` on `/v1/search`: check that `KEENABLE_API_KEY` is valid, or unset it to fall back to the public endpoint.

## Related Skills
- exa-search, tavily-web, firecrawl-scraper
