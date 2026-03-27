# [Team Name] Execution Example

This document shows a real execution of the [Team Name] autonomous team.

## Scenario

**Goal**: [What we're trying to accomplish]

**Input**: [What we're providing as input]

**Expected Output**: [What we expect to get]

## Execution Flow

### Step 1: Initialization

```bash
$ claude-code --team [TEAM-NAME] --target [TARGET]

[TEAM-NAME] v1.0.0
Initializing autonomous team...
✓ Loaded configuration from team.yaml
✓ Loaded 4 agents
✓ Loaded 2 rule sets
✓ Loaded 3 templates
```

### Step 2: Orchestrator Analysis

```
[ORCHESTRATOR] Analyzing scope...
  → Target: [TARGET]
  → Items found: 15
  → Complexity: Medium
  → Estimated time: 5 minutes

[ORCHESTRATOR] Planning workflow...
  → Phase 1: [PHASE-NAME] (2 agents, parallel)
  → Phase 2: [PHASE-NAME] (2 agents, parallel)
  → Phase 3: Synthesis (1 agent, sequential)
```

### Step 3: Phase 1 Execution

```
[ORCHESTRATOR] Starting Phase 1: [PHASE-NAME]
  → Delegating to [agent-1]: 15 items
  → Delegating to [agent-2]: 15 items

[AGENT-1] Processing 15 items...
  ✓ Item 1: [Result]
  ✓ Item 2: [Result]
  ✓ Item 3: [Result]
  ...
[AGENT-1] Completed in 120s
  → Found: 8 findings
  → Confidence avg: 92%

[AGENT-2] Processing 15 items...
  ✓ Item 1: [Result]
  ✓ Item 2: [Result]
  ✓ Item 3: [Result]
  ...
[AGENT-2] Completed in 115s
  → Found: 5 findings
  → Confidence avg: 88%

[ORCHESTRATOR] Phase 1 complete
  → Total findings: 13
  → Time: 120s (parallel)
```

### Step 4: Phase 2 Execution

```
[ORCHESTRATOR] Starting Phase 2: [PHASE-NAME]
  → Delegating to [agent-3]: 15 items + Phase 1 context
  → Delegating to [agent-4]: 15 items + Phase 1 context

[AGENT-3] Processing with Phase 1 context...
  ✓ Analyzing finding from [agent-1]
  ✓ Cross-referencing with [agent-2]
  ✓ Generating recommendations
  ...
[AGENT-3] Completed in 90s
  → Found: 6 findings
  → Confidence avg: 95%

[AGENT-4] Processing with Phase 1 context...
  ✓ Reviewing [agent-1] results
  ✓ Validating [agent-2] findings
  ✓ Adding insights
  ...
[AGENT-4] Completed in 85s
  → Found: 4 findings
  → Confidence avg: 91%

[ORCHESTRATOR] Phase 2 complete
  → Total findings: 10
  → Time: 90s (parallel)
```

### Step 5: Synthesis

```
[ORCHESTRATOR] Starting Phase 3: Synthesis
  → Aggregating 23 total findings
  → Resolving 2 conflicts
  → Generating final report

[ORCHESTRATOR] Conflict Resolution:
  Conflict 1: [agent-1] vs [agent-3]
    → [agent-1]: [Recommendation A]
    → [agent-3]: [Recommendation B]
    → Resolution: [Final decision]
    → Rationale: [Reasoning]

  Conflict 2: [agent-2] vs [agent-4]
    → [agent-2]: [Recommendation A]
    → [agent-4]: [Recommendation B]
    → Resolution: [Final decision]
    → Rationale: [Reasoning]

[ORCHESTRATOR] Synthesis complete
  → Final findings: 21 (2 duplicates removed)
  → Time: 30s
```

### Step 6: Output Generation

```
[ORCHESTRATOR] Generating report...
  ✓ Executive summary
  ✓ Key findings
  ✓ Detailed results by category
  ✓ Recommendations
  ✓ Metrics

[ORCHESTRATOR] Report saved: ./[TEAM-NAME]-report.md

✨ Execution complete!
  → Total time: 4m 30s
  → Items processed: 15
  → Findings: 21
  → Confidence avg: 92%
```

## Generated Report

### Executive Summary

[High-level overview of what was accomplished]

### Key Findings

1. **[Finding 1]** (Critical)
   - Source: [agent-1]
   - Confidence: 98%
   - Impact: [Description]

2. **[Finding 2]** (High)
   - Source: [agent-3]
   - Confidence: 95%
   - Impact: [Description]

3. **[Finding 3]** (Medium)
   - Source: [agent-2]
   - Confidence: 89%
   - Impact: [Description]

### Detailed Results

#### Category 1: [Category Name]
- **Finding 1.1**: [Description]
  - Detected by: [agent-1]
  - Confidence: 96%
  - Recommendation: [Action]

- **Finding 1.2**: [Description]
  - Detected by: [agent-1]
  - Confidence: 92%
  - Recommendation: [Action]

#### Category 2: [Category Name]
- **Finding 2.1**: [Description]
  - Detected by: [agent-2]
  - Confidence: 88%
  - Recommendation: [Action]

### Recommendations

1. **Immediate Actions** (P0)
   - [ ] [Action 1]
   - [ ] [Action 2]

2. **Short-term** (P1)
   - [ ] [Action 3]
   - [ ] [Action 4]

3. **Long-term** (P2)
   - [ ] [Action 5]
   - [ ] [Action 6]

### Metrics

| Metric | Value |
|--------|-------|
| Items processed | 15 |
| Total findings | 21 |
| Critical | 2 |
| High | 5 |
| Medium | 9 |
| Low | 5 |
| Avg confidence | 92% |
| Execution time | 4m 30s |
| Agents used | 4 |
| Conflicts resolved | 2 |

## Performance Analysis

### Phase Breakdown
```
Phase 1: 120s (44%)
Phase 2: 90s (33%)
Phase 3: 30s (11%)
Overhead: 30s (11%)
```

### Agent Performance
```
[agent-1]: 120s, 8 findings, 92% confidence
[agent-2]: 115s, 5 findings, 88% confidence
[agent-3]: 90s, 6 findings, 95% confidence
[agent-4]: 85s, 4 findings, 91% confidence
```

### Optimization Opportunities
- Caching could save ~30s on repeated runs
- Incremental mode could skip 5 unchanged items
- Parallel file processing could reduce Phase 1 by 20%

## Lessons Learned

### What Worked Well
1. [Success 1]
2. [Success 2]
3. [Success 3]

### What Could Improve
1. [Improvement 1]
2. [Improvement 2]
3. [Improvement 3]

### Adjustments Made
1. [Adjustment 1]
2. [Adjustment 2]

## Next Steps

1. **Implement recommendations**: Start with P0 items
2. **Monitor metrics**: Track improvement over time
3. **Refine rules**: Based on false positives
4. **Optimize workflow**: Enable caching and incremental mode

## Reproduction

To reproduce this execution:

```bash
# Clone the repository
git clone [REPO-URL]
cd [REPO-NAME]

# Install dependencies
npm install

# Run the team
claude-code --team [TEAM-NAME] --target [TARGET]

# View the report
cat [TEAM-NAME]-report.md
```

## Related Examples

- [Example 2](./example-2.md) - [Description]
- [Example 3](./example-3.md) - [Description]

---

**This example demonstrates the full power of autonomous team coordination!** 🚀
