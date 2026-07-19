---
name: root-cause-pareto
description: Build a decision-grade Pareto for downtime, defects, complaints or delays - with unit-of-measure discipline, category hygiene, exposure normalization and a follow-up metric. Use when the user mentions pareto analysis, kök neden, duruş analizi, downtime, arıza analizi, defect ranking, şikayet analizi, 80/20 analysis. Differentiator - treats the Pareto as the start of a causal investigation, not a bar chart deliverable.
---

# Root-Cause Pareto

A Pareto chart is easy; a Pareto that survives challenge in a management meeting is not. The difference is four disciplines applied before the chart exists.

## Workflow

1. **Pick the unit of measure deliberately.** Occurrences, minutes, or money - choose the one closest to the pain being managed and say why. Ranking breakdowns by *count* when one category costs 10x more *minutes* per event points the team at the wrong problem. When in doubt, show count and impact side by side.
2. **Enforce category hygiene before counting:**
   - Categories must sit at one granularity level (no "Mechanical failure" next to "Sensor S-114 misaligned")
   - "Other/Miscellaneous" must stay under ~15% of the total; if it is bigger, the categorization failed - split it before proceeding
   - Merge synonyms and near-duplicates (free-text logs always contain them; list the merges made)
3. **Normalize by exposure before comparing.** Line A with 3 shifts will "lead" any raw ranking against Line B with 1 shift. Divide by machine-hours, orders, or units produced when comparing across lines, shifts, or periods - state the exposure base used.
4. **Check stability.** A Pareto from one bad week is an anecdote. Compare the ranking across at least two comparable periods; only categories that stay on top deserve investment. Note rank changes.
5. **Rank, plot, and go one level deeper on the #1 category.** Break the top category into its own sub-Pareto or apply 5-why prompts to its most frequent instances. The actionable cause is usually one level below the headline category.
6. **Define the counter-metric.** Before recommending an action, state which number should move, by roughly how much, and when to re-measure. A Pareto without a follow-up measurement is decoration.

## Pitfalls to check explicitly

- Unit mismatch (count vs duration vs cost) silently reordering priorities
- Unnormalized cross-line comparisons
- "Other" as the tallest bar
- Categories mixing symptoms ("stopped") with causes ("no material")
- Acting on unstable rankings from short windows

## Output format

1. One sentence: unit of measure, exposure base, period, and total impact covered
2. The ranked table (category, impact, share, cumulative) - chart optional, table mandatory
3. Sub-analysis of the top category with candidate root causes
4. Recommended action + counter-metric + re-measure date
5. Data notes: merges performed, rows excluded, Other%

---

Source: [industrial-engineering-ai-skills](https://github.com/gulmezeren2-byte/industrial-engineering-ai-skills) by Eren Gulmez (MIT). The full method pack - entry skill, role agents, data-hygiene rules and artifact templates - lives there.
