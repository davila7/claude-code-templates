---
name: skill-improvement-loop
description: Continuously grades the quality of your skills against a rubric and opens a focused pull request to improve the weakest one on every pass.
category: engineering
interval: 7d
stop-condition: Every skill scores at or above the quality threshold and the diffs produced by a pass become cosmetic (no meaningful improvement remains).
components: [agent:expert-advisors/research-technical-spike, agent:expert-advisors/architect-review, command:git-workflow/create-pr]
tags: [skills, quality, automation, ci, evaluation, loop, self-improvement]
---

# Skill Improvement Loop

> **Loop Engineering** — an *outer* optimization loop for your skills. Instead of
> hand-editing skills one by one, you let an observer grade them, pick the weakest,
> open a small diff to improve it, and repeat until the diffs stop mattering. This
> is the marketplace adaptation of the "observer skill" pattern: run the inner
> skill, record its weaknesses, make a diff to improve it, repeat.

## 🎯 Goal
Keep a library of skills consistently high quality as it grows. Each pass surfaces
the single weakest skill and proposes a focused, reviewable improvement — rather
than a giant batch nobody reviews.

## ⏱️ Schedule
Suggested interval: `7d` (weekly), or run manually after importing a batch of new skills.

## ▶️ Run it
```
/loop 1w "Grade every skill against the quality rubric, pick the lowest-scoring one, research best practices for it, apply a focused improvement, validate it, and open a draft PR. Continue until all skills clear the quality bar and further diffs would be cosmetic."
```

## 🔁 Iteration steps
1. **Perceive (cheap triage)** — score every skill with a deterministic rubric (frontmatter completeness, description clarity and trigger cues, presence of examples, body depth) and a security scan. This is token-free and ranks the whole catalog.
2. **Select** — pick the lowest-scoring skill (highest improvement priority) that is below the quality threshold.
3. **Reason (real grade)** — run `component-researcher` to apply the full LLM rubric and produce a prioritized improvement report with sources.
4. **Act** — run `component-improver` to apply the researched changes, preserving the skill's existing value.
5. **Observe** — `component-reviewer` and a security scan validate the change; open a focused **draft** PR titled `improve: <skill-name>`.
6. **Repeat** — on the next pass the triage re-ranks and the loop moves to the next weakest skill.

## 🛑 Stopping condition
Every skill scores at or above the quality threshold, and the diffs a pass would
produce are cosmetic. Bake an exit criterion into the loop (quality bar + a cap on
PRs per pass) so it does not burn tokens optimizing toward a local maximum forever.

## 🧩 Referenced components
- `agent:expert-advisors/research-technical-spike` — investigates best practices and grades the skill (the observer).
- `agent:expert-advisors/architect-review` — reviews the proposed change before it ships.
- `command:git-workflow/create-pr` — opens the focused, reviewable draft PR.

## ⚙️ Automating it with GitHub Actions
This repo ships a manual workflow, `.github/workflows/skill-improvement-loop.yml`,
that runs the cheap triage in CI (heuristic rubric via `scripts/skill_rubric_grade.py`
plus SkillSpector) and hands the shortlist to a Claude managed agent through a
GitHub issue. The managed agent then drives the research → improve → review → PR
steps. No API key lives in the repo — the managed agent does the LLM work. Start
with `create_issue: false` to inspect the triage report, then flip it on once the
shortlist looks right.

> **Note on this repo's CI path:** internally this project drives those steps with
> repo-only agents (`component-researcher`, `component-improver`, `component-reviewer`)
> that live in `.claude/agents/`. They are maintainer tooling, not installable
> catalog components, so they are intentionally not listed in `components:` above.
> When you install this loop elsewhere, the catalog agents in `components:` fill
> those roles.

## 💡 Example
The weekly pass grades 870 skills, finds one with a vague description and no usage
examples, researches how similar skills phrase their triggers, rewrites the
description and adds a worked example, and opens `improve: humanizer` as a draft PR
for review. Next week it moves on to the next weakest skill.
