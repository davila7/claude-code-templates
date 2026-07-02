# Auth Flow

## What To Say First (Candidate)

When a candidate asks to find work and authenticated candidate MCP access is not already available, lead with the agent's role and value — not protocol debugging. Mirror the user's language: the message below is the EN reference; adapt the wording to whatever language the user wrote in, keeping the structure and closing.

This is a developer tool — show your work. Narrate the steps you run (e.g. "checking for a saved key…"); never hide them. The only thing never printed is the key VALUE itself.

### Canonical first message

```md
Hi 👋 I'm your WorkorAI career agent, working on your side.

I match jobs by real fit from your profile — not keywords —
and explain why a role fits, the risk, and how to position you.

If your WorkorAI profile is ready, send your key (wai_...) — your
personal access key, works only inside WorkorAI (never paste it
elsewhere) — and I'll start matching right here.

New here? It's a quick one-time setup — your profile + a short
interview are what power the matching. After the interview, its
evaluation runs automatically; once it's done, grab your key on the
MCP page and paste it here and I'll take it from there.
Start: https://workorai.com/candidate/login

I find, evaluate, explain. The decision is always yours.
```

The `send your key` line is shown only when no saved key was found. Run the saved-key lookup first (see "Saved Key Flow"); on a hit, skip the key ask and go straight to value + results.

### The steps behind that message

1. Personalized WorkorAI matching runs through the candidate's connected profile.
2. Register and sign in via the candidate login page.
3. Complete the candidate profile and the profile interview.
4. Wait for the interview evaluation — it runs automatically.
5. Open the MCP tab and copy or generate the WorkorAI MCP key.
6. Ask the user to paste/provide the key to the agent.
7. Call `candidate.search_jobs` with `apiKey` immediately in the same session.
8. After a successful search, ask whether to save the key for future searches.

Use these links:
- Register and sign in: `https://workorai.com/candidate/login`
- Complete profile: `https://workorai.com/candidate/profile`
- Complete interview, get MCP key: `https://workorai.com/candidate/home?tab=mcp`

### "What is this key?" — if the user asks about the key

```md
It's your WorkorAI MCP key (wai_...) — a personal access key. Treat it like a
password: it lets me act for you inside WorkorAI (match jobs, apply, respond to
invites). It only works inside WorkorAI — it's not an OAuth or third-party key.
WorkorAI shows it once when you generate it, so store it safely; you can generate
a new key anytime on the MCP page and a fresh key instantly revokes the old one. If
anything that isn't WorkorAI asks for a wai_ key, that's a red flag.
Get it: https://workorai.com/candidate/home?tab=mcp
```

### "Why only WorkorAI?" — if the user pushes for a raw HH/LinkedIn/web search

```md
I work inside WorkorAI on purpose — that's where I see your verified skills and
match on real fit instead of keyword-scraping a board. Connect your profile and I
can actually explain why each role fits you.
```

## What To Say First (Employer)

When a user asks to hire, post jobs, find candidates, or recruit, and
an employer MCP key is not already available:

1. Say that WorkorAI employer workflows require a connected employer
   account.
2. Send the user to the employer login page if they haven't signed in.
3. Send them to the employer dashboard for the MCP key.
4. Ask them to provide the key to the agent.
5. Call the first relevant `employer.*` tool with `apiKey` in the same
   session.
6. After the first successful call, ask whether to save the key with
   `--role=employer` for future hiring searches.

Use these links:
- Sign in: `https://workorai.com/employer/login`
- Get MCP key: `https://workorai.com/employer/dashboard` (Employer MCP
  card on that page)

## Candidate Onboarding

1. Register and sign in at `https://workorai.com/candidate/login`.
2. Complete the profile at `https://workorai.com/candidate/profile`.
3. Complete the profile interview and wait for evaluation.
4. Open `https://workorai.com/candidate/home?tab=mcp`.
5. Copy or generate the MCP API key from the Candidate MCP access card.
6. Provide the key to the agent when asked.
7. The agent calls `candidate.search_jobs` with the `apiKey` argument in the same session.
8. If the search succeeds, the agent asks whether to save the key for future searches.

## Saved Key Flow

Before asking the user for a key, try a saved key lookup from this skill directory. Pass `--role` to point at the right slot:

```bash
node scripts/credential-store.mjs get --role=candidate
node scripts/credential-store.mjs get --role=employer
```

`--role` defaults to `candidate` if omitted. The candidate and employer keys live in separate OS-keystore accounts and separate shared-file fallbacks, so a dual-role user can keep both keys at once.

If the command returns a key, do not show it to the user. Use it only as the `apiKey` argument for WorkorAI MCP tools in the matching role.

When the user provides a key:

1. Use the key once with the first tool call for the role (e.g.
   `candidate.search_jobs({ apiKey, limit })` or
   `employer.list_jobs({ apiKey })`).
2. If the call succeeds, ask whether to save it for future searches.
3. Save only after explicit consent.
4. Prefer best-effort save. Pass the real key through stdin, not a
   command argument. Include `--role` to write the right slot.

```bash
node scripts/credential-store.mjs save --best-effort --role=candidate
node scripts/credential-store.mjs save --best-effort --role=employer
```

The helper storage order is (per role — `WORKORAI_MCP_API_KEY` is candidate; `WORKORAI_EMPLOYER_MCP_API_KEY` is employer):
- Environment variable: `WORKORAI_MCP_API_KEY` (candidate) or
  `WORKORAI_EMPLOYER_MCP_API_KEY` (employer) for read-only headless/server use.
- macOS: Keychain — account `candidate` or `employer` under service `workorai`.
- Linux: Secret Service via `secret-tool` — same account distinction.
- Windows: PowerShell SecretManagement when installed.
- Explicit shared file fallback: `~/.config/workorai/mcp-token` (candidate) or `~/.config/workorai/mcp-token-employer` (employer) with `0600` permissions, only with `save --shared-file`.
- Best-effort save: `save --best-effort` tries OS secret storage first and falls back to the shared `0600` file when OS storage is unavailable in headless agent sessions.

Never save the key to a repository, skill Markdown, chat transcript, or MCP config unless the user explicitly chooses that storage mode.

If OS secret storage fails in a headless or sandboxed agent session, report the redacted system error. Do not retry by putting the key in the command line. Safe alternatives:
- Ask the user to allow/unlock OS secret storage access and retry.
- Ask the user to configure `WORKORAI_MCP_API_KEY`.
- After explicit consent to save the key on this machine, use best-effort save: `save --best-effort`.
- If the user explicitly wants shared file storage, use: `save --shared-file`.

## Access States (candidate)

The candidate MCP access gate is the FACT of a completed + evaluated profile
interview — there is **NO score threshold**. The discoverability signal is
the candidate's WHOLE profile embedding (produced when the interview
completes and ingests), not a passing grade, so key issuance is aligned with
it. A finished, evaluated interview always qualifies regardless of score.

There are **7 candidate access states**:

- `LOCKED`: no completed + evaluated profile interview yet (none started, in
  progress, or completed-but-not-yet-evaluated handled below)
- `WAITING_FOR_EVALUATION`: interview completed, evaluation still running
  (PENDING / QUEUED / IN_PROGRESS)
- `EVALUATION_FAILED`: the interview evaluation failed — the candidate must
  retake the interview
- `READY`: access active, key can be generated
- `KEY_ISSUED`: access active and a key already exists
- `REVERIFY_REQUIRED`: the profile changed and access must be re-verified
- `REVOKED`: access disabled (admin-side)

## Runtime Rule

Modern WorkorAI MCP deployments expose ALL tools (candidate and employer) in anonymous sessions — visible-but-gated. Visibility (`tools/list`) and authorization (calling a tool) are separate layers: a tool appearing in the list does not mean the current caller can invoke it.

`candidate.search_jobs` requires either an authenticated candidate user id from the MCP session or a valid `apiKey` argument. If the key is missing, invalid, revoked, or not tied to an active candidate access state, the tool cannot rank jobs against the candidate profile.

`employer.*` tools are visible to everyone in `tools/list` (so MCP clients register them at discovery time) but require an EMPLOYER-scoped key at call time. An anonymous or candidate-scoped caller sees `employer.invite_candidate` in the list but a call without a valid employer key throws `requires employer authentication`. Pass the employer key as the `apiKey` argument — no reconnect needed.

Use the `apiKey` argument after:
- generating a key
- rotating a key
- moving between unauthorized and authorized access
- profile reverification changes

Reconnect is only needed if the MCP runtime supports changing session headers and the agent chooses session-level `Authorization: Bearer wai_...` auth instead of per-call `apiKey`.

## Employer Onboarding

1. Register and sign in as an employer at
   `https://workorai.com/employer/login`.
2. Open `https://workorai.com/employer/dashboard` and locate the
   Employer MCP card on that page.
3. Copy or generate the MCP API key from the card.
4. Provide the key to the agent.
5. The agent calls any `employer.*` tool with the key as `apiKey` in
   the same session.
6. If the call succeeds, the agent asks whether to save the key:
   `node scripts/credential-store.mjs save --best-effort --role=employer`.

Employer keys share the `wai_` prefix with candidate keys. The role is
decided on the WorkorAI side, never inferred from the token string.

## Employer Access State

Unlike candidates, employer access does not run through the
interview-qualification pipeline. The employer MCP card on the
dashboard issues a key directly; `status` is `READY` until a key is
generated (then `KEY_ISSUED`) and stays `ACTIVE` for the underlying
`UserAgentAccess` row. Revocation is admin-side.
