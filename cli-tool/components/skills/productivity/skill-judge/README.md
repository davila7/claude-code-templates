# Skill Judge

A comprehensive evaluation framework for assessing Agent Skill quality against official specifications and best practices. This skill provides multi-dimensional scoring and actionable improvement suggestions for SKILL.md files and skill packages.

## Purpose

Skill Judge exists to solve a critical problem: **most Skills waste tokens on knowledge Claude already has**.

The skill helps you evaluate whether a Skill actually adds value by measuring its "knowledge delta" - the gap between what the Skill provides and what Claude already knows. A good Skill should be a compressed expert brain, not a tutorial.

### The Core Formula

> **Good Skill = Expert-only Knowledge - What Claude Already Knows**

This skill helps you identify:
- Token-wasting redundant content (things Claude already knows)
- Genuine expert knowledge that adds value
- Structural issues that prevent Skills from being activated or used effectively

## When to Use

Use Skill Judge when you need to:

- **Review a Skill before publishing**: Evaluate quality and identify improvements
- **Audit existing Skills**: Systematic assessment against best practices
- **Improve a SKILL.md file**: Get specific, actionable suggestions
- **Learn Skill design patterns**: Understand what makes a great Skill
- **Compare Skills**: Assess relative quality using consistent criteria

**Trigger phrases**:
- "Evaluate this skill"
- "Review my SKILL.md"
- "Audit this skill"
- "Score this skill"
- "How can I improve this skill?"
- "Is this skill well-designed?"

## How It Works

### Evaluation Protocol

1. **First Pass - Knowledge Delta Scan**: Read the SKILL.md and categorize each section as:
   - **[E] Expert**: Claude genuinely doesn't know this (value-add)
   - **[A] Activation**: Claude knows but brief reminder is useful (acceptable)
   - **[R] Redundant**: Claude definitely knows this (should delete)

2. **Structure Analysis**: Check frontmatter validity, line count, reference files, design pattern, and loading triggers

3. **Score Each Dimension**: Evaluate against 8 dimensions with specific evidence and justifications

4. **Calculate Total and Grade**: Sum scores (max 120 points) and assign grade

5. **Generate Report**: Produce structured report with scores, critical issues, and improvements

### The 8 Evaluation Dimensions (120 points total)

| Dimension | Max Points | What It Measures |
|-----------|------------|------------------|
| **D1: Knowledge Delta** | 20 | Does the Skill add genuine expert knowledge? (THE CORE DIMENSION) |
| **D2: Mindset + Procedures** | 15 | Does it transfer expert thinking patterns and domain-specific workflows? |
| **D3: Anti-Pattern Quality** | 15 | Does it have effective NEVER lists with specific reasons? |
| **D4: Specification Compliance** | 15 | Is the frontmatter valid? Is the description comprehensive? |
| **D5: Progressive Disclosure** | 15 | Is content properly layered for on-demand loading? |
| **D6: Freedom Calibration** | 15 | Is specificity appropriate for task fragility? |
| **D7: Pattern Recognition** | 10 | Does it follow an established official pattern? |
| **D8: Practical Usability** | 15 | Can an Agent actually use this Skill effectively? |

### Grading Scale

| Grade | Percentage | Meaning |
|-------|------------|---------|
| A | 90%+ (108+) | Excellent - production-ready expert Skill |
| B | 80-89% (96-107) | Good - minor improvements needed |
| C | 70-79% (84-95) | Adequate - clear improvement path |
| D | 60-69% (72-83) | Below Average - significant issues |
| F | <60% (<72) | Poor - needs fundamental redesign |

## Key Features

### Knowledge Classification System

The skill teaches you to recognize three types of content:

| Type | Definition | Treatment |
|------|------------|-----------|
| **Expert** | Claude genuinely doesn't know this | Must keep - this is the Skill's value |
| **Activation** | Claude knows but may not think of | Keep if brief - serves as reminder |
| **Redundant** | Claude definitely knows this | Should delete - wastes tokens |

### Five Official Design Patterns

Skill Judge identifies and evaluates against five established patterns:

| Pattern | Lines | Best For | Example |
|---------|-------|----------|---------|
| **Mindset** | ~50 | Creative tasks requiring taste | frontend-design |
| **Navigation** | ~30 | Multiple distinct scenarios | internal-comms |
| **Philosophy** | ~150 | Art/creation requiring originality | canvas-design |
| **Process** | ~200 | Complex multi-step projects | mcp-builder |
| **Tool** | ~300 | Precise operations on specific formats | docx, pdf, xlsx |

### Common Failure Pattern Detection

The skill identifies 9 common failure patterns:

1. **The Tutorial**: Explains basics Claude already knows
2. **The Dump**: Everything in one 800+ line file
3. **The Orphan References**: Reference files that never get loaded
4. **The Checkbox Procedure**: Mechanical steps without thinking frameworks
5. **The Vague Warning**: "Be careful" without specific guidance
6. **The Invisible Skill**: Great content but poor description
7. **The Wrong Location**: Trigger info in body instead of description
8. **The Over-Engineered**: Unnecessary auxiliary files
9. **The Freedom Mismatch**: Wrong freedom level for task type

## Usage Examples

### Basic Evaluation

```
Evaluate the skill at skills/my-new-skill/SKILL.md
```

### Comparative Analysis

```
Compare the quality of skills/skill-a and skills/skill-b
```

### Targeted Improvement

```
How can I improve the knowledge delta in my skill?
```

### Pattern Identification

```
What pattern does this skill follow, and is it the right choice?
```

## Output

Skill Judge produces a structured evaluation report:

```markdown
# Skill Evaluation Report: [Skill Name]

## Summary
- **Total Score**: X/120 (X%)
- **Grade**: [A/B/C/D/F]
- **Pattern**: [Mindset/Navigation/Philosophy/Process/Tool]
- **Knowledge Ratio**: E:A:R = X:Y:Z
- **Verdict**: [One sentence assessment]

## Dimension Scores
[Table with scores for all 8 dimensions]

## Critical Issues
[Must-fix problems]

## Top 3 Improvements
[Prioritized improvement suggestions]

## Detailed Analysis
[In-depth analysis for dimensions scoring below 80%]
```

## Best Practices

### When Evaluating Skills

**Do:**
- Always check the description field first (it's the most critical)
- Ask "Does Claude already know this?" for every section
- Look for specific anti-patterns with non-obvious reasons
- Verify decision trees actually lead to correct choices
- Check that loading triggers are embedded in workflows

**Never:**
- Give high scores just because content looks professional
- Ignore token waste from redundant explanations
- Let length impress you (43 lines can outperform 500)
- Forgive explaining basics as "helpful context"
- Put "when to use" information only in the body

### The Meta-Question

When evaluating any Skill, always ask:

> "Would an expert in this domain, looking at this Skill, say: 'Yes, this captures knowledge that took me years to learn'?"

If yes, the Skill has genuine value. If no, it's compressing what Claude already knows.

## Quick Reference Checklist

```
SKILL EVALUATION QUICK CHECK

KNOWLEDGE DELTA (most important):
  [ ] No "What is X" explanations for basic concepts
  [ ] No step-by-step tutorials for standard operations
  [ ] Has decision trees for non-obvious choices
  [ ] Has trade-offs only experts would know
  [ ] Has edge cases from real-world experience

MINDSET + PROCEDURES:
  [ ] Transfers thinking patterns (how to think about problems)
  [ ] Has "Before doing X, ask yourself..." frameworks
  [ ] Includes domain-specific procedures Claude wouldn't know

ANTI-PATTERNS:
  [ ] Has explicit NEVER list
  [ ] Anti-patterns are specific, not vague
  [ ] Includes WHY (non-obvious reasons)

SPECIFICATION:
  [ ] Valid YAML frontmatter
  [ ] Description answers: WHAT, WHEN, KEYWORDS
  [ ] Description specific enough for Agent activation

STRUCTURE:
  [ ] SKILL.md < 500 lines (ideal < 300)
  [ ] Loading triggers embedded in workflow
  [ ] Has "Do NOT Load" for preventing over-loading

FREEDOM:
  [ ] Creative tasks -> High freedom (principles)
  [ ] Fragile operations -> Low freedom (exact scripts)

USABILITY:
  [ ] Decision trees for multi-path scenarios
  [ ] Working code examples
  [ ] Error handling and fallbacks
```

## Prerequisites

None. Skill Judge is self-contained and requires no external tools or dependencies.

## Related Concepts

- **Tool vs Skill**: Tools define capability boundaries (what Claude CAN do). Skills inject knowledge (what Claude KNOWS how to do).
- **Progressive Disclosure**: Three-layer loading system (metadata -> SKILL.md body -> resources)
- **Freedom Calibration**: Matching constraint level to task fragility
