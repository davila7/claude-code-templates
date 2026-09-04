---
name: protected-paths-guard
description: Denies Edit, Write, MultiEdit and NotebookEdit calls on sensitive paths (.env files, lockfiles, CI workflows, git internals, private keys) with a glob allowlist override. Function hook on tool.call with an array matcher.
category: security
events: [tool.call]
module: protected-paths-guard.ts
tags: [security, files, guardrail, deny, tool.call]
---

# Protected Paths Guard

> ⚠️ **Experimental.** Function hooks are an Anthropic proposal under community review, not a shipped Claude Code feature. Nothing here is documented on code.claude.com. The API names come from the architecture PDF attached to [anthropics/claude-code#91870](https://github.com/anthropics/claude-code/issues/91870) and from the demo videos in that issue, and may change or never ship. Treat this component as a design reference and a head start, not a drop-in install.

## What it does

Keeps Claude out of files that should only change through a human or a tool (dependency lockfiles, CI workflows, secrets). Uses the proposal's array matcher so one hook covers all four editing tools.

## How it composes

Placement: **instead** on a protected path, pass-through otherwise. An `allow` glob wins over a `protect` glob so teams can carve out exceptions per project.

Every function hook has the signature `($, e, next)`: `$` is the engine interface (the only door to side effects), `e` is the immutable event, and `next` runs the rest of the chain. Hooks nest like Express or Koa middleware: the first plugin registered wraps everything below it.

## Options

Set these in the plugin's `userConfig`; they arrive as the second argument of `register(on, options)`.

| Option | Type | Default | Description |
|---|---|---|---|
| `protect` | `string[]` | `[]` | Extra globs to protect, on top of the defaults. |
| `allow` | `string[]` | `[]` | Globs that are always allowed, even when a protect rule matches. |

## Install

```bash
npx claude-code-templates@latest --function-hook security/protected-paths-guard
```

The CLI writes a local plugin at `.claude/plugins/protected-paths-guard/`:

```text
.claude/plugins/protected-paths-guard/
├── .claude-plugin/plugin.json
└── hooks/
    ├── hooks.json          # { "modules": ["./protected-paths-guard.ts"] }
    └── protected-paths-guard.ts
```

Then start Claude Code with the experimental flag seen in the demo and load the plugin directory:

```bash
CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1 claude --plugin-dir .claude/plugins/protected-paths-guard
```

## Module: `hooks/protected-paths-guard.ts`

```ts
/**
 * protected-paths-guard — Function Hook (EXPERIMENTAL)
 *
 * Denies Edit / Write / MultiEdit / NotebookEdit calls that target sensitive
 * files (.env, lockfiles, CI workflows, git internals, private keys) unless
 * the path is allowlisted. Placement: "instead" on match, pass-through otherwise.
 *
 * Function hooks are an Anthropic proposal under community review:
 * https://github.com/anthropics/claude-code/issues/91870
 * Every API name below is provisional.
 */

type Engine = any;
type Next = ((e: any) => Promise<any>) & { event: string; origin: string; signal: AbortSignal };

// Minimal glob support: "**" = any depth, "*" = any chars except "/".
function globToRegExp(glob: string): RegExp {
  const escaped = glob
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replace(/\*\*\//g, "(?:.*/)?")
    .replace(/\*\*/g, ".*")
    .replace(/\*/g, "[^/]*");
  return new RegExp(`(^|/)${escaped}$`);
}

const DEFAULT_PROTECTED = [
  ".env",
  ".env.*",
  "**/.git/**",
  "package-lock.json",
  "pnpm-lock.yaml",
  "yarn.lock",
  "Cargo.lock",
  "poetry.lock",
  ".github/workflows/*.yml",
  ".github/workflows/*.yaml",
  "**/*.pem",
  "**/*.key",
  "**/id_rsa*",
];

export function register(on: any, options: Record<string, any> = {}) {
  const protectedGlobs: string[] = [...DEFAULT_PROTECTED, ...(options.protect ?? [])];
  const allowGlobs: string[] = options.allow ?? [];
  const protectedRes = protectedGlobs.map(globToRegExp);
  const allowRes = allowGlobs.map(globToRegExp);

  // An array in a matcher matches when any element matches (design doc §6.1).
  on("tool.call", { tool: ["Edit", "Write", "MultiEdit", "NotebookEdit"] }, ($: Engine, e: any, next: Next) => {
    const filePath: string = (e.file_path ?? e.notebook_path ?? "").replace(/\\/g, "/");
    if (!filePath) return next(e);

    if (allowRes.some((re) => re.test(filePath))) return next(e);

    const hit = protectedRes.findIndex((re) => re.test(filePath));
    if (hit !== -1) {
      $.ui.log(`[protected-paths-guard] denied ${e.tool} on ${filePath} (rule: ${protectedGlobs[hit]})`);
      return {
        deny: `${filePath} is protected by protected-paths-guard (rule "${protectedGlobs[hit]}"). ` +
          `Ask the user to edit it manually or add the path to the plugin's "allow" option.`,
      };
    }

    return next(e);
  });
}
```

## `hooks/hooks.json`

```json
{
  "modules": ["./protected-paths-guard.ts"]
}
```

## `.claude-plugin/plugin.json`

```json
{
  "name": "protected-paths-guard",
  "description": "Denies Edit, Write, MultiEdit and NotebookEdit calls on sensitive paths (.env files, lockfiles, CI workflows, git internals, private keys) with a glob allowlist override.",
  "version": "0.1.0"
}
```

## Assumed `$` surface

- `$.ui.log(message)`
- `e.file_path` / `e.notebook_path` — assumed to mirror today's tool input field names.

## Caveats

- Only Claude's editing tools are intercepted. A `sed -i` through Bash is not, so pair with `block-destructive-commands` or a Bash rule if that matters to you.

## Sources

- Proposal and demo videos: [anthropics/claude-code#91870](https://github.com/anthropics/claude-code/issues/91870)
- Architecture PDF attached to the issue: "Function Hooks: Core Architecture" (Anthropic, August 2026)
