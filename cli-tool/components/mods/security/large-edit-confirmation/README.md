# large-edit-confirmation

Asks the user, in the engine's own AskUserQuestion dialog, before Claude
edits or overwrites a file larger than a configurable number of lines.
A `tool.call` hook on Edit / Write: it reads the file through `$.fs.read`,
asks through `$.ui.ask`, then either calls `next(e)` or returns `{ deny }`.

`$.ui.ask` rejects in a headless (`claude -p`) run, where nobody can answer;
the `headless` option decides what happens then (deny by default).


## Options

```
  maxLines: number            files above this many lines need confirmation (default 1000)
  headless: "deny" | "allow"  what to do when there is nobody to ask (default "deny")
```

Declared in `.claude-plugin/plugin.json` (`userConfig`). Set them in `/config`, in user settings (`~/.claude/settings.json`, not project settings), with `--settings <file>` or in managed settings:

```json
{ "pluginConfigs": { "large-edit-confirmation": { "options": { } } } }
```

## Install

```sh
npx claude-code-templates@latest --mod security/large-edit-confirmation
CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1 claude
```

It is written to `.claude/skills/large-edit-confirmation/`, which Claude Code auto-loads as `large-edit-confirmation@skills-dir`. For one session with hot reload: `CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1 claude --plugin-dir .claude/skills/large-edit-confirmation`. `claude plugin validate .claude/skills/large-edit-confirmation` prints every event it hooks and every `$` call it makes.

**Early access.** Mods need Claude Code 2.1.259+ with `CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1`; the `$` API may change between releases. Typed against Anthropic's declarations: https://github.com/anthropics/claude-code/tree/main/mods
