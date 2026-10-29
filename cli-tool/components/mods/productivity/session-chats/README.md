# session-chats

A side pane with every conversation between your Claude Code sessions: which session messaged which (SendMessage), what each one said, and when. The record is kept on disk, so it is still there after both sessions close, and each conversation has an **Open** button that resumes that session in a new terminal.

```
╭──────────────────────────────────────────────────────────────────────╮
│ ◆ Session chats   2 conversations                                    │
│ this session  web-46  ~/Proyectos/web                                │
╰──────────────────────────────────────────────────────────────────────╯

 ▾ api-6b                                                           3m
   2 messages · ~/Proyectos/api

   you  15:59
   ¿Terminaste la migración del esquema? Avísame cuando esté lista.
   api-6b  16:02
   Lista: 3 tablas nuevas, tests verdes. El PR es el #418.

   api-6b  [ Open ↗ ] [ copy command ]

 ▸ api-6b  ⇄  worker-72                                             7m
   api ⇄ worker · 4 messages
   worker-72: el job de backfill terminó sin errores

[ refresh ] [ close ]
```

Run `/chats` to open it and `/chats close` to close it.

## What it shows

- **One row per conversation**, newest first. A conversation is a pair of sessions. When this session is one of them, the row is named after the other one and its messages read `you` / the other session's name. A conversation between two other sessions is shown as `a ⇄ b`.
- **Folded**, a row shows the message count, the session's folder and the last message. Click it to see the last 8 messages with their time.
- **Open ↗** resumes a closed session: `claude --resume <id>` in that session's own folder, in a new terminal. A session that is still running shows `running · idle` (or `busy`, and its tmux session) instead, because resuming a live session would run two copies of it. **copy command** puts the `cd <folder> && claude --resume <id>` line on the clipboard either way. A folder or id the mod cannot pass safely to a shell (a backslash or a control character in the folder, an id that starts with `-`) gets no buttons.
- A session resumed after a restart gets a new name from Claude Code (`demob-bd` comes back as `demob-72`): the pane matches sessions by id, so the conversation stays one row and shows the current name.
- A remote session (Remote Control, cloud) is recorded too, but it is not on this machine, so it has no Open button.

It draws in Anthropic's palette only: ivory for names and your messages' authors, warm grays for messages and paths, orange for the fold markers and your own lines.

## How it works

The mod hooks two engine events and only observes them; both pass every message on unchanged:

- `session.send`: a message this session sends with SendMessage. A message to a subagent or a teammate is skipped: only an address of another session (`uds:…`, `session_…`, `cse_…`, `bridge:…`) or a name in the live-session registry counts.
- `session.receive`: a `<cross-session-message from="…" from-name="…">` that Claude Code delivered as another session's message (origin `peer`). The sender is identified by its `from` address, which the engine sets; the `from-name` the sender gives is only shown as a label.

At that moment the other session is running, so the mod looks it up in Claude Code's live-session registry (`~/.claude/sessions/<pid>.json`, one file per running session with its id, folder, name and messaging socket) and keeps its session id and folder. That is what lets **Open** work after the session is gone. The registry is Claude Code's internal file, not a documented API: if a release changes it, the pane still records the messages and the name, but Open shows `session id unknown`.

The record lives in the mod's own store (`~/.claude/plugins/store/`), one key per session (`log:<sessionId>`), so two sessions never write over each other. The pane merges every session's log, and a message that both sides logged appears once. Each conversation keeps its last 40 messages, each cut to 600 characters, with terminal control sequences removed. A session's log that has not been written for `keepDays` days is deleted.

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

Needs Claude Code 2.1.287 or later, which has the `session.send` and `session.receive` events; it was tested with live sessions on 2.1.312.
