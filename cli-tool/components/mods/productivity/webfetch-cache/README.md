# webfetch-cache

Short-circuits repeated WebFetch calls for the same URL + prompt within a
session. On a cache hit the hook answers `{ result }` itself without calling
`next` (no network call); on a miss it awaits the real fetch, stores the
tool's record and returns what came back.

Only the tool's own record (`result`) is cached, never core's `ref`: that
number names the messages core produced for one specific call and must not
be replayed on another.


## Options

```
  ttlSeconds: number  how long an entry stays fresh (default 900)
  maxEntries: number  cache size (default 200)
```

Declared in `.claude-plugin/plugin.json` (`userConfig`). Set them in `/config`, in user settings (`~/.claude/settings.json`, not project settings), with `--settings <file>` or in managed settings:

```json
{ "pluginConfigs": { "webfetch-cache": { "options": { } } } }
```

## Install

```sh
npx claude-code-templates@latest --mod productivity/webfetch-cache
CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1 claude
```

It is written to `.claude/skills/webfetch-cache/`, which Claude Code auto-loads as `webfetch-cache@skills-dir`. For one session with hot reload: `claude --plugin-dir .claude/skills/webfetch-cache`. `claude plugin validate .claude/skills/webfetch-cache` prints every event it hooks and every `$` call it makes.

**Early access.** Mods need Claude Code 2.1.259+ with `CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1`; the `$` API may change between releases. Typed against Anthropic's declarations: https://github.com/anthropics/claude-code/tree/main/mods
