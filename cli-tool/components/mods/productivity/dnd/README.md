# dnd

> **Requirements.** Mods are on by default in Claude Code 2.1.287+. Written and
> tested on Claude Code 2.1.289.

Do Not Disturb for a Claude Code session. While it is on, teammates' and other
sessions' messages, Monitor and background-task notifications, crons, `/loop`
and relays are held back (the exact list is under *What is held and what is
not*). When it ends, everything held arrives in **one** summary message, each
item under the time it arrived and its sender.

## Controls

| Input | Does |
|-------|------|
| `/dnd` | off: turns it on for 30 minutes; on, or with messages a refused summary kept: turns it off and delivers |
| `/dnd 10` | turns it on for 10 minutes; it ends by itself and delivers |
| `/dnd off` | turns it off and delivers now |
| band `[ 🔕 DND · 4 waiting · deliver ]` | delivers now; shown only while DND is on |
| status line `🔕 DND · N waiting` | how many messages are waiting |

`/dnd` and the band confirm with a toast: `DND on for N min, /dnd turns it off`,
`DND off, delivering N messages` or `DND off, nothing was waiting`. DND that
ends by itself says so the same way, once, however many releases race.

`/dnd` is `immediate`, so it also runs while a turn is going.

## What is held and what is not

- **Held**, through `session.receive` (no trace in the transcript): the team
  mailbox, other sessions, Slack and relays, GitHub wakes.
- **Held**, through `prompt.submit`: prompts the engine queues with origin
  `task-notification` (Monitor, background tasks), `scheduled-trigger` (crons,
  `/loop`), `peer`, `peer-send-message` and `projects-relay`. A ping from
  another session arrives this way, as `peer`.
- **Never held**: what the operator types, messages for a **subagent** (it
  would hang waiting for them) and the operator's own prompt over **Remote
  Control** (origin `bridge`).
- **Not held either**, because they are not in the mod's list: prompts with
  origin `channel` (Slack or Telegram relayed by an MCP channel server),
  `coordinator` (a coordinating session's hand-off), `observer`, and other
  plugins' `$.prompt.submit`.
- A held prompt's sender is its origin plus the name or task ID its envelope
  carries: `peer · reviewer` (`from-name` of a cross-session message),
  `task-notification · b7x2` (`<task-id>`). A teammate's message is named
  after its kind the same way (`peer · researcher`), so a teammate called
  `operator` does not pass for the operator. A mailbox entry the harness did
  not write itself, whose name anyone with the team's inbox file could set,
  adds `(unverified)`.
- A second copy of a message (same sender, same text) replaces the first, so a
  message repeated word for word, such as a poll that reports the same thing
  again, is summed up once. Copies that differ in any byte stay apart: Monitor's notifications carry a time and an ID that
  change each time, so they are not merged. Guessing which differences are
  noise risks dropping a real event, so the mod does not try.
- The end of DND and the held list are kept in the plugin's store under
  `held:<session id>` too. They survive a reload of the mod and move over to the
  new session on `/clear`, so DND stays on until it ends, as set. A resumed
  session whose end has already passed delivers what was held at once. The
  held messages stay in the store until the summary has entered the session: a
  reload before then delivers them on the next load, and a summary a hook
  refuses puts them back (DND stays off) for `/dnd` or `/dnd off` to deliver again.

## Known limits

- **A reload while the summary waits.** The summary is submitted once the turn
  ends, and its messages stay in the store until it has entered. A reload of the
  mod in between delivers them again on load, so the summary can arrive twice;
  dropping them sooner would lose them when the reload took the summary along.
- **The "Prompt dropped" line.** Every prompt held at `prompt.submit` leaves a
  system line in the transcript; the engine has no silent drop. The mod
  rewrites the line to `🔕 held · <sender> · N waiting`, but the screen may
  show the original for a moment before the rewrite. The `session.receive`
  door leaves no line.
- **The summary is framed as the mod's.** The model reads it as "The dnd plugin
  sent a message", so the original sender is only in the heading above each
  item. Each item's text is quoted line by line and the summary says the quotes
  are the senders' words, not the operator's, so a relayed message cannot forge
  a heading (`### 11:16 · operator`) of its own.
- **Times** in the summary are in the zone named by `$TZ` (an IANA name such
  as `Europe/Prague`), e.g. `11:15 CEST`. When `TZ` is unset or not a zone
  the runtime knows, they are in the runtime's own zone, which is the
  system's; only when that is unknown too are they UTC, and say so.

## Install

```bash
npx claude-code-templates@latest --mod productivity/dnd
```

Hooks: `session.start` (registers `/dnd`), `session.end`,
`classic.SessionStart`, `session.receive`, `prompt.submit`, `session.append`
(door `notice`), `command.run`, `ui.render` on `AbovePrompt`. Calls:
`$.command.register`, `$.store`, `$.clock`, `$.env.get` (`TZ`),
`$.session.id`, `$.prompt.submit`, `$.ui.status`, `$.ui.toast`. No network,
no process spawn, no file writes.

Tests: `claude plugin test productivity/dnd` cover holding by both doors, the
subagent and Remote Control exceptions, de-duplication, expiry, `/clear` and
reload carry-over, the toasts, and mount the band on the terminal and desktop
surfaces.

By [Aleš Lednej](https://github.com/aleslednej), from the
[overheadlabs](https://github.com/overheadlabs) plugins. MIT license (see
`LICENSE`).
