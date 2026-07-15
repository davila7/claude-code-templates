---
name: weekly-ops-report
description: Turn raw operational data into a weekly management report that answers exactly three questions - what changed, where is it concentrated, what needs a decision. Use when the user mentions weekly report, haftalık rapor, yönetim raporu, ops review, KPI summary, or asks to summarize operational data for managers. Differentiator - contract-first reporting with plain-language findings and driver decomposition, never a chart dump.
---

# Weekly Ops Report

A weekly report is a contract: *what changed, where is it concentrated, what needs a decision.* Anything that does not serve one of those three questions is decoration and gets cut.

## Workflow

1. **Data-quality gate first.** Before any KPI: duplicated rows, missing calendar days, impossible values (negative quantities, dates out of range). Fix what is safe to fix, and report every finding in a footer - an unattended report must audit its own inputs.
2. **Compute the KPI set** agreed for the audience (typical core: revenue/volume, service level, stock cover; keep it under ~6). For each: this week, vs last week, and vs the trailing 8-week average. The baseline comparison prevents one unusual prior week from faking a trend.
3. **Apply movement thresholds.** Only movements beyond agreed thresholds (state defaults, e.g. |revenue| >= 5%, |service| >= 1.5 pts) become findings. Reporting every wiggle trains readers to ignore the report.
4. **Decompose every finding.** A movement without its driver is not a finding. Break the moved metric by its main dimension (region, carrier, category...) and name the concentrated segment with its share of the move.
5. **Write findings as sentences**, one line each, using: *METRIC moved X (vs baseline) - DRIVER is the main contributor (Y, ~Z% of the move) - SUGGESTED NEXT STEP.* Tag each finding positive / negative / warning. Maximum five findings; if more qualify, keep the five largest by impact.
6. **Assemble in fixed order:** headline KPI cards, findings list, trend view (13 weeks), attention lists (e.g. low-cover SKUs), data-quality footer. Same structure every week - familiarity is what makes deltas visible.
7. **Validate before delivering.** Recompute one headline KPI directly from raw rows and match it against the report value. If automation is involved, this check runs inside the pipeline, not in someone's head.

## Pitfalls to check explicitly

- Week-over-week only (no baseline) - manufactures fake trends
- Unstated metric definitions - pair every service/on-time figure with its definition footnote
- Commentary drift - keep generated findings rule-based and auditable; human judgment belongs in a clearly separated commentary block, not mixed into computed statements
- Silent denominator changes (cancelled orders, excluded lines) between weeks

## Output format

The report skeleton in order: title + period + generation stamp; 4-6 KPI cards with deltas; "What changed and where to look" findings (max 5, tagged); 13-week trends; attention table; data-quality footer listing every issue found.

Worked implementation (scheduled pipeline, rule-based insight engine): https://github.com/gulmezeren2-byte/auto-report-pipeline

---

Source: [industrial-engineering-ai-skills](https://github.com/gulmezeren2-byte/industrial-engineering-ai-skills) by Eren Gulmez (MIT). The full method pack - entry skill, role agents, data-hygiene rules and artifact templates - lives there.
