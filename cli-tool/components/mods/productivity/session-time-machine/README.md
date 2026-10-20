# session-time-machine

> **Requirements.** Mods are on by default in Claude Code 2.1.287+.

`/timemachine` draws the session as a timeline: every prompt, tool call and
turn end, read from the session's own transcript. Press a point, type what
you want done differently, and the mod writes a copy of the session cut at
that point under a new session id and gives you the command that continues
it. The session you are in is not touched, so you can try the other approach
and still go back.

```
⏱ Time machine
 9 points  3 prompts  5 calls
──────────────────────────────────────
  1 ┏ ● prompt 1  add a retry to the upload client
  2 ┃ ◆ Read  src/upload.ts
  3 ┃ ◆ Edit  src/upload.ts                  <- armed (highlighted row)
  4 ┃ ◆ Bash  npm test
  5 ┗ ■ turn end  Tests pass, retry added with backoff.
╭────────────────────────────────────╮
│ Fork from #3                       │
│ after: src/upload.ts               │
│ Type the new instruction after     │
│ /timemachine fork 3 and press Enter│
╰────────────────────────────────────╯
↑ older   ↓ newer   ⟳ reload   ✕ clear
```

Colors mark the kind: blue prompts, violet turn ends, and a glyph per tool
(green Bash, amber Edit/Write, teal Read/Grep/Glob, orange Web, pink Agent,
lilac MCP). The armed row is highlighted and rows light up under the pointer.

```
> /timemachine fork 3 keep the retry but use the existing queue helper instead
Forked at point 3 (Edit src/upload.ts): 41 rows kept.
New session 7c1e…, resume command copied. In a new terminal:
cd '/home/me/app' && claude --resume 7c1e… 'keep the retry but use the existing queue helper instead'
```

## Usage

| Command | Does |
| --- | --- |
| `/timemachine` | opens the pane; pressing a point arms it: the fork bar shows the point's whole text, `⎇ Fork here` forks at once, or type an instruction after the `/timemachine fork <n> ` it puts in the prompt |
| `/timemachine list` | the same points as text, numbered |
| `/timemachine fork <n> [instruction]` | forks at point `n`; with an instruction the resume command carries it as the first message |

Points are of three kinds. **▸ prompt**: the fork keeps everything *before*
that prompt, so the instruction replaces it. **· tool call**: the fork keeps
the conversation up to and including that call's result. **■ turn end**: the
fork keeps the whole turn. The timeline refreshes when a turn completes; the
pane's `reload` button re-reads it on demand, and `⤢ expand` adds a second line
with more of each point's text. Row width follows the pane's own width.

## How it forks, and what it cannot do

The mod API has no call that forks or rewinds the live session, so the fork is a
new session, not a branch inside the one you are in. What the mod does around
that to make it one click:

1. **Snapshots.** While the mod is loaded it commits the whole working tree
   (tracked, modified and untracked files, `.gitignore` honored) with a
   throwaway git index: before each prompt, after each `Edit`/`Write`/`Bash`
   call and at each turn end. Your index, branch and stash are never touched;
   each snapshot is pinned by `refs/time-machine/<session-id>/<point>`.
2. **Fork here** (or `/timemachine fork <n> [instruction]`) then
   - creates a git worktree on its own branch `time-machine/<id>` at the
     snapshot of that point, under `.claude/worktrees/`,
   - reads `~/.claude/projects/<project>/<session-id>.jsonl` (or under
     `CLAUDE_CONFIG_DIR`), follows the `parentUuid` chain from the last row
     (dropping rewound branches and subagent sidechains), keeps the rows up to
     the point, closes any `tool_use` left without its `tool_result`,
   - writes them under a new session id for the worktree, with a first message
     that tells the model the files live in the worktree,
   - opens it in Claude Desktop (`claude --desktop --resume <new-id>`, macOS), or in a new Terminal window when you gave an instruction (it travels as the resume command's message) or Desktop cannot take it, running in
     that worktree. Elsewhere, or if the window cannot open, the command is
     copied to the clipboard instead.

Your checkout and the session you are in are not touched.

Limits:

- **macOS only.** The fork opens through `claude --desktop`, or Terminal;
  elsewhere you paste the command.
- **Snapshots only exist from when the mod was loaded.** A point without one
  forks the conversation only, and the pane says so before you press.
- **Git projects only.** Outside a git repository there is no file snapshot.
- **Bash side effects outside the repo** (installed packages, databases) are not
  part of a snapshot.
- **4 MiB.** `$.fs.read` rejects files over 4 MiB, so a very long transcript
  shows an error in the pane instead of a timeline.
- **Rows only.** The timeline is the transcript's prompts, tool calls and
  turn ends; thinking and attachments are kept in the fork but not listed.
- **Pane not drawn in `claude -p`.** `/timemachine list` and `fork` work
  there; the pane needs the terminal UI.

## Options

`snapshots` (boolean, default true) and `openTerminal` (boolean, default true) are declared next to `copyCommand` in `plugin.json`.

Read from user settings, keyed by the plugin's full id:

```json
{ "pluginConfigs": { "session-time-machine@skills-dir": { "options": { "copyCommand": false } } } }
```

| Option | Default | |
| --- | --- | --- |
| `copyCommand` | `true` | copy the resume command to the clipboard |

## Install

```bash
npx claude-code-templates@latest --mod productivity/session-time-machine
```

Hooks: `session.start` (registers `/timemachine`), `command.run`,
`turn.complete`, `ui.render` on `Pane`. Calls: `$.fs.read`, `$.fs.write`,
`$.env.get` (`HOME`, `CLAUDE_CONFIG_DIR`), `$.session.cwd`, `$.session.id`,
`$.prompt.fill`, `$.ui.copy`. No network, no process spawn.

Tests: `claude plugin test productivity/session-time-machine`
cover the transcript parsing, the cut points, the tool-pair closing, the
resume command, and mount the pane on the terminal and desktop surfaces to
press a point.
