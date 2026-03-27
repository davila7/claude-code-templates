# [Rule Category Name]

## Overview
This rule set defines [WHAT THESE RULES COVER] for the [TEAM-NAME] autonomous team.

## Purpose
These rules help agents:
- [Purpose 1]
- [Purpose 2]
- [Purpose 3]

## Scope
Applies to:
- [Scope item 1]
- [Scope item 2]
- [Scope item 3]

---

## Rules

### Rule 1: [Rule Name]

**Category**: [Category - e.g., Critical, Important, Recommended]

**Description**: 
[Detailed description of what this rule checks for]

**Detection Pattern**:
```
[How to detect violations of this rule]
```

**Why It Matters**:
[Explanation of why this rule is important]

**Examples**:

❌ **Bad**:
```
[Example of code/content that violates this rule]
```

✅ **Good**:
```
[Example of code/content that follows this rule]
```

**How to Fix**:
1. [Step 1]
2. [Step 2]
3. [Step 3]

**Confidence Indicators**:
- High (95-100%): [When you're very confident]
- Medium (85-94%): [When you're moderately confident]
- Low (70-84%): [When you're less confident]

**Related Rules**: [rule-2], [rule-5]

---

### Rule 2: [Rule Name]

**Category**: [Category]

**Description**: 
[Detailed description]

**Detection Pattern**:
```
[Detection logic]
```

**Why It Matters**:
[Importance explanation]

**Examples**:

❌ **Bad**:
```
[Bad example]
```

✅ **Good**:
```
[Good example]
```

**How to Fix**:
1. [Step 1]
2. [Step 2]

**Confidence Indicators**:
- High: [Criteria]
- Medium: [Criteria]
- Low: [Criteria]

**Related Rules**: [rule-1], [rule-3]

---

### Rule 3: [Rule Name]

**Category**: [Category]

**Description**: 
[Detailed description]

**Detection Pattern**:
```
[Detection logic]
```

**Why It Matters**:
[Importance explanation]

**Examples**:

❌ **Bad**:
```
[Bad example]
```

✅ **Good**:
```
[Good example]
```

**How to Fix**:
1. [Step 1]
2. [Step 2]

**Confidence Indicators**:
- High: [Criteria]
- Medium: [Criteria]
- Low: [Criteria]

**Related Rules**: [rule-2], [rule-4]

---

## Rule Priority Matrix

| Rule | Severity | Frequency | Priority |
|------|----------|-----------|----------|
| Rule 1 | High | Common | P0 |
| Rule 2 | Medium | Common | P1 |
| Rule 3 | Low | Rare | P2 |

## Application Guidelines

### When to Apply
- [Condition 1]
- [Condition 2]
- [Condition 3]

### When to Skip
- [Condition 1]
- [Condition 2]

### Context Considerations
- [Factor 1]
- [Factor 2]

## Common Patterns

### Pattern 1: [Pattern Name]
**Description**: [What this pattern is]
**Detection**: [How to detect]
**Fix**: [How to fix]

### Pattern 2: [Pattern Name]
**Description**: [What this pattern is]
**Detection**: [How to detect]
**Fix**: [How to fix]

## Edge Cases

### Edge Case 1: [Description]
**Scenario**: [When this happens]
**Handling**: [How to handle]

### Edge Case 2: [Description]
**Scenario**: [When this happens]
**Handling**: [How to handle]

## False Positives

### Common False Positives
1. **[False Positive Type]**: [When it occurs] → [How to avoid]
2. **[False Positive Type]**: [When it occurs] → [How to avoid]

### Reducing False Positives
- [Strategy 1]
- [Strategy 2]
- [Strategy 3]

## Integration with Agents

### Primary Agents
- **[Agent 1]**: Uses rules [1, 2, 3]
- **[Agent 2]**: Uses rules [2, 4, 5]

### Rule Dependencies
- Rule 1 → Rule 2 (must check Rule 1 first)
- Rule 3 → Rule 4 (Rule 4 depends on Rule 3)

## Metrics

### Success Criteria
- Detection rate: [Target]%
- False positive rate: <[Target]%
- Confidence average: >[Target]%

### Monitoring
Track these metrics:
- Rules triggered per run
- Confidence distribution
- Fix success rate

## Examples

### Example 1: [Scenario Name]
**Input**:
```
[Example input]
```

**Rule Applied**: Rule 1

**Detection**:
```
[What was detected]
```

**Recommendation**:
```
[What to do]
```

### Example 2: [Scenario Name]
**Input**:
```
[Example input]
```

**Rule Applied**: Rule 2

**Detection**:
```
[What was detected]
```

**Recommendation**:
```
[What to do]
```

## References

### Internal
- [Related rule file 1](./rule-2.md)
- [Related rule file 2](./rule-3.md)

### External
- [External resource 1](https://example.com)
- [External resource 2](https://example.com)

## Changelog

### Version 1.0.0
- Initial rule set
- Rules 1-3 defined

---

**Note**: These rules are continuously refined based on feedback and real-world usage. Suggest improvements via pull requests.
