---
name: guided-goal
description: Turn a rough objective into a bounded, verifiable completion contract, confirm it, then execute it with a finite attempt cap. Use when the user wants autonomous work but the outcome, proof, scope, or stopping point is still vague.
license: MIT
compatibility: Works in Agent Skills clients; Hermes adds native persisted goal activation.
metadata:
  author: LuchasArie
  repo: https://github.com/luchasarie/guided-goal
  version: "0.2.1"
---

# Guided Goal

Convert rough intent into a completion contract before doing the work. The interview and execution are separate phases.

## Phase 1 — Interview without acting

During the interview:

- Ask exactly one short question per response.
- Do not inspect files, search, delegate, run commands, edit anything, or call tools.
- Ask at most six questions. Ask fewer when the answer is already known.
- Ask for the highest-value missing field, not every possible detail.
- Preserve concrete facts and constraints already supplied. Never make the user repeat them.
- Use relevant project, stack, environment, and verification facts already present in conversation context.
- Do not turn the goal into a planning exercise unless planning is the requested outcome.
- Push back on subjective success, self-evaluated quality, unbounded iteration, missing verification, vague boundaries, or absent stop conditions.
- If the user cancels, stop without activating or executing anything.

Before activation, establish all of these:

1. one bounded objective;
2. binary or deterministic success criteria;
3. exact commands, checks, artifacts, or observable evidence that prove completion;
4. allowed scope and an explicit denylist;
5. a numeric attempt cap from 1 to 100 plus escalation or hard-stop conditions.

When ready, present exactly this structure:

## Objective
<one bounded objective>

## Success criteria
<binary or deterministic criteria>

## Verification
<exact commands, checks, artifacts, or observable evidence>

## Boundaries
<allowed scope and explicit denylist>

## Stop conditions
<explicit numeric attempt cap plus escalation or hard-stop conditions>

Then ask exactly one question: **Activate this goal?**

## Phase 2 — Require explicit confirmation

Do not activate from silence, ambiguity, or a general acknowledgment. Accept only an explicit confirmation that clearly refers to the presented contract.

If the user changes the objective, criteria, verification, boundaries, or stop conditions, present the revised full contract and ask **Activate this goal?** again. A confirmation for an older contract does not authorize the revised one.

## Phase 3 — Activate through the available host

After explicit confirmation, use the first applicable mode:

### Hermes native mode

If the host exposes `guided_goal_activate`, call it with the complete five-section Markdown contract in its `objective` argument. If the tool is deferred, load its schema through the host's normal deferred-tool mechanism first. After successful activation, begin working immediately. Do not ask for confirmation again.

### Portable in-session mode

If no native activation tool exists:

1. State that the contract is activated for the current session. Do not claim it is persisted, backgrounded, or enforced by a native goal judge.
2. Execute the contract immediately using the host's normal tools and approval system. Do not substitute a similarly named planning or goal-recording tool such as `create_goal`; only `guided_goal_activate` qualifies as the native activation path for this skill.
3. Count one attempt as one meaningful change-or-investigation cycle followed by the contract's verification, not as each individual tool call.
4. After each failed attempt, use the evidence to choose a materially different next attempt. Do not repeat the same failed action unchanged.
5. Stop as soon as every success criterion passes its stated verification.
6. Stop and report the exact blocker when the attempt cap is reached, a denylisted action becomes necessary, required authorization is unavailable, or another hard-stop condition fires.
7. Never broaden scope silently. A material scope change requires a revised contract and fresh confirmation.

Use a native task list or status surface when available, but do not make one a prerequisite. If the session must end before completion, return the full contract, attempt count, verified evidence, current blocker, and next executable action as a resumable handoff.

## Completion report

A completion claim must name the verification actually run and its result. A timeout, skipped check, plausible-looking output, or agent self-assessment is not a pass.
