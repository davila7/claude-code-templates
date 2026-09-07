---
stage: test
status: draft
feature: <slug>
date: <YYYY-MM-DD>
plan: ./plan.md
---

# Test report: <short title>

Template note: remove this paragraph and every line beginning with
"> Guidance:" when instantiating this template; the committed artifact
contains only real content.

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
