---
name: tool-timing-badge
description: Times every tool call and wraps the engine's ToolUse rendering with a colored duration badge, on the terminal and on Desktop. Function hooks on tool.call and ui.render using JSX.
category: ui
events: [tool.call, ui.render]
module: tool-timing-badge.tsx
tags: [ui, render, jsx, performance, ui.render]
---

# Tool Timing Badge

> ⚠️ **Experimental.** Function hooks are an Anthropic proposal under community review, not a shipped Claude Code feature. Nothing here is documented on code.claude.com. The API names come from the architecture PDF attached to [anthropics/claude-code#91870](https://github.com/anthropics/claude-code/issues/91870) and from the demo videos in that issue, and may change or never ship. Treat this component as a design reference and a head start, not a drop-in install.

## What it does

Shows the *plugins can draw now* capability. A timing hook on `tool.call` records how long each call took; a render hook on `ui.render` matched to the `ToolUse` component wraps whatever the engine drew in a `Row` and adds a `Badge` with the duration. The same JSX is translated by each surface (Ink on the terminal, DOM on Desktop).

## How it composes

Placement: **after** on both events. The render hook resolves its elements through `$.ui.resolve(e)` so a plugin above can restyle or restrict them.

Every function hook has the signature `($, e, next)`: `$` is the engine interface (the only door to side effects), `e` is the immutable event, and `next` runs the rest of the chain. Hooks nest like Express or Koa middleware: the first plugin registered wraps everything below it.

## Options

Set these in the plugin's `userConfig`; they arrive as the second argument of `register(on, options)`.

| Option | Type | Default | Description |
|---|---|---|---|
| `slowMs` | `number` | `5000` | Calls at or above this are logged and drawn in red; a quarter of it is yellow. |

## Install

```bash
npx claude-code-templates@latest --function-hook ui/tool-timing-badge
```

The CLI writes a local plugin at `.claude/plugins/tool-timing-badge/`:

```text
.claude/plugins/tool-timing-badge/
├── .claude-plugin/plugin.json
└── hooks/
    ├── hooks.json          # { "modules": ["./tool-timing-badge.tsx"] }
    └── tool-timing-badge.tsx
```

Then start Claude Code with the experimental flag seen in the demo and load the plugin directory:

```bash
CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1 claude --plugin-dir .claude/plugins/tool-timing-badge
```

## Module: `hooks/tool-timing-badge.tsx`

```tsx
/**
 * tool-timing-badge — Function Hook (EXPERIMENTAL)
 *
 * Measures how long every tool call takes and draws a duration badge next to
 * the engine's own ToolUse rendering, on the terminal and on Desktop alike.
 * Two hooks: "after" on tool.call (timing), "after" on ui.render (drawing).
 *
 * Function hooks are an Anthropic proposal under community review:
 * https://github.com/anthropics/claude-code/issues/91870
 * Every API name below is provisional. The ToolUse component props are
 * declared public API in the design doc (§3.2.2) but not yet published, so
 * the id / tool fields read here are assumptions.
 */

type Engine = any;
type Next = ((e: any) => Promise<any>) & { event: string; origin: string; signal: AbortSignal };

const durations = new Map<string, number>();
let lastByTool = new Map<string, number>();

function badgeColor(ms: number, slowMs: number): string {
  if (ms >= slowMs) return "red";
  if (ms >= slowMs / 4) return "yellow";
  return "green";
}

function format(ms: number): string {
  return ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(1)} s`;
}

export function register(on: any, options: Record<string, any> = {}) {
  const slowMs: number = options.slowMs ?? 5000;

  // 1. Time every tool call. Runs "during" the call so the badge is exact.
  on("tool.call", async ($: Engine, e: any, next: Next) => {
    const startedAt = Date.now();
    try {
      return await next(e);
    } finally {
      const ms = Date.now() - startedAt;
      if (e.id) durations.set(e.id, ms);
      lastByTool.set(e.tool, ms);
      if (ms >= slowMs) $.ui.log(`[tool-timing-badge] slow ${e.tool}: ${format(ms)}`);
    }
  });

  // 2. Wrap the engine's ToolUse rendering with a badge (design doc listing 2).
  on("ui.render", { component: "ToolUse" }, async ($: Engine, e: any, next: Next) => {
    const { Row, Badge } = $.ui.resolve(e);
    const rendered = await next(e);

    const ms = durations.get(e.props?.id) ?? lastByTool.get(e.props?.tool);
    if (ms === undefined) return rendered;

    return (
      <Row>
        {rendered}
        <Badge text={format(ms)} color={badgeColor(ms, slowMs)} />
      </Row>
    );
  });
}
```

## `hooks/hooks.json`

```json
{
  "modules": ["./tool-timing-badge.tsx"]
}
```

## `.claude-plugin/plugin.json`

```json
{
  "name": "tool-timing-badge",
  "description": "Times every tool call and wraps the engine's ToolUse rendering with a colored duration badge, on the terminal and on Desktop.",
  "version": "0.1.0"
}
```

## Assumed `$` surface

- `$.ui.resolve(e)` — returns the surface's element table (design doc §3.2.3).
- `e.component`, `e.props`, `e.surface` on `ui.render` (§3.2.1).
- `e.props.id` / `e.props.tool` on the ToolUse component are assumptions; the public prop list is not published yet.

## Caveats

- This module is `.tsx`; the proposal lists `.js`, `.ts`, `.jsx` and `.tsx` as valid module extensions.
- If the ToolUse props carry no id, the badge falls back to the most recent call of the same tool.

## Sources

- Proposal and demo videos: [anthropics/claude-code#91870](https://github.com/anthropics/claude-code/issues/91870)
- Architecture PDF attached to the issue: "Function Hooks: Core Architecture" (Anthropic, August 2026)
