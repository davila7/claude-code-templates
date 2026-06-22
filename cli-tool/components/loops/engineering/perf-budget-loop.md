---
name: perf-budget-loop
description: Profiles and optimizes the app pass after pass until it consistently meets a defined performance budget.
category: engineering
interval: 20m
stop-condition: The target metric meets the budget across repeated runs with no functional regressions.
components: [agent:performance-testing/performance-engineer, command:performance/performance-audit, command:performance/optimize-bundle-size]
tags: [performance, optimization, profiling, loop]
---

# Performance Budget Loop

> **Loop Engineering** — hold the agent to a concrete, measurable budget and let it optimize until the number is real and stable.

## 🎯 Goal
Drive a target metric (page load, bundle size, p95 latency, etc.) under its budget by profiling, fixing the biggest bottleneck each pass, and re-measuring — without breaking functionality.

## ⏱️ Schedule
Suggested interval: `20m`.

## ▶️ Run it
```
/loop 20m "Profile the app against the performance budget. Find the single biggest bottleneck, fix it, and re-measure. Verify no tests break. Continue until the metric meets the budget across three consecutive runs."
```

## 🔁 Iteration steps
1. **Perceive** — run `/performance-audit` and capture the current metric.
2. **Reason** — the `performance-engineer` agent identifies the top bottleneck.
3. **Plan** — choose one optimization (code-split, cache, query, bundle).
4. **Act** — apply it (e.g. `/optimize-bundle-size`).
5. **Observe** — re-measure; require the budget to hold across repeated runs before stopping.

## 🛑 Stopping condition
Metric ≤ budget across consecutive runs, with no functional regression.

## 🧩 Referenced components
- `agent:performance-testing/performance-engineer` — diagnoses bottlenecks.
- `command:performance/performance-audit` — measures each pass.
- `command:performance/optimize-bundle-size` — one of the optimization levers.

## 💡 Example
Targeting a 200 KB JS budget, the loop lazy-loads a chart library, trims a moment.js import, and de-dupes a dependency until the bundle stabilizes under budget.
