# npm-to-pnpm-rewriter

Rewrites npm / npx invocations to the package manager your project uses
(pnpm by default, yarn or bun via options). The "modifying" placement: the
hook forwards a copy of the event with a changed `command` to `next`, and
tells the model what ran through `context` (the model's own tool_use block
keeps the command it wrote, for prompt-cache stability).


## Options

```
  manager: "pnpm" | "yarn" | "bun"  (default "pnpm")
```

Declared in `.claude-plugin/plugin.json` (`userConfig`). Set them in `/config`, in user settings (`~/.claude/settings.json`, not project settings), with `--settings <file>` or in managed settings:

```json
{ "pluginConfigs": { "npm-to-pnpm-rewriter": { "options": { } } } }
```

## Install

```sh
npx claude-code-templates@latest --mod productivity/npm-to-pnpm-rewriter
CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1 claude
```

It is written to `.claude/skills/npm-to-pnpm-rewriter/`, which Claude Code auto-loads as `npm-to-pnpm-rewriter@skills-dir`. For one session with hot reload: `claude --plugin-dir .claude/skills/npm-to-pnpm-rewriter`. `claude plugin validate .claude/skills/npm-to-pnpm-rewriter` prints every event it hooks and every `$` call it makes.

**Early access.** Mods need Claude Code 2.1.259+ with `CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1`; the `$` API may change between releases. Typed against Anthropic's declarations: https://github.com/anthropics/claude-code/tree/main/mods
