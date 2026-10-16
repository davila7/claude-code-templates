# ultra-config

A designed `/config`. A side pane with five profiles that set Claude Code up for one way of working in one press, and the whole settings menu as a form grouped by category, with search. Every profile shows exactly what it will change before anything is written, and every applied profile can be undone.

```
⚙ ULTRA  CONFIG          default · default effort · default mode
1: ◆ Profiles  2: ☰ Settings  3: ↺ History
──────────────────────────────────────────────────────────────
│ ◔  Token saver                        ■■■□□□□□□□  3/11
      Sonnet, low effort, short answers, Haiku subagents
▌ ▣  Guarded                            ■■■□□□□□□□  2/7
      You approve each change; no reading secrets; no bypass
╭────────────────────────────────────────────────────────────╮
│ ▣ Guarded · 5 changes                                       │
│ ● Bypass mode         unset → disable   settings.json       │
│   bypassPermissions cannot be turned on                     │
│ ● Deny rules          none → +5 rules   settings.json       │
│   the Read tool is blocked on .env, secrets/, ~/.ssh, ~/.aws│
│ ✓ 2 already set: Default permission mode, Rewind code       │
│ [ Apply 5 changes ] [ Close preview ]                       │
╰────────────────────────────────────────────────────────────╯
```

## Commands

| Command | What it does |
| --- | --- |
| `/ultra-config` | Opens the pane |
| `/ultra-config <profile>` | Opens the pane with that profile's preview |
| `/ultra-config apply <profile>` | Applies a profile and lists what it changed and skipped |
| `/ultra-config undo` | Reverts the last applied profile (newest first) |
| `/ultra-config settings` · `history` | Opens the pane on that tab |
| `/ultra-config close` | Closes the pane |

Profile ids: `saver`, `flow`, `quality`, `guarded`, `autopilot`.

In the pane, `1` `2` `3` switch tabs, `a` applies the open preview, `c` closes it and `u` undoes from History, while the pane has focus (ctrl+x tab, or a click). Click a card, or Tab to it and press Enter, to preview it.

## The profiles

| Profile | For | Sets |
| --- | --- | --- |
| ◔ **Token saver** | Spending fewer tokens | Model `sonnet`, effort `low`, subagents on `haiku`, Concise output, no prompt suggestions or recap, auto-compact on, small workflows, no `ultracode` keyword, MCP output capped at 10,000 tokens, fast mode off |
| » **Fast flow** | Less waiting | Model `sonnet`, effort `medium`, edits auto-accepted, Concise output, prompt suggestions on, turn duration and progress bar on, medium workflows |
| ◆ **Max quality** | The best result | Model `best`, effort `xhigh`, subagents keep their own model, default output, workflows on with large fan-outs and the `ultracode` keyword, checkpoints and auto-compact on |
| ▣ **Guarded** | Control and safety | Every edit and command asks first, plan mode never acts on its own, `bypassPermissions` disabled, `Read` deny rules for `.env`, `secrets/`, `~/.ssh` and `~/.aws` (they stop the Read tool, not a Bash `cat`), checkpoints on, verbose output, no `ultracode` keyword |
| ➤ **Autopilot** | Long unattended runs (fewer approval prompts) | Auto permission mode (also during plan), effort `high`, workflows on, recap on, push notifications when Claude decides or needs you, auto-compact on |

Each card shows how much of the profile is already in force (`3/11`), and `✓ active` when all of it is.

## Where each change is written

- **`/config` rows** (model, permission mode, output style, auto-compact…) are written with `$.config.set`, exactly as if you changed them in `/config`. Claude Code picks the file: most go to `~/.claude/settings.json` or `~/.claude.json`, and Output style goes to the project's `.claude/settings.local.json`, the same as the menu.
- **Keys with no `/config` row** (`effortLevel`, `env.CLAUDE_CODE_SUBAGENT_MODEL`, `env.MAX_MCP_OUTPUT_TOKENS`, `permissions.deny`, `permissions.disableBypassPermissionsMode`) are written to `~/.claude/settings.json` (or `$CLAUDE_CONFIG_DIR/settings.json`). They are marked `settings.json` in the preview and `json` in the form. Before each write the file is copied to `settings.json.ultra-config.bak` (only the latest copy is kept; it holds whatever the file held, `env` values included). A file that is not valid JSON is never overwritten: those steps are skipped and the pane says why.

Every applied profile is kept (the last 20) in the plugin's store, so `undo` works after a restart and puts back exactly the values it changed. A deny rule you already had stays when you undo. A profile never touches a row your organization locked, a value this Claude Code version does not offer, or a row Claude Code reserves for its own panel (it says so, for example "can only be turned on from the /config panel"); those show as `⊘` in the preview.

The `/config` rows and `effortLevel` apply right away. The env variables (`CLAUDE_CODE_SUBAGENT_MODEL`, `MAX_MCP_OUTPUT_TOKENS`) are read when Claude Code starts, so count on them from the next session.

## The form

The Settings tab lists every row of `/config`, grouped into Model, Safety, Context, Display, Alerts, Plugins (other plugins' options) and Other, plus Effort and Subagent model. Press a value to change it: a toggle flips, a choice moves to the next option. Type in the search box to filter across all groups. Rows locked by policy show `⊘ locked`. The form follows changes you make in `/config` itself.

## Where it draws

In the **fullscreen layout** the pane docks beside the transcript (`/tui fullscreen`, at least 110 columns). On the classic layout it sits above the prompt. In Claude Desktop it draws in the session's side panel; padded cells use non-breaking spaces so the columns keep their width.

## Options

Set them in user or managed settings under `pluginConfigs["ultra-config@skills-dir"].options` (`"ultra-config"` when loaded with `--plugin-dir`):

| Option | Default | What it does |
| --- | --- | --- |
| `columns` | `62` | Width asked for the docked pane (44–100); a width you drag it to wins |

## Install

```bash
npx claude-code-templates@latest --mod productivity/ultra-config
```

Needs Claude Code 2.1.290 or later and a trusted project folder (or install it under `~/.claude/skills/`).

## Notes for maintainers

Claude Code writes `/config` rows from the settings it holds in memory, and it does not reload a `settings.json` write that lands right after one of its own. So the mod writes `settings.json` first, waits until `$.settings.read` shows the new values (writing the file once more if the first write was not picked up), and only then sets `/config` rows. If the engine never reloads the file, the row changes are skipped and the pane says to restart the session. Without this ordering, the next `/config` change would silently put back the old values.

Tests: `claude plugin test productivity/ultra-config` (from `cli-tool/components/mods`).
