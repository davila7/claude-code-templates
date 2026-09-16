# admin-capability-lockdown

An organization-level mod that (1) withholds the `http` and `process`
nouns from `$` so no plugin seated beneath it can reach the network or
spawn processes, (2) refuses
plugins at `plugin.register` by name allowlist and by the `$` calls their
source declares, and (3) optionally withholds or guards the Bash tool.

Only (1), (2) and the "deny" shell policy are real boundaries. The
"guardrail" shell denylist is bypassable by design and is labelled as such.

SEATING. Withholding and refusal only bind the plugins BENEATH this one.
Put it in the prepend tier through managed settings, e.g.

```json
"prependPlugins": ["admin-capability-lockdown@acme-tools", "sec-default@builtin"]
```

so it is outermost: its `engine.create` step returns last (its withholding
wins) and it judges every `plugin.register` after it. Loaded with
--plugin-dir it sits in the user tier and only binds plugins listed after it.


## Options

```
  allowedPlugins: string  plugin names that may register, comma-separated (unset = any name)
  refuseCalls:    string  a user-tier plugin whose source calls any of these is refused, comma-separated
                            (default: the withheld nouns' calls, e.g. "http.fetch", "process.run")
  shellPolicy:    "deny" | "guardrail" | "allow"  (default "deny")
```

Declared in `.claude-plugin/plugin.json` (`userConfig`). Set them in `/config`, in user settings (`~/.claude/settings.json`, not project settings), with `--settings <file>` or in managed settings:

```json
{ "pluginConfigs": { "admin-capability-lockdown": { "options": { } } } }
```

## Install

```sh
npx claude-code-templates@latest --mod enterprise/admin-capability-lockdown
CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1 claude
```

It is written to `.claude/skills/admin-capability-lockdown/`, which Claude Code auto-loads as `admin-capability-lockdown@skills-dir`. For one session with hot reload: `CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1 claude --plugin-dir .claude/skills/admin-capability-lockdown`. `claude plugin validate .claude/skills/admin-capability-lockdown` prints every event it hooks and every `$` call it makes.

**Early access.** Mods need Claude Code 2.1.259+ with `CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1`; the `$` API may change between releases. Typed against Anthropic's declarations: https://github.com/anthropics/claude-code/tree/main/mods
