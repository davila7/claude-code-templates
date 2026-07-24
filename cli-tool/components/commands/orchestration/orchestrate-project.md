---
allowed-tools: Read, Write, Edit, Bash, Glob, Grep, Task, TodoWrite, AskUserQuestion
argument-hint: "<goal or path to a project brief>" [--subprojects a,b,c] [--worktrees]
description: Kick off a hierarchical, looped build — think-tank decomposition + one PM per subproject (each running SDD -> TDD impl-loop -> review-repair loop) + an integration gate. For greenfield or multi-subproject work that parallelizes.
---

# Orchestrate Project (hierarchical + looped)

Run a full hierarchical build for: **$ARGUMENTS**

Topology (see the `hierarchical-orchestration` skill for the method + the deterministic-workflow variant):

```
project-orchestrator  → think-tank decompose + freeze CONTRACT + integration gate
  └─ subproject-pm × N → SDD (task-execution-engine) → swarm → PM gate → review-repair loop
       └─ swarm-worker × M → TDD test-repair loop (bounded, contract-anchored)
```

## Preflight

- Is this genuinely multi-subproject and parallelizable? !`echo "check: does the goal split into 2-6 independent slices (e.g. api/web/db/infra/auth)?"`
- If it is ONE cohesive task → do NOT use this; run the flat looped pipeline (a single `subproject-pm`, or your `feature-pipeline` / issue-flow). Say so and stop.
- Existing contract/design docs to honor: @CONTRACT.md @contracts/ @docs/designs/ (if present)
- Git state (for worktree isolation): !`git rev-parse --is-inside-work-tree 2>/dev/null && git status --porcelain | head -5`

## Execute

1. **Dispatch the root**: spawn the `project-orchestrator` agent with the goal `$ARGUMENTS`, any existing contract/design docs, and the flags:
   - `--subprojects a,b,c` — pin the decomposition (skip the think-tank's proposal step but still run its critique loop on the given split).
   - `--worktrees` — give each subproject-pm an isolated git worktree (use when PMs mutate files in parallel).
2. The root runs **Stage A** (think-tank decompose + freeze the shared contract to `CONTRACT.md`), then dispatches one **subproject-pm** per subproject (each runs SDD → swarm with TDD loops → PM gate → review-repair loop), then **Stage E** (integrate + integration gate).
3. **Human gates** (ask, don't assume): confirm the decomposition + frozen contract BEFORE the PMs build (one `AskUserQuestion`), and surface any loop that hit its cap for a decision. Everything between gates runs unattended.

## Guardrails (enforced by the agents; do not bypass)

- Every loop is **bounded** (critique 2 / TDD 3 / review-repair 3 / integration 3) and **escalates on cap** — no infinite autonomous looping.
- Loop exit tests are **contract-anchored** (assert the frozen contract/criteria, not a paraphrase) and **independently verified** (the re-checker didn't write the fix).
- Never report "done" if the integration gate didn't run, a loop silently capped, or a subproject didn't build. Surface truncation explicitly.

## Output

The root's structured report: per-subproject verdicts + loop iterations, the integration gate result, and every deferred/escalated item.
