---
name: worktree-cleaner
description: Inventory the git worktrees of the current repository, classify each one with evidence (merged, PR state, uncommitted or unpushed work, locked, stale, in use by a running session) and remove them one at a time or by group, always asking the user first and verifying every removal. Use when worktrees have piled up (for example one per Claude Code task or thread), when `git worktree list` is long, or when the user asks to clean up, prune or tidy worktrees.
license: MIT
metadata:
  author: claude-code-templates
  version: "1.0.0"
  tags: [git, worktree, cleanup, maintenance]
---

# Worktree Cleaner

Agents and parallel workflows create one git worktree per task, and nobody removes them. This skill finds them, shows the user what each one holds, and removes only what the user approves, checking the result after every step.

The user decides. You gather evidence, recommend, and execute exactly what was approved. Nothing is removed in bulk without the user seeing the list first.

## Hard rules

1. **Ask before every destructive command.** `git worktree remove`, `git worktree prune`, `git worktree unlock` and `git branch -d/-D` each need the user's approval for that worktree or that named group. Approval of one group does not carry to the next.
2. **Never `--force` on work that would be lost.** If a worktree has uncommitted changes, untracked files, or commits that exist nowhere else, show the exact files and commits and ask a separate, explicit question ("remove it and lose these changes?"). A general "yes, clean everything" is not that confirmation.
3. **Never touch** the main worktree, the worktree you are running in, or a worktree with live processes inside it (another Claude Code session, an editor, a dev server). Report them and move on.
4. **Never delete a remote branch** (`git push --delete`, `git push origin :branch`, API calls). Remote branches are out of scope; mention them in the report if they look stale.
5. **Deleting the local branch is a separate question**, asked after the worktree is gone. Removing a worktree never deletes its branch.
6. **Re-check right before acting.** State changes while you talk to the user: re-run the inventory for that one path immediately before removing it, and stop if the verdict got worse.
7. **Verify after every action** and report what you checked. If a check fails, stop and tell the user; do not retry with stronger flags.

## Step 1: Inventory (read-only)

Run the bundled script from anywhere inside the repository. It changes nothing; `--fetch` only runs `git fetch --prune` so the merged/pushed checks use fresh remote refs. Ask before fetching if the user is offline or on a metered connection; otherwise fetch.

```bash
bash "${CLAUDE_SKILL_DIR}/scripts/worktree-inventory.sh" --fetch
```

If `CLAUDE_SKILL_DIR` is not set, the script is at `.claude/skills/worktree-cleaner/scripts/worktree-inventory.sh` (project install) or `~/.claude/skills/worktree-cleaner/scripts/worktree-inventory.sh` (user install).

Flags: `--path <worktree>` reports a single worktree (use it for the re-check in rule 6; it exits 3 with an error when no worktree matches, so a typo never looks like an empty result), `--no-gh` skips the GitHub CLI PR lookup, `--repo <dir>` targets another repository. The fetch never prompts for credentials; if it cannot authenticate it reports `fetch: FAILED`.

It prints a header (`default_branch`, whether the fetch worked, whether `gh` and `git merge-tree` were available) and then one block per worktree. Key fields:

| Field | Meaning |
|-------|---------|
| `modified_tracked`, `untracked_files`, `changed_paths` | Uncommitted work. `git worktree remove` refuses these without `--force`. |
| `ignored_local_files` | Gitignored files and directories that are not regenerable artifacts (dependencies, build output and caches such as `node_modules/`, `dist/`, `.venv/` are left out): `.env`, `.dev.vars`, local settings, keys, a whole `secrets/` directory. **`git worktree remove` deletes ignored files without warning**, so these must be shown to the user. |
| `commits_not_on_any_remote` | Commits reachable from this worktree's HEAD and from no remote-tracking ref. On a branch, removing the worktree keeps them on the branch, but deleting the branch afterwards loses them. On a **detached** worktree there is no branch: removing it makes them unreachable (the script marks it `AT_RISK`). |
| `git_error` | git could not read the worktree (broken `.git` file, `safe.directory` ownership, permissions). Nothing else in the block is reliable. |
| `head_merged_into_default` | HEAD is an ancestor of the default branch (merge or fast-forward). |
| `content_already_in_default` | Merging HEAD into the default branch would change nothing (`git merge-tree`). This catches squash and rebase merges, where the commits differ but the content landed. |
| `pr` | `#N STATE url` from `gh`, `none`, or `unknown` when `gh` is not available. |
| `processes_inside` | Running processes whose working directory is inside the worktree. |
| `claude_session_hours_ago` | Hours since a Claude Code session transcript for this exact path (`~/.claude/projects/<slug>/*.jsonl`) was written, or `none`. An idle, paused or archived session has no process but still owns its worktree; removing it breaks resuming that session. Under 7 days the verdict becomes `REVIEW`: ask whether that session is finished. |
| `index_touched_hours_ago` | Hours since git last wrote this worktree's index: a rough "last used" signal. |
| `locked`, `prunable` | Lock reason, or why git considers the entry stale (directory gone). |
| `created_by: claude-code` | The path is under `.claude/worktrees/`. |

Verdicts:

| Verdict | Meaning | What to offer |
|---------|---------|---------------|
| `SAFE` | Clean, nothing that would be lost, not in use. | Remove, as a group if the user prefers. |
| `REVIEW` | Probably removable but something needs a look: pushed but not in the default branch (PR open, closed without merge, merged with later commits, or unknown), touched in the last 2 h, locked, submodules, ignored local files, or git could not read it. | Show the reason, ask per worktree. |
| `AT_RISK` | Uncommitted changes, untracked files, or local-only commits not in the default branch. | Default is keep. Offer to commit/push first, or rule 2's explicit question. |
| `IN_USE` | A process has its cwd inside. | Do not remove. Tell the user which process. |
| `STALE_ENTRY` | The directory no longer exists and the entry is not locked. | Prune the entry (no data in it). A missing directory that is locked comes out as `REVIEW`: it may live on a removable drive, so ask before `git worktree unlock`. |
| `PROTECTED` | Main or current worktree, or bare. | Never offered. |

The verdict is the script's summary, not permission. Read the fields; if something looks off (for example `fetch: FAILED`, so "not on any remote" may be stale), say so and downgrade.

## Step 2: Present and ask

Show one compact table, grouped by verdict, with the evidence that drove each verdict. Use the user's language. Example:

```
SAFE (3)
  .claude/worktrees/fix-login   branch worktree-fix-login   PR #812 MERGED   content in origin/main
  ../app-wt-docs                branch docs-sweep           merged into origin/main
  ../app-wt-old                 (detached)                  content in origin/main

REVIEW (1)
  ../app-wt-api                 branch api-v2               pushed, PR #820 OPEN

AT_RISK (1)
  ../app-wt-spike               branch spike                2 uncommitted files, 1 local-only commit

IN_USE (1)
  .claude/worktrees/stack       claude (pid 4121) running inside

STALE_ENTRY (1)
  ../app-wt-usb                 directory missing
```

Then ask one question at a time, starting with the lowest-risk group: "Remove the 3 SAFE worktrees?" (allow the user to pick a subset), then the stale entries, then each REVIEW item individually. For AT_RISK, recommend keeping and ask what they want; never bundle AT_RISK into a group question.

If the user is in a hurry, it is fine to ask about SAFE + STALE_ENTRY together, but list the paths in the question.

## Step 3: Remove one worktree

For each approved worktree, in order:

1. **Re-check**: `bash "${CLAUDE_SKILL_DIR}/scripts/worktree-inventory.sh" --path <path>`. If the verdict is now worse than when the user approved (new changes, a process appeared), stop and ask again.
2. **Record** the branch name and HEAD SHA from that output; you will need them to verify and to tell the user how to recover. For a detached worktree with `commits_not_on_any_remote` > 0 (only after rule 2's explicit confirmation), first offer to keep the commits on a branch: `git branch rescue-<name> <sha>`.
3. **Remove without force**:
   ```bash
   git worktree remove <path>
   ```
   - Locked: show the lock reason and ask whether to unlock (`git worktree unlock <path>`, then remove). Do not use `remove -f -f`.
   - Refused for modified/untracked files: the state changed or the inventory missed something. Show `git -C <path> status --short` and go back to the user. Use `--force` only after rule 2's explicit confirmation naming the files that will be lost.
   - Submodules: git requires `--force` even when clean. Show `git -C <path> submodule status` and ask explicitly.
   - `git_error` (broken `.git` file): `git worktree remove` refuses even with `--force`. Show the user what is in the directory; only with their approval delete the directory itself and then drop the entry with `git worktree prune`.
4. **Verify**, all three:
   ```bash
   git worktree list --porcelain | grep -Fx "worktree <path>"   # <path> exactly as the inventory printed it; must print nothing
   test ! -e "<path>" && echo "dir gone"
   git rev-parse --verify --quiet "refs/heads/<branch>"           # must still print <sha> (skip for detached)
   ```
   Report the result. If the directory still exists (for example a file was locked by another program), say so; do not `rm -rf` it without asking.

For a `STALE_ENTRY` the directory is already gone: `git worktree remove <path>` drops just that entry; `git worktree prune --dry-run -v` shows every stale entry and `git worktree prune -v` removes them all, so only use the latter when the user approved all of them. Verify with `git worktree list --porcelain`.

## Step 4: Ask about the branch

After the worktree is gone, ask separately whether to delete its local branch. Give the evidence again:

- Merged into the default branch: `git branch -d <branch>` will succeed.
- Squash/rebase merged (`content_already_in_default: yes` but `head_merged_into_default: no`): `git branch -d` refuses because the commits differ. Explain that the content is in the default branch and ask explicitly before `git branch -D <branch>`. A merged PR alone is not enough evidence: the branch may have commits pushed after the merge. Offer `-D` only when one of the two `*_default` fields is `yes`.
- Neither: recommend keeping the branch. If the user still wants it gone, warn that `commits_not_on_any_remote` commits will only be recoverable through the reflog, and require an explicit yes.

Before deleting, tell the user the recovery command: `git branch <branch> <sha>`. After deleting, verify `git rev-parse --verify --quiet refs/heads/<branch>` prints nothing.

Do not delete the remote branch, even if the user's wording suggests it; say that it is outside this skill and give them the command to run themselves if they want it.

## Step 5: Final report

Re-run the inventory without `--fetch` and finish with:

- Removed worktrees (path, branch, SHA) and which branches were deleted, each with its recovery command.
- What was kept and why (AT_RISK, IN_USE, declined by the user).
- Anything that failed a verification check.
- Final `git worktree list` output.

## Notes

- Requires git 2.38+ for `content_already_in_default` (squash-merge detection); older git reports it as `n/a` and squash-merged worktrees show as `AT_RISK` or `REVIEW`. Say so when that happens.
- `gh` is optional. Without it PR state is `unknown`, and pushed branches that are not in the default branch stay `REVIEW`.
- The process check uses `lsof` (macOS, most Linux) or `/proc`. It cannot see processes in other containers, VMs or machines that mount the same folder: if the user runs sessions elsewhere (remote control, a VM), ask whether any are active before removing recently touched worktrees.
- The script works with the bash 3.2 that ships with macOS.
- The Claude desktop app has its own worktree cleanup for the sessions it creates. If the user also uses it, say so: run one or the other on the same worktrees, and re-run the inventory if the app cleaned up in between.
- Under an agent's auto mode, running the inventory script may need the user's approval once, because it is a script file rather than a single git command.
