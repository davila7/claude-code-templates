# Candidate Troubleshooting

Scenarios on the candidate MCP surface. For transport / saved-key / tool
visibility issues (cross-role), see `troubleshooting.md`. For onboarding and
access states, see `auth-flow.md`.

## Candidate tool call fails with "requires candidate authentication"

Cause: no usable candidate identity. No `apiKey` was passed and the MCP
session is anonymous. The full message is
`<tool> requires candidate authentication. Provide apiKey with a WorkorAI
MCP key or reconnect ...`.

Fix: look up a saved candidate key
(`node scripts/credential-store.mjs get --role=candidate`); if none, send
the user to `https://workorai.com/candidate/home?tab=mcp` to copy the key,
then retry the tool with the `apiKey` argument. No reconnect needed.

## Candidate tool fails with "requires a candidate MCP key"

Cause: the key passed is for the wrong role (an employer key on a candidate
tool).

Fix: re-read the candidate slot
(`credential-store.mjs get --role=candidate`) or ask the user for the
candidate key from `https://workorai.com/candidate/home?tab=mcp`. Save it
with `--role=candidate`.

## Candidate tool rejected at call time (access / key error)

A valid-looking candidate key can still be rejected. The EXACT message tells
you the cause — each maps to a distinct runtime error, so do not lump them:

- `<tool> requires active candidate MCP access` — access is
  `REVERIFY_REQUIRED`: the profile changed and must be re-verified before the
  key works again. (This is the ONLY state that produces this message.)
- `MCP API key has been revoked` — the key was revoked admin-side (`REVOKED`),
  OR superseded by a newer key (issuing a key revokes the prior one). Copy the
  current key, or issue a fresh one.
- `MCP API key has expired` — the key passed its expiry (a distinct message
  from "revoked"). Issue a fresh key.
- `MCP access is pending verification` — there is no ACTIVE access yet (the
  `LOCKED` / `WAITING_FOR_EVALUATION` / `EVALUATION_FAILED` summary states map
  to this). Normally a key cannot even exist here — issuance requires ACTIVE —
  so it usually means the account never reached ACTIVE.
- `MCP API key was not found` — the key is wrong/garbled; re-copy it.
- `<tool> requires a candidate MCP key` — wrong-role key (see the wrong-role
  scenario above).

Fix: do NOT retry the same call — the access state must change on the
WorkorAI side first. Route by message: re-verify after a profile change,
finish/await/retake the interview, or regenerate the key at
`https://workorai.com/candidate/home?tab=mcp`. See `auth-flow.md` for the
7 candidate access states.

## search_jobs returns `INTERNAL: search is temporarily unavailable`

Cause: a transient search-engine / DB failure. The raw error is normalized
to `INTERNAL` and never relayed — it is NOT a key, state, or input problem.

Fix: retry once after a short pause. If it persists, tell the user search is
temporarily down and to try again later. Do not "fix" the key or re-onboard.

## search_jobs returns no jobs (empty `jobs[]`)

Cause: filters too narrow, an `offset` past the end, or genuinely no
published matches for this candidate right now.

Fix:
- Drop or widen the enum filters (`workModel`/`seniority`/`jobType`) and the
  free-text `q`, and reset `offset` to 0.
- Confirm `page.total` — if 0 across no filters, there are no matching live
  vacancies; suggest checking back later or broadening the role.
- An empty page with `page.hasMore: false` and a non-zero earlier total just
  means the user paged past the end.

## Results look generic / not personalized (no interview yet)

Cause: ranking is SEMANTIC only when the candidate has a completed +
evaluated profile interview. Without one — or when a free-text `q` is passed
— `search_jobs` instead BROWSES published jobs by recency. Those rows carry NO
fit score (`matchScore` is `null`) — they are a browse list, not a personalized
ranking. There is no keyword scorer (the lexical matcher was retired).

Fix: explain that personalized ranking needs a finished profile interview
(`auth-flow.md` onboarding). The same gate blocks `apply_to_job` until the
interview is evaluated — so finishing it unlocks both.

## apply_to_job returns GATE_LOCKED / GATE_EVALUATING / GATE_FAILED

Cause: the apply gate requires a completed + evaluated profile interview.
- `GATE_LOCKED` — no completed interview yet.
- `GATE_EVALUATING` — interview finished, evaluation still running.
- `GATE_FAILED` — the evaluation failed.

Fix (do NOT blind-retry):
- `GATE_LOCKED` → send the user to complete the profile interview.
- `GATE_EVALUATING` → wait, then retry in a short while.
- `GATE_FAILED` → tell the user to retake the interview.
All paths start at `https://workorai.com/candidate/home?tab=mcp` /
`/candidate/profile` — see `auth-flow.md`.

## NOT_FOUND on a job the user just saw

Cause: `get_job`, `apply_to_job`, `accept_invitation`, and `set_saved_job`
collapse "missing job" and "non-PUBLISHED job" into one `NOT_FOUND`
(anti-enumeration). The vacancy was likely closed/archived since the search,
or the `jobId` is wrong. (`decline_invitation` and `withdraw_application`
differ — their `NOT_FOUND` means "no matching invite/application row", NOT a
publish-status collapse; they do not check the job's status at all.)

Fix: re-run `search_jobs` for a live equivalent. Treat `NOT_FOUND` as
terminal for that `jobId` — do not loop retrying it.

## accept_invitation / decline_invitation returns NOT_INVITED

Cause: there is no OPEN invitation for this job. The invite may have been
withdrawn or already declined, or the candidate applied organically (no
invite to respond to).

Fix: call `get_applications` and read the row's `status`. `APPLIED` → use
`withdraw_application` if they want out; `DECLINED`/`WITHDRAWN` → terminal,
nothing to accept/decline.

## withdraw_application returns NOT_APPLIED

Cause: there is no ACTIVE (APPLIED) application — the row may be an open
`INVITED` invite, or already DECLINED/WITHDRAWN.

Fix: call `get_applications`. If the row is `INVITED`, the right action is
`decline_invitation` (to opt out) or `accept_invitation` — not withdraw.

## A saved job disappeared from get_saved_jobs

Cause: `get_saved_jobs` lists PUBLISHED jobs only. A job saved earlier and
then closed/archived is filtered out — the bookmark row still exists, the
listing just hides it.

Fix: the vacancy is no longer live. Re-search for a current equivalent. This
is expected behavior, not a lost bookmark.
