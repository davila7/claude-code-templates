---
name: mac-storage-cleaner
description: Safely reclaim disk space on a Mac — the trustworthy, transparent, reversible alternative to CleanMyMac and similar tools. Use whenever the user says their Mac disk or storage is full or nearly full, gets a "startup disk almost full" / low-storage warning, asks to free up space, clean/clear caches, remove junk, delete leftover files from apps they uninstalled, or find what's eating their disk — in any language (e.g. English "my mac is out of space", "free up disk", "clear caches", "what's taking up my storage"; Georgian "ქეში გაასუფთავე", "მეხსიერება გადამევსო", "ადგილი აღარ მაქვს"). Surveys usage first, auto-clears only pure caches, moves anything riskier to the Trash (restorable), asks before anything expensive, logs every deletion, and reports what was freed. Do NOT use for cloud storage, RAM/memory-pressure, or a single named app's own in-app cache button.
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

## Workflow

**Locating the scripts.** The commands below resolve `$D` to this skill's own
directory so they work whether the skill was installed as a plugin
(`$CLAUDE_PLUGIN_ROOT` is set) or as a standalone skill (`~/.claude/skills/…`).
Shell state doesn't persist between commands, so each block re-resolves `$D`.

### 1. Survey — caches (always first, read-only)

```bash
D="${CLAUDE_PLUGIN_ROOT:+$CLAUDE_PLUGIN_ROOT/skills/mac-storage-cleaner}"; D="${D:-$HOME/.claude/skills/mac-storage-cleaner}"
bash "$D/scripts/survey.sh"
```

Prints free space and sizes every cache that exists on *this* machine, grouped
**safe / ask / never / app-data**. Never skip it — locations and sizes differ on
every Mac. Note current free space for the before/after report.

### 2. Clear the safe tier (no per-item permission needed)

Tell the user briefly what the safe tier removes and roughly how much it frees,
then:

```bash
D="${CLAUDE_PLUGIN_ROOT:+$CLAUDE_PLUGIN_ROOT/skills/mac-storage-cleaner}"; D="${D:-$HOME/.claude/skills/mac-storage-cleaner}"
bash "$D/scripts/clean-safe.sh"
```

Removes only the vetted safe allowlist (nothing else — the survey's "other large
caches" list is for the user to review, not for auto-deletion), handles read-only
files, skips anything macOS protects (reporting rather than failing), runs
`brew cleanup -s --prune=all` and removes unavailable simulators, logs each
deletion, and prints what it reclaimed. If the user only wanted specific items,
delete those directly instead.

To preview first (recommended when the user hesitates or asks what will go): add
`--dry-run` — full preview with sizes, zero deletion, zero log writes. Guards and
whitelist run identically in both modes, so the preview always matches reality.

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
D="${CLAUDE_PLUGIN_ROOT:+$CLAUDE_PLUGIN_ROOT/skills/mac-storage-cleaner}"; D="${D:-$HOME/.claude/skills/mac-storage-cleaner}"
bash "$D/scripts/find-extras.sh"
```

Surfaces the real hogs a cache sweep ignores: **leftover data from uninstalled
apps**, **big files (>500MB)**, **stale installers** (.dmg/.pkg), and **old
Downloads**. Everything here is ask-tier — present candidates, let the user pick,
then remove reversibly:

```bash
D="${CLAUDE_PLUGIN_ROOT:+$CLAUDE_PLUGIN_ROOT/skills/mac-storage-cleaner}"; D="${D:-$HOME/.claude/skills/mac-storage-cleaner}"
bash "$D/scripts/trash-items.sh" "/path/one" "/path/two"
```

**Trash chain and refusals.** trash-items.sh now tries `/usr/bin/trash` first (no
TCC prompt, works headless), then Finder (needs the Automation grant — System
Settings › Privacy & Security › Automation), then a same-volume `mv` into
`~/.Trash`. The log records which method moved each item; refused entries mean
the path is on the tool's deny list (system/user roots) — never work around a
refusal. Don't report space as freed when items logged `trash-failed` — nothing
was actually removed.

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

- `MSC_DRY_RUN` — set to `1` to force preview mode (same as `--dry-run`) on `clean-safe.sh`, and to make `trash-items.sh` preview instead of trashing.
- `MSC_WHITELIST_FILE` — override the whitelist path (default `~/.config/mac-storage-cleaner/whitelist`).
- `MSC_TRASH_BIN` — override the `trash` binary `trash_path` tries first (default `/usr/bin/trash`).
- `MSC_DEVICE_SUPPORT_KEEP` (default `2`) — how many newest Xcode DeviceSupport versions to keep per platform.
- `MSC_AI_AGENTS_KEEP` (default `1`) — how many newest non-active AI CLI versions to keep alongside the active (symlink-pinned) one.
- `MSC_ALLOW_UNLOGGED` — set to `1` to let a destructive run proceed even when the audit log can't be written (default: refuse, exit 3).

## Tests

`bats tests/` from the repo root (`brew install bats-core`). Every test runs
against a fake `$HOME`; the dangerous-path corpus in `tests/fixtures/` is a
floor — investigate a failure, never weaken the corpus.
