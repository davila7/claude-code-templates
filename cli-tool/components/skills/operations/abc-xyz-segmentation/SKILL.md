---
name: abc-xyz-segmentation
description: Segment a SKU portfolio on value (ABC) and demand variability (XYZ), produce the 9-box with a planning policy per cell, and reallocate planner attention accordingly. Use when the user mentions ABC analysis, inventory segmentation, SKU rationalization, stok segmentasyonu, envanter sınıflandırma, or asks which items deserve forecasting effort. Differentiator - ABC alone is treated as half an answer; policy lives in the value x variability combination.
---

# ABC-XYZ Segmentation

Value tells you where the money is. Variability tells you whether forecasting, buffering or restructuring can work. Never output a classification without the policy consequences.

## Required data

Per-SKU demand history (`sku`, `period`, `qty`) covering 12+ periods, plus unit value (`unit_price` or cost). Without unit value, ABC degrades to a volume ranking - say so and ask for prices before presenting conclusions about money.

## Workflow

1. **ABC on annual value.** Rank by annual consumption value; cumulative 80% = A, next 15% = B, rest = C. Report the actual concentration found (e.g. "15 SKUs = 80%"), not the folklore 20/80.
2. **XYZ on variability.** CV = std/mean of period demand per SKU. Defaults: X < 0.5, Y 0.5-1.0, Z >= 1.0. These are conventions - check the CV histogram for natural breaks and state the thresholds used. SKUs with structural zero periods (intermittent) belong in Z regardless of CV arithmetic; mean-based CV understates their risk.
3. **Build the 9-box** with SKU counts AND value share per cell. Value share is what makes managers act.
4. **Attach the policy per cell** (adapt wording to context):
   - A-X: tight forecasting pays; low buffer, frequent review, automate replenishment
   - A-Y: forecast + healthy buffer; investigate variability drivers
   - A-Z: do not chase forecasts - strategic buffer, lead-time negotiation, or make-to-order
   - B-X / C-X: min-max autopilot; withdraw planner attention
   - B-Z: buffer or longer promise dates; check if variability is self-inflicted (promotions, batching)
   - C-Z: rationalization shortlist - kill, consolidate, or on-demand sourcing
5. **Name the reallocation.** The deliverable is planner-hours and buffer money moving between cells - state explicitly which cells gain and lose attention.
6. **Validate.** Sum of cell value shares must equal 100%; spot-check two SKUs' classifications against their raw series before presenting.

## Pitfalls to check explicitly

- ABC computed on quantity while unit values vary 10x+ ranks the wrong items.
- Self-inflicted variability (order batching, month-end pushes, promotions) shows up as Z; flag it as a process fix, not a demand fact.
- Classifications rot - recommend re-running quarterly and tracking cell migrations.
- A dominant "C-Z is 60% of SKUs" finding usually signals assortment bloat, not a planning problem.

## Output format

1. The 9-box (counts + value share per cell)
2. Policy table per occupied cell
3. Attention-reallocation paragraph (from where, to where)
4. Rationalization shortlist (top C-Z items by holding cost or shelf age, if data allows)

Worked example including a safety-stock stress test: https://github.com/gulmezeren2-byte/abc-xyz-inventory

---

Source: [industrial-engineering-ai-skills](https://github.com/gulmezeren2-byte/industrial-engineering-ai-skills) by Eren Gulmez (MIT). The full method pack - entry skill, role agents, data-hygiene rules and artifact templates - lives there.
