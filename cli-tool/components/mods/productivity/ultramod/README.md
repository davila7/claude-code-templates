# ultramod

Ultra Mod is a mod pack for Claude Code: ten mods in one plugin, switched together by five sets.
Source, tests and releases: [github.com/mertkayacs/ultramod](https://github.com/mertkayacs/ultramod).

![Claude Code with Ultra Mod: the HUD, a receipt, the guard and /ultra undo](https://raw.githubusercontent.com/mertkayacs/ultramod/media/demo.gif)

| Mod | What it does |
| --- | --- |
| hud | One line above the prompt: context bar, 5-hour and 7-day limits with reset times, turn timer, cost, model |
| receipts | A line under each answer with files, commands, tests, time and cost; flags "tests pass" claims when no passing test ran after the last edit |
| guard | Holds `rm -rf`, `git reset --hard`, force pushes, `DROP TABLE`, `terraform destroy` and similar until you approve. In a git work tree it first tries to save a snapshot, so `/ultra undo` can restore it; snapshots are best effort, and a failed one is logged without blocking the command |
| secrets | Refuses reads of `.env`, keys and credential files; masks known token formats in tool output |
| tests | Asks before a test is skipped, focused with `.only`, deleted or stripped of assertions |
| notify | Desktop notification when a long turn ends or Claude waits for you |
| compact | Warns at 70 % context, offers one-key compaction at 85 % with instructions that keep files, failures and open claims |
| loops | Notices the same command failing three times and tells Claude to stop and rethink |
| pins | Keeps the lines of `.claude/pins.md` in the system prompt for the whole session |
| tidy | Asks before Claude writes summary files nobody asked for (strict set) |

Sets: `essentials` (default), `strict`, `flow`, `marathon`, `quiet`. Switch with `/ultra set <name>`; the choice is
remembered per project. `/ultra` opens the control pane.

Ultra Mod makes no network requests, collects nothing, has no dependencies and calls no model itself. It does add some
text to what Claude reads: the lines of `.claude/pins.md` (at most 30 lines and 3,000 characters) go into the system
prompt while the file exists, and a refusal or a loop nudge is a short message in the conversation. Guards fail closed;
everything else fails open.

## Install

From this repo:

```bash
npx claude-code-templates --mod productivity/ultramod
```

Or from its own marketplace (receives updates):

```bash
claude plugin marketplace add mertkayacs/ultramod
claude plugin install ultramod@ultramod
```

Requires Claude Code 2.1.287 or later. MIT license, by Mert Kaya.
