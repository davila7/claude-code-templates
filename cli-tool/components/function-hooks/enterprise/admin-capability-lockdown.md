---
name: admin-capability-lockdown
description: Organization control plugin: withholds the http and process nouns from $ so no plugin beneath it can reach the network or spawn processes, allowlists which plugins may register, and denies shell network commands. Function hooks on engine.create, plugin.register and tool.call.
category: enterprise
events: [engine.create, plugin.register, tool.call]
module: admin-capability-lockdown.ts
tags: [enterprise, admin, capabilities, allowlist, engine.create]
---

# Admin Capability Lockdown

> ⚠️ **Experimental.** Function hooks are an Anthropic proposal under community review, not a shipped Claude Code feature. Nothing here is documented on code.claude.com. The API names come from the architecture PDF attached to [anthropics/claude-code#91870](https://github.com/anthropics/claude-code/issues/91870) and from the demo videos in that issue, and may change or never ship. Treat this component as a design reference and a head start, not a drop-in install.

## What it does

The *admin control as a hook* video, as code. Instead of asking plugins not to make network calls, this plugin removes the affordance: it hooks `engine.create`, takes the `$` table that everything below assembled, and returns it without `http` and `process`. A second hook on `plugin.register` refuses plugins that are not on the allowlist. A third denies `curl`, `wget`, `ssh` and friends through Bash, since the shell is the obvious way around a missing `$.http`.

## How it composes

Placement: **after** on `engine.create` (returns last, so it has the final word on what `$` contains), **instead** on `plugin.register` and `tool.call` for denials. Only works when the plugin is **prepended** in managed settings.

Every function hook has the signature `($, e, next)`: `$` is the engine interface (the only door to side effects), `e` is the immutable event, and `next` runs the rest of the chain. Hooks nest like Express or Koa middleware: the first plugin registered wraps everything below it.

## Options

Set these in the plugin's `userConfig`; they arrive as the second argument of `register(on, options)`.

| Option | Type | Default | Description |
|---|---|---|---|
| `withhold` | `string[]` | `["http", "process"]` | Nouns to remove from $ for every plugin below. |
| `allowedPlugins` | `string[]` | `(unset = allow all)` | Plugin names allowed to register. |
| `blockShellNetwork` | `boolean` | `true` | Also deny network commands through Bash. |
| `pluginName` | `string` | `"admin-capability-lockdown"` | This plugin's own name, so it never denies itself. |

## Install

```bash
npx claude-code-templates@latest --function-hook enterprise/admin-capability-lockdown
```

The CLI writes a local plugin at `.claude/plugins/admin-capability-lockdown/`:

```text
.claude/plugins/admin-capability-lockdown/
├── .claude-plugin/plugin.json
└── hooks/
    ├── hooks.json          # { "modules": ["./admin-capability-lockdown.ts"] }
    └── admin-capability-lockdown.ts
```

Then start Claude Code with the experimental flag seen in the demo and load the plugin directory:

```bash
CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1 claude --plugin-dir .claude/plugins/admin-capability-lockdown
```

## Module: `hooks/admin-capability-lockdown.ts`

```ts
/**
 * admin-capability-lockdown — Function Hook (EXPERIMENTAL)
 *
 * An organization-level plugin that (1) withholds nouns from $ so no plugin
 * registered beneath it can reach the network or spawn processes, and
 * (2) allowlists which plugins may register at all.
 *
 * It only works if it is PREPENDED in managed settings: the first plugin in
 * the list returns last from engine.create and sees plugin.register first
 * (design doc §2.3, §4.2, §5).
 *
 * Function hooks are an Anthropic proposal under community review:
 * https://github.com/anthropics/claude-code/issues/91870
 * Every API name below is provisional. The plugin.register event shape and
 * the exact noun names on $ ("http", "process") are assumptions the author
 * has hinted at in the issue thread, not documented API.
 */

type Engine = any;
type Next = ((e: any) => Promise<any>) & { event: string; origin: string; signal: AbortSignal };

export function register(on: any, options: Record<string, any> = {}) {
  const withhold: string[] = options.withhold ?? ["http", "process"];
  const allowedPlugins: string[] | undefined = options.allowedPlugins; // undefined = allow all
  const ownName: string = options.pluginName ?? "admin-capability-lockdown";

  // 1. Shape $ itself. Everything below has already added its nouns when we
  //    get the table back from next(e); we return it minus the withheld ones.
  on("engine.create", async ($: Engine, e: any, next: Next) => {
    const below = await next(e);
    const shaped: Record<string, unknown> = {};
    for (const [noun, api] of Object.entries(below)) {
      if (!withhold.includes(noun)) shaped[noun] = api;
    }
    return shaped;
  });

  // 2. Decide which plugins may exist.
  on("plugin.register", ($: Engine, e: any, next: Next) => {
    if (!allowedPlugins || e.name === ownName || allowedPlugins.includes(e.name)) return next(e);
    $.ui.log(`[admin-capability-lockdown] refused plugin "${e.name}" (not in allowlist)`);
    return { deny: `Plugin "${e.name}" is not on the organization allowlist.` };
  });

  // 3. Belt and braces: even with $.http gone, a plugin below could still ask
  //    the Bash tool to curl. Deny obvious network commands from the shell.
  if (options.blockShellNetwork ?? true) {
    on("tool.call", { tool: "Bash" }, ($: Engine, e: any, next: Next) => {
      const command: string = e.command ?? "";
      if (/\b(curl|wget|nc|ncat|ssh|scp|rsync)\b/.test(command)) {
        return { deny: "Outbound network commands are disabled by your organization's admin-capability-lockdown plugin." };
      }
      return next(e);
    });
  }
}
```

## `hooks/hooks.json`

```json
{
  "modules": ["./admin-capability-lockdown.ts"]
}
```

## `.claude-plugin/plugin.json`

```json
{
  "name": "admin-capability-lockdown",
  "description": "Organization control plugin: withholds the http and process nouns from $ so no plugin beneath it can reach the network or spawn processes, allowlists which plugins may register, and denies shell network commands.",
  "version": "0.1.0"
}
```

## Assumed `$` surface

- `engine.create` — the fold that builds `$` (design doc §4.1, listing 3).
- `plugin.register` — the engine lifecycle event named in §3.1 and §5; its event shape (`e.name`) is an assumption.
- The noun names `http` and `process` come from the author's comment in the issue thread, not from the PDF.

## Caveats

- Enforcement is plugin order. If this plugin is not first, a plugin above it keeps the full `$`.
- Capability removal applies to plugins. Claude's own built-in tools (WebFetch, WebSearch) are engine calls; hook `tool.call` to restrict those.

## Sources

- Proposal and demo videos: [anthropics/claude-code#91870](https://github.com/anthropics/claude-code/issues/91870)
- Architecture PDF attached to the issue: "Function Hooks: Core Architecture" (Anthropic, August 2026)
