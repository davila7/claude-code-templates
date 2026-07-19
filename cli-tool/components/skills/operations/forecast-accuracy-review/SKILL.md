---
name: forecast-accuracy-review
description: Evaluate demand-forecast quality honestly - WMAPE, bias and Forecast Value Added against a naive benchmark over a rolling-origin backtest. Use when the user mentions forecast accuracy, MAPE, demand planning performance, tahmin doğruluğu, talep tahmini, or asks whether a forecasting process or tool is worth it. Differentiator - judges the process (value added vs doing nothing), not just the model.
---

# Forecast Accuracy Review

A forecast is only worth what it adds over the free alternative: shipping last period's number. Every review must answer "how many points does this process add over naive?" before any model discussion.

## Required data

Per-SKU demand history at the planning bucket (usually monthly): `sku`, `period`, `qty`. If evaluating an existing forecast, also the forecast values with their creation dates (to avoid hindsight leakage). 18+ periods per SKU for a meaningful backtest; flag SKUs with less.

## Workflow

1. **Profile the demand first.** Per SKU compute mean, CV and zero-period share; classify smooth / erratic / intermittent / lumpy (defaults: CV 0.5 and 1.0 boundaries, intermittency at >25% zero periods - state them, adjust to natural breaks). Accuracy expectations differ by class; never report one blended number alone.
2. **Set the benchmarks.** Naive (last period) always; seasonal naive when 2+ full seasons exist. These are non-negotiable controls.
3. **Backtest rolling-origin.** One-step-ahead forecasts for each of the last 6+ periods, expanding window, using only data before each origin. A single train/test split is one lucky draw - do not accept it.
4. **Score with honest metrics:**
   - **WMAPE** = sum(|error|) / sum(actual) - the volume-weighted headline
   - **Bias** = sum(error) / sum(actual) - direction; a fine WMAPE with persistent bias is quietly building excess stock or stockouts
   - MAPE only as a footnote, and always disclose how many zero-actual periods it dropped
5. **Deliver the FVA verdict.** FVA = WMAPE(naive) - WMAPE(candidate), per segment and overall. Negative FVA means the process destroys value - say it plainly.
6. **Validate.** Recompute WMAPE for one model directly from the raw backtest rows and confirm it matches the table before presenting.

## Pitfalls to check explicitly

- **MAPE with zeros**: undefined on zero-actual periods; silently dropping them fakes precision on intermittent SKUs.
- **MAPE asymmetry** rewards under-forecasting (errors capped at 100% below, unbounded above).
- **Aggregation mix**: a good total can hide terrible A-item accuracy; always show the value-weighted cut.
- **Lumpy segments**: if WMAPE > ~100%, the honest recommendation is an inventory-policy answer (buffers, MTO), not a better model.
- **Hindsight leakage**: forecasts must predate actuals; check timestamps when auditing an existing process.

## Output format

1. Scoreboard table: model x (WMAPE, bias, MAPE-footnote), sorted by WMAPE
2. FVA statement: "the process adds/destroys X points vs naive" - overall and per segment
3. Segment table (pattern x best approach)
4. Two or three recommendation sentences tied to segments, not globals

Worked example with five baseline models and charts: https://github.com/gulmezeren2-byte/forecast-accuracy-lab

---

Source: [industrial-engineering-ai-skills](https://github.com/gulmezeren2-byte/industrial-engineering-ai-skills) by Eren Gulmez (MIT). The full method pack - entry skill, role agents, data-hygiene rules and artifact templates - lives there.
