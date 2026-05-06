# Sonnet Tier — Logic Checklist (extended reference)

This is the extended reference the Tier 2 (Sonnet) agent loads when a logic check needs more context than the inline agent definition. For the canonical flow + RESULT block schema, see `../../../agents/sonnet-reviewer.md`.

## Scope

Logic review is where the cross-file tracing happens. Tier 1 scans each file; Tier 2 traces paths between files. It catches:

- Scope drift (feature added that wasn't in the issue)
- Scope shortfall (feature in the issue not yet implemented)
- Type contracts that silently break (annotated `float`, caller passes `None`)
- Schema contracts that silently break (WHERE literal doesn't match stored data)
- Config contracts that silently break (YAML key never read, code read key that doesn't exist in YAML)
- Lifecycle wiring gaps (drain function called at reconnect but not startup)
- Dead `try / except` blocks that wrap functions that can't raise

## Cross-Boundary Contract discipline

Every value that crosses a boundary must have its contract verified. The three canonical boundaries are:

1. **Type Contract** — every function parameter with a non-Optional annotation must have all call sites verified non-None. If any caller can pass `None`, annotation must be `T | None` and the function must guard.
2. **Schema Contract** — every SQL query's columns must exist in the target table. Every SQL literal in WHERE must match the actual data stored (e.g., DB normalises `'SLD'` → `'SELL'` on insert — querying `side='SLD'` returns zero rows silently).
3. **Config Contract** — bidirectional. Every key added to YAML must be read by code. Every key read by code must exist in YAML. Dead either direction = incomplete implementation.

## Sample Invocation Gate — when it applies

For changes that touch any of:

- Pipeline / backtest / orchestration wiring
- CLI flag threading into downstream function signatures
- Cross-module function-arg propagation (>1 hop from CLI to DB / file write)
- Persistent-state writes (JSONB schema mutation, SQL literal drift across SET / READ sites, DB column rename, enum-value drift)

Unit + smoke tests are necessary but NOT sufficient. A REAL-CLI sample invocation against real DB is required. Exit-code-0 alone is insufficient — we have history of exit-0 runs writing zero rows. The proof must show rows landed + downstream consumers succeeded.

Mocks that accept `**kwargs` silently discard params and do NOT prove propagation. Any mock in the fix's tests must assert `call_args.kwargs["<key>"] == <expected>` explicitly.

## Observability discipline

Every new component must emit:

1. **Structured logs** at every decision boundary, state transition, and external call
2. **Metrics** for anything quantifiable — counters, durations, queue depths, success / failure ratios
3. **Audit trail** for state changes affecting production data, money, or user-visible behaviour — append-only, with actor + timestamp + reason

`print()` is not logging. Empty `except:` blocks are not error handling. `return None` on error without a structured log is a silent fallback.

## Graph discipline — lazy-fallback detection

Every subagent RESULT block that discusses graph queries must start with `mcp_graph_available: yes|no` on the first line. This discriminates:

- `yes` + graph-query evidence lines = expected
- `no` + grep fallback evidence = acceptable (no MCP access)
- `yes` + no graph-query evidence = **lazy fallback** — the subagent had graph access but used grep anyway. FAIL.

This is how a grader at Tier 2 catches subagents that silently skip graph when it was available.

## Spot-check discipline

When the graph IS used, Tier 2 requires a spot-check: read at least one result's source file:line to verify graph output matches reality. The graph is AST-based — it does NOT see runtime behaviour, does NOT verify DB column values, does NOT catch JSONB schema drift. Record the spot-check file:line in RESULT.
