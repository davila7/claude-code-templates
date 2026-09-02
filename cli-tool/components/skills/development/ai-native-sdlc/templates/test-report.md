---
stage: test
status: draft
feature: <slug>
date: <YYYY-MM-DD>
plan: ./plan.md
---

# Test report: <short title>

Template note: lines beginning with "> Guidance:" describe what belongs in
each section and are replaced by real content when this template is
instantiated.

## Verification commands

> Guidance: every command run, with its real result. Red rows stay red until
> fixed — this report never flatters.

| Command | Result |
|---|---|
| `<test command>` | ✅ pass (N tests) / ❌ fail — <summary> |
| `<build command>` | |
| `<lint/typecheck command>` | |

## Acceptance criteria coverage

| Criterion | Test | Result |
|---|---|---|
| AC1 … | `path/to/test` | ✅ / ❌ |

## Visual / manual checks

> Guidance: for UI or behavior not capturable in automated tests — what was
> checked, how (screenshot, browser run), and what was seen.

## Not verified

> Guidance: anything unverified and why. An honest gap beats a false green.
