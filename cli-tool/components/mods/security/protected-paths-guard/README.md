# protected-paths-guard

Denies Edit / Write / NotebookEdit calls that target sensitive files
(.env, lockfiles, CI workflows, git internals, private keys) unless the path
is allowlisted. A `tool.call` hook under an array matcher (any of the named
tools); on a match it returns `{ deny }` without calling `next`.


## Options

```
  protect: string  extra globs to protect, comma-separated
  allow:   string  globs that are always allowed (checked first), comma-separated
```

Declared in `.claude-plugin/plugin.json` (`userConfig`). Set them in `/config`, in user settings (`~/.claude/settings.json`, not project settings), with `--settings <file>` or in managed settings:

```json
{ "pluginConfigs": { "protected-paths-guard": { "options": { } } } }
```

## Install

```sh
npx claude-code-templates@latest --mod security/protected-paths-guard
CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1 claude
```

It is written to `.claude/skills/protected-paths-guard/`, which Claude Code auto-loads as `protected-paths-guard@skills-dir`. For one session with hot reload: `claude --plugin-dir .claude/skills/protected-paths-guard`. `claude plugin validate .claude/skills/protected-paths-guard` prints every event it hooks and every `$` call it makes.

**Early access.** Mods need Claude Code 2.1.259+ with `CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1`; the `$` API may change between releases. Typed against Anthropic's declarations: https://github.com/anthropics/claude-code/tree/main/mods
