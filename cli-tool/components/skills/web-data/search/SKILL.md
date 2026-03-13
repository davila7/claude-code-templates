---
name: search
description: Search Google via Bright Data SERP API. Returns structured JSON results with title, link, and description. Requires BRIGHTDATA_API_KEY and BRIGHTDATA_UNLOCKER_ZONE environment variables.
---

# Bright Data - Google Search

Search Google and get structured JSON results using Bright Data's SERP API.

## Setup

**1. Get your API Key:**
Get a key from [Bright Data Dashboard](https://brightdata.com/cp).

**2. Create a Web Unlocker zone:**
Create a zone at brightdata.com/cp by clicking "Add" (top-right), selecting "Unlocker zone".

**3. Set environment variables:**
```bash
export BRIGHTDATA_API_KEY="your-api-key"
export BRIGHTDATA_UNLOCKER_ZONE="your-zone-name"
```

## Usage

```bash
bash scripts/search.sh "query" [cursor]
```

**Parameters:**
- `query` (required): Search term
- `cursor` (optional): Page number for pagination (0-indexed, default: 0)

**Examples:**
```bash
# Basic search
bash scripts/search.sh "climate change"

# Get page 2 of results
bash scripts/search.sh "climate change" 1
```

## Output Format

Returns JSON with structured `organic` array:
```json
{
  "organic": [
    {
      "link": "https://example.com/article",
      "title": "Article Title",
      "description": "Brief description of the page..."
    }
  ]
}
```

## Dependencies

- `curl` - For API requests
- `jq` - For JSON processing
