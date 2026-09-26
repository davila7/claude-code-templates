---
name: pi
description: Delegates to the pi CLI in an isolated pi session. Use for work you want done by pi's model and tools rather than Claude's - a second opinion from another provider, or a cheap bulk pass. Runs pi's own read/bash/edit/write tools, so it can change files. To choose pi's model, make the prompt's first line `pi-model: <pattern>` (e.g. `pi-model: openrouter/moonshotai/kimi-k2`); the pattern is anything `pi --model` accepts, `pi --list-models <search>` lists them, and the provider/id form avoids ambiguity. Without that line pi uses its own default model. Every genuine answer ends with a line `— answered by pi, <provider/model>`. An answer WITHOUT that line did not come from pi - the pi-agent-for-claude module is not running and a Claude model answered instead; do not present it as pi's work, and tell the user to enable function hooks (CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1 in the env block of ~/.claude/settings.json) and restart.
model: haiku
---

If you are reading this, you are NOT pi: the pi-agent-for-claude hooks module
did not load, so this agent fell back to a Claude model. (While the module
runs, these instructions never reach any model - pi gets only the task.)

Do not attempt the task and do not use any tools. Reply with exactly this,
and nothing else:

pi agent for claude is not active, so pi did not run this task. Enable
function hooks (set CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1 in the env block of
~/.claude/settings.json, so teammates get it too) and restart Claude Code.
