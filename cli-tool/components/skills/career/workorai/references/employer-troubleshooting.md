# Employer Troubleshooting

Scenarios on the employer MCP surface. For candidate-side issues, see
`troubleshooting.md` (cross-role) and the candidate flow in
`auth-flow.md`.

## Employer tool call fails with "requires employer authentication"

Employer tools are always visible in `tools/list` (visible-but-gated),
so a missing tool is NOT the signal — a failed *call* is. An employer
tool invoked without a valid EMPLOYER key returns
`employer.<tool> requires employer authentication. Provide apiKey with
a WorkorAI MCP key...`.

Cause: no key was passed, the key is candidate-scoped, the key is
revoked, or the underlying user is not an EMPLOYER.

Fix: ask the user to open
`https://workorai.com/employer/dashboard`, locate the Employer MCP
card, and copy or generate the key. Then save with:

```bash
node scripts/credential-store.mjs save --best-effort --role=employer
```

Subsequent calls use that key as the `apiKey` argument on every
`employer.*` tool — no MCP reconnect required.

## Employer tools missing entirely from tools/list

If `employer.*` tools do not appear in `tools/list` at all (only
`request_access` + the candidate tools), the client is connected to
an OLDER MCP deployment that predates the visible-but-gated employer
surface, or the session is stale. Reconnect to the latest deployment.
This is a deployment/version issue, not a key issue — a current
deployment lists all 28 tools anonymously (`request_access` + 9
candidate + 18 employer).

## INVITE_BLOCKED: INVITE_NOT_ALLOWED

Cause: there is already a `JobApplication` row for this (candidate, job)
pair. Statuses INVITED / APPLIED / DECLINED all block. WITHDRAWN is the
only re-invite path and goes through automatically — the service
UPDATEs the row back to INVITED.

Fix:
1. Call `employer.get_candidate({ userId })` and inspect
   `existingApplications` for the (jobId) entry.
2. Interpret:
   - DECLINED → terminal. Do not re-invite. Suggest a different vacancy.
   - INVITED → already pending. Wait for the candidate to accept, or
     `employer.cancel_invitation` and re-invite later.
   - APPLIED → already in the funnel. Use `employer.list_applicants`
     instead of `invite_candidate`.

## INVITE_BLOCKED: NOT_DISCOVERABLE

Cause: the candidate is not in the searchable pool. The single
discoverability gate is a WHOLE candidate embedding, produced only after
a profile interview both completes AND ingests. No completed-and-ingested
interview → no embedding → not invitable. There is NO privacy opt-out and
NO separate matching-profile gate (search == invite: anyone you can find
in `search_candidates_*`, you can invite).

Fix: explain the candidate cannot be invited yet — they must finish their
profile interview on the WorkorAI side. If the candidate DID appear in a
search result, retry; a freshly-ingested embedding may have lagged the
search index briefly.

## INVITE_BLOCKED: JOB_NOT_PUBLISHED

Cause: the job exists but is in DRAFT, CLOSED, or ARCHIVED status.

Fix: call `employer.publish_job({ jobId })` if the user actually wants
to invite candidates against this vacancy.

## set_review_status: CONFLICT: NOT_APPLIED

Cause: the application's `status` is INVITED. The candidate has not
accepted the invitation yet. Review controls (NEW/REVIEWING/SHORTLISTED/
REJECTED/HIRED) are decoupled from the invitation acceptance and are
not allowed on pending invites.

Fix: explain the gating to the user. Wait for the candidate to accept;
when they do, the row appears in `list_applicants` with `source:
'INVITED'` and is reviewable.

## set_review_status: CONFLICT: WITHDRAWN

Cause: the candidate withdrew the application.

Fix: nothing to review. If the user wants to re-engage, run
`employer.invite_candidate({ jobId, candidateUserId })` — WITHDRAWN is
the only state where re-invite is allowed (the service preserves the
application id by UPDATE).

## Contact details missing in list_applicants / get_applicant_detail

Cause: `reviewStatus` is below SHORTLISTED. Contact fields
(`email`, `phone`, `linkedinUrl`, `githubUrl`, `websiteUrl`) are gated
server-side and not transmitted.

Fix: tell the user that contact unlocks at SHORTLISTED or HIRED. To
unlock: `employer.set_review_status({ applicationId, reviewStatus:
'SHORTLISTED' })`, then re-read.

## cancel_invitation: NOT_INVITED

Cause: the application is no longer in INVITED status (candidate may
have accepted, declined, or withdrawn between the agent's earlier
`list_invitations` and the current call).

Fix: re-read `employer.list_invitations({ jobId })` to see the current
state. The candidate has likely moved into `list_applicants` or out
entirely.

## create_job: PARSE_FAILED

Cause: Gemini AI returned an error parsing `rawText` (rate limit,
malformed prompt, network).

Fix: surface the error message to the user. Suggest retry with a
cleaner `rawText`. Do NOT silently retry — risk of duplicate DRAFTs.

## create_job: client timeout

Cause: the parse is synchronous and budgets 5-30 seconds. Some MCP
clients have shorter timeouts.

Fix: do NOT resubmit `rawText`. Run
`employer.list_jobs({ status: 'DRAFT' })` and pick the most recent
row by `createdAt`. That is the job that finished parsing on the
server while the client gave up.

## publish_job / close_job / archive_job: CONFLICT

Cause: the job is in an unexpected source status for the requested
transition.

Fix: read the error suffix. `CONFLICT: expected status DRAFT, found
PUBLISHED` for `publish_job` means the job is already published —
nothing to do. For other mismatches, run `employer.get_job` to see
the current state and pick the right transition.

## NOT_FOUND on read tools you know exist

Cause: read tools (`get_job`, `list_applicants`, `list_invitations`,
`get_applicant_detail`, `get_applicant_transcript`, `get_candidate`)
collapse NOT_FOUND and FORBIDDEN into a single NOT_FOUND. This
prevents enumeration of other employers' jobs and applicants.

Fix: never assume "this is my job but I lost access". If the user
believes a job is theirs, ask them to verify the `jobId` (typo / wrong
employer account). Otherwise treat NOT_FOUND as terminal — the row
does not exist for this employer.
