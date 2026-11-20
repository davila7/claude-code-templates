---
stage: review
status: draft
feature: <slug>
date: <YYYY-MM-DD>
policy: ../REVIEW.md
---

# Review: <short title>

Template note: remove this paragraph and every line beginning with
"> Guidance:" when instantiating this template; the committed artifact
contains only real content.

## Passes run

> Guidance: one row per pass from .sdlc/REVIEW.md. Reviewers are adversarial
> subagents that did not write the code.

| Pass | Reviewer tier | Findings |
|---|---|---|
| Bugs | deep | 0 / N |
| Security | deep | |
| Compliance | deep | |
| Simplification | deep | |

## Findings

> Guidance: every finding, kept regardless of outcome.

### F1 · <one-line summary>
- **Pass:** bugs
- **Failure scenario:** <concrete inputs/state → wrong behavior>
- **Resolution:** fixed in `<commit>` / rejected — <reason>

## Human review

> Guidance: filled during PR review — each reviewer comment and how it was
> addressed.

## PR
- Branch: `<branch>`
- PR: <link>
- Artifact chain: [intent](./intent.md) · [spec](./spec.md) ·
  [plan](./plan.md) · [test report](./test-report.md)
