# tool-timing-badge

Measures how long every tool call takes and draws a colored duration badge
beside the engine's own ToolUse rendering, on the terminal, Desktop and
mobile alike. Two hooks: `tool.call` (timing, "after": it awaits `next`) and
`ui.render` on the ToolUse component (drawing: wraps what `next` drew).

Elements come from the surface's table (`$.ui.resolve(e)`), never from
globals; JSX compiles against the environment's `h`. A ToolUse is drawn
once per props change, so the badge appears on the redraw that follows the
call settling (`isRunning` flips to false).


## Options

```
  slowMs: number  calls at or above this are red, above a quarter of it yellow (default 5000)
```

Declared in `.claude-plugin/plugin.json` (`userConfig`). Set them in `/config`, in user settings (`~/.claude/settings.json`, not project settings), with `--settings <file>` or in managed settings:

```json
{ "pluginConfigs": { "tool-timing-badge": { "options": { } } } }
```

## Install

```sh
npx claude-code-templates@latest --mod ui/tool-timing-badge
CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1 claude
```

It is written to `.claude/skills/tool-timing-badge/`, which Claude Code auto-loads as `tool-timing-badge@skills-dir`. For one session with hot reload: `CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1 claude --plugin-dir .claude/skills/tool-timing-badge`. `claude plugin validate .claude/skills/tool-timing-badge` prints every event it hooks and every `$` call it makes.

**Early access.** Mods need Claude Code 2.1.259+ with `CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1`; the `$` API may change between releases. Typed against Anthropic's declarations: https://github.com/anthropics/claude-code/tree/main/mods
