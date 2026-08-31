---
name: upstash-redis
description: Work with the @upstash/redis TypeScript/JavaScript SDK, a serverless HTTP-based Redis client for Next.js, Vercel, Cloudflare Workers, edge runtimes, and Node.js. Use when adding a cache (cache-aside, write-through, TTL strategies), session storage, a key-value store, leaderboards with sorted sets, counters, distributed locks, queues with lists, streams, JSON documents, pipelines and transactions, Lua scripting, or full-text search with Upstash Redis Search. Also use when migrating from ioredis or node-redis, when Redis is needed from a serverless function without connection pooling, or when the user says Redis cache, KV store, session store, serverless Redis, or Upstash Redis.
version: 1.0.0
author: Upstash
repo: https://github.com/upstash/skills
license: MIT
tags: [Upstash, Redis, Serverless, Caching, Sessions, Leaderboards, Key-Value, Edge, Next.js, Cloudflare Workers]
source: upstash/skills (MIT) - single-file version of skills/upstash-redis-js
---

# Upstash Redis (`@upstash/redis`)

`@upstash/redis` is an HTTP/REST-based Redis client. It needs no TCP connection, so it works
from serverless and edge functions (Vercel, Cloudflare Workers, Deno, Bun, Node.js) without
connection pooling. Values are serialized and deserialized automatically.

## Installation

```bash
npm install @upstash/redis
```

## Quick Start

```typescript
import { Redis } from "@upstash/redis";

// Explicit credentials
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

// Or read UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN from the environment
const redisFromEnv = Redis.fromEnv();
```

Environment variables (`.env`):

```bash
UPSTASH_REDIS_REST_URL=https://your-redis.upstash.io
UPSTASH_REDIS_REST_TOKEN=your-token-here
```

Both values come from the database page in the Upstash console. Never hardcode them.

## Common Mistakes (Especially for LLMs)

### Mistake 1: Treating everything as strings

```typescript
// WRONG - manual parsing is not needed
await redis.set("count", "42");
const count = await redis.get("count");
const incremented = parseInt(count) + 1;

// CORRECT - the SDK preserves JavaScript types
await redis.set("count", 42);
const count2 = await redis.get<number>("count");
const incremented2 = count2! + 1;
```

### Mistake 2: Manual JSON serialization

```typescript
// WRONG
await redis.set("user", JSON.stringify({ name: "Alice" }));
const user = JSON.parse(await redis.get("user"));

// CORRECT
await redis.set("user", { name: "Alice" });
const user2 = await redis.get<{ name: string }>("user");
```

### Mistake 3: Using ioredis-style TCP options

`@upstash/redis` takes `url` and `token`, not `host`/`port`/`password`. If a project uses
ioredis or node-redis on a serverless platform, migrate the client construction and drop the
manual `JSON.stringify`/`JSON.parse` calls; command names are otherwise the same.

## Quick Command Reference

```typescript
// Strings and counters
await redis.set("key", "value");
await redis.set("session:abc", { userId: "123" }, { ex: 3600 }); // TTL in seconds
await redis.get("key");
await redis.incr("counter");
await redis.decr("counter");

// Hashes
await redis.hset("user:1", { name: "Alice", age: 30 });
await redis.hget("user:1", "name");
await redis.hgetall("user:1");

// Lists
await redis.lpush("tasks", "task1", "task2");
await redis.rpush("tasks", "task3");
await redis.lrange("tasks", 0, -1);

// Sets
await redis.sadd("tags", "javascript", "redis");
await redis.smembers("tags");

// Sorted sets (leaderboards)
await redis.zadd("leaderboard", { score: 100, member: "player1" });
await redis.zrange("leaderboard", 0, -1, { rev: true, withScores: true });

// JSON
await redis.json.set("user:1", "$", { name: "Alice", address: { city: "NYC" } });
await redis.json.get("user:1");

// Expiration
await redis.setex("session", 3600, { userId: "123" });
await redis.expire("key", 60);
await redis.ttl("key");

// Delete
await redis.del("key");
```

## Caching Pattern (cache-aside)

```typescript
import { Redis } from "@upstash/redis";

const redis = Redis.fromEnv();

async function getUser(userId: string) {
  const cached = await redis.get<User>(`user:${userId}`);
  if (cached) return cached;

  const user = await database.users.findById(userId);
  await redis.set(`user:${userId}`, user, { ex: 3600 }); // 1 hour TTL
  return user;
}

async function updateUser(userId: string, data: Partial<User>) {
  const user = await database.users.update(userId, data);
  await redis.set(`user:${userId}`, user, { ex: 3600 }); // write-through
  return user;
}

async function deleteUser(userId: string) {
  await database.users.delete(userId);
  await redis.del(`user:${userId}`); // invalidate
}
```

## Pipelines and Automatic Pipelining

Independent commands issued concurrently are batched into a single HTTP request
automatically (disable with `enableAutoPipelining: false`):

```typescript
const [profile, settings, activity] = await Promise.all([
  redis.hgetall(`user:${userId}:profile`),
  redis.hgetall(`user:${userId}:settings`),
  redis.zrange(`user:${userId}:activity`, 0, 9),
]);
```

For explicit batching or atomic execution:

```typescript
const pipeline = redis.pipeline();
pipeline.set("a", 1);
pipeline.incr("a");
const results = await pipeline.exec();

const tx = redis.multi(); // MULTI/EXEC transaction
tx.set("b", 1);
tx.incr("b");
await tx.exec();
```

## Rate Limiting

For production rate limiting use `@upstash/ratelimit` on top of this client (see the
`upstash-ratelimit` skill). A minimal fixed-window counter with this SDK alone:

```typescript
async function simpleRateLimit(id: string, limit = 10, windowSeconds = 60) {
  const key = `ratelimit:${id}`;
  const count = await redis.incr(key);
  if (count === 1) await redis.expire(key, windowSeconds);
  return { allowed: count <= limit, remaining: Math.max(0, limit - count) };
}
```

## Best Practices

1. Read credentials from environment variables; never commit them.
2. Pass native JavaScript values and let the SDK serialize them.
3. Use TypeScript generics on reads (`redis.get<User>(...)`) for type safety.
4. Set TTLs (`ex`, `setex`, `expire`) on cache and session keys.
5. Namespace keys with prefixes such as `user:123` and `session:abc`.
6. Create the client once at module scope so auto-pipelining and connection reuse work.
7. Use `Promise.all` or `pipeline()` instead of sequential awaits for independent commands.

## Resources

- Docs: https://upstash.com/docs/redis
- SDK reference: https://upstash.com/docs/redis/sdks/ts/overview
- Source: https://github.com/upstash/redis-js
- Full multi-file skill (data structures, streams, Lua, search, migrations): https://github.com/upstash/skills/tree/main/skills/upstash-redis-js
