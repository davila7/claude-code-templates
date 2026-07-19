---
name: safety-stock-review
description: Size or audit safety stock with assumption checks - the z*sigma*sqrt(LT) formula plus an empirical stress test of what it actually delivers (cycle service vs fill rate) per variability class. Use when the user mentions safety stock, emniyet stoku, emniyet stoğu, reorder point, service level, stok seviyesi belirleme. Differentiator - refuses to hand back a number without validating the demand-distribution assumptions behind it.
---

# Safety Stock Review

The textbook formula assumes roughly normal demand. Real portfolios contain SKUs where that assumption fails badly - the skill's job is to compute the number AND say where it can be trusted.

## Required data

Per-SKU demand history (`sku`, `period`, `qty`, 12+ periods), lead time (with variability if available), and the service target. Clarify early **which service the target means**: cycle service (probability of no stockout per cycle) or fill rate (share of units served) - contracts usually mean fill rate, formulas usually compute cycle service.

## Workflow

1. **Classify first.** Compute CV and zero-period share per SKU. For CV >= 1.0 or intermittent demand, state up front that the normal-formula result will be optimistic.
2. **Compute the formula result:** SS = z * sigma_d * sqrt(LT), ROP = mu_d * LT + SS (demand-period units consistent with LT). If lead time varies, use the extended form with the sigma_LT term - ignoring lead-time variance is the most common silent understatement.
3. **Stress-test empirically.** Set stock at mu + SS and replay the actual history: report both achieved cycle service (share of periods fully covered) and achieved fill rate (units served / units demanded). Zero-demand periods pass cycle service for free - fill rate is the honest one on intermittent items.
4. **Show the cost of nines.** SS at 90/95/98/99% targets for the SKUs in question - service targets are pricing decisions, and the curve makes that visible.
5. **Recommend per class**, not globally: formula fine for X-class; formula + empirical check for Y; for Z-class recommend empirical/quantile-based sizing or a policy change (MTO, lead-time reduction) instead of a bigger z.
6. **Validate.** Reconcile the stress-test denominator (total units demanded) against the raw data sum before presenting.

## Pitfalls to check explicitly

- Cycle service quoted where the contract says fill rate - a penalty clause waiting to be found.
- Normal formula on lumpy demand understates risk precisely on the items that hurt most.
- sigma computed over a period mixing trend or seasonality inflates SS everywhere; deseasonalize or use forecast-error sigma when a forecast exists.
- One global service target across the whole portfolio - targets should follow item criticality and margin.

## Output format

1. Per-SKU (or per-class) table: mu, sigma, CV, class, SS, ROP, achieved cycle service, achieved fill rate
2. Trust statement per class ("formula reliable here / optimistic here, use X instead")
3. Cost-of-nines table for the discussed target range
4. Assumption footnote: service definition, lead-time treatment, sigma source

Worked stress test with charts: https://github.com/gulmezeren2-byte/abc-xyz-inventory

---

Source: [industrial-engineering-ai-skills](https://github.com/gulmezeren2-byte/industrial-engineering-ai-skills) by Eren Gulmez (MIT). The full method pack - entry skill, role agents, data-hygiene rules and artifact templates - lives there.
