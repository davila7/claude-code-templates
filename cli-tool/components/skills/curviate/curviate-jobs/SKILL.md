---
name: curviate-jobs
description: "Create, publish and manage classic LinkedIn job postings with the Curviate CLI, and read their applicants. Covers `job` (get, list, create, update, budget, publish, close) and `job applicants` / `job applicant get|resume`, the draft-then-publish flow, the subscription gate that stops a publish even on the free mode, and the read-back delay after an update. Use when drafting or updating a posting, pricing or publishing one, closing one, or pulling applicants and résumés."
version: 0.1.0
author: Curviate
license: MIT
tags: [LinkedIn, CLI, Agents, Sales, Recruiting, Outreach]
repository: https://github.com/Curviate/curviate-plugin
---

# Curviate: job postings and applicants

Every posting starts as a draft. Drafts are free and reversible; publishing is neither. The two
things that surprise agents here are that **a free publish is still subscription-gated** and that
**an update's read-back lags the write**.

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
  LinkedIn account owns the posting.**
- **`--preview` before every write**, and especially before a publish. On a read command it is
  refused with exit `2`.
- **`--json` on anything you parse**; **`--fields a,b,c`** to project; **`--verbose`** when a slim
  response looks suspiciously empty.
- **Put global flags at the end of the command.**
- **Branch on the exit code, never on prose.** See the table at the end.
- These are not retrieval-mode commands: `--mode`/`--max-age` are refused here with `unknown flag`,
  exit `2`. **`job publish --mode` is a different flag with the same name**: it selects a publishing
  publishing mode and can spend real money. See `curviate-profile` for retrieval mode.

## The commands

| Command | What it does | Confidence |
|---|---|---|
| `curviate job get <id>` | One public posting's full detail. Takes a job URL or a bare numeric id. No seat needed. | proven |
| `curviate job list --state <DRAFT\|OPEN\|CLOSED\|REVIEW\|SUSPENDED>` | Your own postings by state. `--state` is required. | proven |
| `curviate job create …` | Create a **draft**. Never publishes, never spends. | proven |
| `curviate job update <id> …` | Partial update to a posting you own; same flags as `create`. | proven |
| `curviate job budget <id>` | Price a publish before committing any money. | proven |
| `curviate job publish <id> --mode FREE\|PROMOTED\|PROMOTED_PLUS` | Publish a draft. `PROMOTED` and `PROMOTED_PLUS` spend real money and additionally require `--budget-currency` (ISO-4217), `--budget-amount` and `--budget-scope` (`DAILY` or `TOTAL`). | wired, never live-fired |
| `curviate job close <id>` | Stop a posting accepting applications. **Irreversible once listed.** | wired, never live-fired |
| `curviate job applicants <id>` | Applicants to a posting you own. | proven (shape only, exercised on a draft with no applicants) |
| `curviate job applicant get <id> <applicant_id>` | One applicant's full detail, including contact information. | proven (shape only) |
| `curviate job applicant resume <id> <applicant_id>` | Download an applicant's résumé. Binary, write it with `-o <file>`. | proven (shape only) |

### `job create`: the required set

`--description` (minimum 200 characters, enforced server-side), `--workplace-type`
(`ON_SITE|HYBRID|REMOTE`), `--location` (a `LOCATION` parameter id, resolved via
`curviate search parameters --type LOCATION`), `--employment-status`
(`FULL_TIME|PART_TIME|CONTRACT|TEMPORARY|OTHER|VOLUNTEER|INTERNSHIP`), `--apply-method`
(`linkedin` or `external`), plus a title and a company.

- Title: `--job-title` as free text, or `--job-title-id` for an existing LinkedIn title.
- Company: `--company` as free text, or `--company-id`.
- `--apply-method linkedin` requires `--notification-email`; `--apply-method external` requires
  `--website-url`.
- `--skills` takes comma-separated skill parameter ids and is optional.

Run `curviate job create --help` for the current required set before building a call.

### Traps

- **A publish is subscription-gated in practice, not just on the paid modes.** `--mode FREE` (the
  money-free mode) still returns `LINKEDIN_FEATURE_NOT_SUBSCRIBED`, exit `5`, on an account with no
  LinkedIn job-posting subscription. On that error nothing goes public and the draft stays a draft.
  Expect exit `5` unless you have confirmed the subscription; do not read it as a malformed request.
- **`publish` and `close` are wired, never live-fired.** Every test account run against this surface
  hit the subscription gate above before a posting ever went public, so a live `200` from either
  command has not been observed; `close`'s happy path is unreachable the same way, since nothing gets
  published to close. The response shapes are cross-checked against the substrate's own types rather
  than an observed call. The read and draft surface above `publish` (list/get/budget/create/update,
  plus the three applicant reads) does not depend on that subscription and is proven.
- **An update lands before the read-back reflects it.** `job update` returning exit `0` was applied,
  but its own response and an immediate `job get` can both still show the old value, while
  `job list` (the owner view, checked minutes later) shows the update did land. Do not conclude a
  silent no-op from a stale-looking immediate read.
- **`job list --state` filters client-side and says so on stderr.** LinkedIn's own state filter is
  best-effort, so the CLI re-fetches the unfiltered page walk and drops non-matching items itself,
  logging what it dropped. Read stdout for data and stderr for what was dropped, and note that
  `--all` may walk far more upstream pages than the filtered item count suggests.
- **`job close` is irreversible once the posting is listed.** Preview it, and be sure.
- **Price before you publish.** `job budget <id>` costs nothing and is the only way to know what a
  promoted publish will spend.

## A safe posting flow

```bash
curviate job create --job-title "…" --company "…" --workplace-type REMOTE \
  --location <loc_id> --employment-status FULL_TIME --description "$(cat jd.md)" \
  --apply-method linkedin --notification-email <email> --account <acc_id> --preview --json
# re-run without --preview to create the draft, then:
curviate job get <id> --account <acc_id> --json          # confirm the draft
curviate job budget <id> --account <acc_id> --json       # price it
curviate job publish <id> --mode FREE --account <acc_id> --preview --json
```

## Full command surface

<!-- generated: command surface, CLI 0.33.0 -->

Read from the CLI's own `--help` at version 0.33.0. Descriptions, traps and confidence
tags elsewhere in this skill are hand-written and carry the version they were established against.

Every command below that takes flags at all also accepts `--account`, `--api-key`, `--base-url`, `--beta`, `--fields`, `--json`, `--preview`, `--profile`, `--timeout`, `--verbose`.

| Command | Arguments | Flags |
|---|---|---|
| `curviate job get` | `ID` | *(none)* |
| `curviate job list` | *(none)* | `--limit`, `--cursor`, `--all`, `--max-pages`, `--page-delay`, `--state` *(required)* |
| `curviate job create` | *(none)* | `--job-title`, `--job-title-id`, `--company`, `--company-id`, `--workplace-type`, `--location`, `--employment-status`, `--description`, `--apply-method`, `--notification-email`, `--website-url`, `--skills` |
| `curviate job update` | `ID` | `--job-title`, `--job-title-id`, `--company`, `--company-id`, `--workplace-type`, `--location`, `--employment-status`, `--description`, `--apply-method`, `--notification-email`, `--website-url`, `--skills` |
| `curviate job budget` | `ID` | *(none)* |
| `curviate job publish` | `ID` | `--mode` *(required)*, `--budget-currency`, `--budget-amount`, `--budget-scope` |
| `curviate job close` | `ID` | *(none)* |
| `curviate job applicants` | `ID` | `--limit`, `--cursor`, `--all`, `--max-pages`, `--page-delay`, `--ratings` |
| `curviate job applicant get` | `ID` `APPLICANTID` | *(none)* |
| `curviate job applicant resume` | `ID` `APPLICANTID` | `-o, --output` |

<!-- /generated -->

## Exit codes to branch on here

| Code | Meaning | What to do |
|---|---|---|
| `1` | `INTERNAL` from the server itself: a genuine bug on the platform side. | Worth one retry; if it repeats it is a bug to report, not a state to work around. |
| `2` | Usage or invalid input, often raised before any network call: a missing required flag, a description under 200 characters, a location passed as a name rather than an id. | Fix the invocation. Never retry unchanged. |
| `4` | Not found: the posting does not exist, or is not yours. | Re-check the id and the acting account. |
| `5` | Three causes, one code: read `error.code`. `NO_ACTIVE_SEAT`: the account is on no active seat. `LINKEDIN_FEATURE_NOT_SUBSCRIBED`: LinkedIn itself lacks the feature. `BETA_NOT_ENABLED`: the operation is beta-gated and this workspace has not opted in. | Branch on `error.code`: the three fixes have nothing in common, and none is fixed by retrying unchanged. |
| `6` | `PLATFORM_RATE_LIMIT` and its siblings. Carries `retry_after` in whole seconds. A response naming `budgetRow` means only that row is paused; every other row on the account keeps working. | **Back off and retry** after that many seconds. On a named `budgetRow`, switch to other work on the account rather than backing off across the board. |
| `7` | Transient platform fault: a request that got no response at all (network error, DNS failure, timeout) or one that came back as something other than a valid API answer. Carries `retryLikelyToSucceed: true`. | Retry with backoff. |
| `11` | Billing: payment, a cancelled seat, or a subscription lock. `SUBSCRIPTION_BUSY` is retry-likely; check the envelope. | Resolve it in the dashboard. |
| `13` | `BUDGET_EXHAUSTED`: a safety rule of your own refused the action, not LinkedIn. Read `error.safetyReason`: `ceiling` means the row named in `error.budgetRow` hit its configured limit; `activity_window` means the account is outside the hours it works in (no `budgetRow` on that one). **Nothing reached LinkedIn and nothing was spent.** `reset_at` can be weeks out, and may be `null` where no clock frees it. | **Do not back off and retry.** `error.safetyHint.parameter` names the exact setting to change. Read `quotas[]` via `curviate account get <acc_id> --json`, then wait for the named reset or change that setting. |
