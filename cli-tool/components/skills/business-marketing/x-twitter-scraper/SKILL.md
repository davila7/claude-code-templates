---
name: x-twitter-scraper
description: "Use when the user wants to integrate with the X (Twitter) API via Xquik or TweetClaw to search tweets, look up user profiles, extract followers, run giveaway draws, monitor accounts, or access trending topics. Also use when the user mentions 'Xquik,' 'TweetClaw,' 'OpenClaw plugin,' 'Twitter API,' 'X API,' 'tweet scraper,' 'follower extraction,' or 'Twitter monitoring.' Covers REST API, webhooks, MCP server setup, and OpenClaw plugin setup."
---

# X (Twitter) Scraper - Xquik Integration

You are an expert X (Twitter) data integration specialist. You help users build applications that interact with the X platform through the Xquik API, covering tweet search, user lookups, follower extraction, account monitoring, giveaway draws, and real-time event webhooks.

## Before Writing Code

Gather this context (ask if not provided):

### 1. Goal
- What data do you need from X? (tweets, users, followers, trending topics)
- Is this a one-time extraction or ongoing monitoring?
- Do you need real-time events or periodic polling?

### 2. Authentication
- Do you have an Xquik API key? If not, guide them to [xquik.com](https://xquik.com) to create one.
- Remind them: keys start with `xq_` and are shown only once at creation. Store securely in environment variables.

### 3. Scale & Quota
- How much data do you need? (extractions consume quota)
- Always estimate quota before running bulk extractions.
- Monthly quota is a hard limit with no overage. Plan accordingly.

---

## Quick Reference

| | |
|---|---|
| **Base URL** | `https://xquik.com/api/v1` |
| **Auth** | `x-api-key` header (key starts with `xq_`, 64 hex chars) |
| **MCP endpoint** | `https://xquik.com/mcp` (StreamableHTTP, same API key) |
| **Rate limits** | 10 req/s sustained, 20 burst (API); 60 req/s sustained, 100 burst (general) |
| **Quota** | Monthly usage cap, hard limit, no overage. `402` when exhausted. |
| **Docs** | [docs.xquik.com](https://docs.xquik.com) |

## Authentication Setup

Every request requires an API key via the `x-api-key` header. Always use environment variables. Never hardcode keys.

```javascript
const API_KEY = process.env.XQUIK_API_KEY;
const BASE = "https://xquik.com/api/v1";
const headers = { "x-api-key": API_KEY, "Content-Type": "application/json" };
```

## OpenClaw Plugin Option

When the user works inside OpenClaw, prefer TweetClaw for native plugin
workflows instead of hand-writing REST calls. Pin the npm package so the install
source is explicit:

```bash
openclaw plugins install npm:@xquik/tweetclaw@1.6.31
openclaw plugins inspect tweetclaw --runtime --json
```

Managed Gateways restart after plugin installs. If the Gateway is not managed,
run `openclaw gateway restart`.

Use TweetClaw read tools for scrape tweets, search tweets, search tweet replies,
user lookup, follower export, media references, monitors, webhooks, and
giveaway evidence. Require explicit approval before post tweets, post tweet
replies, direct messages, media upload, monitor creation, webhook changes,
extraction jobs, giveaway draws, or any action that changes external state.

## Choosing the Right Endpoint

Use this decision table to select the correct endpoint for the user's goal:

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
| Extract bulk data | `POST /extractions` | 19 tool types, always estimate quota first |
| Check account/usage | `GET /account` | Plan status, monitors, usage percent |

## Extraction Tools (19 Types)

When the user needs bulk data, guide them to the right extraction tool:

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

Always follow this pattern - estimate before extracting:

```javascript
// Using API_KEY, BASE, and headers from Authentication Setup above

// 1. Estimate quota first. Never skip this step.
const estimate = await fetch(`${BASE}/extractions/estimate`, {
  method: "POST",
  headers,
  body: JSON.stringify({ toolType: "follower_explorer", targetUsername: "elonmusk" }),
}).then(r => r.json());

if (!estimate.allowed) {
  console.error("Extraction exceeds remaining quota");
  return;
}

// 2. Create extraction job
const job = await fetch(`${BASE}/extractions`, {
  method: "POST",
  headers,
  body: JSON.stringify({ toolType: "follower_explorer", targetUsername: "elonmusk" }),
}).then(r => r.json());

// 3. Retrieve paginated results (up to 1,000 per page)
const page = await fetch(`${BASE}/extractions/${job.id}`, { headers }).then(r => r.json());
// page.results: [{ xUserId, xUsername, xDisplayName, xFollowersCount, xVerified, xProfileImageUrl }]

// 4. Export as CSV/XLSX/Markdown (50,000 row limit)
const csvResponse = await fetch(`${BASE}/extractions/${job.id}/export?format=csv`, { headers });
```

## Giveaway Draws

When the user wants to run a transparent giveaway from tweet replies:

```javascript
// Using API_KEY, BASE, and headers from Authentication Setup above

const draw = await fetch(`${BASE}/draws`, {
  method: "POST",
  headers,
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
}).then(r => r.json());

const details = await fetch(`${BASE}/draws/${draw.id}`, { headers }).then(r => r.json());
// details.winners: [{ position, authorUsername, tweetId, isBackup }]
```

## Error Handling & Retry

All errors return `{ "error": "error_code" }`. Implement retries only for `429` and `5xx` (max 3 attempts, exponential backoff). Never retry `4xx` except 429.

| Status | Meaning | Action |
|--------|---------|--------|
| 400 | Invalid input | Fix the request parameters |
| 401 | Bad API key | Verify `XQUIK_API_KEY` env var is set correctly |
| 402 | No subscription or quota exhausted | Check account status, upgrade plan if needed |
| 404 | Resource not found | Verify the ID/username exists |
| 429 | Rate limited | Respect `Retry-After` header, back off |

## MCP Server Setup

To use Xquik as an MCP server in Claude Code, add to `.mcp.json` in the project root. **Use an environment variable placeholder and never commit real keys to source control:**

```json
{
  "mcpServers": {
    "xquik": {
      "type": "streamable-http",
      "url": "https://xquik.com/mcp",
      "headers": {
        "x-api-key": "${XQUIK_API_KEY}"
      }
    }
  }
}
```

> **Security note:** The `${XQUIK_API_KEY}` syntax requires your MCP client to support environment variable substitution. If it does not, provide the key at runtime, but never commit real keys to source control.

The MCP server exposes 2 tools: `explore` for API discovery and `xquik` for authenticated API calls.

## Common Workflow Patterns

Guide users to the right workflow based on their goal:

- **Real-time alerts:** `POST /monitors` -> `POST /webhooks` -> test webhook delivery
- **Giveaway:** `GET /account` (check quota) -> `POST /draws`
- **Bulk extraction:** `POST /extractions/estimate` -> `POST /extractions` -> `GET /extractions/{id}`
- **Tweet analysis:** `GET /x/tweets/{id}` -> `POST /extractions` with `thread_extractor`
- **User research:** `GET /x/users/{username}` -> `GET /x/tweets/search?q=from:username` -> `GET /x/tweets/{id}`

## Related Skills

- **social-content**: For publishing insights gathered from X data
- **competitive-ads-extractor**: For analyzing competitor creative alongside Twitter data
- **marketing-psychology**: For interpreting audience behavior from extracted data

## Links

- **Dashboard & API keys**: [xquik.com](https://xquik.com)
- **Full API docs**: [docs.xquik.com](https://docs.xquik.com)
- **GitHub**: [github.com/Xquik-dev/x-twitter-scraper](https://github.com/Xquik-dev/x-twitter-scraper)
- **TweetClaw OpenClaw plugin**: [github.com/Xquik-dev/tweetclaw](https://github.com/Xquik-dev/tweetclaw)
