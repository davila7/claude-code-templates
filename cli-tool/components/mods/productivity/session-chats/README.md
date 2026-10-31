# session-chats

A side pane that draws your Claude Code sessions as a graph: one node per session, one arrow per conversation between two of them (SendMessage). The record is kept on disk, so the graph is still there after the sessions close, and **Open** resumes a closed session in a new terminal.

```
╭──────────────────────────────────────────────────────────────────────╮
│ ◆ Session flow   3 sessions · 3 links                                │
│ [ All ] [ Active ]                                                   │
╰──────────────────────────────────────────────────────────────────────╯

                           ╭──────────────╮
                           │ ● democ-ea   │
                           │ demoC        │
                           ╰──────────────╯
                                │     │
                                │     ╰─────╮
                                ▼           │
                           ╭──────────────╮ │
                           │ ● demoa-6b   │ │
                           │ this session │ │
                           ╰──────────────╯ │
                                   │        │
                                   │  ╭─────╯
                                   ▼  ▼
                           ╭──────────────╮
                           │ ○ demob-bd   │
                           │ demoB        │
                           ╰──────────────╯

 ● 1: democ-ea  running · demoC
 ● 2: demoa-6b  running · this session
 ○ 3: demob-bd  closed · demoB

╭──────────────────────────────────────────────────────────────────────╮
│ ○ demob-bd  closed                                                   │
│ ~/Proyectos/demoB                                                    │
│                                                                      │
│ ↙ from democ-ea  2 messages · 1d                                     │
│   ok                                                                 │
│ ↙ from demoa-6b  2 messages · 1d                                     │
│   Mi directorio de trabajo principal es ~/Proyectos/demoB            │
│                                                                      │
│ [ Open ↗ ] [ copy command ]                                          │
╰──────────────────────────────────────────────────────────────────────╯
[ refresh ] [ close ]
1–3 select a session · dashed: not answered yet · r refresh
```

Run `/chats` to open it and `/chats close` to close it.

## What it shows

- **A node per session**: its name, its folder (or `this session`) and a dot, filled orange while the session is running, hollow once it closed.
- **An arrow per conversation**, from the session that wrote first to the one it wrote to. It is dashed until the other side answers. The selected session's arrows are orange. Sessions that only start conversations sit on top, the ones they wrote to below them; a link that skips a layer goes down a lane beside it.
- **All / Active**: Active keeps only the running sessions and the links between them.
- **Select a session** with its number (`1`–`9`) or a click on its name in the list under the graph (from the 10th session on, only a click). The panel under the graph lists its links (`↗ to` the sessions it wrote to first, `↙ from` the ones that wrote to it), with the message count, how long ago, and the last message.
- **Open ↗** (`o`) resumes the selected session if it is closed: `claude --resume <id>` in that session's own folder, in a new terminal. A running session shows `still running` instead, because resuming a live session would run two copies of it. **copy command** puts the `cd <folder> && claude --resume <id>` line on the clipboard either way. A folder or id the mod cannot pass safely to a shell (a backslash or a control character in the folder, an id that starts with `-`) gets no buttons. `r` refreshes.
- A session resumed after a restart gets a new name from Claude Code (`demob-bd` comes back as `demob-72`): the pane matches sessions by id, so it stays one node and shows the current name.
- A remote session (Remote Control, cloud) is recorded too, but it is not on this machine, so it has no Open button.

In the terminal the graph is drawn with box characters; in Claude Desktop (and the other surfaces with `Svg`) it is an SVG with curved links on its own dark card, so it reads on a light or a dark panel. Anthropic's palette only: ivory names, warm grays, orange as the one accent. A pane too narrow for the widest layer, or a graph too big for one SVG, says so and keeps the session list and the panel. On the classic layout the band above the prompt is at most half the terminal tall and scrolls: a number key only selects a session whose row is in view, so `/tui fullscreen` suits a big graph better.

## How it works

The mod hooks two engine events and only observes them; both pass every message on unchanged:

- `session.send`: a message this session sends with SendMessage. A message to a subagent or a teammate is skipped: only an address of another session (`uds:…`, `session_…`, `cse_…`, `bridge:…`) or a name in the live-session registry counts.
- `session.receive`: a `<cross-session-message from="…" from-name="…">` that Claude Code delivered as another session's message (origin `peer`). The sender is identified by its `from` address, which the engine sets; the `from-name` the sender gives is only shown as a label.

At that moment the other session is running, so the mod looks it up in Claude Code's live-session registry (`~/.claude/sessions/<pid>.json`, one file per running session with its id, folder, name and messaging socket) and keeps its session id and folder. That is what lets **Open** work after the session is gone. The registry is Claude Code's internal file, not a documented API: if a release changes it, the pane still records the messages and the name, but Open shows `session id unknown`.

The record lives in the mod's own store (`~/.claude/plugins/store/`), one key per session (`log:<sessionId>`), so two sessions never write over each other. The pane merges every session's log into one graph, and a message that both sides logged counts once. Each conversation keeps its last 40 messages, each cut to 600 characters, with terminal control sequences removed. A session's log that has not been written for `keepDays` days is deleted.

**Privacy:** the messages are stored as plain text in that store file, readable by anything that can read your `~/.claude`. Don't let sessions message each other secrets you would not keep in a file, or lower `keepDays`.

## Install it at the user level

Install it for every session, not one project: each session records its own side, and a session without the mod records nothing. One side is enough to show a conversation, so a pair where only one session had the mod still shows up.

```bash
npx claude-code-templates@latest --mod productivity/session-chats
cp -r .claude/skills/session-chats ~/.claude/skills/
```

The CLI writes the plugin to `.claude/skills/session-chats/`, which Claude Code loads as `session-chats@skills-dir` in a trusted project; `~/.claude/skills/` loads it in every session.

## Options

Set them in user or managed settings under `pluginConfigs["session-chats@skills-dir"].options` (`"session-chats"` when loaded with `--plugin-dir`):

| Option | Default | What it does |
| --- | --- | --- |
| `terminal` | `auto` | Where Open resumes the session. `auto`: a new tmux window when Claude Code runs inside tmux, else a new macOS Terminal window. `Terminal`, `iTerm`, `tmux`, or `copy` (only copy the command). On Linux outside tmux, and on Windows, Open copies the command. |
| `keepDays` | `90` | Forget a session's log once it has not been written for this many days |
| `columns` | `72` | Columns asked for the docked pane (40–140) |

macOS asks once for permission to let Claude Code control Terminal (or iTerm) the first time you press Open.

## Where it draws

In the **fullscreen layout** (`/tui fullscreen`) the pane docks beside the transcript; on the classic layout it sits above the prompt. In Claude Desktop it draws in the session's side panel.

Needs Claude Code 2.1.287 or later, which has the `session.send` and `session.receive` events; it was tested with live sessions on 2.1.312 and the graph on 2.1.314.
