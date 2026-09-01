---
name: upstash-ratelimit
description: Rate limiting for serverless and edge apps with the @upstash/ratelimit TypeScript/JavaScript SDK backed by Upstash Redis. Use when adding a rate limiter or throttling to an API route, Next.js middleware, Vercel Edge, Cloudflare Workers, or any HTTP endpoint, returning 429 Too Many Requests, choosing between fixed window, sliding window, and token bucket algorithms, limiting per user, IP, API key, or tenant, protecting login, signup, form, or AI endpoints from abuse and brute force, or using ephemeral caching, analytics, timeouts, and multi-region limits. Also use when the user says rate limit, throttle, quota, request limits, or traffic protection.
version: 1.0.0
author: Upstash
repo: https://github.com/upstash/skills
license: MIT
tags: [Upstash, Rate Limiting, Throttling, Redis, Serverless, Edge, Next.js Middleware, API Security, Brute Force Protection, 429]
source: upstash/skills (MIT) - single-file version of skills/upstash-ratelimit-js
---

# Upstash Ratelimit (`@upstash/ratelimit`)

Distributed rate limiting for serverless and edge runtimes. State lives in Upstash Redis over
HTTP, so every function instance shares the same counters without a long-lived connection.

## Installation

```bash
npm install @upstash/ratelimit @upstash/redis
```

## Quick Start

```typescript
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

// Create once at module scope, not inside the request handler
const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(), // UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN
  limiter: Ratelimit.slidingWindow(10, "10 s"), // 10 requests per 10 seconds
  analytics: true,
  prefix: "@upstash/ratelimit",
});

const { success, limit, remaining, reset, pending } = await ratelimit.limit("user-123");
if (!success) {
  // return 429
}
```

## Next.js Middleware Example

```typescript
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { NextResponse, type NextRequest } from "next/server";

const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(10, "10 s"),
  analytics: true,
});

export async function middleware(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for") ?? "127.0.0.1";
  const { success, limit, remaining, reset } = await ratelimit.limit(ip);

  if (!success) {
    return NextResponse.json(
      { error: "Too many requests" },
      {
        status: 429,
        headers: {
          "X-RateLimit-Limit": String(limit),
          "X-RateLimit-Remaining": String(remaining),
          "X-RateLimit-Reset": String(reset),
        },
      }
    );
  }
  return NextResponse.next();
}

export const config = { matcher: "/api/:path*" };
```

## Algorithms

| Algorithm | Constructor | Behaviour | Choose when |
|-----------|-------------|-----------|-------------|
| Fixed window | `Ratelimit.fixedWindow(10, "10 s")` | Counter per fixed time slot | Cheapest; boundary bursts acceptable |
| Sliding window | `Ratelimit.slidingWindow(10, "10 s")` | Weighted count across current and previous window | Smoother limits at window boundaries (default choice) |
| Token bucket | `Ratelimit.tokenBucket(5, "10 s", 10)` | `refillRate` tokens per `interval`, up to `maxTokens` | Allow controlled bursts; not available in multi-region |

Pitfalls: fixed windows leak bursts at boundaries and invite retry stampedes; sliding windows
assume uniform distribution and are expensive in multi-region mode; token bucket is the most
compute-heavy.

## Methods

```typescript
// Check and consume. Options are all optional.
const res = await ratelimit.limit(identifier, {
  rate: 2,               // consume N tokens for one request (batch operations)
  ip: req.ip,            // used by deny lists
  userAgent: ua,
  country: geo?.country,
});
// res: { success, limit, remaining, reset, reason, pending }
// reason is "timeout" | "cacheBlock" | "denyList" | undefined

await ratelimit.blockUntilReady("id", 30_000); // wait up to 30s instead of rejecting
await ratelimit.resetUsedTokens("user-123");   // admin reset
const { remaining, reset } = await ratelimit.getRemaining("user-123"); // read-only
```

Dynamic limits (single-region limiters only; needs `dynamicLimits: true` in the constructor):

```typescript
await ratelimit.setDynamicLimit({ limit: 5 });      // override for all future checks
const { dynamicLimit } = await ratelimit.getDynamicLimit();
await ratelimit.setDynamicLimit({ limit: false });  // remove override
```

## Features

- **Ephemeral cache**: identifiers already blocked are rejected in memory without a Redis
  call. Enabled by default with a new `Map()`; pass `ephemeralCache: cache` to share one, or
  `ephemeralCache: false` to disable. Only effective when the limiter is created outside the
  handler.
- **Timeout**: `timeout: 1000` (ms) lets requests through if Redis is slow; default 5000.
- **Analytics**: `analytics: true` records allowed/blocked counts for the Upstash dashboard.
- **Multiple limits per tier**:

```typescript
const limiters = {
  free: new Ratelimit({ redis, prefix: "free", limiter: Ratelimit.slidingWindow(10, "10 s") }),
  paid: new Ratelimit({ redis, prefix: "paid", limiter: Ratelimit.slidingWindow(60, "10 s") }),
};
await limiters.free.limit(ip);
await limiters.paid.limit(userId);
```

- **Multi-region** (`MultiRegionRatelimit` with an array of Redis clients) trades strict
  accuracy for lower global latency.

## Edge Runtime Requirement: handle `pending`

With `analytics: true` or multi-region, the SDK issues follow-up requests after the decision.
On Vercel Edge and Cloudflare Workers, keep the function alive until they finish:

```typescript
const { success, pending } = await ratelimit.limit(id);
context.waitUntil(pending); // or event.waitUntil(pending) in Workers
```

## Common Pitfalls

- Creating the `Ratelimit` inside the request handler disables the ephemeral cache.
- Forgetting `waitUntil(pending)` on edge runtimes loses analytics and multi-region sync.
- Multi-region limits are approximate; dynamic limits do not work with multi-region.
- Using the raw IP as identifier behind a proxy without reading `x-forwarded-for`.

## Resources

- Docs: https://upstash.com/docs/redis/sdks/ratelimit-ts/overview
- Source: https://github.com/upstash/ratelimit-js
- Full multi-file skill (algorithms, features, traffic protection, pricing): https://github.com/upstash/skills/tree/main/skills/upstash-ratelimit-js
