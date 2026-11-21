# Harness notes - Claude Code and CLI harnesses

Everything here is the set of operational details that affect how `ponder` runs inside an agent harness: installation, invocation, parallel subagents, the session lock, sandboxing, and compaction recovery.

## Install

Install from a reviewed checkout of [`Quinnod345/ponder`](https://github.com/Quinnod345/ponder):

```sh
git clone https://github.com/Quinnod345/ponder.git ~/code/ponder
~/code/ponder/install.sh
```

`install.sh` links the `ponder` binary into `~/.local/bin/ponder` (or `${CLAUDE_PLUGIN_ROOT}/bin/ponder` when bundled as a plugin) and runs `ponder doctor`. Re-running is safe - it replaces its own symlinks and refuses to clobber a real directory.

`bin/ponder` is a POSIX `sh` shim, not JavaScript. That is deliberate: an extensionless JS file trips Node's module resolution. It walks its own symlink chain before `exec node .../lib/cli.js "$@"`, because without that a `ponder` symlinked onto `PATH` would look for `~/.local/lib/cli.js`. Do not "fix" either part.

### Front matter

The skill front matter carries `name`, `description`, `license`, and `metadata` (`author`, `version`, `tags`):

```yaml
---
name: ponder
description: '...'
license: MIT
metadata:
  author: Quinnod345
  version: "1.0.0"
  tags: [deliberation, code-review, audit, verification, multi-agent]
---
```

Keep `description` quoted as a YAML string because it contains trigger phrases and punctuation that would break an unquoted YAML scalar.

### Checking the install

```sh
ponder doctor                                            # engine reachable, and what it can see
```

In **Claude Code**, the skill appears in the available-skills list; `/ponder` invokes it, as does the Skill tool with `skill: "ponder"`.

## Invocation

Claude Code surfaces the skill list to the model every turn, so a trigger phrase ("ponder this", "audit every route", "where were we") or an explicit `/ponder` invokes the skill. In harnesses where skills only load at session start, if the user says "keep pondering" mid-session and the skill context was compacted, read `SKILL.md` directly and run `ponder status`.

## Subagents and fan-out

| Capability | Claude Code | Single-process CLI harness |
|---|---|---|
| In-process subagents | **Agent / Task tool.** Multiple calls in one message run in parallel and return text to the parent. | None - run batches sequentially in one context. |
| Very large sweeps | **Workflow tool** - handles batching, retries, and collection better than hand-rolled parallel agents. | Sequential batches writing JSONL to `.ponder/tmp/batch/`. |
| Background execution | Bash tool `run_in_background`, plus Monitor to wait on a condition. | Foreground sequential batches. |

When fanning out across subagents:

- Have each subagent write its JSONL findings or deltas to `.ponder/tmp/batch/` and return only the path plus a count.
- Each subagent starts a **fresh context**. Everything the batch needs (the lens rubric, the unit list with paths, the 1-5 scale, and on pass 2+ the current findings for those units) goes in the prompt or in a file inside `.ponder/tmp/` that the subagent can read.

## The session lock

**The engine locks. Do not architect around a lost-update race - there isn't one.** Here is what happens in `lib/session.js`:

`lockSession()` takes an exclusive lock on the session directory before any command that writes state: `units`, `predict`, `grade`, `deliberate`, `delta`, `judge`, `decide`, `apply`, `abort`, and `verify --repair`. The read-only commands - `status`, `report`, `list`, `doctor`, and a plain `verify` - take no lock, so you can always ask where a session is even while a pass is being written into it. `verify` is the only command whose locking depends on a flag, for the obvious reason: with `--repair` it rewrites the state files, without it it writes nothing at all.

| Property | Behavior |
|---|---|
| Mechanism | `open(.ponder/<slug>/.lock, 'wx')` - atomic create-exclusive. The winner writes its pid and a timestamp into the file; the file's *existence* is the lock |
| Contending command | polls every 60 ms (`Atomics.wait`, no CPU spin) for up to **10 seconds** |
| Wait exhausted | exits **`1`**: `another ponder command is already working on <slug>.` - and names the lock file |
| Stale reclaim | a `.lock` whose mtime is older than **120 seconds** is deleted and taken. This is what covers a `kill -9` |
| Normal release | `unlink` when the command finishes, plus a process `exit` hook for `process.exit()` |
| Unlockable store | if the lock cannot be created for any reason other than `EEXIST`, the command runs without one. A safety net must not become a new way to fail |

**What the loser of a real race sees.** Two `ponder delta` calls fired at the same pass, measured:

```text
A rc=2   error out of order: "ponder delta" satisfies revise, but this session owes judge.
B rc=0   ponder delta - pass 1, 1 delta applied
```

The lock serializes them and the phase machine finishes the job. B takes the lock, applies its batch, and advances the phase from `revise` to `judge`. A waits a few milliseconds, takes the lock, reloads `session.json` from disk - and now owes `judge`, so its `ponder delta` is out of order and exits `2` without applying anything. The ledger grew by exactly one line, `findings.json` agrees with it, and the phase advanced exactly once. Two `ponder decide` at once record one pass, not two. Two `ponder start` on one slug: `mkdir` without `recursive` is the atomic claim, so the second exits `1` with `session "<slug>" already exists`.

The conformance suite pins this: **45 checks** in `concurrency: racing deltas have exactly one winner` and 14 more in `concurrency: racing decisions and starts have one winner too`, run over three fresh sessions because a lock-free engine only loses the race some of the time. Making `lockSession` a no-op fails both.

**What this means for fan-out.** The rule is unchanged - *only the parent runs `ponder`* - but the reason is sequencing, not corruption. A race has a winner and a loser, and **the loser's work is refused, not merged**. A subagent that calls `ponder delta` and does not check its exit code will report success while its entire batch went nowhere. So: batch agents write JSONL to `.ponder/tmp/batch/` and return a path plus a count, the parent concatenates, and the parent makes one call. That also keeps `f-NNNN` assignment and the ledger in one place, which is where they belong.

Two practical notes. The 10-second wait is generous against a command that finishes in well under a second, but a command stuck on a slow OCA bridge call (5 s per call) can outlast it - if a queued command exits `1` on the lock, re-run it rather than deleting the file. And delete a `.lock` by hand only when you know the process that made it is gone; otherwise wait, or let the 120-second stale reclaim do it for you.

## Sandboxing and `ponder doctor`

Run `ponder doctor` as the first command in any unfamiliar environment. It reports `node`, `psql`, OCA reachability, and which store roots are writable:

- **Network-restricted sandboxes:** If `psql` to `postgres://localhost/oneiro` is blocked or PostgreSQL is not installed, the OCA bridge returns `null` and the deliberation loop runs identically without prior-pondering recall. That is the designed degradation, not a bug. Set `PONDER_OCA=off` when you want to skip the OCA check explicitly.
- **Workspace-write sandboxes:** When writes outside the workspace are blocked, the `$HOME/.ponder/<slug>/` global fallback is not writable. Keep the session inside the project with `ponder start --project "$PWD"` so state lives in `<project>/.ponder/<slug>/`.
- **Read-only sandboxes:** A read-only sandbox cannot run a pass at all because every command in the loop writes state to `.ponder/<slug>/`. The inspection commands that write nothing (`status`, `list`, `verify` without `--repair`) still work, which is enough to inspect where a session stands.

## Context and compaction

Long sessions can compact, and compaction is the single most likely way a long ponder loses its thread in memory. The mitigation is built into the protocol: state lives in `.ponder/<slug>/` files, and every command prints `NEXT:`. After any context loss, `ponder status` tells you what you owe; `.ponder/<slug>/ledger.jsonl` tells you everything every pass did and why.

For large sweeps, prefer batches that write JSONL to `.ponder/tmp/batch/` and drop the raw file contents between batches over holding 40 units' worth of code in one context. The disk is the memory.

## Paths

Skill-relative references (`references/protocol.md`, `references/perspectives.md`, `references/harness-notes.md`) live alongside `SKILL.md` in the skill directory. Lens packs (`lenses/ui.md`, `lenses/architecture.md`, `lenses/tests.md`, etc.) live in the `ponder` repo (`~/code/ponder/lenses/`).

Session state goes in `<project>/.ponder/`. It is plain JSON and JSONL. Commit it when the ledger is worth keeping across branches and machines - that history is the point of the append-only design - otherwise add `.ponder/` to `.gitignore`. Do not commit `.ponder/tmp/`.

## Known bites

- **A queued command that exits `1` on the lock.** Not corruption - the session lock did its job and the wait ran out. Re-run the command. See [The session lock](#the-session-lock); do not delete a `.lock` file unless the process that wrote it is gone.
- **A skill edit that does not take effect.** Harnesses read `SKILL.md` at load; start a new turn after editing the skill file.
- **The OCA cognitive-loop process is not running.** Nothing in `ponder` depends on an external daemon; the optional OCA bridge shells out to `psql` directly and degrades cleanly when `psql` is absent or `PONDER_OCA=off` is set.
