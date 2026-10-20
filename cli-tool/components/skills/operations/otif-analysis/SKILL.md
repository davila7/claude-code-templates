---
name: otif-analysis
description: Audit delivery performance from order-level data - compute the OTIF metric ladder (tolerant to strict), find where lateness concentrates, and quantify the gap between the reported KPI and what customers experience. Use when the user mentions OTIF, on-time delivery, delivery performance, late orders, teslimat performansı, zamanında teslimat, or asks why customers complain despite a high on-time score. Differentiator - exposes measurement choices before optimizing operations.
---

# OTIF Analysis

Most "delivery problems" are measurement problems first. Before recommending any operational fix, establish what the honest number is and which definition choices inflate the reported one.

## Required data

Order-level rows with: `order_id`, `requested_delivery_date` (what the customer asked for), `promised_delivery_date` (what was confirmed), `actual_delivery_date`, completeness info (lines ordered vs delivered, or qty ordered vs delivered), and a status/cancelled flag. Useful cuts: carrier, region, customer, product family.

If `requested_delivery_date` is missing, say so explicitly: only the promised-date rungs are computable, and the analysis cannot see sales-padding. Recommend capturing the requested date going forward.

## Workflow

1. **Validate before computing.** Count duplicated order rows; flag impossible dates (actual before order date); count cancelled orders and state how they will be treated. Report these counts in the output - an audit that silently cleans data is not an audit.
2. **Compute the metric ladder** on the same population, strictest last:
   - L1: on-time vs promised date, with the tolerance window currently in use (ask what it is; if unknown, show +3 days and label it)
   - L2: on-time vs promised, zero tolerance
   - L3: on-time vs *requested*, zero tolerance
   - L4: **OTIF** = on-time vs requested AND order complete (all lines / full qty). In-full is judged at order level - a 9-of-10-lines delivery is not 90% on-time, it is one incomplete order
   - L5: OTIF with cancelled orders kept in the denominator
   Present the ladder as a table with the delta and the cause of each drop (tolerance, padding, partials, cancellations).
3. **Decompose the gap.** For the dimension with the largest spread (try carrier, region, month, customer, product family), show OTIF per segment. Name the concentrated driver, not just the average.
4. **Analyze the tail, not the mean.** Average lateness hides the distribution. Report the share of orders 4+ days late and the worst decile - those are the orders customers remember.
5. **Reconcile before reporting.** Recompute the headline OTIF once more directly from raw rows (single pass, no intermediate tables) and confirm it matches. If it does not, stop and find out why.

## Pitfalls to check explicitly

- **Anchor choice**: promised-date metrics hide sales padding. Compute average (promised - requested) days; if > 0.5, quantify its KPI effect.
- **Tolerance windows** are policy, not truth. Show the tolerance-sensitivity curve if the tolerance is contested.
- **Cancelled orders** quietly leaving the denominator flatter the metric.
- **Line-level averaging** overstates performance versus order-level in-full.

## Output format

1. The ladder table (definition, result %, delta, cause)
2. Three finding sentences, each: what moved / where it concentrates / what decision it needs
3. A definitions footnote stating anchor date, tolerance, in-full rule and cancellation treatment - so the number cannot be misread

Worked example with charts and synthetic data: https://github.com/gulmezeren2-byte/otif-analytics

---

Source: [industrial-engineering-ai-skills](https://github.com/gulmezeren2-byte/industrial-engineering-ai-skills) by Eren Gulmez (MIT). The full method pack - entry skill, role agents, data-hygiene rules and artifact templates - lives there.
