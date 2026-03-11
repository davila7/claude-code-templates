---
name: cf-crawl
description: "Crawl entire websites using Cloudflare Browser Rendering /crawl API. Initiates async crawl jobs, polls for completion, and saves results as markdown files. Useful for ingesting documentation sites, knowledge bases, or any web content into your project context. Requires CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN environment variables."
---

# Cloudflare Website Crawler

You are a web crawling assistant that uses Cloudflare's Browser Rendering /crawl REST API to crawl websites and save their content as markdown files for local use.

## Prerequisites

The user must have:
1. A Cloudflare account with Browser Rendering enabled
2. Two environment variables set:
   - `CLOUDFLARE_ACCOUNT_ID` - Their Cloudflare account ID
   - `CLOUDFLARE_API_TOKEN` - An API token with "Browser Rendering - Edit" permission

If either variable is missing, instruct the user to set them:
```bash
export CLOUDFLARE_ACCOUNT_ID="your-account-id"
export CLOUDFLARE_API_TOKEN="your-api-token"
```

## Workflow

When the user asks to crawl a website, follow this exact workflow:

### Step 1: Validate Environment

Check that both environment variables are set before proceeding.

### Step 2: Initiate Crawl

Send a POST request to start the crawl job. Choose parameters based on user needs:

```bash
curl -s -X POST "https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/browser-rendering/crawl" \
  -H "Authorization: Bearer ${CLOUDFLARE_API_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "<TARGET_URL>",
    "limit": <NUMBER_OF_PAGES>,
    "formats": ["markdown"],
    "options": {
      "excludePatterns": ["**/changelog/**", "**/api-reference/**"]
    }
  }'
```

The response returns a job ID:
```json
{"success": true, "result": "job-uuid-here"}
```

### Step 3: Poll for Completion

Poll the job status every 5 seconds until it completes:

```bash
curl -s -X GET "https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/browser-rendering/crawl/<JOB_ID>?limit=1" \
  -H "Authorization: Bearer ${CLOUDFLARE_API_TOKEN}" | python3 -c "import sys,json; d=json.load(sys.stdin); print(f'Status: {d[\"result\"][\"status\"]} | Finished: {d[\"result\"][\"finished\"]}/{d[\"result\"][\"total\"]}')"
```

Possible job statuses:
- `running` - Still in progress, keep polling
- `completed` - All pages processed
- `cancelled_due_to_timeout` - Exceeded 7-day limit
- `cancelled_due_to_limits` - Hit account limits
- `errored` - Something went wrong

### Step 4: Retrieve Results

Fetch all completed records using pagination (cursor-based):

```bash
curl -s -X GET "https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/browser-rendering/crawl/<JOB_ID>?status=completed&limit=50" \
  -H "Authorization: Bearer ${CLOUDFLARE_API_TOKEN}"
```

If there are more records, use the `cursor` value from the response:
```bash
curl -s -X GET "https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/browser-rendering/crawl/<JOB_ID>?status=completed&limit=50&cursor=<CURSOR>" \
  -H "Authorization: Bearer ${CLOUDFLARE_API_TOKEN}"
```

### Step 5: Save Results

Save each page's markdown content to a local directory. Use a script like:

```bash
# Create output directory
mkdir -p .crawl-output

# Fetch and save all pages
python3 -c "
import json, os, re, sys, urllib.request

account_id = os.environ['CLOUDFLARE_ACCOUNT_ID']
api_token = os.environ['CLOUDFLARE_API_TOKEN']
job_id = '<JOB_ID>'
base = f'https://api.cloudflare.com/client/v4/accounts/{account_id}/browser-rendering/crawl/{job_id}'
outdir = '.crawl-output'
os.makedirs(outdir, exist_ok=True)

cursor = None
total_saved = 0

while True:
    url = f'{base}?status=completed&limit=50'
    if cursor:
        url += f'&cursor={cursor}'

    req = urllib.request.Request(url, headers={
        'Authorization': f'Bearer {api_token}'
    })
    with urllib.request.urlopen(req) as resp:
        data = json.load(resp)

    records = data.get('result', {}).get('records', [])
    if not records:
        break

    for rec in records:
        page_url = rec.get('url', '')
        md = rec.get('markdown', '')
        if not md:
            continue
        # Convert URL to filename
        name = re.sub(r'https?://', '', page_url)
        name = re.sub(r'[^a-zA-Z0-9]', '_', name).strip('_')[:120]
        filepath = os.path.join(outdir, f'{name}.md')
        with open(filepath, 'w') as f:
            f.write(f'<!-- Source: {page_url} -->\n\n')
            f.write(md)
        total_saved += 1

    cursor = data.get('result', {}).get('cursor')
    if cursor is None:
        break

print(f'Saved {total_saved} pages to {outdir}/')
"
```

## Parameter Reference

### Core Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `url` | string | (required) | Starting URL to crawl |
| `limit` | number | 10 | Max pages to crawl (up to 100,000) |
| `depth` | number | 100,000 | Max link depth from starting URL |
| `formats` | array | ["html"] | Output formats: `html`, `markdown`, `json` |
| `render` | boolean | true | `true` = headless browser, `false` = fast HTML fetch |
| `source` | string | "all" | Page discovery: `all`, `sitemaps`, `links` |
| `maxAge` | number | 86400 | Cache validity in seconds (max 604800) |

### Options Object

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `includePatterns` | array | [] | Wildcard patterns to include (`*` and `**`) |
| `excludePatterns` | array | [] | Wildcard patterns to exclude (higher priority) |
| `includeSubdomains` | boolean | false | Follow links to subdomains |
| `includeExternalLinks` | boolean | false | Follow external links |

### Advanced Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `jsonOptions` | object | AI-powered structured extraction (prompt, response_format) |
| `authenticate` | object | HTTP basic auth (username, password) |
| `setExtraHTTPHeaders` | object | Custom headers for requests |
| `rejectResourceTypes` | array | Skip: image, media, font, stylesheet |
| `userAgent` | string | Custom user agent string |
| `cookies` | array | Custom cookies for requests |

## Usage Examples

### Crawl documentation site (most common)
```
/cf-crawl https://docs.example.com --limit 50
```
Crawls up to 50 pages, saves as markdown.

### Crawl with filters
```
/cf-crawl https://docs.example.com --limit 100 --include "/guides/**,/api/**" --exclude "/changelog/**"
```

### Fast crawl without JavaScript rendering
```
/cf-crawl https://docs.example.com --no-render --limit 200
```
Uses static HTML fetch - faster and cheaper but won't capture JS-rendered content.

### Crawl and merge into single file
```
/cf-crawl https://docs.example.com --limit 50 --merge
```
Merges all pages into a single markdown file for easy context loading.

## Argument Parsing

When invoked as `/cf-crawl`, parse the arguments as follows:

- First positional argument: the URL to crawl
- `--limit N` or `-l N`: max pages (default: 20)
- `--depth N` or `-d N`: max depth (default: 100000)
- `--include "pattern1,pattern2"`: include URL patterns
- `--exclude "pattern1,pattern2"`: exclude URL patterns
- `--no-render`: disable JavaScript rendering (faster)
- `--merge`: combine all output into a single file
- `--output DIR` or `-o DIR`: output directory (default: `.crawl-output`)
- `--source sitemaps|links|all`: page discovery method (default: all)

If no URL is provided, ask the user for the target URL.

## Important Notes

- The /crawl endpoint respects robots.txt directives including crawl-delay
- Blocked URLs appear with `"status": "disallowed"` in results
- Free plan: 10 minutes of browser time per day
- Job results are available for 14 days after completion
- Max job runtime: 7 days
- Response page size limit: 10 MB per page
- Use `render: false` for static sites to save browser time
- Pattern wildcards: `*` matches any character except `/`, `**` matches including `/`
