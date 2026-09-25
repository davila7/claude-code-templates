# agent-flow

A side pane that draws the session's agents as they run: the main loop and its context window at the top, then every subagent it spawns as a tree, and for each one the context handed down to it, what it did with that context, and the answer it handed back up.

```
Session · turn 3
context 45.2k/200k 22%
████████░░░░░░░░░░░░░░░░░░░░░░
› refactor the auth module and add tests

Agents (1 running · 2 done)
● main                                  45.2k 12⚒
├─● Explore  map auth module             12.0k 6⚒
│ └─◐ general-purpose  check tests         8.4k 3⚒
└─● Plan  design the refactor             9.1k 2⚒
╭──────────────────────────────────────────────╮
│ Explore  map auth module                     │
│ claude-haiku-4-5 · done · 4.2s               │
│ ↓ in from main: prompt 312 tok               │
│   Map the auth module. List every file…      │
│ ⚙ 5 requests · ctx 12.0k (peak 14.1k) · out 2│
│   Read src/auth.ts                           │
│   Grep refreshToken                          │
│ ↑ out to main: answer 820 tok                │
│   auth lives in src/auth.ts and src/sess…    │
╰──────────────────────────────────────────────╯
[ refresh ] [ clear ] [ close ]
```

Run `/agent-flow` to open it, `/agent-flow clear` to forget finished agents, `/agent-flow stop` to close it.

## What it shows

- **The general context.** The main loop's window (tokens used of the window, %, a bar) and the prompt of the current turn. Select the `main` row to see the window broken down by category, as `/context` counts it, plus how much the main loop handed down to its subagents and got back from them.
- **Each subagent's context.** Select an agent row to see:
  - `↓ in`: the context handed down. For a normal subagent this is its prompt, the only thing it starts with, and its size in tokens. For a **fork**, it is the parent's whole context (its size at the moment) plus the directive.
  - `⚙`: what the agent did with it. The requests it made, how full its own window is now and at its peak, the output tokens, and its last tool calls.
  - `↑ out`: the context handed back up, which is its final answer (the only part of its work the parent sees) and its size.
- **The flow between them.** The tree nests agents by the loop that spawned them, in spawn order. A row's right edge shows the agent's current context size and its tool calls.

Markers: `◐` running, `●` done, `✗` failed, `○` stopped. Token counts for prompts and answers are estimates (4 characters per token); context sizes come from the API's own usage figures for each request.

## Where it draws

In the **fullscreen layout** the engine docks the pane beside the transcript, floor to ceiling. That layout needs a terminal at least 110 columns wide; turn it on with `/tui fullscreen` or `CLAUDE_CODE_NO_FLICKER=1`. On the classic layout the same pane sits above the prompt instead. Mouse clicks land in the fullscreen layout. Everywhere else, focus the pane (ctrl+x tab), move with Tab and press with Enter.

The flow is recorded from session start, whether the pane is open or not, so opening it late still shows every agent so far. While it is open, the status line reads `agents: N running · N done · ctx N%`.

## How it works

It only observes: every hook passes its event on unchanged.

| Event | What it records |
|---|---|
| `turn.start` | a new main-loop turn and its prompt |
| `agent.spawn` | a subagent: parent loop, type, description, prompt, fork, background, model |
| `turn.step` | each model request of any loop: its usage, so that loop's context size |
| `tool.call` | each tool call, by the loop it ran in |
| `turn.complete` | a loop's end: its answer, duration, and how it ended |
| `session.measure` | the main window and its % |

It reads `$.agent.list()` to fold in status changes it did not see (a background agent killed) and `$.session.usage({ breakdown: 'summary' })` when you select `main`. A loop that does work without an Agent call announcing it (a workflow's agent, an engine fork) is still drawn, as `loop <id>`.

## Options

```
  columns: number      width asked for the docked pane, 32-120 (default 52)
  maxAgents: number    subagents kept, oldest finished dropped first (default 60)
  openOnStart: boolean open the pane when a session starts (default false)
```

Declared in `.claude-plugin/plugin.json` (`userConfig`). Set them in user settings (`~/.claude/settings.json`, never project settings), with `--settings <file>` or in managed settings, under the plugin's full id:

```json
{ "pluginConfigs": { "agent-flow@skills-dir": { "options": { "columns": 64 } } } }
```

With `--plugin-dir` the id is plain `agent-flow`.

## Install

```sh
npx claude-code-templates@latest --mod ui/agent-flow
CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1 claude
```

It is written to `.claude/skills/agent-flow/`, which Claude Code auto-loads as `agent-flow@skills-dir` in a **trusted** project. For one session: `CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1 claude --plugin-dir .claude/skills/agent-flow`.

If `/agent-flow` is missing from the typeahead, the mod did not load: run `claude --debug` and look for `hooks module agent-flow@… loaded` in `~/.claude/debug/latest`.

## Tests

```sh
CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1 claude plugin test .claude/skills/agent-flow
```

The tests drive the flow model directly, then raise `turn.start`, `agent.spawn`, `turn.step`, `tool.call` and `turn.complete` through the engine, mount the pane on the terminal surface and press its rows.

**Early access.** Mods need Claude Code 2.1.259+ with `CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1`; the `$` API may change between releases. Written and tested on 2.1.282 against the 2.1.278 declarations. Typed against Anthropic's declarations: https://github.com/anthropics/claude-code/tree/main/mods
