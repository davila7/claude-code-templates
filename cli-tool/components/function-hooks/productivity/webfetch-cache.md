---
name: webfetch-cache
description: Short-circuits repeated WebFetch calls for the same URL and prompt within a session, returning the cached result without a network round trip. Function hook on tool.call with TTL and size limits.
category: productivity
events: [tool.call]
module: webfetch-cache.ts
tags: [productivity, cache, webfetch, performance, tool.call]
---

# Webfetch Cache

> ⚠️ **Experimental.** Function hooks are an Anthropic proposal under community review, not a shipped Claude Code feature. Nothing here is documented on code.claude.com. The API names come from the architecture PDF attached to [anthropics/claude-code#91870](https://github.com/anthropics/claude-code/issues/91870) and from the demo videos in that issue, and may change or never ship. Treat this component as a design reference and a head start, not a drop-in install.

## What it does

The *short-circuit* example from the demo. On a cache hit the hook returns the stored result and nothing beneath it runs, so there is no HTTP call at all. On a miss it awaits the real fetch, stores it, and returns it unchanged.

## How it composes

Placement: **instead** on a hit, **after** on a miss. Denials and empty results are never cached.

Every function hook has the signature `($, e, next)`: `$` is the engine interface (the only door to side effects), `e` is the immutable event, and `next` runs the rest of the chain. Hooks nest like Express or Koa middleware: the first plugin registered wraps everything below it.

## Options

Set these in the plugin's `userConfig`; they arrive as the second argument of `register(on, options)`.

| Option | Type | Default | Description |
|---|---|---|---|
| `ttlSeconds` | `number` | `900` | How long an entry stays fresh. |
| `maxEntries` | `number` | `200` | Oldest entry is evicted beyond this size. |

## Install

```bash
npx claude-code-templates@latest --function-hook productivity/webfetch-cache
```

The CLI writes a local plugin at `.claude/plugins/webfetch-cache/`:

```text
.claude/plugins/webfetch-cache/
├── .claude-plugin/plugin.json
└── hooks/
    ├── hooks.json          # { "modules": ["./webfetch-cache.ts"] }
    └── webfetch-cache.ts
```

Then start Claude Code with the experimental flag seen in the demo and load the plugin directory:

```bash
CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1 claude --plugin-dir .claude/plugins/webfetch-cache
```

## Module: `hooks/webfetch-cache.ts`

```ts
/**
 * webfetch-cache — Function Hook (EXPERIMENTAL)
 *
 * Short-circuits repeated WebFetch calls for the same URL + prompt within a
 * session. Placement: "instead" on a cache hit, "after" on a miss (awaits the
 * real fetch, stores the result, returns it).
 *
 * Function hooks are an Anthropic proposal under community review:
 * https://github.com/anthropics/claude-code/issues/91870
 * Every API name below is provisional.
 */

type Engine = any;
type Next = ((e: any) => Promise<any>) & { event: string; origin: string; signal: AbortSignal };

interface Entry { result: any; storedAt: number }

// Module state lives for the session. A persistent store would be added to $
// through an engine.create hook (design doc §4.1) once the "files" primitive
// is documented; a Map keeps this example honest about what is known today.
const cache = new Map<string, Entry>();

function keyFor(e: any): string {
  return `${e.url ?? ""}\n${e.prompt ?? ""}`;
}

export function register(on: any, options: Record<string, any> = {}) {
  const ttlMs: number = (options.ttlSeconds ?? 900) * 1000;
  const maxEntries: number = options.maxEntries ?? 200;

  on("tool.call", { tool: "WebFetch" }, async ($: Engine, e: any, next: Next) => {
    if (!e.url) return next(e);
    const key = keyFor(e);
    const now = Date.now();

    const hit = cache.get(key);
    if (hit && now - hit.storedAt < ttlMs) {
      $.ui.log(`[webfetch-cache] hit for ${e.url} (${Math.round((now - hit.storedAt) / 1000)}s old)`);
      return hit.result; // nothing below this hook runs: no network call
    }

    const result = await next(e);

    // Do not cache a denial or an empty result.
    if (result && !result.deny) {
      if (cache.size >= maxEntries) {
        const oldest = cache.keys().next().value;
        if (oldest !== undefined) cache.delete(oldest);
      }
      cache.set(key, { result, storedAt: now });
    }
    return result;
  });
}
```

## `hooks/hooks.json`

```json
{
  "modules": ["./webfetch-cache.ts"]
}
```

## `.claude-plugin/plugin.json`

```json
{
  "name": "webfetch-cache",
  "description": "Short-circuits repeated WebFetch calls for the same URL and prompt within a session, returning the cached result without a network round trip.",
  "version": "0.1.0"
}
```

## Assumed `$` surface

- `$.ui.log(message)`
- `e.url`, `e.prompt` on the WebFetch tool.

## Caveats

- The cache is module memory and lasts for the session. The demo showed a `$.store` primitive; the design doc frames a store as something a plugin adds to `$` via an `engine.create` hook (§4.1), so a persistent version is a small follow-up once the files primitive is documented.

## Sources

- Proposal and demo videos: [anthropics/claude-code#91870](https://github.com/anthropics/claude-code/issues/91870)
- Architecture PDF attached to the issue: "Function Hooks: Core Architecture" (Anthropic, August 2026)
