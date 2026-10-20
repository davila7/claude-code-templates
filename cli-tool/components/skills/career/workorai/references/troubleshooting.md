# Troubleshooting

> Role-scoped references:
> - Candidate-only scenarios: see also `candidate-catalog.md` agent guidance.
> - Employer-side scenarios (INVITE_BLOCKED branching, contact gating,
>   review-status conflicts, create_job timeouts): see
>   `employer-troubleshooting.md`.
>
> This file covers general MCP transport, saved-key, and cross-role issues.

## Do Not Debug First For Normal Users

For normal job-search requests, do not run raw `curl` or JSON-RPC checks before giving the candidate onboarding path. Transport debugging is only appropriate when the user explicitly asks why MCP connection failed or asks to test the server.

## Tool Visibility

Modern WorkorAI MCP exposes ALL 28 tools in an anonymous `tools/list`:
`request_access`, the 9 candidate tools, and all 18 `employer.*`
tools — visible-but-gated. Visibility is discovery (so MCP clients
register the names); authorization is enforced per call. A tool in the
list is not proof the current caller can invoke it.

If only `request_access` (or only the 2–3 candidate-era tools) is
visible, the client is connected to an OLDER deployment that predates
the visible-but-gated employer surface or the expanded candidate
surface, or the session is stale — reconnect to the latest deployment.
This is a version issue, not a key issue.

If tools are visible but a call fails auth, common reasons:
- no Bearer key was sent
- no `apiKey` argument was provided for an anonymous session
- the key is invalid
- the key was revoked
- the candidate account is not in an active access state (candidate-side only)
- the saved local key is missing, unreadable, or stale
- the saved key is for the wrong role (a candidate key on an employer call or vice versa) — re-save with the correct `--role`

## Saved Key Problems

Check whether the skill can read a saved key — pass `--role` to query the right slot:

```bash
node scripts/credential-store.mjs get --role=candidate
node scripts/credential-store.mjs get --role=employer
```

Do not paste the returned key into user-visible output. If lookup fails:
- For a candidate intent: ask the user to paste the current MCP key from `https://workorai.com/candidate/home?tab=mcp`.
- For an employer intent: ask the user to paste the current MCP key from `https://workorai.com/employer/dashboard` (Employer MCP card).
- Use the pasted key with the tool `apiKey` argument.
- If the tool call succeeds, ask whether to save the replacement key (`save --best-effort --role=<role>`).

If OS secret storage fails:
- macOS requires `/usr/bin/security` and Keychain authorization.
- Linux requires `secret-tool` and a running Secret Service provider.
- Windows requires PowerShell SecretManagement.
- Headless/server environments should prefer `WORKORAI_MCP_API_KEY`.
- Shared file fallback requires explicit user consent: `save --shared-file`.

## Protocol Gotchas

- Use the local endpoint `http://127.0.0.1:3001/mcp` for Docker/dev smoke tests.
- Use `https://workorai.com/mcp` only after production DNS/nginx/SSL and the prod MCP container are deployed.
- Use `POST /mcp` with `Accept: application/json, text/event-stream`.
- `GET /mcp` without a session id returning `405` is expected.
- After auth changes, prefer per-call `apiKey`; reconnect only if the client relies on session-level `Authorization` headers.

## Visible Tool Scopes

All tools are visible-but-gated in an anonymous `tools/list`; the
key determines what can be *called*, not what is *listed*:
- Public (always callable): `request_access`
- Candidate (visible to all, callable with a candidate key): 9 tools —
  `candidate.search_jobs`, `candidate.get_job`, `candidate.get_applications`,
  `candidate.apply_to_job`, `candidate.accept_invitation`,
  `candidate.decline_invitation`, `candidate.withdraw_application`,
  `candidate.set_saved_job`, `candidate.get_saved_jobs` — see
  `candidate-catalog.md`
- Employer (visible to all, callable with an EMPLOYER key): 18 tools —
  see `employer-catalog.md`

An anonymous or candidate-scoped caller seeing `employer.*` in the list
is EXPECTED and correct — visibility is discovery. The call-time gate
rejects an employer call made without a valid employer key. Once a
session authenticates with a role key, `tools/list` narrows to that
role's callable surface.

If a candidate-scoped key sees employer tools (or vice versa), the server is misconfigured — please file an operator issue. The runtime filter is role-aware on `tools/list`.

## Missing Match Metadata

`candidate.search_jobs` returns these per-job fields:
- `matchScore`
- `matchedMustHaveSkills`
- `matchedNiceToHaveSkills`
- `missingMustHaveSkills`
- `seniorityFit` — always `UNKNOWN` (the combiner has no seniority signal)
- `matchReasons` — always `[]` (nothing synthesizes them)

NOTE: a free-text `q` or a not-yet-interviewed candidate returns a recency
BROWSE with `matchScore: null` (no fit score) — a browse list, not a scored
ranking. A `null` `matchScore` on that path is correct, not a bug.

If `matchScore` or the skill arrays are missing, the client may be reading stale cached output, using an unauthenticated session that cannot call the real tool, or connected to an older MCP deployment.
