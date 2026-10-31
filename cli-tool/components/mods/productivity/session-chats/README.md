# session-chats

A side pane that shows your Claude Code sessions as a tree: which session messaged which (SendMessage), who wrote first, and which conversations still have no answer. The record is kept on disk, so it is still there after the sessions close, and **Open** resumes a closed session in a new terminal.

```
╭──────────────────────────────────────────────────────────────────────╮
│ ◆ Session flow   8 sessions · 7 links                                │
│ [ All ] [ Active ]                                                   │
╰──────────────────────────────────────────────────────────────────────╯

● 1: web-46            this session
├─→ ○ 2: api-6b        api · 3 msgs · 3m
│   ├─→ ○ 3: worker-72 worker · 4 msgs · 1h
│   └─⇢ ○ 4: db-19     db · 1 msg · 3h · no answer
├─← ● 5: docs-0a       docs · 2 msgs · 1d
│   └─→ ○ 6: blog-72   blog · 2 msgs · 1d
└─↺   blog-72          (above) · 2 msgs · 1d
○ 7: infra-3c          infra
└─→ ○ 8: ci-88         ci · 2 msgs · 2d

╭──────────────────────────────────────────────────────────────────────╮
│ ○ api-6b  closed                                                     │
│ ~/Proyectos/api                                                      │
│                                                                      │
│ ↙ from web-46  3 messages · 3m                                       │
│   PR #418 abierto                                                    │
│ ↗ to worker-72  4 messages · 1h                                      │
│   worker-72: backfill terminó sin errores                            │
│ ↗ to db-19  1 message · 3h · not answered yet                        │
│   ¿puedes crear el índice en orders?                                 │
│                                                                      │
│ [ Open ↗ ] [ copy command ]                                          │
╰──────────────────────────────────────────────────────────────────────╯
[ refresh ] [ close ]
1–8 select · → wrote first · ⇢ no answer · ↺ shown above
```

Run `/chats` to open it and `/chats close` to close it.

## What it shows

- **One tree per group of sessions that talked to each other**, this session's first. Each other group starts at a session nobody wrote to first (in a loop, the earliest one).
- **A row per session**: a dot, filled orange while the session is running and hollow once it closed, its name, and its folder (or `this session`).
- **The arrow before a session** is its conversation with the row above it: `→` the session above wrote first, `←` this one did. `⇢` and `⇠` mark a conversation the other side has not answered yet (also said as `no answer`). Each row says how many messages and how long ago.
- **`↺` is a conversation with a session that already has its own row** somewhere else in the tree. It takes one line and does not repeat that session's branch, so the tree has one line per session plus one per extra link, however many sessions talk to each other.
- **All / Active**: Active keeps only the running sessions and the conversations between them.
- **Select a session** with its number (`1`–`9`) or a click on its name (from the 10th session on, only a click). Its row is highlighted and its arrows turn orange. The panel under the tree lists its conversations (`↗ to` the sessions it wrote to first, `↙ from` the ones that wrote to it), with the message count, how long ago, and the last message.
- **Open ↗** (`o`) resumes the selected session if it is closed: `claude --resume <id>` in that session's own folder, in a new terminal. A running session shows `still running` instead, because resuming a live session would run two copies of it. **copy command** puts the `cd <folder> && claude --resume <id>` line on the clipboard either way. A folder or id the mod cannot pass safely to a shell (a backslash or a control character in the folder, an id that starts with `-`) gets no buttons. `r` refreshes.
- A session resumed after a restart gets a new name from Claude Code (`demob-bd` comes back as `demob-72`): the pane matches sessions by id, so it stays one row and shows the current name.
- A remote session (Remote Control, cloud) is recorded too, but it is not on this machine, so it has no Open button.

The tree is plain text, so it looks the same in the terminal and in Claude Desktop. Anthropic's palette only: ivory names, warm grays, orange for running sessions and the selected session's arrows; the selected row is highlighted. On the classic layout the band above the prompt is at most half the terminal tall and scrolls: a number key only selects a session whose row is in view, so `/tui fullscreen` suits a long tree better.

## How it works

The mod hooks two engine events and only observes them; both pass every message on unchanged:

- `session.send`: a message this session sends with SendMessage. A message to a subagent or a teammate is skipped: only an address of another session (`uds:…`, `session_…`, `cse_…`, `bridge:…`) or a name in the live-session registry counts.
- `session.receive`: a `<cross-session-message from="…" from-name="…">` that Claude Code delivered as another session's message (origin `peer`). The sender is identified by its `from` address, which the engine sets; the `from-name` the sender gives is only shown as a label.

At that moment the other session is running, so the mod looks it up in Claude Code's live-session registry (`~/.claude/sessions/<pid>.json`, one file per running session with its id, folder, name and messaging socket) and keeps its session id and folder. That is what lets **Open** work after the session is gone. The registry is Claude Code's internal file, not a documented API: if a release changes it, the pane still records the messages and the name, but Open shows `session id unknown`.

The record lives in the mod's own store (`~/.claude/plugins/store/`), one key per session (`log:<sessionId>`), so two sessions never write over each other. The pane merges every session's log into one tree, and a message that both sides logged counts once. Each conversation keeps its last 40 messages, each cut to 600 characters, with terminal control sequences removed. A session's log that has not been written for `keepDays` days is deleted.

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

Needs Claude Code 2.1.287 or later, which has the `session.send` and `session.receive` events; it was tested with live sessions on 2.1.312 and the tree on 2.1.314.
