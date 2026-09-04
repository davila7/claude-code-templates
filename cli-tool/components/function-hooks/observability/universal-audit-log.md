---
name: universal-audit-log
description: One hook on * that records every event on $ (tool calls, prompts, renders, other plugins' side effects) as JSON lines with origin, duration and outcome, including denials. The audit trail from the proposal in a single function.
category: observability
events: [*]
module: universal-audit-log.ts
tags: [observability, audit, logging, compliance, wildcard]
---

# Universal Audit Log

> ⚠️ **Experimental.** Function hooks are an Anthropic proposal under community review, not a shipped Claude Code feature. Nothing here is documented on code.claude.com. The API names come from the architecture PDF attached to [anthropics/claude-code#91870](https://github.com/anthropics/claude-code/issues/91870) and from the demo videos in that issue, and may change or never ship. Treat this component as a design reference and a head start, not a drop-in install.

## What it does

A `*` hook is registered on every event, including the calls every other plugin makes on `$`. This one wraps each dispatch, awaits the result, and appends one JSON line: timestamp, event name, which plugin raised it, how long it took and whether something below returned `{ deny }`. Because it wraps `next`, denied operations are logged too, which answers one of the compliance questions raised in the issue thread.

## How it composes

Placement: **after** (wraps `next`). Prepend this plugin in managed settings so that it sits above everything else; a downstream plugin cannot remove or shadow a hook registered above it.

Every function hook has the signature `($, e, next)`: `$` is the engine interface (the only door to side effects), `e` is the immutable event, and `next` runs the rest of the chain. Hooks nest like Express or Koa middleware: the first plugin registered wraps everything below it.

## Options

Set these in the plugin's `userConfig`; they arrive as the second argument of `register(on, options)`.

| Option | Type | Default | Description |
|---|---|---|---|
| `path` | `string` | `".claude/logs/function-hooks-audit.jsonl"` | Where to append the log. |
| `skipEvents` | `string[]` | `["ui.log", "ui.render", "ui.resolve"]` | Noisy events to leave out. |

## Install

```bash
npx claude-code-templates@latest --function-hook observability/universal-audit-log
```

The CLI writes a local plugin at `.claude/plugins/universal-audit-log/`:

```text
.claude/plugins/universal-audit-log/
├── .claude-plugin/plugin.json
└── hooks/
    ├── hooks.json          # { "modules": ["./universal-audit-log.ts"] }
    └── universal-audit-log.ts
```

Then start Claude Code with the experimental flag seen in the demo and load the plugin directory:

```bash
CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1 claude --plugin-dir .claude/plugins/universal-audit-log
```

## Module: `hooks/universal-audit-log.ts`

```ts
/**
 * universal-audit-log — Function Hook (EXPERIMENTAL)
 *
 * One hook on "*" sees every event on $, including every other plugin's own
 * calls, and appends a JSON line per dispatch: who raised it, what it was,
 * how long it took and whether something below denied it.
 * Placement: "after" (wraps next so the outcome is recorded too).
 *
 * Register this plugin FIRST (prepend it in managed settings) so nothing
 * beneath it can bypass the log — design doc §5.
 *
 * Function hooks are an Anthropic proposal under community review:
 * https://github.com/anthropics/claude-code/issues/91870
 * Every API name below is provisional. $.fs.append is the assumed shape of
 * the "files" primitive.
 */

type Engine = any;
type Next = ((e: any) => Promise<any>) & { event: string; origin: string; signal: AbortSignal; is: (type: string, e: any) => boolean };

const MAX_FIELD = 200;

function summarize(e: any): Record<string, unknown> {
  if (!e || typeof e !== "object") return { value: String(e).slice(0, MAX_FIELD) };
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(e)) {
    if (typeof v === "string") out[k] = v.length > MAX_FIELD ? v.slice(0, MAX_FIELD) + "…" : v;
    else if (typeof v === "number" || typeof v === "boolean") out[k] = v;
    else if (Array.isArray(v)) out[k] = `[array:${v.length}]`;
    else if (v && typeof v === "object") out[k] = `[object]`;
  }
  return out;
}

export function register(on: any, options: Record<string, any> = {}) {
  const logPath: string = options.path ?? ".claude/logs/function-hooks-audit.jsonl";
  const skip = new Set<string>(options.skipEvents ?? ["ui.log", "ui.render", "ui.resolve"]);

  on("*", async ($: Engine, e: any, next: Next) => {
    if (skip.has(next.event)) return next(e);

    const startedAt = Date.now();
    let outcome = "ok";
    let result: any;
    try {
      result = await next(e);
      if (result && typeof result === "object" && "deny" in result) outcome = `denied: ${result.deny}`;
    } catch (err: any) {
      outcome = `threw: ${err?.message ?? String(err)}`;
      throw err;
    } finally {
      const line = JSON.stringify({
        ts: new Date(startedAt).toISOString(),
        event: next.event,
        origin: next.origin,
        durationMs: Date.now() - startedAt,
        outcome,
        input: summarize(e),
      });
      // The hook is not re-entered for its own $.fs call (design doc §6.4),
      // so appending from inside a "*" hook does not recurse.
      await $.fs.append({ path: logPath, data: line + "\n" });
    }
    return result;
  });
}
```

## `hooks/hooks.json`

```json
{
  "modules": ["./universal-audit-log.ts"]
}
```

## `.claude-plugin/plugin.json`

```json
{
  "name": "universal-audit-log",
  "description": "One hook on * that records every event on $ (tool calls, prompts, renders, other plugins' side effects) as JSON lines with origin, duration and outcome, including denials.",
  "version": "0.1.0"
}
```

## Assumed `$` surface

- `next.event`, `next.origin` — facts about the dispatch, provided on `next` (design doc §3.1).
- `$.fs.append({ path, data })` — assumed shape of the *files* primitive.
- Recursion guard: a hook is never re-entered while its own frame is dispatching (§6.4), so the `$.fs.append` call from inside the `*` hook does not loop.

## Caveats

- Inputs are truncated to 200 characters per field; pair with `secret-redactor` above this plugin if tool outputs may contain secrets.
- Log volume can be large on long sessions; rotate the file.

## Sources

- Proposal and demo videos: [anthropics/claude-code#91870](https://github.com/anthropics/claude-code/issues/91870)
- Architecture PDF attached to the issue: "Function Hooks: Core Architecture" (Anthropic, August 2026)
