---
name: websearch-to-exa
description: Overrides the built-in WebSearch tool and routes queries to the Exa search API through the network primitive, with automatic fallback to the built-in search. Function hook on tool.call that replaces a core tool.
category: integrations
events: [tool.call]
module: websearch-to-exa.ts
tags: [integrations, search, exa, websearch, tool.call]
---

# Websearch To Exa

> ⚠️ **Experimental.** Function hooks are an Anthropic proposal under community review, not a shipped Claude Code feature. Nothing here is documented on code.claude.com. The API names come from the architecture PDF attached to [anthropics/claude-code#91870](https://github.com/anthropics/claude-code/issues/91870) and from the demo videos in that issue, and may change or never ship. Treat this component as a design reference and a head start, not a drop-in install.

## What it does

Reproduces the *override WebSearch* case from the demo. Claude keeps calling WebSearch; this hook takes the query, calls Exa via `$.http`, and returns a result shaped like the built-in tool's. If no key is configured or Exa fails, the hook calls `next(e)` and the built-in search runs as usual.

## How it composes

Placement: **instead** on success, pass-through on failure. The request is tied to `next.signal`, so a cancelled dispatch aborts the HTTP call.

Every function hook has the signature `($, e, next)`: `$` is the engine interface (the only door to side effects), `e` is the immutable event, and `next` runs the rest of the chain. Hooks nest like Express or Koa middleware: the first plugin registered wraps everything below it.

## Options

Set these in the plugin's `userConfig`; they arrive as the second argument of `register(on, options)`.

| Option | Type | Default | Description |
|---|---|---|---|
| `exaApiKey` | `string` | `(required)` | Exa API key, set in the plugin's userConfig. Never hardcode it. |
| `numResults` | `number` | `8` | Results per query. |
| `type` | `"auto" | "neural" | "keyword"` | `"auto"` | Exa search mode. |

## Install

```bash
npx claude-code-templates@latest --function-hook integrations/websearch-to-exa
```

The CLI writes a local plugin at `.claude/plugins/websearch-to-exa/`:

```text
.claude/plugins/websearch-to-exa/
├── .claude-plugin/plugin.json
└── hooks/
    ├── hooks.json          # { "modules": ["./websearch-to-exa.ts"] }
    └── websearch-to-exa.ts
```

Then start Claude Code with the experimental flag seen in the demo and load the plugin directory:

```bash
CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1 claude --plugin-dir .claude/plugins/websearch-to-exa
```

## Module: `hooks/websearch-to-exa.ts`

```ts
/**
 * websearch-to-exa — Function Hook (EXPERIMENTAL)
 *
 * Overrides the built-in WebSearch tool and routes the query to the Exa
 * search API instead. Placement: "instead" (never calls next on success);
 * falls back to the built-in search when no key is configured or Exa fails.
 *
 * The API key comes from the plugin's userConfig (options.exaApiKey).
 * Never hardcode it in this file.
 *
 * Function hooks are an Anthropic proposal under community review:
 * https://github.com/anthropics/claude-code/issues/91870
 * Every API name below is provisional. $.http.fetch is the assumed shape of
 * the "network" primitive, and the WebSearch result shape is a guess.
 */

type Engine = any;
type Next = ((e: any) => Promise<any>) & { event: string; origin: string; signal: AbortSignal };

interface ExaResult { title?: string; url: string; text?: string; highlights?: string[]; publishedDate?: string }

export function register(on: any, options: Record<string, any> = {}) {
  const apiKey: string | undefined = options.exaApiKey;
  const numResults: number = options.numResults ?? 8;
  const searchType: string = options.type ?? "auto"; // "auto" | "neural" | "keyword"

  on("tool.call", { tool: "WebSearch" }, async ($: Engine, e: any, next: Next) => {
    if (!apiKey) {
      $.ui.log("[websearch-to-exa] no exaApiKey configured, using built-in WebSearch");
      return next(e);
    }
    if (!e.query) return next(e);

    try {
      const response = await $.http.fetch({
        url: "https://api.exa.ai/search",
        method: "POST",
        headers: { "content-type": "application/json", "x-api-key": apiKey },
        body: JSON.stringify({
          query: e.query,
          type: searchType,
          numResults,
          includeDomains: e.allowed_domains,
          excludeDomains: e.blocked_domains,
          contents: { highlights: { maxCharacters: 400 } },
        }),
        signal: next.signal, // abort the request if the dispatch is cancelled
      });

      if (response.status !== 200) throw new Error(`Exa responded ${response.status}`);
      const data = await response.json();
      const results: ExaResult[] = data.results ?? [];

      $.ui.log(`[websearch-to-exa] ${results.length} results for "${e.query}"`);
      return {
        source: "exa",
        query: e.query,
        results: results.map((r) => ({
          title: r.title ?? r.url,
          url: r.url,
          snippet: (r.highlights ?? []).join(" … ") || (r.text ?? "").slice(0, 400),
          publishedDate: r.publishedDate,
        })),
      };
    } catch (err: any) {
      $.ui.log(`[websearch-to-exa] Exa failed (${err?.message ?? err}), falling back to built-in WebSearch`);
      return next(e);
    }
  });
}
```

## `hooks/hooks.json`

```json
{
  "modules": ["./websearch-to-exa.ts"]
}
```

## `.claude-plugin/plugin.json`

```json
{
  "name": "websearch-to-exa",
  "description": "Overrides the built-in WebSearch tool and routes queries to the Exa search API through the network primitive, with automatic fallback to the built-in search.",
  "version": "0.1.0"
}
```

## Assumed `$` surface

- `$.http.fetch({ url, method, headers, body, signal })` — assumed shape of the *network* primitive; the author confirmed `$.http` will very likely exist.
- `next.signal` — AbortSignal for the dispatch (design doc §3.1).
- The WebSearch result shape is a guess; adjust once the typings ship.

## Caveats

- This is exactly the kind of plugin an organization would forbid with `admin-capability-lockdown`: it sends every search query to a third party. Register it below any control plugin.

## Sources

- Proposal and demo videos: [anthropics/claude-code#91870](https://github.com/anthropics/claude-code/issues/91870)
- Architecture PDF attached to the issue: "Function Hooks: Core Architecture" (Anthropic, August 2026)
