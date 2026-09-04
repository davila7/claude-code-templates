---
name: large-edit-confirmation
description: Asks the user for confirmation before Claude edits or overwrites a file larger than a configurable line count. Function hook on tool.call using the files and permissions primitives.
category: security
events: [tool.call]
module: large-edit-confirmation.ts
tags: [safety, confirmation, files, permissions, tool.call]
---

# Large Edit Confirmation

> ⚠️ **Experimental.** Function hooks are an Anthropic proposal under community review, not a shipped Claude Code feature. Nothing here is documented on code.claude.com. The API names come from the architecture PDF attached to [anthropics/claude-code#91870](https://github.com/anthropics/claude-code/issues/91870) and from the demo videos in that issue, and may change or never ship. Treat this component as a design reference and a head start, not a drop-in install.

## What it does

Reproduces the `$ask` demo from the proposal: before an Edit or Write lands on a big file, the user gets a yes/no prompt with the file name and line count. A denial becomes a `{ deny }` with guidance to propose a smaller change.

## How it composes

Placement: **before** (does its work, then calls `next`). The hook reads the file through `$` rather than the ambient filesystem, so an admin can audit or forbid that read.

Every function hook has the signature `($, e, next)`: `$` is the engine interface (the only door to side effects), `e` is the immutable event, and `next` runs the rest of the chain. Hooks nest like Express or Koa middleware: the first plugin registered wraps everything below it.

## Options

Set these in the plugin's `userConfig`; they arrive as the second argument of `register(on, options)`.

| Option | Type | Default | Description |
|---|---|---|---|
| `maxLines` | `number` | `1000` | Files with more lines than this trigger the prompt. |

## Install

```bash
npx claude-code-templates@latest --function-hook security/large-edit-confirmation
```

The CLI writes a local plugin at `.claude/plugins/large-edit-confirmation/`:

```text
.claude/plugins/large-edit-confirmation/
├── .claude-plugin/plugin.json
└── hooks/
    ├── hooks.json          # { "modules": ["./large-edit-confirmation.ts"] }
    └── large-edit-confirmation.ts
```

Then start Claude Code with the experimental flag seen in the demo and load the plugin directory:

```bash
CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1 claude --plugin-dir .claude/plugins/large-edit-confirmation
```

## Module: `hooks/large-edit-confirmation.ts`

```ts
/**
 * large-edit-confirmation — Function Hook (EXPERIMENTAL)
 *
 * Asks the user for confirmation before Claude edits or overwrites a file
 * larger than a configurable number of lines. Placement: "before".
 *
 * Function hooks are an Anthropic proposal under community review:
 * https://github.com/anthropics/claude-code/issues/91870
 * Every API name below is provisional. $.fs.read and $.permissions.ask are
 * the assumed shape of the "files" and "permissions" primitives named in the
 * architecture doc, not documented calls.
 */

type Engine = any;
type Next = ((e: any) => Promise<any>) & { event: string; origin: string; signal: AbortSignal };

export function register(on: any, options: Record<string, any> = {}) {
  const threshold: number = options.maxLines ?? 1000;

  on("tool.call", { tool: ["Edit", "Write", "MultiEdit"] }, async ($: Engine, e: any, next: Next) => {
    const filePath: string = e.file_path ?? "";
    if (!filePath) return next(e);

    let lineCount = 0;
    try {
      const current: string = await $.fs.read({ path: filePath });
      lineCount = current.split("\n").length;
    } catch {
      // New file or unreadable: nothing to protect.
      return next(e);
    }

    if (lineCount <= threshold) return next(e);

    const approved: boolean = await $.permissions.ask({
      title: "Large file edit",
      message: `${filePath} has ${lineCount} lines (limit ${threshold}). Allow ${e.tool} to modify it?`,
      options: ["Allow once", "Deny"],
    });

    if (!approved) {
      $.ui.log(`[large-edit-confirmation] user denied ${e.tool} on ${filePath}`);
      return { deny: `The user declined the ${e.tool} on ${filePath} (${lineCount} lines). Propose a smaller, targeted change.` };
    }

    return next(e);
  });
}
```

## `hooks/hooks.json`

```json
{
  "modules": ["./large-edit-confirmation.ts"]
}
```

## `.claude-plugin/plugin.json`

```json
{
  "name": "large-edit-confirmation",
  "description": "Asks the user for confirmation before Claude edits or overwrites a file larger than a configurable line count.",
  "version": "0.1.0"
}
```

## Assumed `$` surface

- `$.fs.read({ path })` — assumed shape of the *files* primitive named in the design doc §4.1.
- `$.permissions.ask({ title, message, options })` — assumed shape of the *permissions* primitive. The demo used a `$ask` helper; the exact call is not documented.

## Caveats

- Both `$.fs` and `$.permissions` are assumptions. Expect to rename these two calls when the real typings ship.

## Sources

- Proposal and demo videos: [anthropics/claude-code#91870](https://github.com/anthropics/claude-code/issues/91870)
- Architecture PDF attached to the issue: "Function Hooks: Core Architecture" (Anthropic, August 2026)
