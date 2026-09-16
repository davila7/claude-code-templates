# secret-redactor

Replaces credential-shaped strings in every tool result before the model
reads it, and refuses to echo a redacted placeholder back into a Bash
command. One `tool.call` hook: it awaits `next(e)` (the "after" placement),
deep-replaces every string in what came back and tells the model, through
`context`, that a redaction happened so it is not confused by placeholders.

This is the shape the engine's author gives for a redactor:

```ts
on("tool.call", async ($, e, next) => recursiveStrReplace(await next(e), ...))
```

Seat it as low as possible (an org appends it in managed settings) so no
plugin above ever sees the raw value on the way up.


## Options

```
  patterns: string  extra regex sources, comma-separated (global flag is added)
```

Declared in `.claude-plugin/plugin.json` (`userConfig`). Set them in `/config`, in user settings (`~/.claude/settings.json`, not project settings), with `--settings <file>` or in managed settings:

```json
{ "pluginConfigs": { "secret-redactor": { "options": { } } } }
```

## Install

```sh
npx claude-code-templates@latest --mod security/secret-redactor
CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1 claude
```

It is written to `.claude/skills/secret-redactor/`, which Claude Code auto-loads as `secret-redactor@skills-dir`. For one session with hot reload: `CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1 claude --plugin-dir .claude/skills/secret-redactor`. `claude plugin validate .claude/skills/secret-redactor` prints every event it hooks and every `$` call it makes.

**Early access.** Mods need Claude Code 2.1.259+ with `CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1`; the `$` API may change between releases. Typed against Anthropic's declarations: https://github.com/anthropics/claude-code/tree/main/mods
