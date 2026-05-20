# Action Point Template

Each action point lives in its own file at `blueprint/action-points/AP-NN-<slug>.md`. The numbering is global and stable - once an AP gets a number, that number doesn't change even if the AP is later edited or reordered (use the dependency graph to express order, not the filename).

The default target is ~38 APs for a substantial system. Fewer is fine for smaller systems; more is fine for large ones. The right granularity is: **one AP is a single coherent unit of implementation work that an engineer (or Claude Code) can execute in one focused session without needing to re-plan.** If an AP would take a week or touches 20 files, it's too big - split it. If an AP is "rename this variable," it's too small - fold it into a neighbor.

## Template

```markdown
# AP-NN: <Title>

**Summary:** <one sentence - what this AP accomplishes>

**Status:** draft | reviewed | approved
**Complexity:** S | M | L | XL
**Depends on:** AP-XX, AP-YY  (or "none")
**Blocks:** AP-ZZ  (optional, useful for the dependency graph)

## Goal

<2–4 sentences. What does the system look like after this AP is done that it didn't before? Why does this AP exist?>

## Files involved

| Path | Action | Notes |
|---|---|---|
| `src/auth/token.ts` | create | New module for token issuance |
| `src/auth/index.ts` | modify | Export the new token API |
| `src/db/schema.sql` | modify | Add `tokens` table |
| `tests/auth/token.test.ts` | create | Unit tests for token issuance |

Every path here must be a real path that fits the architecture defined in `plan/01-architecture.md` and the data model in `plan/04-data-model.md`. If you find yourself inventing a path, stop and check those files first.

## Code flow

<Prose, function by function. Not pseudocode - describe what each function does, what it calls, what it returns, and what state it touches. The reader should be able to picture the implementation without seeing it.>

Example:

> `issueToken(userId, scope)` generates a random 256-bit token, stores a hashed copy in the `tokens` table with `userId`, `scope`, `createdAt`, and `expiresAt` (24h default), and returns the raw token to the caller. It calls `hashToken()` from `crypto-utils.ts` and `db.tokens.insert()` from the data layer. On a DB error it throws `TokenIssuanceError`, which the caller (the auth controller) maps to a 500.

## Interfaces touched

<Function signatures, API contracts, schema changes. Be exact.>

```ts
// New
export function issueToken(userId: string, scope: TokenScope): Promise<string>;
export function validateToken(raw: string): Promise<TokenClaims | null>;

// Modified
// (none)
```

Schema delta:

```sql
CREATE TABLE tokens (
  id          UUID PRIMARY KEY,
  user_id     UUID NOT NULL REFERENCES users(id),
  hash        TEXT NOT NULL UNIQUE,
  scope       TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at  TIMESTAMPTZ NOT NULL
);
CREATE INDEX tokens_user_id_idx ON tokens(user_id);
```

## How it interacts with other components

<Explicit named references to components defined in plan/03-components/. No vague "the auth layer" - say which file.>

- **Consumed by:** `plan/03-components/auth-controller.md` calls `issueToken` on successful login.
- **Calls into:** `plan/03-components/db-layer.md` for inserts; `plan/03-components/crypto-utils.md` for hashing.
- **Observed by:** `plan/03-components/audit-logger.md` subscribes to the `token.issued` event (added in AP-NN-1).

## Verification

<How does the user / Claude Code know this AP is done correctly? Concrete, testable.>

- [ ] `tests/auth/token.test.ts` covers: happy path, expired token, unknown token, malformed token, scope mismatch.
- [ ] Manual check: `curl -X POST /login` returns a token; `curl -H "Authorization: Bearer <token>" /me` returns the user.
- [ ] DB check: `SELECT * FROM tokens WHERE user_id = '<id>'` shows the new row with a hashed value (never the raw).
- [ ] Lint and typecheck pass.

## Edge cases considered

- Concurrent login from the same user → multiple tokens allowed; both valid until expiry.
- Token issued just before clock skew → use server clock only; document this.
- DB unreachable during issuance → fail closed, return 500, do not return a token the DB doesn't know about.

## Open questions / risks

- Should tokens be revocable individually, or only by user? (Punted to AP-NN+5.)
- Rate-limit on issuance? (See `plan/06-non-functional.md` - TBD.)

## Research notes

<Any web research that informed this AP, with citations. Link to the file in research/ where the full notes live.>

- See `research/auth-libraries-2026.md` for why we're not using `jsonwebtoken` directly.
```

## Rules for writing APs

1. **No invented names.** Every file path, function name, type, and table name must be consistent with the architecture and component files. If something isn't defined yet, define it in the right `plan/` file *first*, then reference it from the AP.
2. **Verification is not optional.** An AP without a verification section is a wish, not a plan.
3. **Edge cases are not optional.** Force yourself to write at least three. If you can't think of three, you haven't thought hard enough - try scale=0, scale=max, and concurrent access as starting prompts.
4. **Dependencies are explicit.** "Depends on" should list AP IDs, not vague phrases like "after the auth work."
5. **Complexity is honest.** S = under an hour. M = a half day. L = a full day or two. XL = split it.
6. **Cite research.** If the AP makes a choice informed by research, link the research file.

## The dependency graph

After all APs are drafted, write `blueprint/action-points/README.md` containing:

- A one-paragraph overview of the AP set.
- A table of all APs with ID, title, complexity, and dependencies.
- A mermaid graph showing the dependency DAG. Group nodes that can run in parallel.
- A recommended execution order - a topological sort of the DAG, with parallel groups marked.

The execution order is what the user will hand to Claude Code (or any other implementer) when the blueprint is approved.
