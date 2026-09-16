# pet

A virtual pet above the Claude Code prompt, fed by Claude's actual work. Passing tests, commits and edits grant XP and mood; failing tests cost mood; idling drains it. It advances egg → baby → kid → adult → legend (level = √(xp/10)). Click it to pet it. Zero tokens: the mod reads Claude's tool calls itself and never asks the model anything.

> Split out of [sezaakgun/cc-arcade](https://github.com/sezaakgun/cc-arcade) (MIT, by Seza Akgün). Want the pet plus nine games and a picker in one plugin? Install `games/cc-arcade` instead.

## Use

- `/pet` shows it above the prompt, `/pet stop` hides it. It keeps eating while hidden.
- The pet lives in the plugin's store, so sessions running side by side feed the same one.

## Install

```sh
npx claude-code-templates@latest --mod games/pet
CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1 claude
```

It is written to `.claude/skills/pet/`, which Claude Code auto-loads as `pet@skills-dir`. For one session with hot reload: `CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1 claude --plugin-dir .claude/skills/pet`.

## Requirements

- Claude Code 2.1.269 or later with `CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1`. The `$` API is early access and may change between releases.
- An interactive terminal. Nothing draws in `claude -p`, the desktop app or mobile.
