---
name: docs-sweep-loop
description: Keeps documentation aligned with the current codebase and opens a reviewable pull request on every pass.
category: engineering
interval: 30m
stop-condition: Every public API, command and config option is documented and the docs build passes with no warnings.
components: [agent:documentation/documentation-engineer, command:documentation/update-docs, command:git-workflow/create-pr]
tags: [documentation, automation, ci, loop]
---

# Docs Sweep Loop

> **Loop Engineering** — instead of prompting the agent by hand, you define a recurring goal and let Claude observe, plan, act and verify until a stop condition is true. This loop keeps documentation continuously in sync with the code.

## 🎯 Goal
Keep the project's documentation accurate and complete as the codebase changes, and surface every update as a small, reviewable pull request rather than a giant batch.

## ⏱️ Schedule
Suggested interval: `30m` (or run after each merge to `main`).

## ▶️ Run it
```
/loop 30m "Compare the docs against the current code. Find any public API, CLI flag, config option, or behavior that changed or is undocumented. Update the docs to match, then open a focused PR. Continue until docs and code fully agree."
```

## 🔁 Iteration steps
1. **Perceive** — diff the docs against the current source (signatures, flags, env vars, examples).
2. **Reason** — list concrete drift: missing pages, stale snippets, broken links, renamed APIs.
3. **Plan** — pick the smallest meaningful slice to fix this pass.
4. **Act** — update the docs with the `documentation-engineer` agent and `/update-docs`.
5. **Observe** — build the docs; if it passes with no warnings, open a PR with `/create-pr`. Otherwise fix and repeat.

## 🛑 Stopping condition
All public surfaces are documented, examples compile, links resolve, and the docs build is warning-free.

## 🧩 Referenced components
- `agent:documentation/documentation-engineer` — drives the doc edits.
- `command:documentation/update-docs` — refreshes generated docs.
- `command:git-workflow/create-pr` — opens the reviewable PR.

## 💡 Example
After a release that renamed three CLI flags, the loop detects the drift, rewrites the affected pages and examples, verifies the build, and opens `docs: sync CLI flag renames` for review.
