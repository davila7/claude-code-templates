---
description: Multi-framework structured analysis: surfaces hidden assumptions, generates competing solutions, stress-tests each with adversarial reasoning, and delivers confidence-calibrated recommendations
argument-hint: [problem or question to analyze]
---

# Deep Analysis and Problem Solving Mode

Deep analysis and problem solving mode

## Instructions

Analyze the problem or question provided: **$ARGUMENTS**

Before proceeding, identify: the core challenge, key constraints, implicit assumptions, and who is affected by the outcome.

**Before beginning analysis**, check whether $ARGUMENTS provides enough context:
- If the problem is specific and the domain is clear, proceed immediately to analysis.
- If critical context is missing (e.g., the domain, the constraints, or the decision-maker's goals), ask up to three targeted questions before proceeding. Do not ask unnecessary questions.

## Required Analysis Elements

Your analysis must address all of the following. Order and depth are yours to determine based on the problem:

- **Problem framing**: What is actually being asked? What assumptions are embedded in the question?
- **Competing solutions**: At least 3 meaningfully different approaches, not variations of the same idea.
- **Multi-lens evaluation**: Assess each solution across the lenses most relevant to this problem (technical, economic, human, systemic, temporal — select and justify which apply).
- **Adversarial testing**: For each leading solution, argue against it. What would have to be true for it to fail badly? Use inversion — ask what you would do to guarantee failure, then ensure the recommendation avoids those paths.
- **Cross-domain insight**: Draw at least one non-obvious parallel from a different field or discipline.
- **Second-order effects**: What does each approach make more or less likely to happen in 6 months, 2 years, 10 years?
- **Synthesis**: Which approach or combination is recommended? Why, given the specific trade-offs?
- **Confidence calibration**: For each key claim, note where uncertainty is high and what would change the recommendation.

## Structured Output Template

Present findings using this structure:

```
## Problem Analysis
- Core challenge
- Key constraints
- Critical success factors

## Solution Options
### Option 1: [Name]
- Description
- Pros/Cons
- Implementation approach
- Risk assessment

### Option 2: [Name]
[Similar structure]

## Recommendation
- Recommended approach
- Rationale
- Implementation roadmap
- Success metrics
- Risk mitigation plan

## Alternative Perspectives
- Contrarian view
- Future considerations
- Areas for further research
```

## Output Expectations

- Every solution option is evaluated on its own merits, not just compared relatively.
- Reasoning chains are explicit — conclusions reference the evidence or logic that produced them.
- Uncertainty is surfaced, not hidden. If data is insufficient, say so and specify what would resolve it.
- The recommendation section is actionable: next steps are specific enough to begin on immediately.
- Length matches problem complexity. Avoid padding.

## Usage Examples

```bash
# Architectural decision
/ultra-think Should we migrate to microservices or improve our monolith?

# Complex problem solving
/ultra-think How do we scale our system to handle 10x traffic while reducing costs?

# Strategic planning
/ultra-think What technology stack should we choose for our next-gen platform?

# Design challenge
/ultra-think How can we improve our API to be more developer-friendly while maintaining backward compatibility?
```

> **Tip**: For the hardest decisions, enable extended thinking in your Claude Code settings. This command's structured analysis pairs with Claude's native reasoning capabilities for deeper results.
