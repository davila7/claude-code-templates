---
name: curviate-network
description: "Grow and manage a LinkedIn network with the Curviate CLI. Covers `connect` (send with a note, sent, received, accept, decline, cancel), `profile follow`/`unfollow`, `profile relations`, `profile followers` and `profile following`, the de-duplication signal for a connect loop, and the invitation propagation delay. Use when sending or withdrawing connection requests, triaging received invitations, following a member, or listing connections and followers."
version: 0.1.0
author: Curviate
license: MIT
tags: [LinkedIn, CLI, Agents, Sales, Recruiting, Outreach]
repository: https://github.com/Curviate/curviate-plugin
---

# Curviate: connections and following

An invitation is the most consequential low-effort write on LinkedIn: it is visible, it is
attributable, and a withdrawn one still leaves a trace. Preview first, de-duplicate before sending.

Command surface established against CLI `0.33.0`.

## Before any command

```bash
npm install -g @curviate/cli && curviate --version    # needs Node 18 or newer
curviate login --api-key <key>                        # or export CURVIATE_API_KEY
curviate account list --json                          # the acc_id for --account
```

- **Credentials resolve flag > environment > stored profile** (`CURVIATE_API_KEY`,
  `CURVIATE_BASE_URL`, `CURVIATE_ACCOUNT`).
- **`--profile <name>` picks the stored credential set; `--account <acc_id>` picks which connected
  LinkedIn account sends the invitation.** Name it explicitly on every write: an invitation from the
  wrong account reaches a real person as that person.
- **`--preview` before every write.** It renders the resolved request (recipient, note, acting
  account) without sending. On a read command it is refused with exit `2`.
- **`--json` on anything you parse**; **`--fields a,b,c`** to project; **`--verbose`** when a slim
  response looks suspiciously empty.
- **Put global flags at the end of the command.**
- **Branch on the exit code, never on prose.** See the table at the end.
- These are not retrieval-mode commands: `--mode`/`--max-age` are refused here with `unknown flag`,
  exit `2` (see `curviate-profile` for the four commands that do accept them).

## `connect`: invitations

| Command | What it does | Confidence |
|---|---|---|
| `curviate connect <id> --note "<text>"` | Send a connection request. `<id>` is a slug, profile URL or member id. `--note` is capped at 300 characters by LinkedIn; omit it for a generic request. | proven |
| `curviate connect sent` | **Pending** sent invitations only: accepted and declined ones are never returned, so this is a lower bound on what you sent. Use `id` with `connect cancel`; `user.id` identifies the recipient (the sent variant carries no public slug). `created_at` is the platform's own timestamp. There is no total count; use `--all` and count client-side. | proven |
| `curviate connect received` | **Pending** received invitations only. `user.public_identifier`, `display_name`, `first_name`, `last_name` identify the sender. Use `id` with `accept` or `decline`. | proven |
| `curviate connect cancel <id>` | Withdraw a sent invitation. `<id>` is the `id` from `connect sent`. | proven |
| `curviate connect accept <id>` | Accept a received invitation. `<id>` is the `id` from `connect received`. | **wired, never live-fired** |
| `curviate connect decline <id>` | Decline a received invitation. | **wired, never live-fired** |

`connect accept` and `connect decline` are preview-proven (`--preview` renders the correct call and
body), but have never been fired against a live account. They are real, correctly wired commands.
Run your own smoke test on an invitation you are prepared to act on before an unattended flow
depends on either.

### Traps

- **De-duplicate before sending.** A request against a pair already mid-flow or already connected
  returns `CONNECTION_REQUEST_CONFLICT`, exit `8`. That is a clean, routine signal and the only
  reliable de-duplication marker for a connect loop, but check `profile relations` and
  `connect sent --all` first rather than probing with real invitations.
- **Invitations take roughly 10 to 30 seconds to appear on the recipient's side**, and a very recent
  one can take minutes to appear in `connect sent` (LinkedIn-side indexing). An absence right after
  sending is not proof the send failed. Do not resend on that basis.
- **`--note` takes a string, not stdin.** Write the note to a file, confirm it is non-empty, and pass
  `--note "$(cat note.txt)"`. An empty note has gone out as a blank request.
- **There is no idempotency key and no server-side de-duplication.** A send that times out may
  already have landed; re-read `connect sent` before re-issuing.

## Following and connections

| Command | What it does | Confidence |
|---|---|---|
| `curviate profile relations` | Your first-degree connections. | proven |
| `curviate profile followers <id\|me>` | A member's followers. `me` is always safe; another member's id also works. | proven |
| `curviate profile following <id\|me>` | Who a member follows. **Self-only in practice**, see below. | proven |
| `curviate profile follow <id>` | Follow a member. Sends a connection request instead if their profile is private. Bodyless write; resolves a slug or URL to the member id for you. | proven |
| `curviate profile unfollow <id>` | Unfollow. Idempotent. | proven |

- **`profile following` is self-only.** Pass `me`. Any other member id (including your own explicit
  member id) returns `LINKEDIN_OPERATION_NOT_SUPPORTED`, exit `8`. That is a permanent platform
  limitation, never retryable. `profile followers` does not share it.
- **Never write `profile me relations`.** The command is `profile relations`. Older builds silently
  discarded `relations` and answered with your own profile at exit `0`; current builds exit `2`.
- Following is the low-consequence alternative to an invitation: it needs no acceptance, is
  reversible, and still surfaces the member's posts in your feed.

## A connect loop that behaves

```bash
# 1. Confirm you are not already connected or already mid-flow.
curviate profile relations --all --json          # first-degree
curviate connect sent --all --json               # pending invitations

# 2. Preview the exact request, then send it.
curviate connect <slug> --note "$(cat note.txt)" --account <acc_id> --preview --json
curviate connect <slug> --note "$(cat note.txt)" --account <acc_id> --json
```

On exit `8` with `CONNECTION_REQUEST_CONFLICT`, record the pair as already handled and move on. On
exit `13`, stop the loop; see below.

## Full command surface

<!-- generated: command surface, CLI 0.33.0 -->

Read from the CLI's own `--help` at version 0.33.0. Descriptions, traps and confidence
tags elsewhere in this skill are hand-written and carry the version they were established against.

Every command below that takes flags at all also accepts `--account`, `--api-key`, `--base-url`, `--beta`, `--json`, `--preview`, `--profile`, `--timeout`, `--verbose`.

| Command | Arguments | Flags |
|---|---|---|
| `curviate profile relations` | *(none)* | `--fields`, `--limit`, `--cursor`, `--all`, `--max-pages`, `--page-delay` |
| `curviate profile follow` | `ID` | `--fields` |
| `curviate profile unfollow` | `ID` | `--fields` |
| `curviate profile followers` | `ID` | `--fields`, `--limit`, `--cursor`, `--all`, `--max-pages`, `--page-delay` |
| `curviate profile following` | `ID` | `--fields`, `--limit`, `--cursor`, `--all`, `--max-pages`, `--page-delay` |
| `curviate connect` | `ID` | `--note` |
| `curviate connect sent` | *(none)* | `--fields`, `--limit`, `--cursor`, `--all`, `--max-pages`, `--page-delay` |
| `curviate connect received` | *(none)* | `--fields`, `--limit`, `--cursor`, `--all`, `--max-pages`, `--page-delay` |
| `curviate connect accept` | `ID` | *(none)* |
| `curviate connect decline` | `ID` | *(none)* |
| `curviate connect cancel` | `ID` | *(none)* |

<!-- /generated -->

## Exit codes to branch on here

| Code | Meaning | What to do |
|---|---|---|
| `1` | `INTERNAL` from the server itself: a genuine bug on the platform side. | Worth one retry; if it repeats it is a bug to report, not a state to work around. |
| `2` | Usage or invalid input, often raised before any network call. | Fix the invocation. Never retry unchanged. |
| `4` | Not found: a wrong member or invitation identifier. | Re-resolve the id. |
| `5` | Three causes, one code: read `error.code`. `NO_ACTIVE_SEAT`: the account is on no active seat. `LINKEDIN_FEATURE_NOT_SUBSCRIBED`: LinkedIn itself lacks the feature. `BETA_NOT_ENABLED`: the operation is beta-gated and this workspace has not opted in. | Branch on `error.code`: the three fixes have nothing in common, and none is fixed by retrying unchanged. |
| `6` | `PLATFORM_RATE_LIMIT` and its siblings. Carries `retry_after` in whole seconds. A response naming `budgetRow` means only that row is paused; every other row on the account keeps working. | **Back off and retry** after that many seconds. On a named `budgetRow`, switch to other work on the account rather than backing off across the board. |
| `7` | Transient platform fault: a request that got no response at all (network error, DNS failure, timeout) or one that came back as something other than a valid API answer. Carries `retryLikelyToSucceed: true`. | Retry with backoff. |
| `8` | Account or connection state. Read `error.code`: `CONNECTION_REQUEST_CONFLICT` is routine de-duplication; `LINKEDIN_OPERATION_NOT_SUPPORTED` is permanent; `ACCOUNT_RESTRICTED`, `LINKEDIN_AUTH_FAILED` and `LINKEDIN_COOKIE_INVALID` need a reconnect. | Depends entirely on `error.code`; never treat the whole bucket as "reconnect the account". |
| `13` | `BUDGET_EXHAUSTED`: a safety rule of your own refused the invitation, not LinkedIn. Read `error.safetyReason`: `ceiling` means the row named in `error.budgetRow` hit its configured limit; `activity_window` means the account is outside the hours it works in (no `budgetRow` on that one). **Nothing reached LinkedIn and nothing was spent; no invitation went out.** `reset_at` can be weeks out, and is `null` for allowances no clock frees (pending invitations, for instance, are freed by acceptances and withdrawals rather than by time). | **Do not back off and retry.** `error.safetyHint.parameter` names the exact setting to change. Read `quotas[]` via `curviate account get <acc_id> --json`, then wait for the named reset, withdraw stale invitations, or change that setting. A retry loop only burns time. |
