---
name: tradeoff-analysis
description: >
  Use for tradeoff analysis, or when the user must pick between concrete options: "A or B?", "which library should we use?", "build vs buy", "compare these approaches". Scores options on weighted criteria, tests sensitivity and reversibility. Skip for open ideation or single-option reviews.
license: MIT
metadata:
  author: ysskrishna
  version: "2026.10.5"
---

# Tradeoff Analysis

Choose among a small set of real options with the criteria, weights and evidence in plain view. A weighted decision matrix with a sensitivity check and a reversibility check.

## When to use

- Picking a library, vendor, architecture, plan, hire, design or build-vs-buy.
- "A or B?", "compare these", "which should we pick", "is it worth it".
- A decision the user must defend to others.

Skip: generating options from scratch (explore first, then come here), reviewing one plan for flaws, or ranking a long backlog.

## Before you start

1. State in one block: **Decision** (one sentence), **Deadline or cost of delay**, and **Pass** (Options, Must-haves, Criteria, Score, Sensitivity, Reversibility, Recommendation).
2. **Gather first.** Read docs, benchmarks, pricing, the codebase and constraints before scoring. Every score needs a one-line basis; unsupported scores are marked `[ESTIMATED]`. Ask up to 3 questions only for goals and constraints tools cannot answer.
3. **Light path.** Small ask: 2-3 options, 3 criteria, one-line reasons, a one-sentence sensitivity check.

## Steps

### 1. Options
2-5 genuinely different options, including **do nothing** or **keep current** when it is real.

### 2. Must-haves
Hard constraints (budget cap, compliance, deadline). An option that fails one is out; do not score it.

### 3. Criteria and weights
3-7 criteria that reflect the goal and do not overlap (avoid counting the same thing twice, such as "speed" and "performance"). Give weights that sum to 100 and say why the top weight is highest.

### 4. Score
Rate each option per criterion from 1 (poor) to 5 (strong), with a short basis.

| Criterion (weight) | Option A | Option B |
|--------------------|----------|----------|
| ... (40) | 4 - basis | 3 - basis |
| **Weighted total** | | |

### 5. Sensitivity
Change the largest weight by about 10 points, or the least certain score by one. Does the winner change? Name the one criterion or score that flips the result.

### 6. Reversibility
How costly is it to undo this choice (switching cost, data lock-in, contract length, time)? Easy to reverse: decide faster and favor learning. Hard to reverse: spend more effort on evidence.

### 7. Recommendation
The pick, the main reason, the main cost you accept, and **what would change the pick**. For money or time tradeoffs, add a compact **cost-benefit** line: expected benefit range minus cost range, with the unit and period.

## Pitfalls

- False precision: a 3.8 vs 3.6 gap is a tie. Say so and decide on sensitivity and reversibility.
- Weights chosen after seeing the scores. Set them before scoring.
- Criteria that restate the favorite option ("uses our preferred language").
- Scores from impressions with no basis. Mark them `[ESTIMATED]`.
- Ignoring the cost of changing course later.

Worked example: [references/example.md](references/example.md).

## Checklist

- [ ] Decision and options stated; do-nothing considered
- [ ] Must-haves screened before scoring
- [ ] Criteria are independent; weights set with a reason
- [ ] Every score has a basis or `[ESTIMATED]`
- [ ] Sensitivity names what flips the result
- [ ] Reversibility assessed
- [ ] Recommendation names the accepted cost and what would change it
