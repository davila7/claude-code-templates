# Opus Tier — Deep Analysis Checklist (extended reference)

This is the extended reference the Tier 3 (Opus) agent loads when a deep check needs more context than the inline agent definition. For the canonical flow + RESULT block schema, see `../../../agents/opus-reviewer.md`.

## Scope

Opus is the architectural pass. It catches:

- Architectural misfit (new module violates the layering pattern in use)
- Governance drift (Tier A checkbox batching against commit cadence)
- Null propagation across the full codebase (not just the diff)
- Factual claims without provenance in documentation
- Overengineering (premature abstractions, unnecessary complexity)
- Dead code at the module / endpoint / migration level

## Governance drift — two-tier cadence rule

When auditing checkbox close-out cadence, classify every `[x]` box into one of two tiers BEFORE judging:

**Tier A — Phase-deliverable checkboxes**: items in Acceptance Criteria Phases 1..N that describe a concrete deliverable (a file edit, commit, function, section, table, example). STRICT interleaving required — Proof of Work entry order MUST interleave with git-log commit order within the same phase's commit window.

**Tier B — Cross-cutting meta-checkboxes**: Triple-Check Gate items, Engineering Requirements meta-items like "Fix Everything", Cleanup Requirements, Verification Loop self-gates, PREREQUISITE CHECKPOINT, Expected Behavior post-condition items. Batched-at-end is acceptable because these describe conditions observable ONLY after all phases complete. Closing them mid-phase would be dishonest.

**Classification heuristic**: if the checkbox text names a specific file / commit / section / function / table to build or change, it is **Tier A**. If it describes a cross-cutting condition requiring the WHOLE implementation to evaluate, it is **Tier B**. When in doubt, inspect the checkbox's section in the issue template: Acceptance Criteria sub-phases = Tier A; Triple-Check Gate / Engineering Requirements meta / Cleanup Requirements / Verification Loop self-gates / PREREQUISITE CHECKPOINT / Expected Behavior = Tier B.

**Rule**:

- Flag Tier A batching as governance drift.
- Do NOT flag Tier B batching as drift.

A Tier-B-only batch is acceptable and expected.

## Governance evidence signal (canonical)

The canonical audit signal for verifying that checkbox-close invocations actually happened is the `## Proof of Work` section in the issue body — NOT the GitHub timeline `edited` events.

Why: GitHub's timeline API does not emit `edited` events for an issue author's own body edits on their own issue. Since solo-workflow agents ARE the issue author in almost all cases, timeline-based audits false-negative every honored invocation. The body content itself, however, is always externally readable.

Verification procedure:

1. Fetch the issue body via the project's governance MCP tool, or a plain GitHub API call.
2. Parse the `## Proof of Work` section. Each entry starts with `- **<checkbox text>**: <evidence>`.
3. For every `[x]` box in the body, there MUST be a matching entry in Proof of Work. Missing entry = drift.
4. For each entry, spot-check the cited evidence:
   - file:line claims → open the file on the branch
   - commit hashes → `git show <hash>`
   - subagent RESULT blocks → fetch the cited comment
   - command output → reproducible via the same command

Ordering of Proof of Work entries is authoritative — the section appends in invocation order. Cross-reference the entry order against `git log --oneline` to confirm Tier A items closed within the same phase's commit window.

## Factual claims audit

Every numeric assertion added by the implementation (counts, ratios, durations, capacities, percentages) must have a verifiable source:

- **Reproducible command** (e.g. `git log --oneline | wc -l` → "10,385 commits")
- **API query** (e.g. `gh issue list --state all` → "1,309 issues")
- **Code reference** (e.g. `grep -c "def test_" tests/` → "N test functions")
- **Calculation** (e.g. `(total - open) / total = 99.4% close rate`)

"Seems reasonable" is not a source. If the number cannot be reproduced, it must be sourced or removed before OPUS_PASS.

## Bash output discipline

- Any command producing > 200 lines → capture to file, report path + verdict in RESULT.
- Do NOT paste full pytest output, unfiltered git diffs, or log tails back to the main agent.

## When graph is unavailable

Opus tier has the deepest graph requirements — dead-code detection via `large_functions` + orphan scan, impact scope validation via `impact(max_depth=2)`, large-function audit. When graph is unavailable or unsupported-language, an Explore-style subagent MUST perform the equivalent manual architectural audit and the RESULT must include the subagent's RESULT block. Documenting only `[graph unavailable]` = silent skip = FAIL.
