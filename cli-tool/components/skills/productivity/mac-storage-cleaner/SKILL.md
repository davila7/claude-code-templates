---
name: mac-storage-cleaner
description: Safely reclaim disk space on a Mac — the trustworthy, transparent, reversible alternative to CleanMyMac and similar tools. Use whenever the user says their Mac disk or storage is full or nearly full, gets a "startup disk almost full" / low-storage warning, asks to free up space, clean/clear caches, remove junk, delete leftover files from apps they uninstalled, or find what's eating their disk — in any language (e.g. English "my mac is out of space", "free up disk", "clear caches", "what's taking up my storage"; Georgian "ქეში გაასუფთავე", "მეხსიერება გადამევსო", "ადგილი აღარ მაქვს"). Surveys usage first, auto-clears only pure caches, moves anything riskier to the Trash (restorable), asks before anything expensive, logs every deletion, and reports what was freed. Do NOT use for cloud storage, RAM/memory-pressure, or a single named app's own in-app cache button.
license: MIT
metadata:
  version: 3.0.0
  author: Juba Kitiashvili
  homepage: https://github.com/JubaKitiashvili/mac-storage-cleaner
  platforms: macOS
  category: productivity
  tags: macos, disk-space, cache, cleanup, storage, cleanmymac-alternative
---

# Mac Storage Cleaner

Free disk space the way a careful engineer would, and earn the trust one-click
cleaners lose: **measure first, delete only what provably regenerates, make
anything riskier reversible, ask before anything expensive, log every action,
and report honestly.** The differentiator over CleanMyMac-style tools is
judgment and transparency — the user sees what will go and why, and can undo it.

Scripts live in `scripts/`; the full tiered inventory, exact reclaim commands,
and gotchas are in `references/cache-catalog.md`. Read the catalog whenever you
hit something a script didn't classify or you need the precise command.

## Core principles

- **Safe tier → delete outright** (space back immediately). These are pure
  caches; the only cost is a slower next build/install.
- **Everything else → Trash, not `rm`.** Ask-tier items, app leftovers, big
  files — move them to the Trash with `trash-items.sh` so the user can restore
  them. Reversibility is the whole point; never hard-delete a user's data.
- **When unsure, demote a tier.** A slower rebuild is trivial; deleting a
  license, an unpushable Xcode archive, or someone's only local backup is not.
- **Every destructive run is logged** to `~/Library/Logs/mac-storage-cleaner/operations.log` —
  deletions refuse to run unlogged (exit 3) unless the log directory is writable, or
  `MSC_ALLOW_UNLOGGED=1` explicitly opts into an unlogged run.

## What this skill does to your disk (declared behavior)

This section is a complete, mechanism-level statement of every destructive
operation, so automated skill scanners and human reviewers can compare what is
declared here against what the scripts actually do.

**Nothing is deleted permanently without an explicit flag**: `clean-safe.sh`
deletes only with `--apply`; `trash-items.sh` moves only the paths you
explicitly name, reversibly into the Trash, refuses bulk batches without
`--force`, and previews with `--dry-run`.

**Deletes permanently (`rm -rf`)** — paths on the hard-coded safe allowlist in
`scripts/lib.sh` (`SAFE_PATHS`, `KEEP_N_PATHS`, AI-CLI version roots); per-app
`Cache`/`Code Cache`/`GPUCache`/`DawnWebGPUCache` subfolders found under
`~/Library/Application Support` (only once a running-process check confirms the
owning app is idle); and age-gated Handoff clipboard buffers and crash-report
artifacts. The safe-tier, crash-report, and Electron-cache-subfolder deletions
retry once after `chmod -R u+w` when a read-only file blocks removal; the
DeviceSupport/AI-CLI-version and Handoff deletions do not retry.

**Moves to the Trash (reversible)** — everything else, via `/usr/bin/trash`, then
Finder automation through `osascript` (`tell application "Finder" to delete`),
then a same-volume `mv` into `~/.Trash`.

**Runs these third-party cleanup commands** — `brew cleanup -s --prune=all`,
`conda clean -y --tarballs --index-cache --logfiles`, `xcrun simctl delete unavailable`.

**Reads** — `du`, `df`, `find`, `stat`, `pgrep`/`ps`, `mdfind` and `mdutil`
(Spotlight, to check whether an app is still installed and whether indexing is
on), and `defaults read` on app bundles.

**Writes** — `~/Library/Logs/mac-storage-cleaner/operations.log` (audit trail,
rotated at 5 MB) and nothing else.

**Mechanically refuses** — `/System`, `/bin`, `/sbin`, `/dev`, `/private/var/db`,
other users' home directories, and the never-tier: iOS backups (MobileSync),
Photos libraries, Keychains, Mail, Messages, `~/.ssh`, `~/.aws`, `~/.gnupg`.
These are enforced in `validate_target_path`, not by convention.

**Never uses `sudo`** and makes **no network requests**.

## Workflow

**Locating the scripts.** Each command block below starts by resolving `$D` to
this skill's own directory. It searches every standard agent skill root —
Claude Code, Codex, Cursor, opencode, Antigravity, Windsurf, Hermes, the
cross-agent `.agents/skills`, and project-scoped installs — so the commands work
no matter which agent installed the skill or where. Shell state doesn't persist
between commands, so every block re-resolves `$D`; keep the two lines byte-identical
when editing (a test enforces it).

### 1. Survey — caches (always first, read-only)

```bash
D=""; for r in "${MSC_SKILL_ROOT:-/nonexistent}" "${CLAUDE_PLUGIN_ROOT:-/nonexistent}/skills" "$HOME/.claude/skills" "$HOME/.agents/skills" "$HOME/.cursor/skills" "$HOME/.codex/skills" "$HOME/.config/opencode/skills" "$HOME/.gemini/config/skills" "$HOME/.gemini/antigravity/skills" "$HOME/.codeium/windsurf/skills" "$HOME/.hermes/skills" ".claude/skills" ".agents/skills" ".cursor/skills" ".windsurf/skills"; do [ -f "$r/mac-storage-cleaner/scripts/lib.sh" ] && { D="$r/mac-storage-cleaner"; break; }; done
[ -n "$D" ] || { echo "mac-storage-cleaner: not found in any standard skill root (looked under MSC_SKILL_ROOT, CLAUDE_PLUGIN_ROOT and ~/.claude, ~/.agents, ~/.cursor, ~/.codex, ~/.config/opencode, ~/.gemini, ~/.codeium/windsurf, ~/.hermes, plus ./.claude|.agents|.cursor|.windsurf)"; exit 1; }
bash "$D/scripts/survey.sh"
```

Prints free space and sizes every cache that exists on *this* machine, grouped
**safe / ask / never / app-data**. Never skip it — locations and sizes differ on
every Mac. Note current free space for the before/after report.

### 2. Clear the safe tier: preview, show the user, then apply

Tell the user briefly what the safe tier removes and roughly how much it frees,
then preview it first — this run deletes nothing:

```bash
D=""; for r in "${MSC_SKILL_ROOT:-/nonexistent}" "${CLAUDE_PLUGIN_ROOT:-/nonexistent}/skills" "$HOME/.claude/skills" "$HOME/.agents/skills" "$HOME/.cursor/skills" "$HOME/.codex/skills" "$HOME/.config/opencode/skills" "$HOME/.gemini/config/skills" "$HOME/.gemini/antigravity/skills" "$HOME/.codeium/windsurf/skills" "$HOME/.hermes/skills" ".claude/skills" ".agents/skills" ".cursor/skills" ".windsurf/skills"; do [ -f "$r/mac-storage-cleaner/scripts/lib.sh" ] && { D="$r/mac-storage-cleaner"; break; }; done
[ -n "$D" ] || { echo "mac-storage-cleaner: not found in any standard skill root (looked under MSC_SKILL_ROOT, CLAUDE_PLUGIN_ROOT and ~/.claude, ~/.agents, ~/.cursor, ~/.codex, ~/.config/opencode, ~/.gemini, ~/.codeium/windsurf, ~/.hermes, plus ./.claude|.agents|.cursor|.windsurf)"; exit 1; }
bash "$D/scripts/clean-safe.sh"
```

**Preview is the default.** Running `clean-safe.sh` with no argument previews
everything with sizes and deletes nothing; `--apply` performs the deletion.
Guards and the whitelist run identically in both modes, so the preview always
matches reality. Show the user the preview before you run `--apply` — and always
do so on agents that execute shell commands without asking them first (opencode,
OpenClaw and anything configured to auto-run). `MSC_DRY_RUN=1` forces preview
even when `--apply` is passed.

Once the user has seen the preview and is on board, apply it:

```bash
D=""; for r in "${MSC_SKILL_ROOT:-/nonexistent}" "${CLAUDE_PLUGIN_ROOT:-/nonexistent}/skills" "$HOME/.claude/skills" "$HOME/.agents/skills" "$HOME/.cursor/skills" "$HOME/.codex/skills" "$HOME/.config/opencode/skills" "$HOME/.gemini/config/skills" "$HOME/.gemini/antigravity/skills" "$HOME/.codeium/windsurf/skills" "$HOME/.hermes/skills" ".claude/skills" ".agents/skills" ".cursor/skills" ".windsurf/skills"; do [ -f "$r/mac-storage-cleaner/scripts/lib.sh" ] && { D="$r/mac-storage-cleaner"; break; }; done
[ -n "$D" ] || { echo "mac-storage-cleaner: not found in any standard skill root (looked under MSC_SKILL_ROOT, CLAUDE_PLUGIN_ROOT and ~/.claude, ~/.agents, ~/.cursor, ~/.codex, ~/.config/opencode, ~/.gemini, ~/.codeium/windsurf, ~/.hermes, plus ./.claude|.agents|.cursor|.windsurf)"; exit 1; }
bash "$D/scripts/clean-safe.sh" --apply
```

This removes only the vetted safe allowlist (nothing else — the survey's "other
large caches" list is for the user to review, not for auto-deletion), handles
read-only files, skips anything macOS protects (reporting rather than failing),
runs `brew cleanup -s --prune=all` and removes unavailable simulators, logs each
deletion, and prints what it reclaimed. If the user only wanted specific items,
delete those directly instead.

The safe tier now keeps the 2 newest DeviceSupport versions
(MSC_DEVICE_SUPPORT_KEEP), keeps the active + 1 previous version of
auto-updating AI CLIs (claude / cursor-agent / copilot, pinned via their
launcher symlink), and skips any path whose owning process is running (Xcode
family, Gradle daemon) — report skipped items to the user instead of retrying.

**Browser & Electron app caches** (Chrome/Arc/Slack/VS Code/…) are safe but live
inside app-data folders — clear only the `Cache`/`Code Cache`/`GPUCache`
subfolders the survey lists, ideally with the app quit, and **never** the whole
app folder. Exact paths: `references/cache-catalog.md`.

### User whitelist

`~/.config/mac-storage-cleaner/whitelist` — one path or glob per line, `#`
comments, `~/` expansion; protects the entry and everything under it, and
governs every tier `clean-safe.sh` touches (safe, keep-N, AI-agent, Handoff),
dry-run included, down to individual children inside a keep-N/AI-agent/Handoff
base directory — surfaced by the survey too. One limit: an entry BELOW a
**safe-tier** allowlist path (e.g. `~/.npm/some-package`) can't be honored,
because the safe tier removes those paths atomically (`rm -rf ~/.npm`) rather
than walking their children — whitelist the safe-tier path itself instead.
`find-extras.sh` and
`trash-items.sh` do **not** read it (they only ever act on paths the user
explicitly approves that session), so when the user says "always keep X", add
a line here **and** keep checking find-extras candidates against it yourself
before proposing removal — the script won't stop you.

### 3. Surface the "ask" tier — recommend, don't delete

Big but not free caches (Docker images, ML models, simulator devices, Xcode
Archives, module stores). List each with size + a specific recommendation; let
the user choose. Use the tool-native command, and prefer Trash for file
deletions. Key ones (full detail in the catalog):

- **Docker** — `docker system prune -a`, never `rm` the VM disk.
- **ML models** (HuggingFace/Ollama) — often duplicated variants; offer to remove unused ones.
- **Simulators** — only `xcrun simctl delete unavailable` is safe; deleting active devices wipes state.
- **Xcode Archives** — warn: holds dSYMs for crash symbolication and shippable builds.

### 4. Go beyond caches — the space the cleaners miss (read-only scan)

```bash
D=""; for r in "${MSC_SKILL_ROOT:-/nonexistent}" "${CLAUDE_PLUGIN_ROOT:-/nonexistent}/skills" "$HOME/.claude/skills" "$HOME/.agents/skills" "$HOME/.cursor/skills" "$HOME/.codex/skills" "$HOME/.config/opencode/skills" "$HOME/.gemini/config/skills" "$HOME/.gemini/antigravity/skills" "$HOME/.codeium/windsurf/skills" "$HOME/.hermes/skills" ".claude/skills" ".agents/skills" ".cursor/skills" ".windsurf/skills"; do [ -f "$r/mac-storage-cleaner/scripts/lib.sh" ] && { D="$r/mac-storage-cleaner"; break; }; done
[ -n "$D" ] || { echo "mac-storage-cleaner: not found in any standard skill root (looked under MSC_SKILL_ROOT, CLAUDE_PLUGIN_ROOT and ~/.claude, ~/.agents, ~/.cursor, ~/.codex, ~/.config/opencode, ~/.gemini, ~/.codeium/windsurf, ~/.hermes, plus ./.claude|.agents|.cursor|.windsurf)"; exit 1; }
bash "$D/scripts/find-extras.sh"
```

Surfaces the real hogs a cache sweep ignores: **leftover data from uninstalled
apps**, **big files (>500MB)**, **stale installers** (.dmg/.pkg), and **old
Downloads**. Everything here is ask-tier — present candidates, let the user pick,
then remove reversibly:

```bash
D=""; for r in "${MSC_SKILL_ROOT:-/nonexistent}" "${CLAUDE_PLUGIN_ROOT:-/nonexistent}/skills" "$HOME/.claude/skills" "$HOME/.agents/skills" "$HOME/.cursor/skills" "$HOME/.codex/skills" "$HOME/.config/opencode/skills" "$HOME/.gemini/config/skills" "$HOME/.gemini/antigravity/skills" "$HOME/.codeium/windsurf/skills" "$HOME/.hermes/skills" ".claude/skills" ".agents/skills" ".cursor/skills" ".windsurf/skills"; do [ -f "$r/mac-storage-cleaner/scripts/lib.sh" ] && { D="$r/mac-storage-cleaner"; break; }; done
[ -n "$D" ] || { echo "mac-storage-cleaner: not found in any standard skill root (looked under MSC_SKILL_ROOT, CLAUDE_PLUGIN_ROOT and ~/.claude, ~/.agents, ~/.cursor, ~/.codex, ~/.config/opencode, ~/.gemini, ~/.codeium/windsurf, ~/.hermes, plus ./.claude|.agents|.cursor|.windsurf)"; exit 1; }
bash "$D/scripts/trash-items.sh" "/path/one" "/path/two"
```

**Trash chain and refusals.** trash-items.sh now tries `/usr/bin/trash` first (no
TCC prompt, works headless), then Finder (needs the Automation grant — System
Settings › Privacy & Security › Automation), then a same-volume `mv` into
`~/.Trash`. The log records which method moved each item; refused entries mean
the path is on the tool's deny list (system/user roots) — never work around a
refusal. Don't report space as freed when items logged `trash-failed` — nothing
was actually removed.

**Bulk operations need confirmation.** `trash-items.sh` refuses a batch of more than 100
eligible items or 5 GB and exits 4, because several agents run shell commands without
asking the user first. Show the user the list (a preview with `MSC_DRY_RUN=1` is never
refused), get their explicit go-ahead, then re-run with `--force` as the first argument.
Never pass `--force` pre-emptively. If `du` can't fully measure the batch (some paths are
unreadable), the size guard is skipped for that run — with an on-screen warning and a
`size-unmeasurable` log entry — but the 100-item cap still applies regardless.

**App leftovers need verification.** The scan lists containers whose owning app a
quick check couldn't confirm is installed — but Spotlight misses un-indexed apps,
so some candidates *are* still installed. Before proposing to remove any leftover,
**confirm the app is really gone** (check `/Applications`, `mdfind`, or just ask
the user "do you still use X?"), and always Trash it, never `rm`. To also clear a
confirmed-uninstalled app's *other* leftovers (Preferences, Application Support,
Logs, Saved State, etc.), see the leftover-location list in the catalog.

### 5. Report

In the user's language: before → after free space
(`df -h /System/Volumes/Data`), a short list of what was cleared/trashed with
sizes, a one-line note that the first build/install afterward will be slower, the
still-large "ask" items each with a recommendation, and the log path.

If free space rose less than the reclaimed size suggests, explain **APFS
purgeable space**: macOS may hold freed space as purgeable (often behind Time
Machine local snapshots) and release it on demand — the space is genuinely
recovered. Don't chase it with `sudo`.

## Safety rules

Read `references/cache-catalog.md` for the full tiered inventory and gotchas. The essentials:

- **Never delete** user data that looks like storage: iOS backups
  (`~/Library/Application Support/MobileSync/Backup`), Photos library, Mail/Messages
  data, whole app-support folders, `~/.ssh`/`~/.aws`/keychains, Time Machine
  snapshots. Report their size so the user knows, but don't touch them.
- **Messaging-app media is user data, not cache.** Telegram/WhatsApp/Slack store
  downloaded photos/videos in their caches. Don't bulk-delete these; point the
  user to the app's own "Clear Cache" (e.g. Telegram › Settings › Data and
  Storage › Storage Usage) so they choose what to drop.
- **Never `sudo`** into `/System`, `/Library/Caches`, `/private/var/folders`, or
  SIP-protected areas — that's macOS's job.
- **Watch mixed directories**: `~/.cargo` (has installed binaries — only clear
  `registry/`), `~/.m2` (has `settings.xml` — only clear `repository/`), `~/.gradle`
  (only `caches/`). `~/.npm` is pure cache so it's fine whole.
- **Continue past errors and verify** with `du`; `rm -rf` on multiple paths keeps
  going after a failure, so never assume total success or total failure.
- **Handoff shared-pasteboard buffers are cleared only when untouched for 60+
  minutes** — never delete fresher ones, an in-flight Universal Clipboard sync
  may be using them.

## Environment variables

- `MSC_SKILL_ROOT` — escape hatch for the `$D` resolver above: set it to the skills root directory that *contains* the `mac-storage-cleaner` folder (i.e. the same shape as `~/.claude/skills`) and it is checked first, ahead of every hard-coded root. Use this for any agent whose skill root isn't one of the ~10 standard ones the resolver already searches.
- `MSC_DRY_RUN` — set to `1` to force preview mode (same as `--dry-run`) on `clean-safe.sh`, and to make `trash-items.sh` preview instead of trashing.
- `MSC_WHITELIST_FILE` — override the whitelist path (default `~/.config/mac-storage-cleaner/whitelist`).
- `MSC_TRASH_BIN` — override the `trash` binary `trash_path` tries first (default `/usr/bin/trash`).
- `MSC_DEVICE_SUPPORT_KEEP` (default `2`) — how many newest Xcode DeviceSupport versions to keep per platform.
- `MSC_AI_AGENTS_KEEP` (default `1`) — how many newest non-active AI CLI versions to keep alongside the active (symlink-pinned) one.
- `MSC_ALLOW_UNLOGGED` — set to `1` to let a destructive run proceed even when the audit log can't be written (default: refuse, exit 3).
- `MSC_MAX_TRASH_ITEMS` (default `100`) — refuse a `trash-items.sh` batch with more eligible items unless `--force` is passed.
- `MSC_MAX_TRASH_GB` (default `5`) — refuse a `trash-items.sh` batch larger than this unless `--force` is passed.

## Tests

`bats tests/` from a clone of the source repository
(https://github.com/JubaKitiashvili/mac-storage-cleaner, `brew install bats-core`).
The tests are not shipped inside the installed skill. Every test runs against a
fake `$HOME`; the dangerous-path corpus in `tests/fixtures/` is a floor —
investigate a failure, never weaken the corpus.

Note: a handful of `SAFE_PATHS` globs point at the real, shared `/private/tmp`
(Metro/React Native bundler caches) that the fake-`$HOME` harness cannot
isolate — running `bats tests/` with `--apply` tests active (the default) can
clear `/private/tmp/metro-*`-class caches on the machine that runs it.
