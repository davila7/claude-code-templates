# Employer Catalog

Mini-schemas for the 19 employer tools in the WorkorAI MCP surface.

Each tool here mirrors the runtime `outputSchema` exposed by the MCP
server (see WorkorAI repo `mcp/src/tools/shared/{employer-applications,
employer-jobs,employer-candidates}.ts`). When a tool's response shape
changes, both layers move together — the MCP server schema AND this
catalog entry. See WorkorAI
`docs/plans/2026-05-29-workorai-skill-employer-update-design.md`
(Path D, dual-layer schema strategy).

## Runtime surface

Gated, requires `role === 'EMPLOYER'` on the MCP key:

Jobs lifecycle (8):
- `employer.list_jobs`
- `employer.get_job`
- `employer.create_job`
- `employer.update_job`
- `employer.publish_job`
- `employer.close_job`
- `employer.archive_job`
- `employer.delete_job`

Candidate discovery (4):
- `employer.search_candidates_for_job`
- `employer.search_candidates_by_query`
- `employer.get_candidate`
- `employer.get_candidate_evidence`

Invitations (3):
- `employer.invite_candidate`
- `employer.list_invitations`
- `employer.cancel_invitation`

Applicants review (4):
- `employer.list_applicants`
- `employer.set_review_status`
- `employer.get_applicant_detail`
- `employer.get_applicant_transcript`

## Jobs lifecycle

### `employer.list_jobs`

Inputs:
- `apiKey` (string, optional)
- `status` (string | string[], optional) — one or many of
  `DRAFT | PUBLISHED | CLOSED | ARCHIVED`
- `limit` (number, optional, default 50, max 100)
- `offset` (number, optional, default 0)

Behavior:
- Returns the caller's own jobs, paginated. Never crosses employer boundaries.
- Status filter is normalized (deduped, invalid values dropped).

Returns:
- `ok: true`
- `filters: { status?, limit, offset }`
- `page: { total, limit, offset, hasMore }`
- `jobs: EmployerJob[]` where each entry has: `id, employerId, status,
  title, seniority, salary, location, workModel, jobType, description,
  rawInput, dataSource, mustHaveSkills[], niceToHaveSkills[], perks[],
  responsibilities[], qualifications[], referralBonus, hiredCount,
  viewCount, applicationCount, createdAt, updatedAt, publishedAt,
  closedAt`

Errors:
- `INVALID_INPUT` — bad pagination values

Agent guidance:
- Default sort is `updatedAt desc`. Use `status: 'DRAFT'` to recover
  after a `create_job` client timeout (pick the most recent row).

### `employer.get_job`

Inputs:
- `apiKey` (optional), `jobId` (string, required)

Behavior:
- Returns one of the caller's jobs.
- Collapses NOT_FOUND and FORBIDDEN into the same NOT_FOUND.

Returns:
- `ok: true`
- `job: EmployerJob & { company: { name | null } }`

Errors:
- `INVALID_INPUT: jobId is required`
- `NOT_FOUND: <jobId>`

Agent guidance:
- Prefer this over `list_jobs` once a `jobId` is known.

### `employer.create_job`

Inputs:
- `apiKey` (optional)
- `rawText` (string, required, ≤10000 chars) — free-form job description.

Behavior:
- Synchronous Gemini AI parse. Latency 5-30 seconds. Persists a DRAFT
  job under the caller's employer.
- `dataSource: AI_PARSED`. The agent can then call `update_job` to
  refine fields and `publish_job` to make it live.

Returns:
- `ok: true`
- `job: EmployerJob & { company }` (same shape as `get_job`)

Errors:
- `INVALID_INPUT: rawText is required` / `rawText exceeds 10000 characters`
- `PARSE_FAILED: <gemini error>`
- `CONFLICT: <db error>`

Agent guidance:
- On client timeout, do NOT resubmit rawText (would create duplicate
  DRAFTs). Recover via `employer.list_jobs({ status: 'DRAFT' })` and
  pick the newest row.

### `employer.update_job`

Inputs:
- `apiKey` (optional)
- `jobId` (string, required)
- `fields` (object, required) — partial whitelist of 13 fields:
  `title, seniority, salary, location, workModel, jobType, description,
  mustHaveSkills[], niceToHaveSkills[], perks[], responsibilities[],
  qualifications[], referralBonus`

Behavior:
- Whitelist enforced; unknown fields rejected with INVALID_INPUT.
- Auto-flips `dataSource` to `USER_EDITED` on every update.
- `rawInput` (audit-only, set at create) is not editable.

Returns:
- `ok: true`
- `job: EmployerJob & { company }`

Errors:
- `INVALID_INPUT: jobId is required` / `fields not allowed: <names>` /
  `no fields to update`
- `NOT_FOUND: <jobId>`

Agent guidance:
- Use enum values from inputSchema. `seniority` is one of
  `INTERN | JUNIOR | MIDDLE | SENIOR | LEAD | PRINCIPAL`; `workModel`
  is `REMOTE | HYBRID | ON_SITE`; `jobType` is
  `FULL_TIME | PART_TIME | CONTRACT | FREELANCE`.

### `employer.publish_job`

Inputs: `apiKey` (optional), `jobId` (required).

Behavior:
- Transitions DRAFT → PUBLISHED. Sets `publishedAt`.

Returns: same as `get_job` (refreshed job).

Errors:
- `INVALID_INPUT`, `NOT_FOUND`, `CONFLICT: expected status DRAFT, found <X>`

Agent guidance:
- Use after `create_job` + optional `update_job`.

### `employer.close_job`

Inputs: `apiKey` (optional), `jobId` (required).

Behavior:
- Transitions PUBLISHED → CLOSED. Sets `closedAt`.

Returns: refreshed job.

Errors: `INVALID_INPUT`, `NOT_FOUND`, `CONFLICT: expected status PUBLISHED`.

### `employer.archive_job`

Inputs: `apiKey` (optional), `jobId` (required).

Behavior:
- Transitions CLOSED → ARCHIVED.

Returns: refreshed job.

Errors: `INVALID_INPUT`, `NOT_FOUND`, `CONFLICT: expected status CLOSED`.

### `employer.delete_job`

Inputs: `apiKey` (optional), `jobId` (required).

Behavior:
- DRAFT-only deletion. Removes the row permanently.

Returns:
- `ok: true`
- `jobId: string`

Errors: `INVALID_INPUT`, `NOT_FOUND`, `CONFLICT: expected status DRAFT`.

Agent guidance:
- For PUBLISHED jobs, use `close_job` then `archive_job` instead. Never
  call `delete_job` on a non-DRAFT row.

## Candidate discovery

### `employer.search_candidates_for_job`

Inputs:
- `apiKey` (optional)
- `jobId` (string, required)
- `sort` (`bestMatch` | `newest`, optional, default `bestMatch`)
- `tier` (`best` | `good` | `weak`, optional) — match-quality band filter. OMIT
  for the full ranked pool (back-compat). To shortlist, START with `tier:'best'`
  and cascade to `good` then `weak` ONLY if you need more — read `tierCounts` to
  decide. (Ignored on `sort:'newest'` — a recency browse has no bands.)
- `page` (number, optional, default 1)
- `pageSize` (number, optional, default 24, max 100)

Behavior:
- SEMANTICALLY ranks interviewed (embedding-gated, discoverable) candidates
  against the job's requirements and returns a per-candidate fit score
  (`matchScore`) AND a white-box `matchExplanation` (the "why"). Every
  interviewed candidate is discoverable — no privacy gate.
- Includes any existing application overlay (`applicationStatus`,
  `invitedAt`) when the candidate already touches this job.

Returns:
- `ok: true`
- `jobId: string`
- `page: { total, page, pageSize, hasMore }` — on a `tier`-filtered call `total`
  is the FULL pool; paginate WITHIN the band using `hasMore` (not `total`).
- `tierCounts: { matched, unmatched, best, good, weak }` — band sizes to plan the
  cascade. `matched` = cover ≥1 required skill, `unmatched` = none;
  `best+good+weak === matched` on a scored search (all bands 0 on a newest browse).
- `advisory?: { code: 'EMPTY_BEST_REVIEW_MUST_HAVES', message }` — OPTIONAL,
  present ONLY when NO candidate reached the Best tier (`tierCounts.best === 0`)
  but candidates exist below. The vacancy's must-have requirements may be strict
  enough that nobody is an exceptional match. RELAY `message` to the employer as a
  suggestion — they may move the less-critical must-haves to nice-to-have to widen
  the pool. A SUGGESTION only; never auto-edit the job.
- `entries: CandidateEntry[]` where each entry has: `id, displayName,
  avatarUrl, headline, location, seniority, summary, skills[],
  matchScore, matchedMustHaveSkills[], missingMustHaveSkills[],
  matchExplanation?, applicationStatus?, invitedAt?`
- `matchExplanation` (scored rows only) = `{ score, interviewScore|null,
  reliability, similarity, mustCoverage, matchedMust[], missingMust[],
  niceCoverage, matchedNice[], missingNice[], verifiedSkills[], verifiedUplift,
  web3Bonus, reliabilitySource, reliabilityValue, rationale }`.
  `verifiedSkills` = skills the candidate PROVED in their interview (lead your
  explanation with these; empty ≠ no interview — check `interviewScore`).
  `rationale` = a ready-to-quote plain-English sentence.

Errors:
- `INVALID_INPUT: jobId is required`
- `NOT_FOUND: <jobId>` (collapsed NOT_FOUND | FORBIDDEN — no existence leak)
- `NOT_INDEXED: <jobId>` / `NO_CATEGORIES: <jobId>` — the job isn't indexed for
  semantic search yet; re-save or republish it to index it, then retry

Agent guidance:
- To find the best hire: (1) `tier:'best'` for the strongest candidates, cascade
  via `tierCounts`; (2) explain your shortlist from each `matchExplanation` —
  cite `verifiedSkills` (proven in interview), `matchedMust`/`missingMust`, and
  the `rationale` — this is our white-box evidence, not a black box; (3) for the
  few you shortlist, call `employer.get_candidate_evidence(jobId, userId)` for the
  interview facts + Q&A to write a deeper comparative review.
- Use the `applicationStatus` overlay to skip already-applied/invited
  candidates when running a bulk invite.
- If `tier:'best'` (or `tierCounts.best`) is empty but candidates exist below,
  there is no exceptional match for this vacancy. Surface the `advisory` (or, if
  absent, say so plainly) and suggest the employer review the must-have skills —
  moving the less-critical ones to nice-to-have widens the search. Do NOT promote
  a Good/Weak candidate as if they were a Best.

### `employer.search_candidates_by_query`

Inputs:
- `apiKey` (optional)
- `query` (string, required, max 512 chars) — free-form natural-language
  description of who you're looking for (skills, role, stack)
- `page` (number, optional), `pageSize` (number, optional)

Behavior:
- SEMANTIC similarity search: the query is embedded and interviewed
  (embedding-gated, discoverable) candidates are ranked by closeness to it.
  No job context → this is a PRELIMINARY search with NO per-vacancy fit
  score and no match metadata. For a scored ranking, use
  `employer.search_candidates_for_job` with a job id.

Returns:
- `ok: true`
- `query: string`
- `page: { total, page, pageSize }`
- `entries: CandidateEntry[]` (same shape as above but without
  matchScore / matched/missing arrays)

Errors:
- `INVALID_INPUT: query is required`

Agent guidance:
- Use when the employer hasn't picked a vacancy yet (free-form hire).
  Pair with `list_jobs` or `create_job` before invite.

### `employer.get_candidate`

Inputs: `apiKey` (optional), `userId` (string, required).

Behavior:
- Returns one candidate's full discoverable profile plus the full
  `existingApplications` history on this employer's jobs (all 4
  statuses × 4 job statuses).
- `existingApplications` is the single source of truth for re-invite
  decisions.

Returns:
- `ok: true`
- `candidate: CandidateEntry & { interview, existingApplications[] }`
- `interview: { overallScore, summary, completedAt, evaluatedAt } | null`
- `existingApplications: { applicationId, jobId, jobTitle, jobStatus,
  status, createdAt, invitedAt|null, withdrawnAt|null, declinedAt|null }[]`

Errors:
- `INVALID_INPUT: userId is required`
- `NOT_FOUND: <userId>` (collapsed: missing user OR non-discoverable
  privacy OR no matching profile)

Agent guidance:
- ALWAYS call this before `invite_candidate` when the candidate has
  any prior interaction with the employer (the entries explain why a
  re-invite might be blocked):
  - WITHDRAWN: re-invite succeeds (service UPDATEs the row).
  - DECLINED: terminal — do not re-invite.
  - INVITED: already pending, do nothing.
  - APPLIED: already in funnel, route to `list_applicants` not invite.

### `employer.get_candidate_evidence`

Inputs: `apiKey` (optional), `jobId` (string, required), `userId` (string, required).

Behavior:
- JOB-SCOPED interview EVIDENCE for ONE candidate against ONE of your published
  jobs — the white-box basis to explain WHY a candidate ranks where they do. Use
  it AFTER `search_candidates_for_job`: shortlist with the scorecard, then read the
  evidence here for the few you care about and write your own comparative review.
- Same data + gate as the in-app deep review (you must OWN the PUBLISHED job; the
  candidate must be in that job's searchable pool). The candidate-authored text is
  size-budgeted + sanitized.

Returns:
- `ok: true`
- `evidence: { candidateId, headline, resumeSummary, experienceYears,
  facts[], interview, github, linkedin, truncation[] }`
  - `facts: { claim, factScore, mustLinked, qas: { question, answer }[] }[]` —
    what the candidate claimed + the interview Q&A behind it; `mustLinked` flags a
    fact tied to one of THIS job's required skills.
  - `interview: { interviewId, overallScore, summary } | null` (null = no
    evaluated interview → `facts` is `[]`).
  - `github: { trustRank, web3Repos, mergedPrestigeLanguages[] } | null`,
    `linkedin: { historyCoherence, recognizedCerts } | null`.
  - `truncation[]` — which sections were budget-trimmed (be honest about gaps).

Errors:
- `INVALID_INPUT: jobId and userId are required`
- `NOT_FOUND: <userId>` (collapsed: missing/foreign/unpublished job OR the
  candidate is not in that job's searchable pool — no existence leak)

Agent guidance:
- This is the heavy artefact: call it ONLY for the handful you shortlisted from
  `search_candidates_for_job` (not the whole list). Ground your verdict in the
  `facts`/`qas` + the `matchExplanation` from the search row.

## Invitations

### `employer.invite_candidate`

Inputs:
- `apiKey` (optional)
- `jobId` (string, required)
- `candidateUserId` (string, required)

Behavior:
- Creates a `JobApplication { status: INVITED, invitedById: <employer> }`
  for the (candidate, job) pair.
- Re-invite after WITHDRAWN: the service UPDATEs the existing row back
  to INVITED (same applicationId is preserved).
- All other prior statuses (INVITED/APPLIED/DECLINED) block.

Returns:
- `ok: true`
- `applicationId: string`
- `status: 'INVITED'`

Errors:
- `INVALID_INPUT: jobId is required` / `candidateUserId is required`
- `INVITE_BLOCKED: <reason>` — 5 sub-reasons:
  - `JOB_NOT_FOUND` (job missing OR owned by a different employer — the
    two collapse so you cannot probe foreign jobIds; anti-enumeration)
  - `JOB_NOT_PUBLISHED` (your job is in DRAFT/CLOSED/ARCHIVED)
  - `CANDIDATE_NOT_FOUND` (user missing or role ≠ CANDIDATE)
  - `NOT_DISCOVERABLE` (candidate is not in the searchable pool — no
    completed-and-ingested profile interview, so no embedding to match.
    Every interviewed candidate is discoverable; there is NO privacy opt-out
    gate)
  - `INVITE_NOT_ALLOWED` (existing INVITED/APPLIED/DECLINED row)

Agent guidance:
- On `INVITE_NOT_ALLOWED`, follow up with `employer.get_candidate` to
  inspect `existingApplications` and tell the user which prior status
  is blocking.

### `employer.list_invitations`

Inputs: `apiKey` (optional), `jobId` (string, required).

Behavior:
- Lists pending invitations on a job (status = INVITED, not yet
  accepted/declined/withdrawn).

Returns:
- `ok: true`
- `jobId: string`
- `invitations: { applicationId, invitedAt, candidate: { userId,
  displayName, headline, avatarUrl, location } }[]`

Errors:
- `INVALID_INPUT: jobId is required`
- `NOT_FOUND: <jobId>` (collapsed)

Agent guidance:
- Use to remind employers of pending invites before they invite again.
  Once a candidate accepts, the row moves to `list_applicants` with
  `source: 'INVITED'`.

### `employer.cancel_invitation`

Inputs:
- `apiKey` (optional)
- `jobId` (string, required)
- `candidateUserId` (string, required)

Behavior:
- Cancels a pending invitation (only valid while status = INVITED).
- After accept/decline/withdraw, this errors with `NOT_INVITED`.

Returns:
- `ok: true`
- `jobId: string`
- `candidateUserId: string`

Errors:
- `INVALID_INPUT`
- `NOT_INVITED: <candidateUserId>` (status changed already)
- `NOT_FOUND: <jobId>` (collapsed)

## Applicants review

### `employer.list_applicants`

Inputs: `apiKey` (optional), `jobId` (string, required).

Behavior:
- Returns the applicant funnel for a job. Includes both organic
  applicants (`source: 'APPLIED'`) and candidates that accepted an
  earlier invitation (`source: 'INVITED'`, identified by
  `invitedById` having been set).
- Excludes DECLINED rows from the funnel view (those live in invite
  history).
- Contact gating: `contact` is `null` when `reviewStatus` is below
  SHORTLISTED. The fields are not even transmitted to the client.

Returns:
- `ok: true`
- `jobId: string`
- `applicants: { applicationId, status, reviewStatus, appliedAt,
  source ('APPLIED'|'INVITED'),
  candidate: { userId, displayName, headline, avatarUrl, location },
  interview: { overallScore, summary },
  contact: { email|null, phone|null, linkedinUrl|null, githubUrl|null,
  websiteUrl|null } | null }[]`

Errors:
- `INVALID_INPUT: jobId is required`
- `NOT_FOUND: <jobId>` (collapsed)

Agent guidance:
- To unlock contact for a candidate, call
  `set_review_status(applicationId, 'SHORTLISTED'|'HIRED')` first.

### `employer.set_review_status`

Inputs:
- `apiKey` (optional)
- `applicationId` (string, required)
- `reviewStatus` (`NEW|REVIEWING|SHORTLISTED|REJECTED|HIRED`, required)

Behavior:
- Updates the employer review state on an application. Independent of
  the candidate `status` (INVITED/APPLIED/WITHDRAWN/DECLINED).
- SHORTLISTED and HIRED unlock contact in subsequent
  `list_applicants` and `get_applicant_detail` calls.
- INVITED applications cannot be reviewed (candidate hasn't accepted).

Returns:
- `ok: true`
- `applicationId: string`
- `reviewStatus: <new value>`

Errors:
- `INVALID_INPUT: applicationId is required` / `reviewStatus must be
  one of NEW, REVIEWING, SHORTLISTED, REJECTED, HIRED`
- `NOT_FOUND: <applicationId>` (collapsed)
- `CONFLICT: WITHDRAWN` (candidate left; nothing to review)
- `CONFLICT: NOT_APPLIED` (status is still INVITED — candidate has
  not accepted the invitation yet)

Agent guidance:
- On NOT_APPLIED, explain to the user that the candidate is still
  pending acceptance and review controls activate only after accept.
- The default move on a fresh APPLIED row is `REVIEWING` (the UI
  auto-advances when the employer opens the candidate card; the API
  does not auto-advance).

### `employer.get_applicant_detail`

Inputs: `apiKey` (optional), `applicationId` (string, required).

Behavior:
- Returns the full applicant evidence bundle: resume (sanitized),
  github analysis, linkedin analysis, interview overview, and the
  current status pair. Transcript is intentionally stripped — call
  `get_applicant_transcript` for the verbatim conversation.
- Internal flags (`contactUnlocked`, `resumeFilePath`,
  `resumeUploadedAt`, `isProfileInitialized`) are not exposed.

Returns:
- `ok: true`
- `detail: { applicationId, jobId, jobTitle, status, reviewStatus,
  appliedAt, resumeAvailable: boolean, resume: object (contact fields
  blanked when reviewStatus < SHORTLISTED), github: object|null,
  linkedin: object|null,
  interview: { overallScore, summary, facts[] } | null }`

Errors:
- `INVALID_INPUT: applicationId is required`
- `NOT_FOUND: <applicationId>` (collapsed)

Agent guidance:
- For contact info, advance the application to SHORTLISTED or HIRED
  first via `set_review_status`, then re-read.

### `employer.get_applicant_transcript`

Inputs: `apiKey` (optional), `applicationId` (string, required).

Behavior:
- Returns the verbatim conversation turns from the candidate's profile
  interview. Same ownership gate as the UI download button.

Returns:
- `ok: true`
- `applicationId: string`
- `transcript: { role: 'assistant'|'user', text: string }[]`

Errors:
- `INVALID_INPUT: applicationId is required`
- `NOT_FOUND: <applicationId>` (collapsed)

Agent guidance:
- Combine with `get_applicant_detail` to give the employer a full
  evidence view. The transcript can be long — the agent should
  summarize on demand, not dump verbatim.
