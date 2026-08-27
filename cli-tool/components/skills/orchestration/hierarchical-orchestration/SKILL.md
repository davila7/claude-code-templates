---
name: hierarchical-orchestration
description: Method for building large or greenfield software with a three-tier agent hierarchy (project-orchestrator -> subproject-pm -> swarm-worker) where EVERY tier runs a bounded, self-verifying looped pipeline (think-tank -> SDD -> TDD impl-loop -> review-repair loop). Use when a goal splits into independent subprojects that parallelize, or when you want the "most complete flow" — decomposition + a frozen shared contract + test-and-repair loops at every stage + gates. Composes with the task-execution-engine, SDD, code-review, adversarial-critic and qa-paradigms components rather than replacing them.
---

# Hierarchical Orchestration (looped)

The **most complete flow** = two orthogonal ideas composed:

- **Hierarchy** (how you *scale* work across parallel subprojects): `project-orchestrator → subproject-pm × N → swarm-worker × M`.
- **Looped pipeline** (the flow run *per unit of work*): `think-tank → SDD → TDD impl-loop → review-repair loop`, with a bounded test-and-repair loop at every stage.

Each PM runs the looped pipeline for its subproject; the root runs the pipeline's analysis stage (think-tank) once for the whole goal and owns integration. This is strictly a superset of a flat pipeline — for a single cohesive task, collapse the hierarchy to one `subproject-pm` (or your existing `feature-pipeline` / issue-flow) and just run the loops.

```
project-orchestrator      Stage A: think-tank decompose (critique loop) → FROZEN CONTRACT + integration gate
  └─ subproject-pm × N     Stage B: SDD spec/plan/tasks (critique loop, via task-execution-engine)
       └─ swarm-worker × M  Stage C: TDD loop  (test → code → run → repair, cap 3, contract-anchored)
     ↑                      Stage D: PM gate + review-repair loop (findings → fix → re-review, until 0 CRIT/HIGH)
  Stage E: integrate + integration gate (contract/e2e across seams)
```

## When to use / when NOT

- **Use** when the goal is genuinely multi-subproject and parallelizable (greenfield app = api + web + db + infra + auth; a monolith → N services migration). The hierarchy earns its coordination overhead only when subprojects can progress in parallel with minimal cross-talk.
- **Do NOT use** for a single cohesive feature — over-orchestration wastes tokens. Run the looped pipeline flat.
- **Test:** if two "subprojects" need constant coordination, they are one — merge them. Aim for 2–6 subprojects; >8 means the seams are wrong.

## The frozen contract (why decomposition comes first)

Before any PM builds, the root freezes the **shared contract**: API/OpenAPI schema, data model, auth token shape, env-var names, naming + directory conventions — written to `CONTRACT.md` / `contracts/`. It is immutable during the build; a PM that needs a change escalates to the root. **Contract drift between independently-built subprojects is the #1 failure mode of parallel builds** — the frozen contract is the single mechanism that prevents it. (Real example this pattern is designed to avoid: two services deriving a shared name/format differently and silently diverging.)

## The loop catalog (a different loop per stage)

"A loop at every stage" is right, but the *kind* of loop differs:

| Stage | Loop type | Exits when | Cap |
|-------|-----------|-----------|-----|
| think-tank (root) / SDD spec (PM) | **critique-refine** — adversarial-critic attacks the design/spec; refine | critic finds no blocking gap | 2 |
| impl (worker) | **TDD test-repair** — failing test → code → run → repair | test GREEN | 3 |
| subproject review (PM) | **review-repair** — panel finds issues → fix → re-review delta | 0 CRITICAL/HIGH | 3 |
| integration (root) | **integrate-gate** — run seam/e2e check → route failures | integration gate green | 3 |

## Loop discipline (non-negotiable — this is what makes loops safe)

1. **Bounded + escalate on cap.** Every loop has a hard attempt cap. Hitting it means STOP and surface the exact residual gap to the human — never loop autonomously past the cap. (This is the anti-loop budget: repair attempts are not free, and "try again" is not a strategy — escalation is.)
2. **Contract-anchored verification.** A loop's exit test asserts the frozen contract / acceptance criteria, never the agent's own paraphrase — so a loop cannot "converge" by rewriting its own test. (qa-paradigms **Paradigm 4**.)
3. **Independent verification.** The agent that verifies a fix is not the one that wrote it; the review-repair re-check is adversarial and blind to the author's reasoning. (Paradigm 5.)
4. **No self-healing.** A broken test/selector FAILS — it is never auto-relaxed to go green (Paradigm 1). A worker that games its own test is worse than one that honestly reports a blocker.
5. **Isolation for parallelism.** Concurrent PMs get isolated git worktrees / distinct dirs; never let two write the same files at once.

## Composes with (don't reinvent)

- **`task-execution-engine`** — the PM tracks its subproject's tasks as checkboxes in a design doc via `task_manager.py status|next`; durable + resumable state. Use it as the per-subproject backbone.
- **SDD** (`sdd-orchestrator` / the `/sdd-*` commands) — Stage B spec/plan/tasks.
- **`code-review`** panel (security / code-quality / architecture / QA) — the review-repair loop's reviewers.
- **`adversarial-critic`** — the critic in the critique-refine loops.
- **`qa-paradigms`** — the loop-discipline contracts (P1/P4/P5 above).
- Domain specialists (`backend-developer`, `frontend-developer`, `database-architect`, `devops-engineer`) — preferred swarm workers over the generic `swarm-worker`.

## Two ways to run it

**A. Adaptive (LLM-driven)** — use the `project-orchestrator` agent (and `/orchestrate-project`). The root decides the decomposition at runtime. Best when the subproject seams aren't known up front.

**B. Deterministic (Workflow tool)** — when the shape is known, encode it as a workflow script so the fan-outs and gates are explicit, guaranteed steps (no LLM drift on the control flow). This is the most robust/professional form. Reference sketch:

```js
export const meta = {
  name: 'hierarchical-build',
  description: 'Root think-tank → parallel per-subproject looped pipelines → integration gate',
  phases: [{title:'Decompose'},{title:'Subprojects'},{title:'Integrate'}],
}
// Stage A — think-tank decompose + freeze contract (with a bounded critique loop)
phase('Decompose')
let plan = await agent('Think-tank: decompose the goal into 2-6 independent subprojects + a frozen shared contract.', {schema: PLAN})
for (let i=0; i<2; i++) {                                   // critique loop, cap 2
  const crit = await agent(`Adversarially critique this decomposition for seam/contract-drift risk: ${JSON.stringify(plan)}`, {schema: CRITIQUE})
  if (!crit.blocking?.length) break
  plan = await agent(`Refine the decomposition to resolve: ${JSON.stringify(crit.blocking)}`, {schema: PLAN})
}
// Stages B–D — one PM pipeline per subproject, in parallel, each internally looped
phase('Subprojects')
const results = await parallel(plan.subprojects.map(sp => () =>
  workflow('subproject-pipeline', { subproject: sp, contract: plan.contract })  // SDD → TDD-loop swarm → review-repair loop
))
// Stage E — integration gate across the seams (bounded)
phase('Integrate')
let integ = await agent(`Run the integration gate across: ${JSON.stringify(results.filter(Boolean).map(r=>r.name))}. Verify all honor the contract.`, {schema: GATE})
for (let i=0; i<3 && !integ.pass; i++) {                    // integrate-gate loop, cap 3
  await parallel(integ.failures.map(f => () => agent(`Fix seam mismatch for ${f.subproject}: ${f.detail}`)))
  integ = await agent('Re-run the integration gate.', {schema: GATE})
}
return { subprojects: results, integration: integ }
```

The `subproject-pipeline` child workflow mirrors the `subproject-pm`: SDD (critique loop) → `parallel` swarm where each worker runs the TDD loop → PM gate → review-repair loop. Nesting is one level, so the child's own fan-outs run as its stages.

## Reuse across machines

These are `claude-code-templates` components (agents + command + this skill). Install them into any project's `.claude/` via the repo's setup/curl flow (the "Download & Ignore" pattern), or bundle them as a plugin. One repo, N laptops.
