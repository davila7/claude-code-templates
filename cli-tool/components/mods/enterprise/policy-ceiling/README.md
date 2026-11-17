# policy-ceiling

Managed settings normally replace a person's value: if the organization sets `cleanupPeriodDays: 30`, everyone runs with exactly 30. This mod turns some of those values into **limits** instead. Each person keeps their own value as long as it stays inside the organization's ceiling or floor, and only a value outside it is changed.

| Rule (option) | Effect on the merged settings |
| --- | --- |
| `maxCleanupPeriodDays` | `cleanupPeriodDays` is at most N. A person can keep fewer days, never more |
| `deniedModels` + `fallbackModel` | A `model` in the list (also with a `[1m]` or date suffix) becomes `fallbackModel`, or Claude Code's default when the fallback is unset or denied too. The same names are cleared from `env.ANTHROPIC_MODEL`, `ANTHROPIC_DEFAULT_{OPUS,SONNET,HAIKU}_MODEL`, `ANTHROPIC_SMALL_FAST_MODEL` and `CLAUDE_CODE_SUBAGENT_MODEL` |
| `maxEffort` | `effortLevel` and every `modelSettings[<id>].effortLevel` are at most `low` / `medium` / `high` / `xhigh` / `max`. A value that isn't one of those five (`"MAX"`, `"ultra"`) becomes the ceiling |
| `forbiddenModes` | A `permissions.defaultMode` in the list becomes `default` |
| `requireSandbox` | Floor: `sandbox.enabled` is always `true` and `sandbox.allowUnsandboxedCommands` is `false`, and the rest of `sandbox` is kept |

`/policy` opens a pane showing, for each rule, what the person asked for, the organization's limit, and what the session runs with. Values that were clamped or forced are highlighted.

## Install (managed settings only)

Claude Code skips a user-tier plugin's `settings.read` hook. The built-in `sec-default` mod runs first and passes the event straight past it (verified on 2.1.316), so `--mod` or `--plugin-dir` gives you the `/policy` pane with nothing applied. The mod has to be a **managed** plugin seated in the prepend tier, and its rules are read from the managed layer only, so a person's own `pluginConfigs` can't loosen them.

In `managed-settings.json` (on macOS `/Library/Application Support/ClaudeCode/`, on Linux `/etc/claude-code/`, or delivered as server-managed settings):

```json
{
  "extraKnownMarketplaces": {
    "acme-tools": { "source": { "source": "github", "repo": "acme/claude-plugins" } }
  },
  "enabledPlugins": { "policy-ceiling@acme-tools": true },
  "prependPlugins": ["policy-ceiling@acme-tools", "sec-default@builtin"],
  "pluginConfigs": {
    "policy-ceiling@acme-tools": {
      "options": {
        "maxCleanupPeriodDays": 30,
        "deniedModels": "opus[1m]",
        "fallbackModel": "sonnet",
        "maxEffort": "high",
        "forbiddenModes": "bypassPermissions",
        "requireSandbox": true
      }
    }
  }
}
```

Copy `cli-tool/components/mods/enterprise/policy-ceiling/` into your organization's plugin marketplace repository. To get the files from the catalog:

```bash
npx claude-code-templates@latest --mod enterprise/policy-ceiling   # writes .claude/skills/policy-ceiling/
```

With that managed setup and a user `settings.json` holding `cleanupPeriodDays: 365`, `model: "opus[1m]"`, `effortLevel: "xhigh"`, `bypassPermissions` and `sandbox.enabled: false`, `claude -p /policy` answers (verified on Claude Code 2.1.316):

```
cleanupPeriodDays: asked 365, limit ≤ 30, runs 30 (▲ clamped)
model: asked opus[1m], limit not opus[1m], runs sonnet (▲ clamped)
effortLevel: asked xhigh, limit ≤ high, runs high (▲ clamped)
permissions.defaultMode: asked bypassPermissions, limit not bypassPermissions, runs default (▲ clamped)
sandbox.enabled: asked false, limit true, no bypass, runs true (▲ forced)
```

## How it works

Since Claude Code 2.1.304, a mod's `settings.read` hook receives each settings layer separately (`plugin`, `user`, `project`, `local`, `flag`, `policy`) and rewrites the merged result that every reader sees, including Claude Code's own retention sweep. The hook:

1. Awaits the engine's merge.
2. Leaves reads of a single source untouched.
3. Applies the rules, which depend only on the layers and on that merge, so the same read always gives the same answer.

If the hook throws, the files' own merge stands and the debug log records it.

## Limits

- It only does anything as a managed plugin in the prepend tier. Installed any other way, its hook is skipped and `/policy` reports no ceilings.
- A setting the organization also writes directly in managed settings already wins outright. Use the mod only for values the organization wants to cap, not fix.
- The rules only cover settings. `--model`, `--permission-mode`, Shift+Tab and `/model` choose outside settings and are not capped. For a hard model allowlist, use the `availableModels` managed setting together with this mod.
- The rules are deliberately few. A new key needs code: it is not a generic rule language.

Needs Claude Code 2.1.304 or later.
