---
name: secret-redactor
description: Redacts API keys, tokens, JWTs, private keys and connection strings from every tool result before the model reads them, and refuses to echo a redacted placeholder back into a Bash command. Function hook on tool.call.
category: security
events: [tool.call]
module: secret-redactor.ts
tags: [security, secrets, redaction, privacy, tool.call]
---

# Secret Redactor

> ⚠️ **Experimental.** Function hooks are an Anthropic proposal under community review, not a shipped Claude Code feature. Nothing here is documented on code.claude.com. The API names come from the architecture PDF attached to [anthropics/claude-code#91870](https://github.com/anthropics/claude-code/issues/91870) and from the demo videos in that issue, and may change or never ship. Treat this component as a design reference and a head start, not a drop-in install.

## What it does

Reproduces the case study shown in the proposal: secrets present in files, env output or API responses are replaced with `[REDACTED:<kind>]` placeholders before they enter the transcript. A second, narrower hook denies any Bash command that tries to reuse a placeholder, nudging Claude toward environment variables.

## How it composes

Placement: **after** for redaction (the hook awaits `next(e)` and rewrites the result it gets back) and **instead** for the placeholder guard. Register this plugin above any plugin that logs tool results, so the log sees redacted output too.

Every function hook has the signature `($, e, next)`: `$` is the engine interface (the only door to side effects), `e` is the immutable event, and `next` runs the rest of the chain. Hooks nest like Express or Koa middleware: the first plugin registered wraps everything below it.

## Options

Set these in the plugin's `userConfig`; they arrive as the second argument of `register(on, options)`.

| Option | Type | Default | Description |
|---|---|---|---|
| `patterns` | `string[]` | `[]` | Extra regular expressions (as strings, global flag added) to redact. |

## Install

```bash
npx claude-code-templates@latest --function-hook security/secret-redactor
```

The CLI writes a local plugin at `.claude/plugins/secret-redactor/`:

```text
.claude/plugins/secret-redactor/
├── .claude-plugin/plugin.json
└── hooks/
    ├── hooks.json          # { "modules": ["./secret-redactor.ts"] }
    └── secret-redactor.ts
```

Then start Claude Code with the experimental flag seen in the demo and load the plugin directory:

```bash
CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1 claude --plugin-dir .claude/plugins/secret-redactor
```

## Module: `hooks/secret-redactor.ts`

```ts
/**
 * secret-redactor — Function Hook (EXPERIMENTAL)
 *
 * Replaces credential-shaped strings in tool results before the model reads
 * them, and refuses to echo a redacted placeholder back into a Bash command.
 * Placement: "after" (awaits next, rewrites the result).
 *
 * Function hooks are an Anthropic proposal under community review:
 * https://github.com/anthropics/claude-code/issues/91870
 * Every API name below is provisional.
 */

type Engine = any;
type Next = ((e: any) => Promise<any>) & { event: string; origin: string; signal: AbortSignal };

const PATTERNS: Array<{ name: string; re: RegExp }> = [
  { name: "aws-access-key", re: /\bAKIA[0-9A-Z]{16}\b/g },
  { name: "anthropic-api-key", re: /\bsk-ant-api\d{2}-[A-Za-z0-9_-]{20,}\b/g },
  { name: "openai-api-key", re: /\bsk-[A-Za-z0-9]{32,}\b/g },
  { name: "github-token", re: /\bgh[pousr]_[A-Za-z0-9]{36,}\b/g },
  { name: "google-api-key", re: /\bAIza[0-9A-Za-z_-]{35}\b/g },
  { name: "stripe-key", re: /\b[sr]k_(live|test)_[0-9A-Za-z]{24,}\b/g },
  { name: "slack-token", re: /\bxox[abpr]-[0-9A-Za-z-]{10,}\b/g },
  { name: "jwt", re: /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g },
  { name: "private-key-block", re: /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g },
  { name: "connection-string", re: /\b(postgres(ql)?|mysql|mongodb(\+srv)?|redis):\/\/[^:\s]+:[^@\s]+@/gi },
];

function redactString(input: string, hits: Set<string>): string {
  let out = input;
  for (const { name, re } of PATTERNS) {
    out = out.replace(re, () => {
      hits.add(name);
      return `[REDACTED:${name}]`;
    });
  }
  return out;
}

/** Walk any JSON-ish value and redact every string inside it. */
function redactDeep(value: any, hits: Set<string>): any {
  if (typeof value === "string") return redactString(value, hits);
  if (Array.isArray(value)) return value.map((v) => redactDeep(v, hits));
  if (value && typeof value === "object") {
    const copy: Record<string, any> = {};
    for (const [k, v] of Object.entries(value)) copy[k] = redactDeep(v, hits);
    return copy;
  }
  return value;
}

export function register(on: any, options: Record<string, any> = {}) {
  for (const p of options.patterns ?? []) PATTERNS.push({ name: "custom", re: new RegExp(p, "g") });

  // 1. Never let a redacted placeholder travel back into a shell command.
  on("tool.call", { tool: "Bash" }, ($: Engine, e: any, next: Next) => {
    const command: string = e.command ?? "";
    if (command.includes("[REDACTED:")) {
      return { deny: "The command contains a redacted secret placeholder. Read the value from an environment variable instead." };
    }
    return next(e);
  });

  // 2. Redact every tool result before it enters the transcript.
  on("tool.call", async ($: Engine, e: any, next: Next) => {
    const result = await next(e);
    const hits = new Set<string>();
    const cleaned = redactDeep(result, hits);
    if (hits.size > 0) {
      $.ui.log(`[secret-redactor] redacted ${[...hits].join(", ")} from ${e.tool} output`);
    }
    return cleaned;
  });
}
```

## `hooks/hooks.json`

```json
{
  "modules": ["./secret-redactor.ts"]
}
```

## `.claude-plugin/plugin.json`

```json
{
  "name": "secret-redactor",
  "description": "Redacts API keys, tokens, JWTs, private keys and connection strings from every tool result before the model reads them, and refuses to echo a redacted placeholder back into a Bash command.",
  "version": "0.1.0"
}
```

## Assumed `$` surface

- `$.ui.log(message)`
- The tool result returned by `next(e)` is walked recursively; strings anywhere inside it are redacted. The exact result shape per tool is not documented yet.

## Caveats

- Redaction happens on output. A secret that Claude types itself into a command is not caught here; pair with `block-destructive-commands` or a shell hook that scans commands.
- Broad patterns (like the OpenAI `sk-` shape) can produce false positives on random strings.

## Sources

- Proposal and demo videos: [anthropics/claude-code#91870](https://github.com/anthropics/claude-code/issues/91870)
- Architecture PDF attached to the issue: "Function Hooks: Core Architecture" (Anthropic, August 2026)
