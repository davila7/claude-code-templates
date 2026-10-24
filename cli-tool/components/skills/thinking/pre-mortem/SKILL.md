---
name: pre-mortem
description: >
  Use for a pre-mortem, or before committing to a plan, launch or migration: "what could go wrong?", "stress test this plan", "how might this fail?", "risks before we ship". Assumes failure, lists causes, ranks them and sets mitigations. Skip for explaining a failure that already happened.
license: MIT
metadata:
  author: ysskrishna
  version: "2026.10.5"
---

# Pre-mortem

Gary Klein's technique: imagine the plan **has already failed**, then work backward to explain why. Assuming failure makes it safe to name risks that optimism hides.

## When to use

- Before a launch, migration, reorg, contract, hire, architecture change or any hard-to-reverse commitment.
- "What could go wrong?", "stress test this", "play out the failure".
- A plan everyone likes and nobody has attacked.

Skip: explaining a failure that already happened, or reviewing the logic of an argument rather than a plan.

## Before you start

1. State in one block: **Plan** (what, who, by when), **Failure definition** (what "failed badly" means, observable), **Horizon**, and **Pass** (Imagine, Causes, Rank, Mitigate, Decide).
2. **Gather first.** Read the plan, timeline, dependencies, past incidents and similar launches before generating causes. Ask up to 3 questions only for what tools cannot answer.
3. **Light path.** Small ask: 6 causes, top 3 ranked, one mitigation each.

## Steps

### 1. Imagine
Write one sentence in the past tense: "It is [date]. The [plan] failed badly: [failure definition]."

### 2. Causes
List reasons it failed. Cover different angles so they do not cluster: people and skills, process and timeline, technology and dependencies, customers and market, money, external events. Add one **inversion** prompt: "What would guarantee failure?" and list what you would then have to avoid. Each cause is a specific story ("the vendor API changes its rate limit during launch week"), not a category ("vendor risk").

### 3. Rank
For each cause give a plain-language **likelihood**, **impact** if it happens, and an **early warning sign**. Keep the top 5-8.

| Cause | Likelihood | Impact | Early warning |
|-------|-----------|--------|---------------|

### 4. Mitigate
For each top cause choose one:
- **Prevent:** change the plan so it cannot happen.
- **Detect:** a metric or check that shows it early.
- **Respond:** a rehearsed fallback.

Add an **owner** (or "to be assigned").

### 5. Decide
- **Plan changes** to make now.
- **Tripwires:** conditions under which the plan is paused, changed or stopped.
- **Go / no-go** statement: go as is, go with changes, or hold until named risks are reduced.

## Pitfalls

- Generic risks ("scope creep") with no story. Write what it looks like when it happens.
- Everything high likelihood and high impact. Force a ranking; a list where all items matter does not guide action.
- Mitigations nobody owns. Name an owner or mark it unassigned.
- Using it on something already failed. That is a postmortem; use a root-cause method.
- Treating the output as a promise that nothing else will go wrong. Revisit at each tripwire.

Worked example: [references/example.md](references/example.md).

## Checklist

- [ ] Plan, failure definition and horizon stated
- [ ] Failure written in the past tense
- [ ] Causes are specific stories across several angles, plus an inversion prompt
- [ ] Ranked with likelihood, impact and an early warning sign
- [ ] Mitigations are prevent, detect or respond, with owners
- [ ] Tripwires and a go / no-go statement
