---
name: npm-to-pnpm-rewriter
description: Rewrites npm and npx invocations to pnpm (or yarn / bun) before the Bash tool runs them. Function hook on tool.call that forwards a modified event.
category: productivity
events: [tool.call]
module: npm-to-pnpm-rewriter.ts
tags: [productivity, package-manager, pnpm, rewrite, tool.call]
---

# Npm To Pnpm Rewriter

> ⚠️ **Experimental.** Function hooks are an Anthropic proposal under community review, not a shipped Claude Code feature. Nothing here is documented on code.claude.com. The API names come from the architecture PDF attached to [anthropics/claude-code#91870](https://github.com/anthropics/claude-code/issues/91870) and from the demo videos in that issue, and may change or never ship. Treat this component as a design reference and a head start, not a drop-in install.

## What it does

The canonical *modifying* example from the demo. Claude keeps typing `npm install`; the hook turns it into `pnpm add`, `npm ci` into `pnpm install --frozen-lockfile`, `npx` into `pnpm dlx`, and so on, then forwards the rewritten command down the chain. Shell hooks cannot do this today: they can only allow, deny or add context.

## How it composes

Placement: **modifying**: the hook calls `next({ ...e, command })` with a copy of the event. Events are immutable plain values, so mutation of `e` is not an option.

Every function hook has the signature `($, e, next)`: `$` is the engine interface (the only door to side effects), `e` is the immutable event, and `next` runs the rest of the chain. Hooks nest like Express or Koa middleware: the first plugin registered wraps everything below it.

## Options

Set these in the plugin's `userConfig`; they arrive as the second argument of `register(on, options)`.

| Option | Type | Default | Description |
|---|---|---|---|
| `manager` | `"pnpm" | "yarn" | "bun"` | `"pnpm"` | Target package manager. |

## Install

```bash
npx claude-code-templates@latest --function-hook productivity/npm-to-pnpm-rewriter
```

The CLI writes a local plugin at `.claude/plugins/npm-to-pnpm-rewriter/`:

```text
.claude/plugins/npm-to-pnpm-rewriter/
├── .claude-plugin/plugin.json
└── hooks/
    ├── hooks.json          # { "modules": ["./npm-to-pnpm-rewriter.ts"] }
    └── npm-to-pnpm-rewriter.ts
```

Then start Claude Code with the experimental flag seen in the demo and load the plugin directory:

```bash
CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1 claude --plugin-dir .claude/plugins/npm-to-pnpm-rewriter
```

## Module: `hooks/npm-to-pnpm-rewriter.ts`

```ts
/**
 * npm-to-pnpm-rewriter — Function Hook (EXPERIMENTAL)
 *
 * Rewrites npm / npx invocations to the package manager your project uses
 * (pnpm by default, yarn or bun via options). Placement: "modifying" —
 * the hook forwards a copy of the event with a changed command.
 *
 * Function hooks are an Anthropic proposal under community review:
 * https://github.com/anthropics/claude-code/issues/91870
 * Every API name below is provisional.
 */

type Engine = any;
type Next = ((e: any) => Promise<any>) & { event: string; origin: string; signal: AbortSignal };

type Manager = "pnpm" | "yarn" | "bun";

// [regex on the npm form, replacement per manager]. $1 keeps the command separator.
const REWRITES: Array<[RegExp, Record<Manager, string>]> = [
  [/(^|&&\s*|;\s*|\|\s*)npm\s+ci\b/g, { pnpm: "$1pnpm install --frozen-lockfile", yarn: "$1yarn install --immutable", bun: "$1bun install --frozen-lockfile" }],
  [/(^|&&\s*|;\s*|\|\s*)npm\s+(install|i|add)\b/g, { pnpm: "$1pnpm add", yarn: "$1yarn add", bun: "$1bun add" }],
  [/(^|&&\s*|;\s*|\|\s*)npm\s+(uninstall|remove|rm)\b/g, { pnpm: "$1pnpm remove", yarn: "$1yarn remove", bun: "$1bun remove" }],
  [/(^|&&\s*|;\s*|\|\s*)npm\s+run\b/g, { pnpm: "$1pnpm run", yarn: "$1yarn run", bun: "$1bun run" }],
  [/(^|&&\s*|;\s*|\|\s*)npm\s+(test|start|build)\b/g, { pnpm: "$1pnpm $2", yarn: "$1yarn $2", bun: "$1bun run $2" }],
  [/(^|&&\s*|;\s*|\|\s*)npx\s+/g, { pnpm: "$1pnpm dlx ", yarn: "$1yarn dlx ", bun: "$1bunx " }],
];

// "<manager> add" with no package means "install everything": keep the bare install form.
function fixBareAdd(command: string, manager: Manager): string {
  return command.replace(new RegExp(`${manager} add(\\s*(&&|;|\\||$))`, "g"), `${manager} install$1`);
}

export function register(on: any, options: Record<string, any> = {}) {
  const manager: Manager = options.manager ?? "pnpm";

  on("tool.call", { tool: "Bash" }, ($: Engine, e: any, next: Next) => {
    const original: string = e.command ?? "";
    if (!/\bnp[mx]\b/.test(original)) return next(e);

    let rewritten = original;
    for (const [re, byManager] of REWRITES) rewritten = rewritten.replace(re, byManager[manager]);
    rewritten = fixBareAdd(rewritten, manager);

    if (rewritten === original) return next(e);

    $.ui.log(`[npm-to-pnpm-rewriter] ${original}  ->  ${rewritten}`);
    // Events are immutable: forward a modified copy instead of mutating e.
    return next({ ...e, command: rewritten });
  });
}
```

## `hooks/hooks.json`

```json
{
  "modules": ["./npm-to-pnpm-rewriter.ts"]
}
```

## `.claude-plugin/plugin.json`

```json
{
  "name": "npm-to-pnpm-rewriter",
  "description": "Rewrites npm and npx invocations to pnpm (or yarn / bun) before the Bash tool runs them.",
  "version": "0.1.0"
}
```

## Assumed `$` surface

- `$.ui.log(message)`
- `e.command` on the Bash tool.

## Caveats

- Rewrites are regex based and only cover the common verbs. Commands inside quotes or heredocs may be rewritten too.

## Sources

- Proposal and demo videos: [anthropics/claude-code#91870](https://github.com/anthropics/claude-code/issues/91870)
- Architecture PDF attached to the issue: "Function Hooks: Core Architecture" (Anthropic, August 2026)
