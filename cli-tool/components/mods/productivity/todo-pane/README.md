# todo-pane

> **Requirements.** Mods are on by default in Claude Code 2.1.287+. Written and
> tested on Claude Code 2.1.289.

A mod (a plugin of function hooks, `hooks/register.tsx`) that keeps the repo's
`todo.md` one keypress away: a button above the prompt shows how many tasks are
still open, and a pane edits the file in place.

## What it does

- **Band button** `1: 📝 todo (n)` above the prompt, `n` being the open
  (`[ ]`) tasks. Without a `todo.md` it reads `📝 todo`. It is drawn beside
  whatever other mods put in the band, never instead of it.
- **`/todo`**, or pressing the button, opens the pane, or closes it when it is
  already open. The pane takes the keyboard; Esc closes it.
- **The pane** lists `todo.md` line by line:
  - each checkbox line (`- [ ]`, `- [x]`, `* [ ]`, `+ [ ]`, indented or not) as
    `☐`/`☑` (press to toggle), a one-line field (Enter saves the text) and `x`
    (delete the line);
  - every other line (headings, blank lines, free text) as plain text, kept as is;
  - a `new task` field at the bottom that appends `- [ ] <text>`.
- **Writes** go to `<repo root>/todo.md` (`git rev-parse --show-toplevel`, else
  the session's directory) after every action. Only the touched line changes;
  order, other lines, `\r\n` endings and the final newline survive. The first
  task added creates the file. A `todo.md` that exists but cannot be read is
  never written.
- **Refresh**: the file is read again when the pane opens, after an `Edit`,
  `Write` or `MultiEdit` on the repo's `todo.md`, and on a session start from `/clear`,
  resume or fork.

## Controls

| Where | Key | Does |
|-------|-----|------|
| empty prompt | `1` | toggles the pane (the band button's hotkey) |
| band | ctrl+x tab, then `1` or Enter | the same, when the prompt holds text |
| anywhere | `/todo` | toggles the pane |
| pane | Tab / arrows | walk the toggles, fields and `x` buttons |
| pane | Enter on a field | saves its text (or adds the new task) |
| pane | Esc | closes the pane |

## Optional shortcut

A mod cannot register a keybinding of its own (anthropics/claude-code#91870).
It can borrow one of the engine's keybinding actions: the band button then
carries that action, and your chord for it toggles the pane from the prompt.
Off by default; nothing is recommended, pick an action you do not use.

1. Set `toggleAction` in `/config`, or in user settings keyed by the plugin's
   full id (`{ "pluginConfigs": { "todo-pane@skills-dir": { "options": {
   "toggleAction": "app:cycleDiffBase" } } } }`), to one of the actions the
   mod accepts. Each one's engine handler lives in a dialog, so at the prompt
   nothing else answers its chord:
   `app:cycleDiffBase`, `app:diffFileListDown`, `app:diffFileListUp`,
   `diff:nextFile`, `diff:previousFile`, `help:dismiss`, `plugin:toggle`,
   `settings:search`, `theme:toggleSyntaxHighlighting`.
2. Bind a chord, or a modified key, to it in `~/.claude/keybindings.json`
   (`/keybindings` opens the file), in the `Global` context:

   ```json
   {
     "bindings": [
       { "context": "Global", "bindings": { "ctrl+k t": "app:cycleDiffBase" } }
     ]
   }
   ```

Any other name shows a toast with the list and leaves the shortcut off: the
engine would refuse the whole band (every mod's part of it) over an action it
does not know. The shortcut works only in the terminal, while the band is
drawn, with no dialog up. **Warning:** a binding you add for that action in
`Global` also answers inside its dialog, where the action still does its own
job; and while the dialog is open the chord is the dialog's, not the pane's.

## Support

| | Terminal | Claude Desktop (Code tab) |
|-|----------|---------------------------|
| band button (click) | tested | tested |
| pane: toggle ☐/☑, edit via `Input`, delete, add | tested | tested |
| `/todo` | tested | tested |
| `1` in an empty prompt | engine docs say yes | unknown |
| `toggleAction` chord | engine docs say yes | no (terminal only) |

*tested* is `claude plugin test` drawing the mod on that surface, not a
check by hand. Installed with `--mod`, the plugin loads in Desktop's Code tab
the same way as in the terminal.

## Known limits

- **One line per task.** `Input` is single-line: no multi-line editing, no
  "open in `$EDITOR`".
- **iTerm2 and ctrl+x.** Terminals that do not pass ctrl+x chords (iTerm2 is
  reported, anthropics/claude-code#91870) cannot focus the band with
  ctrl+x tab; a click, the bare `1` in an empty prompt and `/todo` do not
  depend on chords.
- **The digit hotkey** only answers in an *empty* prompt (type `1` and wait a
  moment); with text typed, focus the band first or use `/todo`. Another mod's
  band button on `1` clashes with it: the one drawn later wins.
- **No own shortcut.** A mod cannot register a keybinding; only a borrowed
  action (see *Optional shortcut*) gives it one.
- **Mobile** draws no text field: the pane there toggles and deletes, and shows
  each task's text read-only.
- **Not live.** A change to `todo.md` made outside Claude Code shows on the
  next refresh (opening the pane, or the next action in it), not as it happens.
  Every action reads the file afresh before writing, so such a change is never
  written over; an action on a line that has changed since it was drawn does
  nothing and says so.

## Install

```bash
npx claude-code-templates@latest --mod productivity/todo-pane
```

Hooks: `session.start` (registers `/todo`), `classic.SessionStart`,
`tool.call`, `command.run`, `ui.render` on `AbovePrompt` and on its `Pane`.
Calls: `$.command.register`, `$.fs.read`, `$.fs.write`, `$.fs.exists`, `$.session.cwd`,
`$.process.run` (`git rev-parse --show-toplevel`, argv, no shell),
`$.ui.open`, `$.ui.close`, `$.ui.panes`, `$.ui.toast`. No network. The only
file it writes is `<repo root>/todo.md`.

Tests: `claude plugin test productivity/todo-pane` cover the todo.md parsing
and every edit (toggle, set text, delete, add) keeping untouched lines byte
for byte, the stale-file refusal, the `toggleAction` option, and mount the
band and pane on the terminal and desktop surfaces.

By [Aleš Lednej](https://github.com/aleslednej), from the
[overheadlabs](https://github.com/overheadlabs) plugins. MIT license (see
`LICENSE`).
