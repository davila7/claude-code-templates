# websearch-to-exa

Overrides the built-in WebSearch tool and routes the query to the Exa
search API through `$.http.fetch`. On success the hook answers `{ result }`
in WebSearch's own output shape without calling `next` (the built-in search
never runs); with no key configured, or when Exa fails, it falls back to
the built-in search.

The API key comes from the plugin's options (userConfig "exaApiKey").
Never hardcode it in this file.


## Options

```
  exaApiKey:  string   Exa API key (required to activate)
  numResults: number   results per query (default 8)
  type:       string   "auto" | "neural" | "keyword" (default "auto")
```

Declared in `.claude-plugin/plugin.json` (`userConfig`). Set them in `/config`, in user settings (`~/.claude/settings.json`, not project settings), with `--settings <file>` or in managed settings:

```json
{ "pluginConfigs": { "websearch-to-exa": { "options": { } } } }
```

## Install

```sh
npx claude-code-templates@latest --mod integrations/websearch-to-exa
CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1 claude
```

It is written to `.claude/skills/websearch-to-exa/`, which Claude Code auto-loads as `websearch-to-exa@skills-dir`. For one session with hot reload: `CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1 claude --plugin-dir .claude/skills/websearch-to-exa`. `claude plugin validate .claude/skills/websearch-to-exa` prints every event it hooks and every `$` call it makes.

**Early access.** Mods need Claude Code 2.1.259+ with `CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1`; the `$` API may change between releases. Typed against Anthropic's declarations: https://github.com/anthropics/claude-code/tree/main/mods
