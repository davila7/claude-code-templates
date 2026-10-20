# Candidate Catalog

Mini-schemas for the 9 candidate tools in the WorkorAI MCP surface. Each
entry mirrors the runtime `inputSchema`/`outputSchema` exposed by the MCP
server (WorkorAI repo `mcp/src/tools/candidate-*.ts`). When a tool's
response shape changes, both layers move together — the MCP server schema
AND this catalog entry.

## Runtime Surface

Public (always callable):
- `request_access`

Visible but gated — callable with an active candidate key. Authorization
is **role + ACTIVE access**, NO per-tool scope: one candidate key calls
the whole surface (a legacy `[search_jobs, get_job]` key works on the new
tools too — no reissue needed). The two read tools below also carry their
legacy scope; the other seven are role-active only.

- `candidate.search_jobs` — ranked vacancy search
- `candidate.get_job` — full detail for one job
- `candidate.get_applications` — the caller's own applications
- `candidate.apply_to_job` — apply (reuses the evaluated interview)
- `candidate.accept_invitation` — accept an employer invite (→ APPLIED)
- `candidate.decline_invitation` — decline an invite (TERMINAL)
- `candidate.withdraw_application` — withdraw an active application
- `candidate.set_saved_job` — bookmark / un-bookmark a job
- `candidate.get_saved_jobs` — list bookmarked jobs

Not exposed:
- `candidate.get_profile` — **cut, never shipped** (it would have leaked
  password / full-profile fields via `getFullProfile`). The candidate
  reads their own profile on the web app, not over MCP.
- Employer tools are a separate role surface — see `employer-catalog.md`.
  They are visible in an anonymous `tools/list` but reject a candidate key
  at call time. They are NOT a planned part of the candidate surface.

## Anti-Enumeration & Idempotency (applies to all action tools)

- Every action tool keys off `jobId` and operates ONLY on the caller's own
  row. There is no candidate-supplied `userId` and no list-by-id surface to
  probe, so these are not enumeration vectors.
- For the job-targeting tools (`get_job`, `apply_to_job`,
  `accept_invitation`, `set_saved_job`) a missing job and a non-PUBLISHED job
  collapse to one `NOT_FOUND`, so a candidate cannot tell a
  DRAFT/CLOSED/ARCHIVED job from a non-existent one. For the
  application-response tools (`decline_invitation`, `withdraw_application`)
  `NOT_FOUND` instead means "no matching invite/application row" — they do
  not gate on the job's publish status.
- The write tools are **idempotent**: re-running a successful call returns
  success without double-applying. `set_saved_job` is a desired-state setter
  (`saved:true|false`), NOT a toggle — a retry never flips the state.

## Calling Order

Discovery → detail → action:

1. `candidate.search_jobs` — ranked vacancies. (Or `get_saved_jobs` /
   `get_applications` to work from the user's own lists.)
2. `candidate.get_job` — full detail for one `jobId` before acting.
3. Act: `apply_to_job`, `set_saved_job`, or respond to an invite
   (`accept_invitation` / `decline_invitation`); later
   `withdraw_application` to pull out.

Use `candidate.search_jobs` first unless a trusted `jobId` is already known.
Always inspect a job with `get_job` before applying.

## `candidate.search_jobs`

Inputs:
- `apiKey` (string, optional) — WorkorAI MCP key for in-session auth when
  the MCP client started anonymously
- `q` (string, optional) — free-text query
- `workModel` (`REMOTE | HYBRID | ON_SITE`, optional)
- `seniority` (`INTERN | JUNIOR | MIDDLE | SENIOR | LEAD | PRINCIPAL`, optional)
- `jobType` (`FULL_TIME | PART_TIME | CONTRACT | FREELANCE`, optional)
- `tier` (`best | good | weak`, optional) — match-quality band. OMIT for the full
  ranked list; start with `tier:'best'` for the strongest fits and cascade to
  `good`/`weak` only if needed (read `tierCounts`). Ignored on a free-text `q` /
  no-interview browse (no bands).
- `limit` (number, optional, default 20, max 100)
- `offset` (number, optional, default 0)

Behavior:
- Requires an authenticated candidate session or a valid `apiKey`.
- Returns published jobs only, SEMANTICALLY ranked for the authenticated
  candidate (embedding-based fit against their evaluated interview), with a
  per-job `matchExplanation` (the white-box "why").
- A free-text `q`, OR a candidate who has not completed an interview yet,
  instead BROWSES published jobs by recency — those rows carry NO fit score
  (`matchScore` is `null`, no bands); treat them as a browse list, not a ranking.

Returns:
- `ok: true`
- `filters: { q?, workModel?, seniority?, jobType?, tier?, limit, offset }`
- `page: { total, limit, offset, hasMore }`
- `tierCounts: { matched, unmatched, best, good, weak }` — band sizes for the
  cascade (all 0 on a `q` / no-interview browse).
- `jobs: MatchedJob[]` — each is a full job (see `get_job` fields) PLUS:
  `matchScore`, `matchExplanation?`, `matchedMustHaveSkills[]`,
  `matchedNiceToHaveSkills[]`, `missingMustHaveSkills[]`, `seniorityFit`,
  `matchReasons[]`. `seniorityFit` is ALWAYS `UNKNOWN` and `matchReasons` ALWAYS
  `[]` (the combiner has no seniority signal). `matchScore` is a number on the
  ranked path and `null` on the recency browse. `matchExplanation` (scored rows
  only) = `{ score, interviewScore|null, reliability, similarity, mustCoverage,
  matchedMust[], missingMust[], niceCoverage, matchedNice[], missingNice[],
  verifiedSkills[], verifiedUplift, web3Bonus, reliabilitySource,
  reliabilityValue, rationale }`.

Agent guidance:
- Explain recommendations from `matchScore` + matched/missing skills.
- Surface missing must-have skills as gaps to discuss, NOT rejections.
- Give the user two distinct links per recommendation: job page
  (`jobUrl`/`url`) and apply (`applicationUrl`/`applyUrl`). Never apply-only.
- Treat `jobId` as internal/debug metadata unless the user asks for it.
- Paginate with `offset` + `page.hasMore`; filter with the enum inputs.

## `candidate.get_job`

Inputs:
- `apiKey` (string, optional)
- `jobId` (string, required)

Behavior:
- Requires an authenticated candidate session or a valid `apiKey`.
- Returns one PUBLISHED job. A missing OR non-PUBLISHED job collapses to one
  `NOT_FOUND` (anti-enumeration).

Returns:
- `ok: true`
- `job:` — `id`, `jobId`, `url`, `jobUrl`, `applyUrl`, `applicationUrl`,
  `status` (`'PUBLISHED'`), `title`, `company { name, image }`, `salary|null`,
  `location|null`, `workModel`, `jobType`, `seniority`, `description|null`,
  `mustHaveSkills[]`, `niceToHaveSkills[]`, `perks[]`, `responsibilities[]`,
  `qualifications[]`, `createdAt`, `updatedAt`, `publishedAt|null`,
  `viewCount`, `applicationCount`

Errors:
- `jobId is required`
- `candidate.get_job: NOT_FOUND: <jobId>`

Agent guidance:
- Prefer this over re-searching once a `jobId` is known.
- Show `mustHaveSkills` vs the user's skills before recommending an apply.

## `candidate.get_applications`

Inputs:
- `apiKey` (string, optional)

Behavior:
- Lists the caller's OWN job applications, newest first. No `jobId` input,
  so it is not an enumeration surface.

Returns:
- `ok: true`
- `applications: [{ jobId, status, appliedAt, withdrawnAt|null,
  interviewScore|null, interviewEvaluationStatus|null,
  job: { title, salary, jobType, workModel, seniority, location, status } }]`
- `status` is the application status: `INVITED | APPLIED | WITHDRAWN | DECLINED`.
- `interviewScore` / `interviewEvaluationStatus` are null when the
  application has no source interview.

Agent guidance:
- Use to answer "where did I apply / what invites do I have". Branch on
  `status`: `INVITED` → offer accept/decline; `APPLIED` → offer withdraw;
  `DECLINED`/`WITHDRAWN` → terminal for that row.

## `candidate.apply_to_job`

Inputs:
- `apiKey` (string, optional)
- `jobId` (string, required)

Behavior:
- Applies the candidate to a PUBLISHED job, reusing their evaluated profile
  interview as evidence. **Idempotent** — re-applying succeeds; `reused` is
  `true` when an application row already existed.
- **Gated**: requires a completed + evaluated profile interview (the same
  no-score gate as key issuance — see `auth-flow.md`).

Returns:
- `ok: true`, `applicationId: string`, `reused: boolean`, `status: 'APPLIED'`

Errors:
- `candidate.apply_to_job: INVALID_INPUT: jobId is required`
- `candidate.apply_to_job: NOT_FOUND: <jobId>` (missing OR non-public job)
- `candidate.apply_to_job: GATE_LOCKED: complete a profile interview before applying`
- `candidate.apply_to_job: GATE_EVALUATING: your interview is still being evaluated — try again shortly`
- `candidate.apply_to_job: GATE_FAILED: your interview evaluation failed — retake the interview`

Agent guidance:
- On `GATE_LOCKED`/`GATE_EVALUATING`/`GATE_FAILED`, do NOT retry blindly —
  route the user to the matching onboarding step (`auth-flow.md`): finish
  the interview, wait for evaluation, or retake it.
- On `NOT_FOUND`, the vacancy is gone or unpublished — re-search.

## `candidate.accept_invitation`

Inputs:
- `apiKey` (string, optional)
- `jobId` (string, required)

Behavior:
- Accepts an employer's invitation (INVITED → APPLIED). **Idempotent** —
  accepting an already-accepted invite succeeds.

Returns:
- `ok: true`, `status: 'APPLIED'`

Errors:
- `candidate.accept_invitation: INVALID_INPUT: jobId is required`
- `candidate.accept_invitation: NOT_INVITED: <jobId>` (no open invitation —
  e.g. already withdrawn/declined)
- `candidate.accept_invitation: NOT_FOUND: <jobId>` (job/invite not found,
  or the job is no longer public)

Agent guidance:
- Confirm with the user before accepting — acceptance puts them in the
  employer's applicant funnel.

## `candidate.decline_invitation`

Inputs:
- `apiKey` (string, optional)
- `jobId` (string, required)

Behavior:
- Declines an employer's invitation (INVITED → DECLINED). **Idempotent**
  (declining again succeeds).
- ⚠️ **TERMINAL**: a DECLINED row blocks ANY re-invite from the employer.
  Only decline when the candidate is sure.

Returns:
- `ok: true`, `status: 'DECLINED'`

Errors:
- `candidate.decline_invitation: INVALID_INPUT: jobId is required`
- `candidate.decline_invitation: NOT_INVITED: <jobId>` (no open invitation)
- `candidate.decline_invitation: NOT_FOUND: <jobId>` (job/invite not found)

Agent guidance:
- Always confirm with the user before declining — surface the
  re-invite-blocking consequence. If they are merely unsure, suggest doing
  nothing (the invite stays open) instead of declining.

## `candidate.withdraw_application`

Inputs:
- `apiKey` (string, optional)
- `jobId` (string, required)

Behavior:
- Withdraws the candidate's active application (APPLIED → WITHDRAWN).
  **Idempotent** (withdrawing again succeeds).
- WITHDRAWN is the one state an employer CAN re-invite from (unlike
  DECLINED) — so withdrawing is the soft exit.

Returns:
- `ok: true`, `status: 'WITHDRAWN'`

Errors:
- `candidate.withdraw_application: INVALID_INPUT: jobId is required`
- `candidate.withdraw_application: NOT_APPLIED: <jobId>` (no active
  application — e.g. only an open invitation, or already declined)
- `candidate.withdraw_application: NOT_FOUND: <jobId>` (no application row
  for this job)

Agent guidance:
- On `NOT_APPLIED`, the row may be an open INVITED invite — use
  `decline_invitation` (if they want out) or `accept_invitation`, not
  withdraw.

## `candidate.set_saved_job`

Inputs:
- `apiKey` (string, optional)
- `jobId` (string, required)
- `saved` (boolean, required) — desired state: `true` bookmarks, `false`
  removes. **Idempotent desired-state, NOT a toggle.**

Behavior:
- Sets whether a PUBLISHED job is in the candidate's saved list. A retry
  with the same `saved` value never flips the state.

Returns:
- `ok: true`, `saved: boolean` (the resulting state)

Errors:
- `candidate.set_saved_job: INVALID_INPUT: jobId is required`
- `candidate.set_saved_job: INVALID_INPUT: saved (boolean) is required`
- `candidate.set_saved_job: NOT_FOUND: <jobId>` (missing OR non-public job)

Agent guidance:
- Always pass an explicit `saved` boolean — never assume the prior state.
  To "unsave", pass `saved:false`; to bookmark, `saved:true`.

## `candidate.get_saved_jobs`

Inputs:
- `apiKey` (string, optional)

Behavior:
- Lists the candidate's saved (bookmarked) jobs, newest first.
- **PUBLISHED-only**: a job saved earlier then closed/archived is omitted
  (the bookmark row persists, but the listing filters it out).

Returns:
- `ok: true`
- `savedJobs: [{ jobId, savedAt, title, salary, jobType, workModel,
  seniority, location }]`

Agent guidance:
- If a previously-saved job has vanished from the list, it was unpublished —
  not unsaved. Re-search for a live equivalent.
