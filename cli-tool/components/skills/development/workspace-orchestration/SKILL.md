---
name: workspace-orchestration
description: |
  Use when working in a persistent-slot workspace that uses docko. Covers slot claims,
  delegated teammate inheritance, and the rule that code edits inside slots/ require an active claim.
---

# docko Workspace Orchestration

Use this skill whenever work touches files in `slots/` or when the user asks about workspace coordination.

## Quick Path

1. Run `/dock-status` or `docko status --brief`. docko walks up to the workspace root on its own, so this works from inside a slot; pass `--root <workspace>` only from outside the workspace.
2. Pass `--session "$DOCKO_SESSION_ID"` on every claim, heartbeat, and release. The SessionStart hook exports it for this session.
3. Prefer `docko slot acquire --session "$DOCKO_SESSION_ID" --branch <branch> --task "<task>" --brief` when you want docko to pick a slot. Selection is round-robin, starting after the last slot claimed for that application.
4. In a workspace with several applications, pass `--application <id>` so the pick stays inside the right pool.
5. Add `--prefer <slot-id>` when a specific slot is the right one (it already has the branch, say). docko takes it when free and rotates normally when it is not.
6. If every slot is busy and docko asks whether it should create a fresh managed clone, answer explicitly.
7. Use `docko claim --session "$DOCKO_SESSION_ID" --resource slot --id <slot> --branch <branch> --task "<task>"` only when you already know the exact slot.
8. Do the work inside that slot.
9. Release the slot when done:
   `docko release --session "$DOCKO_SESSION_ID" --resource slot --id <slot>`

Prefer slash commands when installed:

- `/dock-status`
- `/dock-claim <slot> <branch> <task>`
- `/dock-heartbeat <slot>`
- `/dock-release <slot>`
- `/dock-doctor`

## Rules

- Work from the root. Edit code in `slots/*`.
- Never invent a session id. The PreToolUse hook checks the runtime's own session, so a made-up id claims a slot that then blocks your own writes. Use `$DOCKO_SESSION_ID`, or an id from `docko session list --brief`.
- `branch` is claim metadata. docko records it and never runs `git checkout`.
- Claims are slot-scoped. Two sessions cannot share a slot, and one claim does not reserve a branch, a PR, or a file.
- If a parent session already owns the slot, reuse that authority instead of creating a second claim.
- Subagents started with the Agent tool share the parent's session id, so they inherit the parent's claim and need no docko call. A separately launched `claude` process gets its own session id and must be delegated: `docko delegate --session <owner> --child-session <child> --resource slot --id <slot>`.
- If docko reports `AMBIGUOUS_SESSION`, run the `suggested_command` from the error payload, or retry with an explicit `--session <id>` from `docko session list --brief`; do not end existing sessions unless the user asked for cleanup.
- If a write is blocked, read the deny message: it names the slot, the reason (`slot-not-claimed`, `claim-expired`, `unrelated-session`) and the exact command that fixes it.
- If every slot is busy and the user already approved the fallback, add `--clone-when-busy` to `docko slot acquire`.
- If `docko` is not runnable, check `DOCKO_BIN`. If it still fails, stop and tell the user.
- Do not inspect slots one by one or replace the CLI with `docko/registry.json` during normal work. Use `docko status --brief --claimed` instead.
