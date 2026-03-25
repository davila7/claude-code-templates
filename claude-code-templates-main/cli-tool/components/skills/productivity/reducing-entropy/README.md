# Reducing Entropy

A manual-only skill for minimizing total codebase size by measuring success through final code amount, not effort. Biases toward deletion and aggressive simplification.

## Purpose

This skill exists to counter the natural tendency of codebases to grow over time. It provides a framework for evaluating changes based on whether they **reduce the total amount of code** in the final codebase, not just minimize the work required now.

More code creates more entropy. More entropy means more bugs, more maintenance, more cognitive load. This skill fights that trend.

## When to Use It

Use this skill when:

- Refactoring existing code and want to minimize the result
- Evaluating feature requests (should we add this?)
- Cleaning up technical debt
- Deciding between implementation approaches
- The user explicitly asks to "reduce entropy" or "minimize code"
- You need to bias toward deletion over addition

**Do NOT use automatically.** This is a manual-only skill that requires explicit user request.

## How It Works

### Core Philosophy

**Measure the end state, not the effort.**

- Writing 50 lines that delete 200 lines = net win (-150 lines)
- Keeping 14 functions to avoid writing 2 = net loss (+12 functions)
- "No churn" is not a goal. Less total code is the goal.

### The Three Questions

Every change must answer:

1. **What's the smallest codebase that solves this?**
   - Not "smallest change" but smallest *result*
   - Could this be 2 functions instead of 14?
   - Could this be 0 functions (delete the feature)?

2. **Does this result in less total code?**
   - Count lines/functions before vs. after
   - If after > before, reject it
   - "Better organized" but more code = more entropy

3. **What can we delete?**
   - What does this make obsolete?
   - What was only needed because of what we're replacing?
   - What's the maximum we could remove?

### Reference Mindsets

Before starting, **you must load at least one mindset** from the `references/` directory. These provide philosophical grounding for radical simplification:

1. List files in `references/`
2. Read frontmatter to see which applies
3. Load at least one
4. State which you loaded and its core principle

**Do not proceed without loading a mindset.**

## Key Features

- **Deletion Bias**: Default action is to remove, not add
- **Total Code Metric**: Success measured by final codebase size
- **Anti-Pattern Detection**: Flags common excuses for adding code
- **Mindset-Driven**: Loads philosophical frameworks to guide decisions
- **Effort Agnostic**: Doesn't care about rewrite effort, only end result

## Red Flags

This skill actively rejects these common arguments:

| Argument | Why It's Rejected |
|----------|-------------------|
| "Keep what exists" | Status quo bias. The question is total code, not churn. |
| "This adds flexibility" | Flexibility for what? YAGNI. |
| "Better separation of concerns" | More files/functions = more code. Separation isn't free. |
| "Type safety" | Worth how many lines? Sometimes runtime checks win. |
| "Easier to understand" | 14 things are not easier than 2 things. |

## When This Doesn't Apply

Don't use this skill when:

- The codebase is already minimal for what it does
- Working in a framework with strong conventions (don't fight it)
- Regulatory/compliance requirements mandate certain structures
- User wants to add functionality and accepts the code cost

## Usage Example

```
User: "I need to add validation to these 5 forms"

Standard approach:
- Create validation schema for each form (5 files)
- Add validation helper functions (1 file)
- Update each form component (5 files modified)
- Total: +6 files, ~300 lines added

Reducing Entropy approach:
1. Load mindset (e.g., "worse-is-better.md")
2. Ask: What's the smallest codebase that solves this?
   - Could we have 1 validation function instead of 5 schemas?
   - Do all 5 forms need validation or just 2?
   - Can we delete 3 forms and merge functionality?
3. Count before/after:
   - Before: 5 forms + 0 validation = 500 lines
   - Option A: 5 forms + 6 validation files = 800 lines (reject)
   - Option B: 2 forms + 1 validation function = 350 lines (accept)
4. Delete: Remove 3 forms, add 1 function
   - Net result: -150 lines
```

## Related Files

- `references/` - Philosophical mindsets to load before starting
- `adding-reference-mindsets.md` - How to add new mindsets

## Success Metrics

You've succeeded when:

- Total lines of code decreased
- Number of files decreased
- Number of functions/classes decreased
- Features work the same (or better) with less code
- You deleted more than you added

---

**Bias toward deletion. Measure the end state.**
