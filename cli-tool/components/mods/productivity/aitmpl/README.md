# aitmpl

`/aitmpl` opens a side pane laid out like VS Code's Extensions view for the
catalog of [aitmpl.com](https://www.aitmpl.com): a search box, a Browse
menu like the site's sidebar (one line per type, with its count), an **Installed** section, a **Popular** list (or
**Results** while you search), the download count on every row and a button
that opens the component's page. In the fullscreen layout (`/tui fullscreen`)
Claude Code docks it beside the transcript; otherwise it sits above the
prompt. Claude Desktop and VS Code draw it in their own pane.

```
aitmpl.com                      refresh  close
2.2k components · 1.6M downloads
[search components                    ]
BROWSE
[All]                                  2.2k
Skills                                  889
Agents                                  422
Commands                                288
Settings                                 72
Hooks                                    62
MCPs                                    104
Mods                                     38
Loops                                    18

INSTALLED                                 3
frontend-developer                    agent
Frontend specialist for React apps…
3.9k downloads · development-team  view

POPULAR                                2.2k
code-reviewer                         skill
Reviews code for bugs and style…
3.2k downloads · quality  view  install
```

The pane is deliberately flat: plain text only, no colours, no icons, no
borders, no bold. Hierarchy is layout (the `BROWSE` / `INSTALLED` / `POPULAR`
headings, counts on the right) and every action is a word (`view`,
`install`, `installed`, `back`). Sections collapse when you press their
heading.

- **Search** filters as you type (every word must appear in the name,
  category or description); it spans every type, or only the type chosen in Browse.
- **Browse** is the site's menu: one line per type (Skills, Agents, Commands,
  Settings, Hooks, MCPs, Mods, Loops) plus All, each with its count from
  `counts.json`; the chosen type narrows both sections.
- **Installed** lists what is already on disk, with the project's `.claude/`
  winning over `~/.claude/`: agents (`agents/*.md`), commands
  (`commands/**.md`), skills and mods (`skills/{name}/`; a directory with
  `.claude-plugin/plugin.json` is a mod). Hooks, settings, MCPs and loops are
  merged into JSON files, so they cannot be told apart by name and are not
  listed. A name found on disk that the catalog does not know is shown as
  local. The list is rescanned when the pane opens, after an install and at
  the end of every turn.
- **Rows** show the type, the description, the category, downloads and two
  actions: `view` opens the component's page on aitmpl.com in your browser
  (`open` on macOS, `xdg-open` on Linux, `explorer.exe` on Windows, each an
  argv; the URL is http(s) only) and `install` (`installed` once it is on disk). A row's
  name opens its detail: description, the install command, **install here**
  (`$.process.run(["npx", "claude-code-templates@latest", "--agent", "…", "--yes"])`:
  always the fixed CLI, the type's own flag and a validated path, never a
  command string from the catalog, never a shell), **open on aitmpl.com** and
  **put command in prompt** (`$.prompt.fill`, nothing is submitted).
- **Downloads** come from the `downloads` field of the site's
  `components/{type}.json`: the total per component the catalog generator
  publishes (the header totals come from `trending-data.json`). The catalog is
  fetched live through `$.http.fetch` and cached for the session; `refresh`
  reloads it.

Browsing costs no tokens: nothing the pane draws enters the transcript.

## Command

```
/aitmpl              open the pane
/aitmpl skills       open it filtered to a type (agents, commands, mcps, settings, hooks, skills, loops, mods)
/aitmpl react perf   open it with a search
/aitmpl stop         close
```

The search box takes the keyboard when the pane opens; Esc returns it, and
then Tab / Enter (or a click) press the buttons, and `r` refreshes, `b` goes
back from a detail, `i` / `o` / `c` install, open and copy the command.

Every cell that has to line up is a fixed-width box and every run of spaces in
a label is a no-break space off the terminal, because Claude Desktop sizes a
cell to its text and collapses spaces. The mobile surface has no `Input`
element yet and draws the engine's own pane instead.

## Hooks

| Event | What it does |
|---|---|
| `session.start` | registers `/aitmpl` (`$.command.register`) |
| `command.run` `{ command: "aitmpl" }` | scans what is installed, opens the pane (`$.ui.open`, focused, docked at `columns`); `stop` closes it |
| `ui.render` `{ component: "Pane", requestId: "aitmpl" }` | draws the pane from `$.ui.resolve(e)` (Box, Text, Button, Input); the fetches start from its closures and `$.ui.invalidate("ui.render")` repaints when they land; a fetch that failed is retried only by refresh, never by a repaint |
| `turn.complete` | rescans what is installed (Claude may have installed something) |
| `ui.close` | notes the pane is closed |

The mod calls `$.http.fetch` (the site's JSON), `$.fs.list` and `$.fs.exists`
(the installed scan, read-only), `$.process.run` (from the install button, with
the fixed CLI argv, and from the open-in-browser button, with the platform's
URL opener), `$.prompt.fill`, `$.env.get` (`HOME`, `USERPROFILE`, `OS`),
`$.ui.open`, `$.ui.close`, `$.ui.toast`, `$.ui.status` and `$.ui.log`. An
`admin-capability-lockdown` mod that withholds `http` or `process` refuses it
at `plugin.register`, by design.

## Options

```
  siteUrl:  string   the site whose catalog is browsed (default "https://www.aitmpl.com")
  pageSize: number   rows shown per section before "show more" (default 8)
  columns:  number   width asked for the docked pane, 28-120 (default 48)
```

Declared in `.claude-plugin/plugin.json` (`userConfig`). Set them in `/config`, in user settings (`~/.claude/settings.json`, not project settings), with `--settings <file>` or in managed settings:

```json
{ "pluginConfigs": { "aitmpl@skills-dir": { "options": { "pageSize": 12 } } } }
```

## Install

```sh
npx claude-code-templates@latest --mod productivity/aitmpl
CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1 claude
```

It is written to `.claude/skills/aitmpl/`, which Claude Code auto-loads as `aitmpl@skills-dir`. For one session with hot reload: `CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1 claude --plugin-dir .claude/skills/aitmpl`. `claude plugin validate .claude/skills/aitmpl` prints every event it hooks and every `$` call it makes; `CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1 claude plugin test .claude/skills/aitmpl` runs the tests (catalog helpers and the pane on the terminal and desktop surfaces). A project mod loads only once the workspace trust prompt is accepted; `~/.claude/skills/aitmpl/` always loads.

**Early access.** Mods need Claude Code 2.1.259+ with `CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1`; the `$` API may change between releases. Typed against Anthropic's declarations: https://github.com/anthropics/claude-code/tree/main/mods
