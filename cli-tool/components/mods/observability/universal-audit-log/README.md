# universal-audit-log

One hook on "*" sees every event: the engine's own (tool.call, prompt.submit,
turn.*, ...) and every other plugin's calls on `$` (fs.read, http.fetch,
process.run, ...). It records one JSON line per dispatch: the event, who
raised it (`next.origin`: plugin and tier), how long it took and whether
something beneath denied or threw. The "after" placement, so the outcome is
recorded too; denials surface here as the value `next(e)` resolves to.

Lines are buffered in memory and flushed to a JSONL file through `$.fs`
(there is no append on `$`, so a flush reads the file, keeps its tail under
`maxBytes`, and writes it back) at the end of every turn and every
`flushEvery` events. The hook is never re-entered for its own `$.fs` calls,
so flushing from inside it does not recurse.

Seat this plugin FIRST (an org prepends it in managed settings) so nothing
beneath it can bypass the log. A hook that fails is skipped by the engine
(fail-open, logged in --debug-file), so it never blocks the session.


## Options

```
  path:       string    JSONL file, relative to the working directory (default ".claude/logs/mods-audit.jsonl")
  skipEvents: string    events not to record, comma-separated (default: the render / log chatter)
  flushEvery: number    flush after this many buffered lines (default 50)
  maxBytes:   number    keep the file under this size, dropping the oldest lines (default 2 MiB)
```

Declared in `.claude-plugin/plugin.json` (`userConfig`). Set them in `/config`, in user settings (`~/.claude/settings.json`, not project settings), with `--settings <file>` or in managed settings:

```json
{ "pluginConfigs": { "universal-audit-log": { "options": { } } } }
```

## Install

```sh
npx claude-code-templates@latest --mod observability/universal-audit-log
CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1 claude
```

It is written to `.claude/skills/universal-audit-log/`, which Claude Code auto-loads as `universal-audit-log@skills-dir`. For one session with hot reload: `claude --plugin-dir .claude/skills/universal-audit-log`. `claude plugin validate .claude/skills/universal-audit-log` prints every event it hooks and every `$` call it makes.

**Early access.** Mods need Claude Code 2.1.259+ with `CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1`; the `$` API may change between releases. Typed against Anthropic's declarations: https://github.com/anthropics/claude-code/tree/main/mods
