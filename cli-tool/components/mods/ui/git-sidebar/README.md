# git-sidebar

A small lazygit-style side pane for Claude Code: every worktree of the repository the session is in, and its local branches, as rows you can click.

```
app
Worktrees (3)
● app  main                ~2
  app-feature  feature/login  locked
  app-spike  spike
Branches (4)
* main                     ↓2
+ feature/login         ↑3 ↓1
+ spike
  old                     gone
[ refresh ] [ close ]
```

Run `/git-sidebar` to open it and `/git-sidebar stop` to close it.

## Where it draws

In the **fullscreen layout** the engine docks the pane beside the transcript, floor to ceiling, splitting the screen in two. That layout needs a terminal at least 110 columns wide; turn it on with `/tui fullscreen` (the session restarts and resumes) or `CLAUDE_CODE_NO_FLICKER=1`. On the classic main-screen layout the same pane sits above the prompt instead, with the same rows and the same actions.

The pane width is a request: `columns` (default 44) sets it when the pane opens, and a width you drag the dock to wins.

## What a click does

| Row | Click or Enter |
|---|---|
| worktree | moves the session there with the engine's own `/cd` (the `●` row is where you are) |
| branch | shows its upstream, age and last 5 commits, plus one action |
| → `switch` | `git switch <branch>` in the current worktree, only when that worktree has no uncommitted changes |
| → `open worktree` | when another worktree has the branch checked out (`+`), `/cd` there, since git would refuse the switch |
| `refresh` (`r`) | reads git again |
| `close` | closes the pane |

Mouse clicks land in the fullscreen layout. Everywhere else, focus the pane (ctrl+x tab), then move with Tab and press with Enter. Esc hands the keyboard back to the prompt and leaves the pane open.

The pane refreshes itself when it opens, after every `/cd`, and after each of Claude's turns, so a branch or worktree Claude just created shows up. While it is open, the status line under the prompt reads `git: <branch> · N worktrees · N branches`.

Markers: `●` the worktree the session is in, `*` its branch, `+` a branch checked out in another worktree, `~N` uncommitted paths, `↑`/`↓` ahead/behind its upstream, `gone` when the upstream branch was deleted.

## What it runs

Only git, by argv (no shell), through `$.process.run`: `rev-parse --show-toplevel`, `worktree list --porcelain`, `for-each-ref refs/heads`, `status --porcelain` in each worktree (the first 12), `log -n5` for a selected branch, and `switch` when you press it. It never commits, stashes, deletes or fetches.

## Options

```
  columns: number      width asked for the docked pane, 28-120 (default 44)
  maxBranches: number  local branches listed, most recently committed first (default 40)
  openOnStart: boolean open the pane when a session starts (default false)
```

Declared in `.claude-plugin/plugin.json` (`userConfig`). Set them in `/config`, in user settings (`~/.claude/settings.json`, never project settings), with `--settings <file>` or in managed settings, under the plugin's full id:

```json
{ "pluginConfigs": { "git-sidebar@skills-dir": { "options": { "columns": 56 } } } }
```

With `--plugin-dir` the id is plain `git-sidebar`. A pane opened on its own at session start stays hidden below 144 columns until you run `/git-sidebar`.

## Install

```sh
npx claude-code-templates@latest --mod ui/git-sidebar
CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1 claude
```

It is written to `.claude/skills/git-sidebar/`, which Claude Code auto-loads as `git-sidebar@skills-dir` in a **trusted** project (accept the trust prompt once; `claude -p` never shows it). For one session with hot reload: `CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1 claude --plugin-dir .claude/skills/git-sidebar`. `claude plugin validate .claude/skills/git-sidebar` prints every event it hooks and every `$` call it makes.

If `/git-sidebar` is missing from the typeahead, the mod did not load: `claude --debug` and look for `hooks module git-sidebar@… loaded` in `~/.claude/debug/latest`.

## Tests

```sh
CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1 claude plugin test .claude/skills/git-sidebar
```

The tests answer `$.process.run` with a fake git, mount the pane on the terminal surface and press its rows.

**Early access.** Mods need Claude Code 2.1.259+ with `CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1`; the `$` API may change between releases. Written and tested on 2.1.282 against the 2.1.278 declarations. Typed against Anthropic's declarations: https://github.com/anthropics/claude-code/tree/main/mods
