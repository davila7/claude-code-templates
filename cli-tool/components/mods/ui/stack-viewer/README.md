# stack-viewer

A side pane that maps every component your Claude Code session runs and where each one is installed from. The sidebar lists the component types. Pick one and the pane draws its scopes as a tree, in precedence order, with what is installed in each scope and whether it is active, shadowed by a higher scope, or off.

```
╭──────────────────────────────────────────────────────────────────────────────╮
│ ◆ Session stack  Claude Code 2.1.306                                         │
│ ~/work/app   158 active · 7 shadowed · 0 off                                 │
╰──────────────────────────────────────────────────────────────────────────────╯

 COMPONENTS               Skills   21 active · 1 shadowed
▌1: Skills            21  Enterprise › User › Project on a name clash · plugin
 2: Subagents          4  skills are namespaced, both load
 3: Commands          99
 4: Hooks              7    1  Enterprise            —  managed settings dir
 5: MCP servers        3  ▾ 2  User                  2  ~/.claude/skills
 6: Plugins & mods     3       deploy
 7: Settings          11       pdf-tools
 8: Memory             2
 9: Output styles      8  ▾ 3  Project               2  .claude/skills
                               d̶e̶p̶l̶o̶y̶        shadowed by User
 name  active                  release-notes
 n̶a̶m̶e̶  shadowed
 name  off                ▾ 4  Plugin                2  <plugin>/skills · …
 ≈     read off files          hello-mod:greet
                               team-tools:changelog

                            5  claude.ai account     —  enabled on claude.ai
                            6  MCP server            —  skills an MCP server…
                          ▸ 7  Built-in             16  ship with Claude Code

[ refresh ] [ fold all ] [ close ]
```

Run `/stack` to open it, `/stack refresh` (or running `/stack` again) to read the stack again, `/stack close` to close it.

## What it shows

Each type lists every scope it can be installed at, empty ones included, so you can see where a component could live as well as where it does. The orange number is the scope's precedence: `1` wins over `2` when two components share a name.

| Type | Scopes, highest first | When names clash |
| --- | --- | --- |
| ✦ Skills | Enterprise, User, Project, Plugin, claude.ai account, MCP server, Built-in | Enterprise › User › Project; plugin skills are namespaced (`plugin:skill`), so both load |
| ◎ Subagents | Enterprise, CLI flag (`--agents`), Project, User, Plugin, Built-in | Enterprise › CLI flag › Project › User › Plugin |
| ❯ Commands | User, Project, Plugin (including mod commands), MCP prompts, Built-in | A skill wins over a command file with the same name |
| ↯ Hooks | Enterprise, CLI flag, Local, Project, User, Plugin (hooks.json and function-hook modules) | None: every source runs. `allowManagedHooksOnly` and `disableAllHooks` turn the rest off |
| ⇄ MCP servers | Enterprise, Local, Project, User, Plugin, claude.ai, This session (`--mcp-config`, SDK) | Enterprise › Local › Project › User › Plugin › claude.ai, the whole entry wins. A `.mcp.json` server nobody approved shows `awaiting approval` |
| ◈ Plugins & mods | Enterprise, CLI flag, Local, Project, User (`enabledPlugins`), Project skills dir, User skills dir, This session (`--plugin-dir`) | The highest settings source that names a plugin decides whether it is on |
| ⚙ Settings | Enterprise, CLI flag (`--settings`), Local, Project, User | A value from the highest source wins; objects and lists merge |
| ¶ Memory | Enterprise, Project, Local, User, Auto memory | None: every file loads |
| ✎ Output styles | Enterprise, Project, User, Plugin, Built-in | One style is selected (★), by the highest settings source with `outputStyle` |

It draws in Anthropic's palette only: ivory for what loads, warm grays for paths and notes, orange for the selected type, the precedence numbers and anything shadowed. A shadowed component is struck through with the scope that wins over it (`shadowed by User`, `overridden by Local`). An `off` component is installed but not loaded: a skill with a broken frontmatter, a hook under `allowManagedHooksOnly`, a plugin disabled in a higher scope, an MCP server that did not connect.

## Where the data comes from

What is **loaded** comes from the engine, so it is what the session really runs:

- skills, custom subagents, MCP tools and memory files from the `/context` breakdown (`$.session.usage({ breakdown })`)
- slash commands from `$.command.list()`
- each settings source as loaded from `$.settings.read({ source })` (hooks, `enabledPlugins`, `outputStyle`, every key)
- the MCP server's config scope from each MCP tool call (`mcp_server.source`), once the server has been called
- the output style the engine sends, from `prompt.compose`

**Where a file sits** comes from reading the folders each type installs to: `~/.claude` (or `$CLAUDE_CONFIG_DIR`), the project's `.claude/`, the managed settings directory, `~/.claude/plugins/installed_plugins.json`, `.claude.json` and `.mcp.json`. That is how the pane finds what the engine does not list, a project skill shadowed by a user one for example. A scope known only from files, never confirmed by the engine, is marked `≈`: a plugin loaded with `--plugin-dir`, an MCP server not in any config file, a mod in a project skills dir (it loads once the folder is trusted).

From MCP config files the mod keeps server **names** only, never their env, headers or arguments. Settings values are shown in one short line: `env` shows variable names, never values, and a settings key whose name looks sensitive (`key`, `token`, `secret`, `auth`, `helper`, `uuid`, `org`…) shows `•••`. Hook commands and URLs are shown with bearer tokens, secret-looking parameters and flags (`token=`, `--api-key=`, `sig=`…) and long opaque strings masked as `•••`. Nothing is written to disk or kept between sessions.

The mods API does not list the built-in subagents (Explore, Plan, general-purpose…), so their scope shows a note instead of items. Nested `.claude/` folders between the working directory and the repository root are not scanned; the engine still reports what loads from them.

## Controls

- Click a type in the sidebar, or focus the pane (ctrl+x tab) and press `1`–`9`.
- Click a scope to fold or unfold it. Long built-in lists start folded.
- `r` or `refresh` reads the stack again, after you install something mid-session.

## Where it draws

In the **fullscreen layout** the engine docks the pane beside the transcript (turn it on with `/tui fullscreen`, at least 110 columns). On the classic layout it sits above the prompt. Under 72 columns the sidebar becomes a row of chips above the tree. In Claude Desktop the pane draws in the session's side panel, and every padded cell uses non-breaking spaces so the columns keep their width.

## Options

Set them in user or managed settings under `pluginConfigs["stack-viewer@skills-dir"].options` (`"stack-viewer"` when loaded with `--plugin-dir`):

| Option | Default | What it does |
| --- | --- | --- |
| `columns` | `84` | Columns asked for the docked pane (40–140); a width you drag it to wins |

## Install

```bash
npx claude-code-templates@latest --mod ui/stack-viewer
```

The CLI writes the plugin to `.claude/skills/stack-viewer/`, which Claude Code loads as `stack-viewer@skills-dir` once the project is trusted. To load it everywhere, copy that folder to `~/.claude/skills/`.

Needs Claude Code 2.1.287 or later. It only observes: every hook passes its event on unchanged.
