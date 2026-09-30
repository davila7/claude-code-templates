# tool-defense

A tower defense above the Claude Code prompt where every enemy is one of Claude's real tool calls: Bash sends runners, an Edit or Write a slow tank, a web or MCP call a flyer, an Agent a boss. Build and upgrade towers by clicking beside the road, hold the base through Claude's turn. Zero tokens: the mod answers every key and click itself and never asks the model anything.

## Play

1. `/defense` opens the board above the prompt (`/defense stop` or the `close` button closes it).
2. **Click the board** to give it the mouse and keyboard; **Esc** gives them back to the prompt.
3. Click a free cell to build a tower (25 gold), click a tower to upgrade it (30, then 50): more range, more damage, faster fire. Space or `p` pauses, `r` restarts.
4. Enemies walk the road from the left to your base on the right; ten get through and the base falls. Each kill pays gold and points.

Every tool call Claude makes releases one enemy the moment the call starts, shaped by the tool:

| tool | enemy |
|---|---|
| Bash, PowerShell | `▶▶` runner: fast, fragile |
| Edit, Write, NotebookEdit | `██` tank: slow, tough |
| WebFetch, WebSearch, any MCP tool | `◢◣` flyer: crosses the bottom row over the towers' heads |
| Agent, Workflow | `▓▓` boss |
| anything else (Read, Grep, Glob, ...) | `▪▪` scout |

Between Claude's calls a quiet trickle of scouts keeps the game alive, so it is playable on its own too. A long turn with many tool calls is the real wave: build before you press Enter.

Your best score is kept in the plugin's store across sessions.

## Install

```sh
npx claude-code-templates@latest --mod games/tool-defense
CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1 claude
```

It is written to `.claude/skills/tool-defense/`, which Claude Code auto-loads as `tool-defense@skills-dir`. For one session with hot reload: `CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1 claude --plugin-dir .claude/skills/tool-defense`. `claude plugin validate .claude/skills/tool-defense` prints every event it hooks and every `$` call it makes.

## How it is built

`hooks/register.tsx` is the hooks module: it registers `/defense`, mounts the board on the `AbovePrompt` band and keeps the score in `$.store`. `hooks/games/*.ts` is the game's logic, pure functions with no drawing, and `hooks/boards/*.tsx` is the surface module that draws it in two-character cells on the drawing thread and takes the keys and the mouse. Written for aitmpl.com against Anthropic's published function-hooks declarations.

## Requirements

- Claude Code 2.1.269 or later (the first build whose function hooks draw above the prompt) with `CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1`. The `$` API is early access and may change between releases.
- An interactive terminal that reports the mouse. Nothing draws in `claude -p`, the desktop app or mobile.
- A terminal font with box-drawing and block characters.

A clone of the genre, not affiliated with or endorsed by the original publisher.
