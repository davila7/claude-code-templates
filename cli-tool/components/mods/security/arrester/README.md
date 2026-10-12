<p align="center"><img src="https://raw.githubusercontent.com/dot-agi/arrester/main/docs/images/header.png" alt="Arrester, a Claude Code mod that remembers blocked calls and stops common detours to the same target." width="100%"></p>

<p align="center">
  <img src="https://img.shields.io/badge/Claude_Code-2.1.288%2B-D97757" alt="Claude Code 2.1.288+">
  <img src="https://img.shields.io/badge/type-mod-555555" alt="mod">
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-555555" alt="License: MIT"></a>
  <img src="https://img.shields.io/badge/version-1.1.0-555555" alt="Version: 1.1.0">
</p>

<p align="center"><strong>Arrester remembers your guards' blocks and stops common detours to the same target.</strong></p>
<p align="center"><a href="#why">Why</a> · <a href="#features">Features</a> · <a href="#how-it-works">How it works</a> · <a href="#install">Install</a> · <a href="#commands">Commands</a> · <a href="#options">Options</a> · <a href="#known-limits">Known limits</a></p>

> Vendored from [dot-agi/arrester](https://github.com/dot-agi/arrester) (MIT, by dot-agi). Install with `npx claude-code-templates@latest --mod security/arrester`, or from the author's marketplace as described below. Installed with `--mod`, it loads as `arrester@skills-dir`: set its options in `/config`, or under `pluginConfigs["arrester@skills-dir"].options` in `~/.claude/settings.json`. Report issues upstream.

![Terminal: a deny rule blocks cat notes.txt. Claude tries head -n 5 notes.txt, and Arrester stops it as a workaround of block b1.](https://raw.githubusercontent.com/dot-agi/arrester/main/docs/images/stop.svg)

A deny rule blocks cat. Arrester stops the head detour.

## Why

A guard can block one tool call while a different tool still reaches the same file, as reported in [Claude Code issue #29709](https://github.com/anthropics/claude-code/issues/29709).
Arrester remembers supported blocks from a settings hook, a deny rule, auto mode, or your own “No” in the permission dialog, within the [capture limits](#known-limits), and checks later calls against them.
A safe alternative that matches none of Arrester's rules goes on to your guards. A recognized detour to the blocked target stops.

## Features

- **Follows the guards you have.** Uses the blocks of your existing hooks, deny rules, and auto mode, so you write no new rules.
- **Matches across tools.** Recognizes common shell rewrites and file-tool calls that reach a blocked path.
- **Protects your guards.** While a block from a hook, rule, or classifier is open, stops recognized reads or changes of guard files, and `claude` commands that can turn guards off.
- **Checks subagents.** Applies the same rules to tool calls from subagents in the conversation.
- **Explains each stop.** Tells Claude which block the call matched and why. `/arrester` shows the open blocks and the recent decisions.
- **Denies or asks.** Refuses a match at once, or holds it until you answer.

## How it works

```mermaid
flowchart TD
  A[Tool call] --> B{Open block?}
  B -->|No| D[Continue through existing guards]
  B -->|Yes| C{Matches a block rule?}
  C -->|No| D
  C -->|Yes| E{Response option}
  E -->|deny| F[Stop and explain]
  E -->|hold| G[Ask the user]
  G -->|Allow once| D
  G -->|Deny or no answer| F
  D -->|Observable guard block| H[Remember the block]
```

- **Capture:** Arrester records the blocked call's paths, the access to each (read, write, or delete), and the shape of its command.
- **Match:** A later call matches when it reaches a blocked target, repeats the blocked command with changed flags or argument order, reads or changes a guard, or is opaque: it runs code or names paths that Arrester cannot read. A retry that only drops flags skips the retry rule; the other rules and your guards still apply.
- **Guards:** The guard files are your user and project settings files, the hook scripts that your settings name by an absolute path or by a [supported relative path](#known-limits), Arrester's own folder, and your installed plugins (changes only). A nested `claude` command with `--settings`, `--bare`, `--safe-mode`, `--dangerously-skip-permissions`, `--allow-dangerously-skip-permissions`, or `--permission-mode bypassPermissions` also counts, and so do `claude plugin disable`, `claude plugin uninstall`, and `claude plugin configure … --values-stdin`, also as `claude plugins`. Any other nested `claude` run counts too, except a version, help, or tool command; see [Known limits](#known-limits).
- **Your “No”:** Arrester stops only an exact retry of the call you rejected, so a changed request can go on. The target, guard, and opaque rules do not apply to it.
- **Lifetime:** A block closes after `block_minutes` (see [Options](#options)), or when you run `/arrester clear`. `/clear`, `/resume`, and `/branch` start a fresh record.
- **No open block:** Arrester passes calls through without analyzing them.

See the [usage guide](https://github.com/dot-agi/arrester/blob/main/docs/usage.md#how-a-later-call-is-checked) for access rules, supported shell forms, and script handling.

## Install

Works with Claude Code 2.1.288 and later. Tested with Claude Code 2.1.296.

Inside Claude Code:

```text
/plugin marketplace add dot-agi/arrester
/plugin install arrester@arrester
```

From a shell:

```sh
claude plugin marketplace add dot-agi/arrester
claude plugin install arrester@arrester
```

To try it for one session from a clone:

```sh
git clone https://github.com/dot-agi/arrester
claude --plugin-dir ./arrester
```

## Commands

| Command | What it does |
| --- | --- |
| `/arrester` or `/arrester status` | Shows the open blocks, the held calls, and the last ten decisions. |
| `/arrester history [1-5]` | Shows ten retained decisions per page, newest page first, with clipped detail. |
| `/arrester clear` | Closes every open block. |
| `/arrester clear b2` | Closes block b2. |

Only you can run `clear`. Arrester accepts it from your own prompt, from Remote Control, and from an SDK host: the desktop app, the VS Code panel, `claude -p`, or a program of your own on the Agent SDK. It refuses `clear` from every other origin, such as a scheduled task or another session.

![Terminal: /arrester status shows open block b1 from deny rule Bash(cat notes.txt), its target, and three recent stops.](https://raw.githubusercontent.com/dot-agi/arrester/main/docs/images/status.svg)

`/arrester status` lists the open block and recent stops.

## Options

Set them in `/config`. From a shell, write the values to a JSON file and run `claude plugin configure arrester@arrester --values-stdin < values.json`. A `--mod` install loads the mod as `arrester@skills-dir`, so use that key in `~/.claude/settings.json` for that install.

| Option | Values | Default | What it does |
| --- | --- | --- | --- |
| `response` | `deny`, `hold` | `deny` | `deny` refuses a match at once and tells Claude to stop and ask you. `hold` asks you first, with `Deny` and `Allow once`; `Allow once` still sends the call through every guard. Where nobody can answer (`claude -p`), `hold` refuses. |
| `block_minutes` | 1 to 1440 | 30 | How long a block stays open after it opened or after its last target or retry match. |

## How it compares

Arrester remembers supported guard blocks within the current conversation. These tools provide complementary checks and controls.

| Tool or feature | What it does | What Arrester adds |
| --- | --- | --- |
| Built-in [`/permissions` Recently denied](https://code.claude.com/docs/en/permission-modes#when-auto-mode-falls-back) and the [`PermissionDenied` hook](https://code.claude.com/docs/en/hooks#permissiondenied) | Lists auto mode denials, which you can retry with your approval; the hook runs on each auto mode denial. | Checks later calls against a recorded block, including recognized routes through other tools. |
| Built-in [protected paths](https://code.claude.com/docs/en/permission-modes#protected-paths) | Never auto-approves writes to protected folders such as `.git` and `.claude`, except in `bypassPermissions` mode and in some sessions where that mode is available. | While a block from a hook, rule, or classifier is open, also stops recognized reads of guard files and recognized guard-changing commands. |
| [Termaxa](https://github.com/termaxa/termaxa) | Applies command policies, previews consequences, and uses a circuit breaker for repeated destructive intent across shells and sessions. | Follows supported blocks from other guards and matches their specific file targets. |
| [melodic-software guardrails](https://github.com/melodic-software/claude-code-plugins/blob/main/plugins/guardrails/README.md) | `block-hook-bypass` checks Bash writes that bypass Write/Edit hooks; other guards check file changes. | Remembers a prior block and checks later calls against its targets across tools. |
| [destructive_command_guard (dcg)](https://github.com/Dicklesworthstone/destructive_command_guard) | Uses rule packs to block destructive commands, with explanations and allow-once controls. | Follows observable hook blocks and stops common attempts to reach the blocked target another way. |
| [guard-and-guide](https://github.com/kawarimidoll/guard-and-guide) | Uses configurable regular-expression rules to deny commands and suggest safer alternatives. | Checks whether a later alternative matches an open block's target or another block rule. |

## Known limits

Arrester catches common retries after a block. It is not a sandbox and cannot recognize every shell rewrite.

<details>
<summary>Read the full detection, capture, and capacity limits</summary>

Most of these limits apply while a block from a hook, deny rule, or auto mode classifier is open. In hold mode, `Allow once` still runs every guard. In deny mode, inspect the call and its block with `/arrester`; clear that specific block only if you intend to end its protection.

- **Pipeline failures (`pipefail`):** With `bash -o pipefail` or `set -o pipefail`, Arrester uses only the last pipeline command's result. It can miss a protected read after `||`, or falsely stop an `&&` branch that Bash would skip. Check these branches yourself and ask Claude to use explicit paths in separate calls after you approve the intended work.
- **Input inherited by command substitutions:** When `$(cat)` reads a path from the surrounding shell's heredoc, Arrester loses that input. A later read through the assigned variable can pass without an Arrester stop or warning. Ask Claude to state the path explicitly so you and the guards can check the intended read.
- **Command-substitution assignments:** Arrester loses the success or failure result of an assignment such as `p=$(true)` or `p=$(false)`. It can falsely stop a protected action after `||` or `&&` that the shell would skip. Inspect the conditional branch before choosing `Allow once` in hold mode.
- **Exit on failure (`errexit`):** With `bash -e` or `set -e`, Arrester can still check commands after a failure that would end the shell. It can falsely stop a later deletion that Bash would never run. Confirm that the failure exits the shell in that context before choosing `Allow once` in hold mode.
- **Pathname text helpers:** While a read block is open, `basename` or `dirname` on the protected path can trigger a false stop. On a guard file, they can also trigger a guard-file stop, although they only transform pathname text. Check that the whole call only handles text before choosing `Allow once` in hold mode.
- **Searches that name no folder:** A search with no folder, such as `rg pattern`, `grep -r pattern`, or a Grep call without `path`, counts as a read of the session's folder. For rg and ag, Arrester skips hidden names there, as they do, unless a flag such as `--hidden` shows them. A search with a file filter, such as `rg -g '*.ts' pattern`, `rg -t py pattern`, `grep -r --include='*.ts' pattern`, `ag -G '\.ts$' pattern`, or `ag --js pattern`, counts as no read, so it can read a blocked file without a stop or a warning. A search with a depth limit, such as `rg --max-depth 1 pattern`, `ag --depth 1 pattern`, or `ugrep -r --depth=2 pattern`, also counts as no read, so it can read a blocked file within that depth without a stop or a warning. Some other reads also pass without a stop or a warning: hidden files that a ripgrep config file or an rg flag that Arrester does not read shows, and a search by a subagent that runs in its own folder. An rg or ag search can also stop falsely on a hidden file below a visible folder, such as `apps/.env`, or on a file that `.gitignore` hides. A Grep or Glob call gets no target stop from a block of a `Read(` deny rule, because Claude Code leaves those files out of its search. Ask Claude to name the search folder while a read block is open.
- **Copies into a folder:** For a copy, move, or link into a folder, such as `cp /work/staging/secret /work/`, Arrester records the entry that it makes there, `/work/secret`. It cannot name that entry when the source's last name is a glob, as in `cp /staging/* /work/`, when the source comes from `find -exec` or from unknown `xargs` input, or for an rsync source that ends in `/`. Such a copy can replace a file under a write or deletion block without a stop or a warning. Under a deletion block, a recursive copy of a folder, such as `cp -r /staging/d /work/` with `/work/d/secret` blocked, also passes. Arrester records the entry also when the destination is a file, which can cause a false stop. A copy, move, or link that cannot replace an entry or changes nothing adds no entry: `cp -n`, `mv -n`, `--update=none`, `rsync -n`, `rsync --ignore-existing`, and `ln` without a flag that replaces, such as `-f`. Such a call can still make a blocked file that does not exist yet without a stop or a warning. A call that gives `-n` together with `-i` or `-f`, such as `cp -i -n`, still adds the entry, so it can stop falsely. A copy of 128 or more named files into one folder passes the limit of 256 path effects, so it is opaque. Ask Claude to name the destination file, and check globbed or found copies into the folder of a protected file yourself.
- **Running or sourcing a script:** Running or sourcing a script does not count as a read of the script file. Arrester checks the commands inside the script instead. So `bash -v /guards/check.sh`, which prints a guard script's text, and `. /guards/check.sh` pass without a guard stop. A script under a read block can be printed the same way without a target stop. `cat /guards/check.sh` and `bash -n /guards/check.sh` still stop. Check calls that run or source a guard script or a protected script yourself, especially with `-v` or `-x`.
- **Failed folder changes:** Arrester assumes that every `cd` or `pushd` succeeds. When the folder does not exist, the shell stays where it was, but Arrester resolves later relative paths in the missing folder. In `/work`, with `/work/secret` under a read block, `cd /missing || head secret` and `cd /missing; head secret` read `/work/secret` without a stop or a warning. A write or a deletion of `secret` there passes the same way. Ask Claude to use absolute paths after a `cd` that can fail, and check relative paths in such fallbacks yourself.
- **Prefix assignments that the shell keeps:** Arrester treats an assignment written before a command, such as `p=/work/secret export p`, as temporary. Some shells keep it. Bash keeps it before `export p` or `readonly p`, and `sh`, `dash`, and `ksh` keep it before any special built-in command, such as `export`, `eval`, `set`, or `:`. Arrester then does not know the value. With `/work/secret` under a read block, `sh -c 'p=/work/secret export p; head "$p"'` reads the file without a stop or a warning. A deletion through `$p` still stops as opaque. Ask Claude to write `export p=/work/secret`, or `p=/work/secret; export p`, which Arrester follows.
- **Relative names with a colon:** Arrester treats a command operand with a colon before its first slash as a remote target, such as `host:path` or a URL, and checks no file for it. So a relative file name such as `2026-10-11:notes.txt` or `dir:x/file` gets no check as an operand. In `/work`, with `/work/2026-10-11:notes.txt` under a block, `head 2026-10-11:notes.txt`, `cp /a 2026-10-11:notes.txt`, and `rm 2026-10-11:notes.txt` pass without a stop or a warning. A redirection such as `< 2026-10-11:notes.txt`, the name with `./`, and the absolute path still stop. Ask Claude to write such names with `./` or as absolute paths, and check colon names in shell commands yourself.
- **Repeated brace groups:** Arrester counts every word that brace expansion makes before it removes repeats. A word whose braces make more than 256 words is opaque, even when every word names the same path. For example, `cat /work/` followed by nine `{s,s}` groups makes 512 words that all name `/work/sssssssss`. While a block from a hook, rule, or classifier is open, such a call stops with the reason `the call names too many paths to read`. Ask Claude to write the path without repeated brace groups, or to split the call.

- A blocked search of a folder or with a glob, and a blocked listing, such as a Glob call, record no target, so the target rule never matches their block. A blocked search of one regular file, such as `grep -r KEY /work/.env` or a Grep call with that `path`, records the file. So when a hook denies a search of one file only to suggest another tool, such as `rg` for `grep`, that tool's search of the file stops too.
- Arrester reads paths from Bash, Monitor, Read, Write, Edit, NotebookEdit, LSP, Grep, Glob, SendFile, and SendUserFile calls, from a `file:` URI in a ReadMcpResourceTool call, and from MCP calls. An MCP call names a path only with a whole one-line string that is absolute, starts with `~/`, or is a local `file:` URI. Arrester cannot know what the MCP tool does with it, so an MCP call that only reads a write-blocked or deletion-blocked file stops too. A named folder that exists matches no write or deletion block. An MCP call that changes or deletes a folder under a write or deletion block, a file inside such a folder, or a folder that holds a blocked file passes without a stop or a warning, and so do relative paths, paths inside longer text, and calls of other tools. An MCP call that names more than 256 paths is opaque.
- Your “No” matches only an identical call: the same command text, working folder, and relevant tool arguments. A command that differs by one character goes on to your guards. Tool input past the serialization limits gets no exact identity, so your “No” on such a call matches no retry.
- Managed-settings hook denials end before installed mods run, so Arrester cannot observe them. With managed settings on the machine, or with a Team or Enterprise sign-in, Arrester sees a hook that denies with JSON only through the permission verdict, which names the hook on Claude Code 2.1.296 and later. On older versions such a deny opens no block; a hook that blocks with exit code 2 does. There, a deny that Claude Code makes after a hook's answer can also open a hook block: the tool's own check or a safety check that denies after a hook's ask, or a hook's changed input that Claude Code refuses.
- An auto mode denial without a classifier verdict, such as when the classifier is unavailable, opens no block.
- Arrester reads a hook's deny when the denied call ends. It keeps this record for at most 64 tool calls in progress at once, in the main session and its subagents together. A call is in progress from its PreToolUse hooks until it ends, so long-running calls count. If 64 calls that started later are in progress before a denied call ends, Arrester drops the record of the denied call. A deny from a JSON hook or from another mod then opens no block; a hook that blocks with exit code 2 still opens one.
- The settings API does not give the locations of managed settings or a `--settings` file, so Arrester does not guard them.
- Arrester expands `~`, `$HOME`, and `$CLAUDE_PROJECT_DIR` in a hook command; a hook with `args` gets only `$CLAUDE_PROJECT_DIR`. A relative hook path counts only as a command's program, such as `./hooks/check.sh`, as the first path after an interpreter or a shell, such as `python3 .claude/hooks/guard.py`, or under `.claude/`. Arrester reads it in the session's folder and in the project folder when the block opens. A bare name such as `python3 guard.py` and a script found through `PATH` add no guard. A `cd` in the hook command does not count, so the path after it guards the wrong file or none. Write `python3 "$CLAUDE_PROJECT_DIR"/hooks/guard.py` to guard such a file.
- Arrester drops the arguments of `source` and `.`, and it ignores shebang options. A script that the same command writes and then runs under another spelling, such as through a new link, can escape. A script path with a glob is opaque.
- In an interpreter script that last changed before the oldest open block, Arrester counts only a literal path that is a whole argument of a definite file operation, such as `shutil.rmtree('/w/d')`. Paths that such a script passes to `subprocess`, `exec`, `spawn`, `system`, or `popen`, builds from parts, nests in another call, or keeps in a `Path(…)` that no file operation uses directly, such as `p = Path('/w/d')` before `p.read_text()`, pass without a stop or a warning. So does the whole script when the call has no work budget left for it. In an older shell script, code that Arrester cannot read does not count, including code past the command-length or nesting limit. At capture, every script read from disk counts as older, and an older interpreter script is not scanned, so a block on an interpreter script on disk records no targets from inside it.
- Arrester folds `..` as text before it resolves symbolic links. With `/work/link` pointing to `/outside/child`, `head /work/link/../secret` reads `/outside/secret`, but Arrester checks `/work/secret`, so a block on `/outside/secret` does not stop it. A relative `..` path after `cd` into a link has the same gap. A link that the same command makes is followed one step only, so a chain of new links can escape.
- Arrester compares letter case exactly, after it looks up each path that exists. On a file system that ignores case, such as the macOS default, Claude Code 2.1.296 gives the name on disk, so `cat /work/SECRET` and `rm /work/SECRET` stop on a block of `/work/secret`. A case alias still passes without a stop or a warning when its name does not exist yet, such as `/work/NEWFILE` with `/work/newfile` blocked, when it names a symbolic link that a deletion removes, when it comes after a glob, such as `/wor?/SECRET`, when the lookup is refused, as for a file with no permissions, and on a Claude Code version whose lookup keeps the typed case. A glob after `shopt -s nocaseglob` or zsh `unsetopt CASE_GLOB` ignores case in every folder of its path, so in Bash, which keeps folder names case-sensitive, it can cause a false stop. Check paths that differ from a blocked path only in letter case yourself.
- Brace expansion covers comma lists such as `{a,b}` only. A range such as `{1..3}` or `{a..c}` stays literal, so a path written with one can pass without a stop or a warning.
- Arrester resolves the parameter operators `-`, `=`, and `+` (each also with `:`), `${#p}`, and `#`, `##`, `%`, and `%%` with a literal pattern. For a variable that it does not know, a default or an alternate counts as a possible value for a read, a write, or a listing, also through an assignment; a deletion through it stays opaque. Other operators, such as `${p/a/b}`, a pattern with a glob, such as `${p%.*}`, an unknown variable beside a path, such as `$UNSET/path` or `path$UNSET`, and command output that Arrester cannot know, such as `$(cat list)` or decoded text, are not resolved. A read or a write of a path that does not resolve passes without a stop or a warning; a deletion is opaque.
- Arrester skips the commands inside an arithmetic expansion `$((…))` or inside another parameter operator, such as `${p/a/b}` or `${p:?message}`, not only their values. With `/work/secret` under a read block, `printf '%s\n' "$(( $(cat /work/secret) ))"` reads the file without a stop or a warning. A deletion there, such as `x="$(( $(rm /work/secret) ))"`, passes the same way and is not opaque. A plain `$(cat /work/secret)` stops, and so does one in a default or an alternate that the shell can expand, such as `"${p:-$(cat /work/secret)}"`.
- A nested `claude` run does not inherit the open blocks, so while a block from a hook, rule, or classifier is open, it stops: also as `claude-code`, in any letter case, by a `claude/versions/<version>` path, or through a runner such as `npx`. Only a first word of `-v`, `--version`, `-h`, `--help`, or a tool subcommand (`mcp`, `plugin`, `plugins`, `doctor`, `update`, `upgrade`, `install`, `auth`, or `setup-token`) passes, but not `mcp serve`, an `mcp add` form, or a first word or subcommand that does not resolve. So `claude -p "summarize"` and `claude --verbose mcp list` stop too; in hold mode, choose `Allow once`. A session that another program starts still escapes: the Agent SDK, `bun x`, `setsid`, `arch`, Python `subprocess`, another agent CLI, a function or an alias from your shell profile, or a copy of the program under another name.
- Interpreter code can compute paths, use bare file names or names with spaces, or hide literals behind template expressions or comments that the scan reads as code. The scan recognizes common file operations but does not interpret functions or computed values. Some functions imported under a bare name are not recognized, such as `copy` after `from shutil import copy`. The scan skips Python `#` comments in code that python runs, and JavaScript `//` and `/* */` comments in code that node, bun, or deno runs; a script run directly takes its language from its `#!` line. A comment counts only when it starts a line, after any indentation, and a `/*` only when its `*/` follows. Other comments are read as code, such as Ruby, Perl, and PHP comments, a comment after code on the same line, such as the `# note` in `x = 1  # note`, and a `/*` without its `*/`. A file call in them can cause a false stop, and a quote in them can hide the calls after it. In a chain of methods on `Path(…)`, Arrester stops following the chain at a subscript such as `[0]`, at grouping parentheses, or at a parenthesis inside a string argument. A path after that point can take the write or deletion of the call around it, so while a block is open a call such as `os.remove(Path('/w/d').read_text().split()[0].strip('/w/e'))` can stop although it does not touch `/w/e`.
- Arrester does not read the command of a `trap`. With `/work/secret` under a read block, `trap 'cat /work/secret' EXIT` passes without a stop or a warning, and the shell runs `cat /work/secret` when it exits. A handler for a signal, such as `INT`, passes the same way.
- Arrester walks a function's body at each call, with the call's arguments, and an alias's text at each use, when the same command defines them, and it still checks the call as written. It does not walk a function whose body names `return` or `exit` anywhere, so what that body does passes without a stop or a warning. A folder change or an assignment in them does not reach the commands after the call. Functions and aliases from your shell profile, unlisted runners, such as `bun x`, `npm x`, `yarn exec`, `conda run`, or `bundle exec`, and unlisted program options can escape detection. A function body also counts where the shell would not call it, such as after `env`, `sudo`, or `xargs`, and an alias text where the shell would not expand it, such as later on the same line in Bash or after `unalias`. This can cause a false stop.
- `npm exec` with a workspace option, such as `-w app` or `--workspaces`, and a login `su` or `runuser`, with `-`, `-l`, or `--login`, run in a folder that Arrester does not know, so Arrester does not read the command or the code that they run. With `/work/secret` under a read block, `su - bob -c 'cat /work/secret'` passes without a stop or a warning, and so does a nested `claude` run through them.
- Compiled programs, remote commands, network targets, and Windows paths are outside detection.
- Loop bodies are scanned once with every possible value. `break`, `continue`, and changes in later iterations are not simulated, so a value that `break` skips can cause a false stop.
- Glob options that the shell already has when the command starts, glob options that Arrester does not track, and locale-specific character classes are unknown to Arrester. A glob that depends on them can pass without a stop or cause a false stop.
- In `find`, only `-name`, `-type f`, `-mindepth`, `-maxdepth`, and `-false` narrow the entries that an action reaches. Arrester ignores other tests, such as `-path` or `-iname`, and keeps the narrowing of the supported ones. With `!`, `-not`, `-o`, `,`, parentheses, or `-prune` before the action, it keeps only the depth bounds and drops `-name`, `-type f`, and `-false`, so it assumes that the action can reach every entry within those depths. These forms can cause a false stop.
- In code that `find -execdir` runs for an entry below a start path, `..` paths, a relative `cd`, a relative script, and `{}` inside a longer word, such as `x{}` or `{}.bak`, are opaque. `./{}` names the found entry and is checked like `{}`.
- `find` output that names entries below a start path and reaches `xargs` is opaque when `xargs` splits on another delimiter, such as `-print0` without `xargs -0`, or would split one found name into several words.
- When the file system refuses a lookup, Arrester compares the path as written and does not follow a link there.
- Past a limit in the [limits table](https://github.com/dot-agi/arrester/blob/main/docs/usage.md#limits), a call is opaque. It then stops while a block from a hook, rule, or classifier is open, even when it is safe. Examples are a file operand over 4,096 characters, more than 256 distinct path effects, and a glob comparison that exhausts its work budget.
- At most 50 blocks stay open. A new block past that closes the oldest one early; a transcript notice and the status name it.
- Arrester keeps the last 50 decisions. `/arrester` shows the last ten, each detail on one line of at most 600 characters. `/arrester history [1-5]` shows them ten per page, each clipped to 160 characters.
- A block keeps at most 256 flags per set and 65,536 bytes of flags in all. Past that, a retry with changed flags may not match; an identical retry still does. The transcript reports the overflow.

</details>

## Privacy

Arrester never approves a tool call and never changes its input. It only denies a call or asks you about it. Every other call goes on, unchanged, to your other guards and the permission check.

- **Network, models, and processes:** Arrester makes no network request, calls no model, and runs no process.
- **Storage:** Its record lives in the session's memory. It writes no file.
- **What it reads:** While a block is open, or when a guard blocks a call, Arrester reads the kind, size, change time, and real path of each path that the call names, the text of a script that the call runs (up to 256 KiB), and the `HOME` variable, to expand `~`. When a guard blocks a call, it also reads your settings through Claude Code's settings API, to find the hook files that they name. It reads no file at other times.
- **Interpreter code:** Arrester reads code that a call gives an interpreter, such as `python -c` or `node -e`, as text, to find the paths that it names. It never runs that code.
- **What Claude sees:** When a guard blocks a call that runs a script, paths and commands from that script can appear in the block's record. `/arrester` and the deny reasons show that record to Claude.
- **Read deny rules:** Arrester reads scripts through the mod file API, which your Read deny rules do not cover.

## Troubleshooting

<details>
<summary>Diagnostics, missing blocks, and hold dialogs</summary>

- Run `claude --debug` and search the debug log for `arrester:`. Each diagnostic names the mod, the event, and the cause.
- A refusal that says "could not check this call against its open blocks" means that Arrester failed while blocks were open, or could not tell whether any were open. It refuses rather than guess. Run `/arrester clear` to close the blocks.
- If no block opens after a hook denies a call, check for managed settings on the machine or a Team or Enterprise sign-in. There, on Claude Code before 2.1.296, make your hook block with exit code 2 instead of a JSON deny. A hook in managed settings never opens a block. See [Known limits](#known-limits).
- The status line may not show in the desktop app or in VS Code. `/arrester` works on every surface.
- Do not change Arrester's options while a hold dialog is open. The change reloads the mod, Claude Code decides what happens to the held call, and the transcript says that the hold ended.

See [docs/usage.md](https://github.com/dot-agi/arrester/blob/main/docs/usage.md) for the full guide.

</details>

## License

MIT. See [LICENSE](LICENSE).
