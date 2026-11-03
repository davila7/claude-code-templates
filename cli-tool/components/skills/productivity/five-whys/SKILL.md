---
name: five-whys
description: >
  Use for the 5 Whys, or when the user wants the root cause of a failure: "why did this happen?", "this keeps breaking", "write the postmortem", "find the real cause". Asks why repeatedly with evidence at each step, then sets countermeasures. Skip for one-off typos or when the cause is already proven.
license: MIT
metadata:
  author: ysskrishna
  version: "2026.10.5"
---

# Five Whys

A root-cause method from the Toyota Production System. Ask "why" of the previous answer until you reach a cause you can change, and check each link with evidence.

## When to use

- An incident, outage, defect, missed deadline or process failure needs its real cause.
- A problem repeats after quick fixes.
- A postmortem or retrospective needs a causal chain, not a list of symptoms.

Skip: a typo or one-line bug whose cause is already visible, or questions about metrics that need data analysis rather than a causal chain.

## Before you start

1. State in one block: **Problem statement** (what happened, where, when, impact, in observable terms) and **Pass** (Chain, Check, Branch if needed, Countermeasures).
2. **Gather first.** Read logs, commits, tickets, timelines and configs before answering any "why". Mark each answer `verified` (you saw evidence) or `hypothesis` (plausible, not yet checked). Ask up to 3 questions only for facts tools cannot reach.
3. **Light path.** Small ask: the chain in 3-5 lines, one countermeasure per root cause.

## Steps

### 1. Chain
Write the problem, then ask why. Each "Why" answers the previous answer, not the original problem.

| # | Why did that happen? | Status | Evidence |
|---|----------------------|--------|----------|
| 1 | ... | verified / hypothesis | file, log line, ticket |

Five is a guide. Stop earlier or later when you reach a cause that is (a) within the team's control and (b) such that fixing it would have prevented the problem.

### 2. Check
- **Reverse test:** read the chain from the bottom up with "therefore". Each step must follow from the one below.
- **Stop test:** if the last answer is "human error", "not enough time" or "bad luck", ask why once more. These describe a missing safeguard, not a cause.
- Mark any link still `hypothesis`; list how to verify it.

### 3. Branch (only if causes split)
When one "why" has several valid answers, follow each as its own chain. If the causes spread across many areas, group them under People, Process, Tools, Environment, Data or Measurement (a fishbone view) and chain the top two or three.

### 4. Countermeasures
For each root cause:
- **Contain:** stop the damage now.
- **Fix:** remove the cause.
- **Prevent:** a check or guardrail so it cannot recur.
- **Owner and date**, or "to be assigned".

## Pitfalls

- Jumping to a favorite cause and filling the chain backward to justify it.
- Asking "who" instead of "why". Blame ends the chain early; look for the missing safeguard.
- Single-chain thinking on a complex failure. Branch when there are several causes.
- Stopping at a cause nobody can change (for example "the vendor was down") without asking why there was no fallback.
- Treating `hypothesis` rows as findings in the summary.

Worked example: [references/example.md](references/example.md).

## Checklist

- [ ] Problem statement is observable (what, where, when, impact)
- [ ] Each why answers the previous answer; each row is `verified` or `hypothesis`
- [ ] Reverse test passed; no chain ends at "human error"
- [ ] Branches followed where causes split
- [ ] Countermeasures cover contain, fix, prevent, with owners
