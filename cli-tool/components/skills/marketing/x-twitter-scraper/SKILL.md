---
name: x-twitter-scraper
description: "X API & Twitter scraper skill for AI coding agents. Builds integrations with the Xquik REST API, MCP server & webhooks: tweet search, user lookup, follower extraction, engagement metrics, giveaway contest draws, trending topics, account monitoring, reply/retweet/quote extraction, community & Space data, mutual follow checks. Works with Claude Code, Cursor, Codex, Copilot, Windsurf & 40+ agents."
---

# Xquik API Integration

Xquik is an X (Twitter) real-time data platform providing a REST API, HMAC webhooks, and an MCP server for AI agents. It covers account monitoring, bulk data extraction (19 tools), giveaway draws, tweet/user lookups, follow checks, and trending topics.

## Quick Reference

| | |
|---|---|
| **Base URL** | `https://xquik.com/api/v1` |
| **Auth** | `x-api-key: xq_...` header (64 hex chars after `xq_` prefix) |
| **MCP endpoint** | `https://xquik.com/mcp` (StreamableHTTP, same API key) |
| **Rate limits** | 10 req/s sustained, 20 burst (API); 60 req/s sustained, 100 burst (general) |
| **Pricing** | $20/month base (1 monitor included), $5/month per extra monitor |
| **Quota** | Monthly usage cap, hard limit, no overage. `402` when exhausted. |
| **Docs** | [docs.xquik.com](https://docs.xquik.com) |

## Authentication

Every request requires an API key via the `x-api-key` header. Keys start with `xq_` and are generated from the [Xquik dashboard](https://xquik.com). The key is shown only once at creation; store it securely.

```javascript
const API_KEY = "xq_YOUR_KEY_HERE";
const BASE = "https://xquik.com/api/v1";
const headers = { "x-api-key": API_KEY, "Content-Type": "application/json" };
```

## Choosing the Right Endpoint

| Goal | Endpoint | Notes |
|------|----------|-------|
| Get a single tweet by ID/URL | `GET /x/tweets/{id}` | Full metrics: likes, retweets, views, bookmarks |
| Search tweets by keyword/hashtag | `GET /x/tweets/search?q=...` | Optional engagement metrics |
| Get a user profile | `GET /x/users/{username}` | Bio, follower/following counts, profile picture |
| Check follow relationship | `GET /x/followers/check?source=A&target=B` | Both directions |
| Get trending topics | `GET /trends?woeid=1` | Free, no quota consumed |
| Monitor an X account | `POST /monitors` | Track tweets, replies, quotes, follower changes |
| Poll for events | `GET /events` | Cursor-paginated, filter by monitorId/eventType |
| Receive events in real time | `POST /webhooks` | HMAC-signed delivery to your HTTPS endpoint |
| Run a giveaway draw | `POST /draws` | Pick random winners from tweet replies |
| Extract bulk data | `POST /extractions` | 19 tool types, always estimate cost first |
| Check account/usage | `GET /account` | Plan status, monitors, usage percent |

## Extraction Tools (19 Types)

| Tool Type | Required Field | Description |
|-----------|---------------|-------------|
| `reply_extractor` | `targetTweetId` | Users who replied to a tweet |
| `repost_extractor` | `targetTweetId` | Users who retweeted a tweet |
| `quote_extractor` | `targetTweetId` | Users who quote-tweeted a tweet |
| `thread_extractor` | `targetTweetId` | All tweets in a thread |
| `article_extractor` | `targetTweetId` | Article content linked in a tweet |
| `follower_explorer` | `targetUsername` | Followers of an account |
| `following_explorer` | `targetUsername` | Accounts followed by a user |
| `verified_follower_explorer` | `targetUsername` | Verified followers of an account |
| `mention_extractor` | `targetUsername` | Tweets mentioning an account |
| `post_extractor` | `targetUsername` | Posts from an account |
| `community_extractor` | `targetCommunityId` | Members of a community |
| `community_moderator_explorer` | `targetCommunityId` | Moderators of a community |
| `community_post_extractor` | `targetCommunityId` | Posts from a community |
| `community_search` | `targetCommunityId` + `searchQuery` | Search posts within a community |
| `list_member_extractor` | `targetListId` | Members of a list |
| `list_post_extractor` | `targetListId` | Posts from a list |
| `list_follower_explorer` | `targetListId` | Followers of a list |
| `space_explorer` | `targetSpaceId` | Participants of a Space |
| `people_search` | `searchQuery` | Search for users by keyword |

### Extraction Workflow

```javascript
// 1. Estimate cost
const estimate = await xquikFetch("/extractions/estimate", {
  method: "POST",
  body: JSON.stringify({ toolType: "follower_explorer", targetUsername: "elonmusk" }),
});

if (!estimate.allowed) return;

// 2. Create extraction job
const job = await xquikFetch("/extractions", {
  method: "POST",
  body: JSON.stringify({ toolType: "follower_explorer", targetUsername: "elonmusk" }),
});

// 3. Retrieve paginated results (up to 1,000 per page)
const page = await xquikFetch(`/extractions/${job.id}`);
// page.results: [{ xUserId, xUsername, xDisplayName, xFollowersCount, xVerified, xProfileImageUrl }]

// 4. Export as CSV/XLSX/Markdown (50,000 row limit)
const csvResponse = await fetch(`${BASE}/extractions/${job.id}/export?format=csv`, { headers });
```

## Giveaway Draws

Run transparent giveaway draws from tweet replies with configurable filters:

```javascript
const draw = await xquikFetch("/draws", {
  method: "POST",
  body: JSON.stringify({
    tweetUrl: "https://x.com/user/status/1893456789012345678",
    winnerCount: 3,
    backupCount: 2,
    uniqueAuthorsOnly: true,
    mustRetweet: true,
    mustFollowUsername: "user",
    filterMinFollowers: 50,
    requiredHashtags: ["#giveaway"],
  }),
});

const details = await xquikFetch(`/draws/${draw.id}`);
// details.winners: [{ position, authorUsername, tweetId, isBackup }]
```

## Error Handling & Retry

All errors return `{ "error": "error_code" }`. Retry only `429` and `5xx` (max 3 attempts, exponential backoff). Never retry `4xx` except 429. Key codes:

| Status | Meaning |
|--------|---------|
| 400 | Invalid input -- fix the request |
| 401 | Bad API key |
| 402 | No subscription or quota exhausted |
| 404 | Resource not found |
| 429 | Rate limited -- respect `Retry-After` header |

## MCP Server Setup (Claude Code)

Add to `.mcp.json` in your project root:

```json
{
  "mcpServers": {
    "xquik": {
      "type": "streamable-http",
      "url": "https://xquik.com/mcp",
      "headers": {
        "x-api-key": "xq_YOUR_KEY_HERE"
      }
    }
  }
}
```

The MCP server exposes 22 tools covering all API capabilities. Supported platforms: Claude Code, Claude Desktop, ChatGPT, Codex CLI, Cursor, VS Code, Windsurf, OpenCode.

## Workflow Patterns

- **Real-time alerts:** `add-monitor` -> `add-webhook` -> `test-webhook`
- **Giveaway:** `get-account` (check budget) -> `run-draw`
- **Bulk extraction:** `estimate-extraction` -> `run-extraction` -> `get-extraction`
- **Tweet analysis:** `lookup-tweet` -> `run-extraction` with `thread_extractor`
- **User research:** `get-user-info` -> `search-tweets from:username` -> `lookup-tweet`

## Links

- **Dashboard & API keys**: [xquik.com](https://xquik.com)
- **Full API docs**: [docs.xquik.com](https://docs.xquik.com)
- **GitHub (skill source)**: [github.com/Xquik-dev/x-twitter-scraper](https://github.com/Xquik-dev/x-twitter-scraper)
