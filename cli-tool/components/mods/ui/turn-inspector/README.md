# turn-inspector

A side pane that shows the session turn by turn, the way Anthropic's context-window diagram draws it. Every request to the model is a turn. Its input (the system prompt and tools, every earlier turn, and what is new: your message or the tool results) is stacked above its output (thinking, text, tool use), and a bar shows how much of the context window it fills.

```
Context window  41.9k / 1.0M  4%
███░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░
■ system  ■ earlier  ■ new  ■ output

❯ read auth.js, then run 'grep -rn TODO .' with Bash…
▸ #1 2× Read, Bash             ██░░░░░░░░░░░░   41.1k
▾ #2 answer                    ██░░░░░░░░░░░░   41.7k
  ┃ INPUT  41.2k · 41.2k cached
  ┃  ⚙ System, tools & memory                  40.8k
  ┃  ↺ Earlier turns (1)                         276
  ┃  ⇠ Tool result · Read                        ~96
  ┃  ⇠ Tool result · Bash                        ~37
  ┃ OUTPUT  +474
  ┃  ✻ Thinking                                 ~263
  ┃  ¶ Text response                            ~211
  claude-opus-5-5 · end_turn

[ following ] [ collapse ] [ close ]
```

Run `/turns` to open it, `/turns clear` to forget the turns so far, `/turns stop` to close it.

## What it shows

- **The window.** At the top, the context in use after the last turn against the model's window (tokens, %, a bar), with the bar split into system, earlier turns, new input and output.
- **One row per turn.** Turns are grouped under the prompt they answer, since one prompt can take several requests (each tool round trip is a new one). A row shows what the turn answered with (`2× Read, Bash`, `answer`, `cut off`), its bar, and the context in use once it finished.
- **The blocks of a turn.** Expand a row to see its stack, colored as in the diagram: input in terracotta, output in grey, thinking in near-black.
  - `⚙ System, tools & memory`: what every request carries before the conversation.
  - `↺ Earlier turns (n)`: every earlier turn, folded into one block.
  - `❯ User message` / `⇠ Tool result · <tool>`: what is new in this request.
  - `✻ Thinking`, `¶ Text response`, `⚒ Tool use · <tool>`: the response.
  - `✂ Cut off`: the response hit the output limit or a full context window, as in the diagram's last turn.

By default the pane follows the newest turn and keeps it expanded. Expanding or collapsing a row yourself stops that; `follow` turns it back on.

## Where the numbers come from

Each turn's input and output totals are the API's own `usage` for that request (input = uncached + cache read + cache write), so they are exact. Blocks marked `~` are an estimate. The engine reports one total per request, not per block, so the mod splits each total across its blocks by size (about 4 characters a token):

- **Output.** Text and tool use are sized by their characters, and thinking gets the rest of the real total. The stream shows only a summary of the thinking, so it can't be measured directly.
- **New input.** This is the real growth since the previous turn (this input less the previous input and output), split across the new blocks.
- **System, tools & memory.** In a fresh session this is measured exactly from the first request. In a resumed session, or one opened with the mod already mid-session, it falls back to the local `/context` estimate, marked `~`.

A turn whose input shrank against the one before is marked `compacted before this turn`.

Turns are recorded from the moment the mod loads, whether the pane is open or not, so opening it late still shows every turn so far. Subagents' requests are not listed; [agent-flow](../agent-flow) draws those.

## Where it draws

In the **fullscreen layout** the engine docks the pane beside the transcript. Turn it on with `/tui fullscreen` (needs a terminal at least 110 columns wide). On the classic layout the pane sits above the prompt instead. Click a row to expand it, or focus the pane (ctrl+x tab), move with Tab and press Enter. In Claude Desktop the pane draws in the session's side panel, and every padded cell uses non-breaking spaces so the chips keep their width.

## Options

Set them in user or managed settings under `pluginConfigs["turn-inspector@skills-dir"].options` (`"turn-inspector"` when loaded with `--plugin-dir`):

| Option | Default | What it does |
|---|---|---|
| `columns` | `56` | Width asked for the docked pane (36-120); a width you drag it to wins |
| `maxTurns` | `200` | Turns kept, oldest dropped first |
| `openOnStart` | `false` | Open the pane when the session starts |

## How it works

It only observes: every hook passes its event on unchanged.

| Event | What it records |
|---|---|
| `turn.start` | the prompt, the first new input of the next request |
| `turn.step` | each main-loop request: its stream (thinking, text, tool use blocks), its usage and stop reason |
| `tool.call` | each tool's answer, new input for the next request |
| `turn.complete` | refreshes the system/tools estimate while the pane is open |
| `session.measure` | the context window's size |

## Install

```bash
npx claude-code-templates@latest --mod ui/turn-inspector
```

It is written to `.claude/skills/turn-inspector/`, which Claude Code auto-loads as `turn-inspector@skills-dir` in a **trusted** project. For one session: `claude --plugin-dir .claude/skills/turn-inspector`.

If `/turns` is missing from the typeahead, the mod did not load: run `claude --debug` and look for `hooks module turn-inspector@… loaded` in `~/.claude/debug/latest`.

## Tests

```sh
claude plugin test .claude/skills/turn-inspector
```

The tests drive the turn model directly, then raise `turn.start`, `turn.step` (with thinking, tool and text chunks), `tool.call` and `turn.complete` through the engine, and mount the pane on both the terminal and desktop surfaces.

**Requirements.** Mods are on by default in Claude Code 2.1.287+. Written and tested on 2.1.296 against the 2.1.283 declarations in this repo.
