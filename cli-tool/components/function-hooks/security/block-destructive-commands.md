---
name: block-destructive-commands
description: Denies Bash commands that match destructive patterns (recursive rm on roots, force push, hard reset, destructive SQL, disk formatting) before they run. Function hook on tool.call with a Bash matcher.
category: security
events: [tool.call]
module: block-destructive-commands.ts
tags: [security, bash, guardrail, deny, tool.call]
---

# Block Destructive Commands

> ⚠️ **Experimental.** Function hooks are an Anthropic proposal under community review, not a shipped Claude Code feature. Nothing here is documented on code.claude.com. The API names come from the architecture PDF attached to [anthropics/claude-code#91870](https://github.com/anthropics/claude-code/issues/91870) and from the demo videos in that issue, and may change or never ship. Treat this component as a design reference and a head start, not a drop-in install.

## What it does

Stops the classic footguns at the tool boundary. When Claude is about to run a Bash command that matches one of the built-in rules, the hook returns `{ deny }` and the tool never executes. Claude receives the reason and can ask the user to run the command manually if it was intentional.

## How it composes

Placement: **instead** on a match (the hook returns without calling `next`), pass-through otherwise. Because nothing below the hook runs on a deny, no shell hook and no core behavior can re-enable the command.

Every function hook has the signature `($, e, next)`: `$` is the engine interface (the only door to side effects), `e` is the immutable event, and `next` runs the rest of the chain. Hooks nest like Express or Koa middleware: the first plugin registered wraps everything below it.

## Options

Set these in the plugin's `userConfig`; they arrive as the second argument of `register(on, options)`.

| Option | Type | Default | Description |
|---|---|---|---|
| `patterns` | `string[]` | `[]` | Extra regular expressions (as strings) to deny, added to the built-in rules. |

## Install

```bash
npx claude-code-templates@latest --function-hook security/block-destructive-commands
```

The CLI writes a local plugin at `.claude/plugins/block-destructive-commands/`:

```text
.claude/plugins/block-destructive-commands/
├── .claude-plugin/plugin.json
└── hooks/
    ├── hooks.json          # { "modules": ["./block-destructive-commands.ts"] }
    └── block-destructive-commands.ts
```

Then start Claude Code with the experimental flag seen in the demo and load the plugin directory:

```bash
CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1 claude --plugin-dir .claude/plugins/block-destructive-commands
```

## Module: `hooks/block-destructive-commands.ts`

```ts
/**
 * block-destructive-commands — Function Hook (EXPERIMENTAL)
 *
 * Denies Bash commands that match destructive patterns before they run.
 * Placement: "instead" (returns { deny } without calling next) on a match,
 * pass-through otherwise.
 *
 * Function hooks are an Anthropic proposal under community review:
 * https://github.com/anthropics/claude-code/issues/91870
 * Every API name below is provisional.
 */

// Provisional typings. Claude Code will ship real ones with the feature.
type Engine = any;
type Next = ((e: any) => Promise<any>) & { event: string; origin: string; signal: AbortSignal };

interface Rule { pattern: RegExp; reason: string }

const DEFAULT_RULES: Rule[] = [
  { pattern: /\brm\s+-[a-z]*r[a-z]*\s+(\/|~|\$HOME|\.\.?)(\s|$)/i, reason: "recursive delete of a root, home or working directory" },
  { pattern: /\bgit\s+push\b(?!.*--force-with-lease).*(--force\b|\s-f\b)/, reason: "force push" },
  { pattern: /\bgit\s+(reset\s+--hard|clean\s+-[a-z]*f)/, reason: "history or working-tree destruction" },
  { pattern: /\b(DROP|TRUNCATE)\s+(TABLE|DATABASE|SCHEMA)\b/i, reason: "destructive SQL" },
  { pattern: /\bmkfs(\.|\s)/, reason: "filesystem format" },
  { pattern: /\bdd\s+.*\bof=\/dev\//, reason: "raw disk write" },
  { pattern: /\bchmod\s+(-R\s+)?777\b/, reason: "world-writable permissions" },
];

export function register(on: any, options: Record<string, any> = {}) {
  // Extra patterns come from the plugin's userConfig, e.g. { "patterns": ["\\bkubectl\\s+delete\\b"] }
  const custom: Rule[] = (options.patterns ?? []).map((p: string) => ({
    pattern: new RegExp(p),
    reason: `custom pattern ${p}`,
  }));
  const rules = [...DEFAULT_RULES, ...custom];

  on("tool.call", { tool: "Bash" }, ($: Engine, e: any, next: Next) => {
    const command: string = e.command ?? "";

    for (const { pattern, reason } of rules) {
      if (pattern.test(command)) {
        $.ui.log(`[block-destructive-commands] denied Bash call: ${reason}`);
        return {
          deny: `Blocked by block-destructive-commands (${reason}). ` +
            `If this is intentional, ask the user to run it manually.`,
        };
      }
    }

    // Nothing matched: let the rest of the chain (and the real tool) run.
    return next(e);
  });
}
```

## `hooks/hooks.json`

```json
{
  "modules": ["./block-destructive-commands.ts"]
}
```

## `.claude-plugin/plugin.json`

```json
{
  "name": "block-destructive-commands",
  "description": "Denies Bash commands that match destructive patterns (recursive rm on roots, force push, hard reset, destructive SQL, disk formatting) before they run.",
  "version": "0.1.0"
}
```

## Assumed `$` surface

- `$.ui.log(message)` — write a line to the transcript/UI (shown in the design doc).
- `e.tool`, `e.command` — the Bash tool call fields (shown in the design doc, listing 1).

## Caveats

- Pattern matching on a shell string has known bypasses (obfuscation, `bash -c` wrappers). It is a guardrail, not a sandbox. Combine with `admin-capability-lockdown` for real capability removal.
- `--force-with-lease` is intentionally allowed.

## Sources

- Proposal and demo videos: [anthropics/claude-code#91870](https://github.com/anthropics/claude-code/issues/91870)
- Architecture PDF attached to the issue: "Function Hooks: Core Architecture" (Anthropic, August 2026)
