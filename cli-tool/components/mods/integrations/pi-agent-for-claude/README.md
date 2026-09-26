# pi-agent-for-claude

> Vendored from [FazalAAli/pi-agent-for-claude](https://github.com/FazalAAli/pi-agent-for-claude) (MIT, by Fazal Ali). Install with `npx claude-code-templates@latest --mod integrations/pi-agent-for-claude`, or from the author's marketplace as described upstream. Report issues upstream.

Runs [pi](https://pi.dev) as a native Claude Code subagent. It shows in the
agent list, streams live, takes follow-ups, and opens in a tmux pane as a
teammate, while the model behind it is anything pi can reach.

```
> Have pi run with model kimi k2 and summarize this repo.

⏺ pi-agent-for-claude:pi(Summarize repo)
  ⎿ ▸ bash: {"command":"ls -la && git log --oneline -10"}
    ▸ bash: {"command":"cat package.json"}
    This repo is an Expo/React Native calling app with a Go admin service...

    — answered by pi, openrouter/moonshotai/kimi-k2
```

Claude Code starts a real subagent. The mod replaces only its model requests
(`turn.step`) with a detached `pi --mode json` run and streams pi's text,
thinking and tool calls. Hook calls get 10 s, so long runs span several steps
chained through a no-op `pi_progress` tool. pi's final answer goes back as
text, `SubagentHandback`, or `SendMessage` for teammates, with pi's real token
usage.

## Requirements

- Claude Code 2.1.275+ (the first build that dispatches `agent.spawn` and `turn.step`)
- [pi](https://pi.dev), logged in to at least one provider
- Node.js, macOS or Linux
- tmux, for teammate panes

## Usage

Ask Claude for pi in plain language. It picks the `pi-agent-for-claude:pi` agent type.

- **Spawn:** "Have pi review the error handling in src/api."
- **Pick a model:** "Have pi run with model kimi k2 and …". Claude adds a `pi-model: <pattern>` line, passed to `pi --model`. Without it pi uses its default. `pi --list-models <search>` lists models.
- **Follow up:** messages to a running pi agent continue its pi session and model.
- **Teammate pane:** name it. "Spawn a pi agent named piper to …"

Answers end with `— answered by pi, <provider/model>`, read from pi's own
events. Trust it over what the model says about itself.

## Security

pi runs its own read/bash/edit/write tools, outside Claude Code's permission
prompts, tool policy and safety classifier. A pi agent can change files
without asking. Restrict pi in its own config if that matters.

## Limitations

- **No hooks, no pi.** With function hooks off, a "pi" agent runs as Claude Haiku and only replies that pi is not active. For teammates, the flag must be in settings `env`.
- **Relies on undocumented engine behaviour:** the 10 s hook budget, subagent transcript files under `~/.claude/projects/`, exact engine message text, and `ps` to detect teammates.
- **Cost figures** for pi agents are pi's real token counts priced as Claude tokens. pi's provider bills them; check its billing.
- **Teammate shutdown** requests go to pi as plain messages. Close the pane yourself.

## Install

```sh
npx claude-code-templates@latest --mod integrations/pi-agent-for-claude
```

Then add the flags to `~/.claude/settings.json`, since shell variables alone
don't reach teammate panes, and restart (inside tmux for teammate panes):

```json
{
  "env": {
    "CLAUDE_CODE_ENABLE_FUNCTION_HOOKS": "1",
    "CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS": "1"
  },
  "teammateMode": "tmux"
}
```

It is written to `.claude/skills/pi-agent-for-claude/`, which Claude Code auto-loads as `pi-agent-for-claude@skills-dir` once the workspace is trusted. For one session with hot reload: `CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1 claude --plugin-dir .claude/skills/pi-agent-for-claude`. `claude plugin validate .claude/skills/pi-agent-for-claude` prints every event it hooks and every `$` call it makes.

**Early access.** Mods need Claude Code 2.1.259+ with `CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1`, and this one needs 2.1.275+; the `$` API may change between releases. Typed against Anthropic's declarations: https://github.com/anthropics/claude-code/tree/main/mods
