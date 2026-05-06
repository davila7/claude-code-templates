# Haiku Tier — Surface Checklist (extended reference)

This is the extended reference the Tier 1 (Haiku) agent loads when a surface check needs more context than the inline agent definition provides. For the canonical flow + RESULT block schema, see `../../../agents/haiku-reviewer.md`.

## Scope

Surface review sits at the first line of defence. It catches:

- Missing / mis-named files
- Narrative-only "evidence"
- Debug code left in the diff
- Obvious copy-paste, obvious magic numbers, obvious silent-fallback patterns
- Cross-boundary issues that are visible at the diff level (wrong column name in a WHERE, `.toFixed()` on a nullable)

It does NOT trace call graphs, does NOT cross-verify config bidirectionally, does NOT audit architectural fit. Those belong in later tiers.

## What counts as "evidence"

For a `[x]` box to pass at the surface tier, the evidence must be at least one of:

- **file:line** — a concrete pointer a reviewer can open and read
- **commit hash** — a hash visible in `git log` of the branch
- **command + output** — a reproducible command with captured output (tee log path is fine)
- **subagent RESULT comment-id** — a comment number referencing a fenced `## RESULT` block

Narrative-only evidence ("implemented the feature") is a fail.

## Common false positives

- **Intentional duplication for defence-in-depth**: a value validated at the API layer AND at the DB layer is not a DRY violation — it's a designed belt-and-braces. Flag for the subagent to confirm intent before marking as a finding.
- **Argparse defaults for optional tunables**: `parser.add_argument("--retries", default=3)` is not a "silent fallback" — the argument is optional by contract. Only flag `default=` patterns that hide REQUIRED config.
- **Sentinel values that are the contract**: `return None` from a "not found" function is not a silent failure — it's the advertised return contract. Flag only when the caller can't distinguish the sentinel from a valid value.

## Bash output discipline

- Wrap any command expected to produce > 200 lines in a tee-style capture. Report only the path + verdict in RESULT.
- Do NOT paste `pytest -v` output, `git diff` of 50+ files, or unfiltered log tails back to the main agent.

## Graph fallback

When the code-review-graph MCP is unavailable or the project uses unsupported languages (Markdown, YAML, JSON, SQL, TOML, shell), do NOT silently skip the graph-backed checks. Instead:

1. Retry once after a short delay.
2. If still unavailable, fall back to an Explore-style subagent that performs the equivalent manual audit (callers, callees, large functions).
3. Include the subagent's RESULT block in your own RESULT as `[graph unavailable: <reason>] [subagent fallback: <id>]`.

A bare `[graph unavailable]` with no subagent evidence = silent skip = FAIL.
