# aitmpl

`/aitmpl` opens a component browser above the Claude Code prompt: the
catalog of [aitmpl.com](https://www.aitmpl.com) (agents, commands, MCPs,
settings, hooks, skills, loops and mods), read live from the site's public
JSON (`counts.json`, `trending-data.json`, `components/{type}.json`) through
`$.http.fetch` and cached for the session. Browsing costs no tokens: nothing
the browser draws enters the transcript.

```
 aitmpl.com  2.0k components · 1.3M downloads · 153k this week · 190 countries   [refresh] [close]
Browse                    Trending this week
1: Agents       422       frontend-design         skill    4.7k↓
2: Commands     287       frontend-developer      agent    3.9k↓
3: MCPs         103       code-reviewer           skill    3.2k↓
4: Settings      72       …
5: Hooks         62
6: Skills       876
7: Loops         18
8: Mods          24
search ▸ a name, a category, words of a description
1-8 open a type · click a trending row · Tab / Enter move and press · q closes
```

Three views:

- **home** — the types with their live counts on the left, the site's
  trending components of the week on the right (a press opens the detail),
  the global stats in the header, and a search field.
- **list** — the type's components sorted by downloads, a `filter` field
  (every word must appear in the name, category or description), the type
  row to switch types keeping the filter, `p`/`n` to page, digits `1`–`9`
  to open a row. Templates are retired on the site and are not listed.
- **detail** — description, category, downloads, the install command, and
  three actions: `i` **install here** runs the CLI on the host
  (`$.process.run(["npx", "claude-code-templates@latest", "--agent", "…", "--yes"])`,
  an argv, never a shell), `c` **put command in prompt** writes an install
  request into the prompt box for Claude (`$.prompt.fill`, nothing is
  submitted), and a link to the component's page on aitmpl.com.

## Command

```
/aitmpl              home
/aitmpl mods         open a type (agents, commands, mcps, settings, hooks, skills, loops, mods)
/aitmpl react perf   search (starts in agents; switch the type from the list)
/aitmpl stop         close
```

Hotkeys press from an empty composer, or while a control of the band has the
focus; Tab moves between controls, Enter presses. The band pauses under a
survey and on the mobile surface (no `Input` element there yet).

## Hooks

| Event | What it does |
|---|---|
| `session.start` | registers `/aitmpl` (`$.command.register`) |
| `command.run` `{ command: "aitmpl" }` | opens the home, a type or a search; `stop` closes |
| `ui.render` `{ component: "AbovePrompt" }` | draws the view from `$.ui.resolve(e)` (Box, Text, Button, Input, Link); the fetches start from its closures and `$.ui.invalidate("ui.render")` repaints when they land |

The mod calls `$.http.fetch` (the site's JSON), `$.process.run` (only from the
install button), `$.prompt.fill`, `$.ui.toast`, `$.ui.status` and `$.ui.log`.
An `admin-capability-lockdown` mod that withholds `http` or `process` refuses
it at `plugin.register`, by design.

## Options

```
  siteUrl:  string   the site whose catalog is browsed (default "https://www.aitmpl.com")
  pageSize: number   rows per page, capped by the rows the band has (default 8)
```

Declared in `.claude-plugin/plugin.json` (`userConfig`). Set them in `/config`, in user settings (`~/.claude/settings.json`, not project settings), with `--settings <file>` or in managed settings:

```json
{ "pluginConfigs": { "aitmpl": { "options": { "pageSize": 12 } } } }
```

## Install

```sh
npx claude-code-templates@latest --mod productivity/aitmpl
CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1 claude
```

It is written to `.claude/skills/aitmpl/`, which Claude Code auto-loads as `aitmpl@skills-dir`. For one session with hot reload: `CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1 claude --plugin-dir .claude/skills/aitmpl`. `claude plugin validate .claude/skills/aitmpl` prints every event it hooks and every `$` call it makes; `bun test tests/` runs the catalog helpers' tests.

**Early access.** Mods need Claude Code 2.1.259+ with `CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1`; the `$` API may change between releases. Typed against Anthropic's declarations: https://github.com/anthropics/claude-code/tree/main/mods
