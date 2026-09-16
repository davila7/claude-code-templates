# block-destructive-commands

Denies Bash commands that match destructive patterns before they run.
A `tool.call` hook under a `{ tool: "Bash" }` matcher: on a match it returns
`{ deny }` without calling `next`, so nothing beneath (other plugins,
PreToolUse shell hooks, the tool itself) runs; otherwise it passes through.


## Options

```
  patterns: string  extra regex sources, comma-separated, e.g. "\\bkubectl\\s+delete\\b"
```

Declared in `.claude-plugin/plugin.json` (`userConfig`). Set them in `/config`, in user settings (`~/.claude/settings.json`, not project settings), with `--settings <file>` or in managed settings:

```json
{ "pluginConfigs": { "block-destructive-commands": { "options": { } } } }
```

## Install

```sh
npx claude-code-templates@latest --mod security/block-destructive-commands
CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1 claude
```

It is written to `.claude/skills/block-destructive-commands/`, which Claude Code auto-loads as `block-destructive-commands@skills-dir`. For one session with hot reload: `claude --plugin-dir .claude/skills/block-destructive-commands`. `claude plugin validate .claude/skills/block-destructive-commands` prints every event it hooks and every `$` call it makes.

**Early access.** Mods need Claude Code 2.1.259+ with `CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1`; the `$` API may change between releases. Typed against Anthropic's declarations: https://github.com/anthropics/claude-code/tree/main/mods
