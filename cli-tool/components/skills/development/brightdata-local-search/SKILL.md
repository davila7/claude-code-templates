---
name: brightdata-local-search
description: Set up and run local web searches using Bright Data SERP API with the unfancy-search pipeline (query expansion, SERP retrieval, RRF reranking).
---

# Bright Data Local Search

Run powerful web searches locally using Bright Data's SERP API. This skill sets up the [unfancy-search](https://github.com/yaronbeen/unfancy-search) pipeline — a local search engine with query expansion, multi-engine SERP retrieval, RRF reranking, deduplication, and domain clustering.

**Important: This skill uses the LOCAL version only. Do not use the hosted endpoint.**

## Prerequisites

- [Bright Data](https://brightdata.com) account with SERP API access
- [Anthropic API key](https://console.anthropic.com) (for query expansion, optional)
- Docker (recommended) or Node.js 18+ with pnpm

## Setup

### Step 1: Clone and Configure

```bash
git clone https://github.com/yaronbeen/unfancy-search.git
cd unfancy-search
cp .env.example .env
```

### Step 2: Set Environment Variables

Edit `.env` with your credentials:

```env
BRIGHT_DATA_API_TOKEN=your_brightdata_token
BRIGHT_DATA_SERP_ZONE=serp_api1
ANTHROPIC_API_KEY=your_anthropic_key   # Optional: enables AI query expansion
```

Get your Bright Data token from: https://brightdata.com (SERP API section)

### Step 3: Start the Local Server

**Docker (recommended):**
```bash
docker compose up -d
# Server runs at http://localhost:3000
```

**Node.js:**
```bash
pnpm install
pnpm dev
# Server runs at http://localhost:3000
```

## API Endpoints

All requests go to `http://localhost:3000`:

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/search` | POST | Start a search job |
| `/api/search-status/{jobId}` | GET | Poll for results |
| `/api/baseline` | POST | Trigger baseline collection |
| `/api/baseline-status/{id}` | GET | Poll baseline progress |

## Running a Search

### Step 1: Submit Search

```bash
curl -X POST http://localhost:3000/api/search \
  -H "Content-Type: application/json" \
  -d '{"query": "your search term"}'
```

The response returns a `jobId`.

### Step 2: Poll for Results

```bash
curl http://localhost:3000/api/search-status/{jobId}
```

Poll every 3 seconds until `status` is `"done"`.

### Search Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `query` | string | required | Search query |
| `expand` | boolean | `false` | Enable AI query expansion via Claude |
| `research` | boolean | `false` | Research mode (12 sub-queries for max coverage) |
| `engines` | string[] | all | SERP engines to use |
| `geo` | string | — | Geographic region filter |
| `count` | number | 10 | Max results (up to 10) |
| `includeDomains` | string[] | — | Only include results from these domains |
| `excludeDomains` | string[] | — | Exclude results from these domains |

### Search Modes

- **Basic** (`expand: false`): Single query, fastest, no AI cost
- **Expanded** (`expand: true`): Claude Haiku generates 3 sub-queries for broader coverage
- **Research** (`research: true`): 12 sub-queries for maximum coverage

## Usage Examples

### Basic Search from an Agent

```bash
# Start search
JOB_ID=$(curl -s -X POST http://localhost:3000/api/search \
  -H "Content-Type: application/json" \
  -d '{"query": "best practices for API rate limiting"}' | jq -r '.jobId')

# Poll until done
while true; do
  RESULT=$(curl -s http://localhost:3000/api/search-status/$JOB_ID)
  STATUS=$(echo $RESULT | jq -r '.status')
  if [ "$STATUS" = "done" ]; then
    echo $RESULT | jq '.results'
    break
  fi
  sleep 3
done
```

### Research Mode with Domain Filtering

```bash
curl -X POST http://localhost:3000/api/search \
  -H "Content-Type: application/json" \
  -d '{
    "query": "kubernetes scaling strategies",
    "research": true,
    "excludeDomains": ["pinterest.com", "quora.com"]
  }'
```

### Adding Search to an Existing Agent

To give your Claude Code agent search capabilities:

1. Ensure the local server is running (`docker compose up -d` in the unfancy-search directory)
2. Your agent can use `curl` or `fetch` to query `http://localhost:3000/api/search`
3. Parse the ranked results to ground responses with real web data

## Response Format

Results include:
- Ranked URLs with RRF scores
- Domain clustering (grouped by source)
- Cost transparency (per-search expense breakdown)
- Raw and unique result counts
- Search duration

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Server won't start | Verify Docker is running or Node.js 18+ installed |
| No results returned | Check `BRIGHT_DATA_API_TOKEN` is valid and SERP API zone is active |
| Query expansion not working | Verify `ANTHROPIC_API_KEY` is set and valid |
| Slow responses | Disable `expand` mode for faster single-query searches |
| Port 3000 in use | Stop other services or modify the port in docker-compose.yml |
