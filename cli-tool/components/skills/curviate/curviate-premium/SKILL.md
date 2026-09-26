---
name: curviate-premium
description: "Drive LinkedIn Sales Navigator and Recruiter through the Curviate CLI. Covers `sales-nav` (search, profile, message, lead and account lists, save-lead, save-account) and `recruiter` (projects, pipeline, talent-search, save-candidate, project jobs, applicants, message, profile, search), and what can refuse them: the LinkedIn subscription on the connected account, the Curviate seat, and the beta-operations gate. These commands carry no Curviate add-on paywall. Use when working a Sales Navigator or Recruiter seat, or when diagnosing why a premium command failed."
version: 0.1.0
author: Curviate
license: MIT
tags: [LinkedIn, CLI, Agents, Sales, Recruiting, Outreach]
repository: https://github.com/Curviate/curviate-plugin
---

# Curviate: Sales Navigator and Recruiter

Sales Navigator and Recruiter are **no longer gated by a separate Curviate add-on**: there is one paid
subscription and one seat, and these commands carry no extra Curviate paywall. What can still refuse
them is LinkedIn's own subscription on the connected account, and, where a workspace has not opted
into beta operations, the beta gate.

Every command here is **badged beta**. That badge is a truth claim about stability, not a refusal:
the beta-gated set is empty at launch, so these commands are callable today. If that changes, the
refusal is `BETA_NOT_ENABLED` and the fix is entirely yours; see Gates below, including what that
refusal actually looks like at this CLI version.

Command surface established against CLI `0.33.0`.

## Before any command

```bash
npm install -g @curviate/cli && curviate --version    # needs Node 18 or newer
curviate login --api-key <key>                        # or export CURVIATE_API_KEY
curviate account list --json                          # the acc_id for --account
```

- **`curviate profile subscription --json` reads what LinkedIn grants** the connected account:
  `has_premium` and the plan. A free account is a valid result, not an error. It tells you nothing
  about your Curviate seat, and it is the read to do before assuming a Recruiter command will work.
- **`--profile <name>` picks the stored credential set; `--account <acc_id>` picks which connected
  LinkedIn account's seat is used.** A tenant can hold one subscribed account among several.
- **`--preview` before every write.** It renders the resolved request without sending. On a read
  command it is refused with exit `2`.
- **`--json` on anything you parse**; **`--fields a,b,c`** to project; **`--verbose`** when a slim
  response looks suspiciously empty.
- **Put global flags at the end of the command.**
- **Branch on the exit code, never on prose.** See the table at the end.
- These are not retrieval-mode commands: `--mode`/`--max-age` are refused with `unknown flag`,
  exit `2`, with one exception that is not retrieval either. **`recruiter job publish` has a
  required `--mode FREE|PROMOTED|PROMOTED_PLUS`**, the same publishing flag `job publish` carries,
  and `PROMOTED`/`PROMOTED_PLUS` spend real money. A retrieval value there is refused at exit `2`.

## Gates: what can refuse these commands

| Refusal | `error.code` | Exit | What fixes it |
|---|---|---|---|
| The account is not on an active seat | `NO_ACTIVE_SEAT` | `5` | Attach the account to a seat (freeing or adding capacity if none is spare), then retry. A seat is required for **every** account-scoped command, not just these. |
| The LinkedIn account lacks the subscription | `LINKEDIN_FEATURE_NOT_SUBSCRIBED` | `5` | Activate Sales Navigator or Recruiter **on LinkedIn**. Reconnecting the account will not help. |
| The workspace has not opted into beta operations | `BETA_NOT_ENABLED` | `5` | A human turns on "Allow beta operations" in Settings. Nothing is missing from the seat or from LinkedIn; an unchanged retry is refused identically. |

Read `error.code`; three causes share exit `5` and their fixes have nothing in common.



**Beta consent is an act a person performs**, so no CLI command grants it persistently: someone
turns on "Allow beta operations" in Settings, or a caller sends `PATCH /v1/tenant/beta` over REST.

**For one call, use the global `--beta` flag.** It allows beta operations for that invocation only
and persists nothing; `--beta=false` withholds consent explicitly. A malformed value is a usage
error, exit `2`. So an unattended run that must not depend on a workspace setting can pass `--beta`
per call rather than requiring someone to have flipped the toggle first.

## Validate the request shape first

**An `INVALID_REQUEST` / exit `2` on a premium command says nothing about entitlement.** Request
validation runs before every entitlement check, so exit `2` means the request itself is malformed,
whatever your seat, subscription or beta-consent state. Fix the request.

The converse holds regardless of version: a well-formed request that is refused is refused by a
gate, and exit `2` is never one of those answers. Which gate you can *name* depends on the client:
`LINKEDIN_FEATURE_NOT_SUBSCRIBED` arrives readable at exit `5`, while the seat and beta refusals
arrive as `INTERNAL` at exit `1` on this version (see Gates). Either way the split holds: exit `2`
is a shape problem, and an entitlement problem is never exit `2`.

*Earlier guidance here said the opposite: that an exit `2` on a premium command was worth reading as
a hidden entitlement failure. That was wrong. The observation behind it was real, but those requests
were malformed in a way the caller could not see, and the entitlement was blamed for it.*

## `sales-nav`

| Command | What it does | Confidence |
|---|---|---|
| `curviate sales-nav search people` | Search Sales Navigator member profiles. | wired, never live-fired |
| `curviate sales-nav search companies` | Search Sales Navigator companies. | wired, never live-fired |
| `curviate sales-nav search parameters --type <T>` | Resolve Sales Navigator filter ids. | wired, never live-fired |
| `curviate sales-nav search "<pasted URL>"` | Run a pasted Sales Navigator search or list URL directly. | wired, never live-fired |
| `curviate sales-nav profile <identifier>` | An enriched member profile through the Sales Navigator lens. | wired, never live-fired |
| `curviate sales-nav message new --to <recipient> --subject "<s>" "<text>"` | Start a Sales Navigator chat. Write. | wired, never live-fired |
| `curviate sales-nav lead-lists` | The saved-lead (member) lists on the seat. | wired, never live-fired |
| `curviate sales-nav browse-lead-list <list_id>` | The leads saved in one list. | wired, never live-fired |
| `curviate sales-nav save-lead <user_id> --list <list_id>` | Save a member into a lead list. Write. | wired, never live-fired |
| `curviate sales-nav account-lists` | The saved-account (company) lists on the seat. | wired, never live-fired |
| `curviate sales-nav browse-account-list <list_id>` | The companies saved in one list. | wired, never live-fired |
| `curviate sales-nav save-account <company_id> --list <list_id>` | Save a company into an account list. Write. | wired, never live-fired |

Sales Navigator filter ids are **not** interchangeable with the classic ones from
`curviate search parameters`; resolve them through `sales-nav search parameters`.

## `recruiter`

| Command | What it does | Confidence |
|---|---|---|
| `curviate recruiter search people` | Search Recruiter member profiles. | wired, never live-fired |
| `curviate recruiter search parameters --source <s> --type <T>` | Resolve Recruiter filter ids. Source-scoped, and a POST. | wired, never live-fired |
| `curviate recruiter search "<pasted URL>"` | Run a pasted Recruiter search, talent-pool or applicant URL directly. | wired, never live-fired |
| `curviate recruiter profile <identifier>` | An enriched member profile through the Recruiter lens. | wired, never live-fired |
| `curviate recruiter message new --to <recipient> --subject "<s>" --signature "<sig>" "<text>"` | Start a Recruiter chat. Write. | wired, never live-fired |
| `curviate recruiter projects` | Hiring projects on the seat. | wired, never live-fired |
| `curviate recruiter project <project_id>` | One project. | wired, never live-fired |
| `curviate recruiter project <project_id> update` | Edit a project's configuration. All fields optional; omitted fields are unchanged. Write. | wired, never live-fired |
| `curviate recruiter pipeline <project_id>` | Candidates in a project's pipeline. | wired, never live-fired |
| `curviate recruiter talent-search <project_id> --channel-id <id>` | Search a project's talent pool. | wired, never live-fired |
| `curviate recruiter save-candidate <project_id> --stage-id <id> --candidate-id <id>` | Save a candidate into a pipeline stage. Write. | wired, never live-fired |
| `curviate recruiter applicants <project_id> --channel-id <id>` | Applicants in a project's talent pool. | wired, never live-fired |
| `curviate recruiter applicant resume <project_id> <applicant_id>` | Download an applicant's résumé. Binary, write it with `-o <file>`. | wired, never live-fired |
| `curviate recruiter jobs` | Recruiter job postings. | wired, never live-fired |
| `curviate recruiter job get <job_id>` | Any public posting through the Recruiter lens, not only your own. | wired, never live-fired |
| `curviate recruiter job create --project-name "<name>"` | Create a posting draft, opening a new hiring project. Write. | wired, never live-fired |
| `curviate recruiter job publish <project_id> <job_id> --mode FREE\|PROMOTED\|PROMOTED_PLUS` | Publish a draft. `PROMOTED` and `PROMOTED_PLUS` **spend real money** and require `--budget-amount`, `--budget-currency` and `--budget-scope`. Write. | wired, never live-fired |
| `curviate recruiter job close <project_id> <job_id>` | Stop a project's posting accepting applications. **Irreversible once listed.** Write. | wired, never live-fired |
| `curviate recruiter project-job get <project_id>` | The single posting attached to a project (a `404` when none is). | wired, never live-fired |
| `curviate recruiter project-job create <project_id>` | Create a draft attached to an existing project. Write. | wired, never live-fired |
| `curviate recruiter project-job budget <project_id> <job_id>` | Price a publish of that posting. | wired, never live-fired |
| `curviate recruiter project-job update <project_id> <job_id>` | Partial update to that posting. Write. | wired, never live-fired |

A project is the organising unit: a project holds one job posting, one pipeline and one talent pool.
`recruiter job create` opens a new project; `recruiter project-job create` attaches a draft to a
project that already exists.

## Full command surface

<!-- generated: command surface, CLI 0.33.0 -->

Read from the CLI's own `--help` at version 0.33.0. Descriptions, traps and confidence
tags elsewhere in this skill are hand-written and carry the version they were established against.

Every command below that takes flags at all also accepts `--account`, `--api-key`, `--base-url`, `--beta`, `--json`, `--preview`, `--profile`, `--timeout`, `--verbose`.

| Command | Arguments | Flags |
|---|---|---|
| `curviate sales-nav message new` | `TEXT` | `--to` *(required)*, `--subject` *(required)*, `--attach`, `--voice`, `--video` |
| `curviate sales-nav search` | `URL` | `--fields`, `--limit`, `--cursor`, `--all`, `--max-pages`, `--page-delay` |
| `curviate sales-nav search people` | *(none)* | `--fields`, `--limit`, `--cursor`, `--all`, `--max-pages`, `--page-delay`, `--keywords`, `--filters`, `--filters-file`, `--first-name`, `--last-name`, `--groups`, `--profile-language` |
| `curviate sales-nav search companies` | *(none)* | `--fields`, `--limit`, `--cursor`, `--all`, `--max-pages`, `--page-delay`, `--keywords`, `--filters`, `--filters-file` |
| `curviate sales-nav search parameters` | *(none)* | `--fields`, `--limit`, `--cursor`, `--type` *(required)*, `--keywords` |
| `curviate sales-nav profile` | `IDENTIFIER` | `--fields` |
| `curviate sales-nav save-lead` | `USERID` | `--list` *(required)* |
| `curviate sales-nav account-lists` | *(none)* | `--fields`, `--limit`, `--cursor`, `--all`, `--max-pages`, `--page-delay` |
| `curviate sales-nav lead-lists` | *(none)* | `--fields`, `--limit`, `--cursor`, `--all`, `--max-pages`, `--page-delay` |
| `curviate sales-nav browse-account-list` | `LISTID` | `--fields`, `--limit`, `--cursor`, `--all`, `--max-pages`, `--page-delay`, `--filter`, `--sort-by`, `--sort-order` |
| `curviate sales-nav browse-lead-list` | `LISTID` | `--fields`, `--limit`, `--cursor`, `--all`, `--max-pages`, `--page-delay`, `--spotlight`, `--sort-by`, `--sort-order` |
| `curviate sales-nav save-account` | `COMPANYID` | `--list` *(required)* |
| `curviate recruiter message new` | `TEXT` | `--to` *(required)*, `--subject` *(required)*, `--signature` *(required)*, `--attach`, `--voice`, `--video` |
| `curviate recruiter profile` | `IDENTIFIER` | `--fields` |
| `curviate recruiter search` | `URL` | `--fields`, `--limit`, `--cursor`, `--all`, `--max-pages`, `--page-delay` |
| `curviate recruiter search people` | *(none)* | `--fields`, `--limit`, `--cursor`, `--all`, `--max-pages`, `--page-delay`, `--keywords`, `--filters`, `--filters-file`, `--employment-type`, `--function`, `--profile-language` |
| `curviate recruiter search parameters` | *(none)* | `--fields`, `--limit`, `--cursor`, `--source` *(required)*, `--type` *(required)*, `--keywords`, `--project-id`, `--stage-id` |
| `curviate recruiter projects` | *(none)* | `--fields`, `--limit`, `--cursor`, `--all`, `--max-pages`, `--page-delay` |
| `curviate recruiter project` | `PROJECTID` | `--fields` |
| `curviate recruiter project update` | `PROJECTID` | `--fields`, `--name`, `--visibility`, `--description`, `--company-id`, `--company-name`, `--job-title-id`, `--job-title`, `--location`, `--seniority-level` |
| `curviate recruiter pipeline` | `PROJECTID` | `--fields`, `--limit`, `--cursor`, `--all`, `--max-pages`, `--page-delay`, `--keywords`, `--stage-id`, `--sort-by`, `--spotlights` |
| `curviate recruiter project-job` | `PROJECTID` | `--fields` |
| `curviate recruiter project-job get` | `PROJECTID` | `--fields` |
| `curviate recruiter project-job create` | `PROJECTID` | `--fields`, `--body-file`, `--body`, `--job-title-id`, `--job-title`, `--company-id`, `--company-name`, `--workplace-type`, `--location`, `--employment-status`, `--seniority-level`, `--description`, `--industry`, `--job-function`, `--apply-method`, `--notification-email`, `--website-url` |
| `curviate recruiter project-job budget` | `PROJECTID` `JOBID` | `--fields` |
| `curviate recruiter project-job update` | `PROJECTID` `JOBID` | `--fields`, `--body-file`, `--body`, `--job-title-id`, `--job-title`, `--company-id`, `--company-name`, `--workplace-type`, `--location`, `--employment-status`, `--seniority-level`, `--description`, `--industry`, `--job-function`, `--apply-method`, `--notification-email`, `--website-url` |
| `curviate recruiter talent-search` | `PROJECTID` | `--fields`, `--limit`, `--cursor`, `--all`, `--max-pages`, `--page-delay`, `--channel-id` *(required)*, `--keywords`, `--filters`, `--filters-file` |
| `curviate recruiter save-candidate` | `PROJECTID` | `--stage-id` *(required)*, `--candidate-id` *(required)* |
| `curviate recruiter applicants` | `PROJECTID` | `--fields`, `--limit`, `--cursor`, `--channel-id` *(required)* |
| `curviate recruiter jobs` | *(none)* | `--fields`, `--limit`, `--cursor`, `--all`, `--max-pages`, `--page-delay` |
| `curviate recruiter job create` | *(none)* | `--body-file`, `--body`, `--job-title-id`, `--job-title`, `--company-id`, `--company-name`, `--workplace-type`, `--location`, `--employment-status`, `--seniority-level`, `--description`, `--industry`, `--job-function`, `--apply-method`, `--notification-email`, `--website-url`, `--project-name` *(required)* |
| `curviate recruiter job publish` | `PROJECTID` `JOBID` | `--fields`, `--mode` *(required)*, `--budget-currency`, `--budget-amount`, `--budget-scope` |
| `curviate recruiter job close` | `PROJECTID` `JOBID` | `--fields` |
| `curviate recruiter job get` | `JOBID` | `--fields` |
| `curviate recruiter applicant` | `PROJECTID` `APPLICANTID` | `--fields` |
| `curviate recruiter applicant resume` | `PROJECTID` `APPLICANTID` | `--fields`, `-o, --output` |

<!-- /generated -->

## Exit codes to branch on here

| Code | Meaning | What to do |
|---|---|---|
| `1` | `INTERNAL` from the server itself: a genuine bug on the platform side. | Worth one retry; if it repeats it is a bug to report, not a state to work around. |
| `2` | `INVALID_REQUEST`, the request shape is wrong. | Fix the request. Validation runs before every entitlement check, so this says **nothing** about your seat, subscription or beta consent. |
| `4` | Not found: a wrong project, list or member identifier. | Re-resolve the id. |
| `5` | Three causes, one code: read `error.code`. `NO_ACTIVE_SEAT`: the account is on no active seat. `LINKEDIN_FEATURE_NOT_SUBSCRIBED`: LinkedIn itself lacks the feature. `BETA_NOT_ENABLED`: the operation is beta-gated and this workspace has not opted in. | Branch on `error.code`: the three fixes have nothing in common, and none is fixed by retrying unchanged. |
| `6` | `PLATFORM_RATE_LIMIT` and its siblings. Carries `retry_after` in whole seconds. A response naming `budgetRow` means only that row is paused; every other row on the account keeps working. | **Back off and retry** after that many seconds. On a named `budgetRow`, switch to other work on the account rather than backing off across the board. |
| `7` | Transient platform fault: a request that got no response at all (network error, DNS failure, timeout) or one that came back as something other than a valid API answer. Carries `retryLikelyToSucceed: true`. | Retry with backoff. |
| `11` | Billing: payment, a cancelled seat, or a subscription lock. | Resolve it in the dashboard. |
| `13` | `BUDGET_EXHAUSTED`: a safety rule of your own refused the action, not LinkedIn. Read `error.safetyReason`: `ceiling` means the row named in `error.budgetRow` hit its configured limit; `activity_window` means the account is outside the hours it works in (no `budgetRow` on that one). **Nothing reached LinkedIn and nothing was spent.** `reset_at` can be weeks out, and may be `null` where no clock frees it (an InMail allowance, for instance, is regranted on LinkedIn's own schedule). | **Do not back off and retry.** `error.safetyHint.parameter` names the exact setting to change. Read `quotas[]` via `curviate account get <acc_id> --json`, then wait for the named reset or change that setting. |
