---
stage: plan
status: draft
feature: <slug>
approved_by: pending
date: <YYYY-MM-DD>
spec: ./spec.md
---

# Plan: <short title>

Template note: remove this paragraph and every line beginning with
"> Guidance:" when instantiating this template; the committed artifact
contains only real content. This file stays editable after approval: checking
off steps and recording deviations IS the documented workflow.

## Strategy

> Guidance: one paragraph — the implementation approach and why it fits this
> codebase's existing patterns.

## Steps

> Guidance: ordered checklist — live state during Stage 3; items get checked
> as they land, one commit per step. Mark independent steps [parallel-ok].
> Each step lists the files touched and how we know it's done.

- [ ] 1. …
      - Files: `path/to/file`
      - Done when: …

## Risks

> Guidance: per risky step — what could go wrong, how we'd notice, how we'd
> back out.

## Test strategy

> Guidance: acceptance criterion → planned test, one line each, e.g.
> "AC1 → unit test in `…`".

## Deviations

> Guidance: empty at approval. If implementation reveals the plan was wrong,
> the change is recorded here and re-acknowledged by the user before work
> continues.
