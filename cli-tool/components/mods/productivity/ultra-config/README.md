# ultra-config

Five setting profiles in a side pane. Each one sets Claude Code up for one way of working: press a profile to see exactly what it sets, then press **Activate**. Every activation can be undone.

```
⚙ ULTRA  CONFIG          default · default effort · default mode
──────────────────────────────────────────────────────────────
▾  ◔  Token saver                      ■■■□□□□□□□  3/11
      Sonnet, low effort, short answers, Haiku subagents
╭────────────────────────────────────────────────────────────╮
│ ● Model                   Default (recommended) → sonnet   │
│   cheaper per token than Opus                              │
│ ● Effort                  medium → low                     │
│   less thinking per request                                │
│ ✓ Auto-compact            on                               │
│ …                                                          │
│ [ Activate Token saver ]                                   │
╰────────────────────────────────────────────────────────────╯
▸  »  Fast flow                        ■■■□□□□□□□  3/8
      Edits auto-accepted, medium effort, fewer interruptions
▸  ◆  Max quality                      ■■■■■■□□□□  6/9
▸  ▣  Guarded                          ■■■□□□□□□□  2/7
▸  ➤  Autopilot                        ■■■■■□□□□□  4/8
```

## Commands

| Command | What it does |
| --- | --- |
| `/ultra-config` | Opens the pane |
| `/ultra-config <profile>` | Opens the pane on that profile |
| `/ultra-config apply <profile>` | Activates a profile and lists what it changed and skipped |
| `/ultra-config undo` | Reverts the last activated profile (newest first) |
| `/ultra-config close` | Closes the pane |

Profile ids: `saver`, `flow`, `quality`, `guarded`, `autopilot`.

In the pane everything is a press: a profile's name opens its detail (one is always open, the first to start), and **Activate** applies it (`a` while the pane has focus). There are no tabs or arrow-key menus, so nothing competes with Claude Code's own `←` for the agents view.

## The profiles

| Profile | For | Sets |
| --- | --- | --- |
| ◔ **Token saver** | Spending fewer tokens | Model `sonnet`, effort `low`, subagents on `haiku`, Concise output, no prompt suggestions or recap, auto-compact on, small workflows, no `ultracode` keyword, MCP output capped at 10,000 tokens, fast mode off |
| » **Fast flow** | Less waiting | Model `sonnet`, effort `medium`, edits auto-accepted, Concise output, prompt suggestions on, turn duration and progress bar on, medium workflows |
| ◆ **Max quality** | The best result | Model `best`, effort `xhigh`, subagents keep their own model, default output, workflows on with large fan-outs and the `ultracode` keyword, checkpoints and auto-compact on |
| ▣ **Guarded** | Control and safety | Every edit and command asks first, plan mode never acts on its own, `bypassPermissions` disabled, `Read` deny rules for `.env`, `secrets/`, `~/.ssh` and `~/.aws` (they stop the Read tool, not a Bash `cat`), checkpoints on, verbose output, no `ultracode` keyword |
| ➤ **Autopilot** | Long unattended runs (fewer approval prompts) | Auto permission mode (also during plan), effort `high`, workflows on, recap on, push notifications when Claude decides or needs you, auto-compact on |

Each profile shows how much of it is already in force (`3/11`), and `✓ active` when all of it is. In the detail, `●` is a change (old value struck through, then the new one and why), `✓` is already set and `⊘` is skipped.

## Where each change is written

- **`/config` rows** (model, permission mode, output style, auto-compact…) are written with `$.config.set`, exactly as if you changed them in `/config`. Claude Code picks the file: most go to `~/.claude/settings.json` or `~/.claude.json`, and Output style goes to the project's `.claude/settings.local.json`, the same as the menu.
- **Effort** is saved per model, the way `/effort` saves it: `modelSettings["<model id>"].effortLevel` in `~/.claude/settings.json`, for the model your next message runs on (the mod learns its id from that request and sends the request at the new effort too). Since Claude Code 2.1.251 a top-level `effortLevel` in user settings is ignored by Opus 5.5 and later models, so the mod never writes it. A model id with a dot (Bedrock, Vertex) can't be saved this way; then the effort applies to that one request only.
- **Keys with no `/config` row** (`env.CLAUDE_CODE_SUBAGENT_MODEL`, `env.MAX_MCP_OUTPUT_TOKENS`, `permissions.deny`, `permissions.disableBypassPermissionsMode`) are written to `~/.claude/settings.json` (or `$CLAUDE_CONFIG_DIR/settings.json`). Before each write the file is copied to `settings.json.ultra-config.bak` (only the latest copy is kept; it holds whatever the file held, `env` values included). A file that is not valid JSON is never overwritten: those steps are skipped and the pane says why.

Every activated profile is kept (the last 20) in the plugin's store, so `undo` works after a restart and puts back exactly the values it changed. A deny rule you already had stays when you undo. A profile never touches a row your organization locked, a value this Claude Code version does not offer, or a row Claude Code reserves for its own panel (it says so, for example "can only be turned on from the /config panel"); those show as `⊘` in the detail.

The `/config` rows apply right away and the effort from your next message. The env variables (`CLAUDE_CODE_SUBAGENT_MODEL`, `MAX_MCP_OUTPUT_TOKENS`) are read when Claude Code starts, so count on them from the next session.

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

Needs Claude Code 2.1.287 or later and a trusted project folder (or install it under `~/.claude/skills/`).

## Notes for maintainers

Claude Code writes `/config` rows from the settings it holds in memory, and it does not reload a `settings.json` write that lands right after one of its own. So the mod writes `settings.json` first, waits until `$.settings.read` shows the new values (writing the file once more if the first write was not picked up), and only then sets `/config` rows. If the engine never reloads the file, the row changes are skipped and the pane says to restart the session. Without this ordering, the next `/config` change would silently put back the old values.

Tests: `claude plugin test productivity/ultra-config` (from `cli-tool/components/mods`).
