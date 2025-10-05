# Gemini Code Review Analysis

Analyze Google Gemini AI code review comments and generate actionable refactoring strategies with intelligent prioritization.

## Purpose

Transform Gemini's automated code review feedback into structured, prioritized refactoring plans. This command bridges the gap between AI-generated review comments and practical implementation decisions, helping developers efficiently process and act on review feedback.

## Usage

```bash
/gemini-review [pr-number] [options]
```

### Options
- `--analyze-only` - Analyze comments without generating refactoring plan
- `--auto-refactor` - Automatically implement critical fixes
- `--min-severity <level>` - Filter by severity (critical|improvement|suggestion)
- `--filter <categories>` - Focus on specific categories (e.g., "security,performance")
- `--diff-only` - Analyze only changed code
- `--export <file>` - Export analysis to markdown file
- `--interactive` - Step through each comment with decision prompts

### Examples

```bash
# Analyze current PR's Gemini review
/gemini-review

# Analyze specific PR
/gemini-review 42

# Auto-fix critical issues only
/gemini-review --auto-refactor --min-severity critical

# Focus on security and performance
/gemini-review --filter "security,performance"

# Export comprehensive analysis
/gemini-review --export refactoring-plan.md
```

## What This Command Does

### 1. **Fetch Review Data**
- Retrieves PR details using GitHub CLI (`gh`)
- Extracts Gemini review comments and metadata
- Maps comments to specific code locations

### 2. **Intelligent Analysis**
- Categorizes comments by type (critical, improvement, suggestion, style)
- Assesses impact and urgency for each item
- Identifies common patterns and themes
- Evaluates implementation complexity

### 3. **Strategic Planning**
- Generates prioritized refactoring roadmap
- Estimates effort for each change
- Maps dependencies between changes
- Creates phased implementation plan

### 4. **Decision Documentation**
- Documents reasoning for each decision
- Explains trade-offs for skipped items
- Provides clear acceptance criteria
- Includes testing strategy

## Output Structure

### Review Summary
- Total comments count and distribution
- Severity breakdown
- Common themes
- Overall sentiment

### Categorized Analysis
For each review comment:
- **Category**: Critical | Improvement | Suggestion | Style
- **Location**: File path and line numbers
- **Issue**: Problem description
- **Impact**: Consequences if unaddressed
- **Decision**: Must-fix | Should-fix | Nice-to-have | Skip
- **Reasoning**: Decision rationale
- **Effort**: Time estimate

### Refactoring Strategy
- **Immediate Actions**: Must-fix items
- **Short-term**: Should-fix items
- **Long-term**: Nice-to-have items
- **Skipped**: Items not being addressed

### Implementation Plan
- **Phase 1**: Critical fixes (with time estimate)
- **Phase 2**: Important improvements
- **Phase 3**: Optional enhancements
- **Dependencies**: Implementation order
- **Testing**: Required test updates

## Decision Criteria

### Must-Fix (Critical)
- Security vulnerabilities
- Data integrity issues
- Breaking changes or runtime errors
- Critical performance problems
- Core architecture violations

### Should-Fix (Improvement)
- Maintainability issues
- Moderate performance improvements
- Best practice violations
- Significant technical debt
- Documentation gaps

### Nice-to-Have (Suggestion)
- Code style improvements
- Minor optimizations
- Optional refactoring
- Enhanced error messages
- Additional comments

### Skip (Not Applicable)
- Conflicts with project standards
- Out of scope
- Low ROI improvements
- Overly opinionated suggestions
- Already addressed

## Requirements

- **GitHub CLI** (`gh`) installed and authenticated
- **Gemini** configured as PR reviewer in repository
- **Current branch** with associated PR or PR number provided

## Integration with Workflow

### Recommended Flow
1. Create PR → Gemini reviews automatically
2. Run `/gemini-review` to analyze feedback
3. Review generated refactoring strategy
4. Implement approved changes systematically
5. Update PR with refactored code
6. Re-run if Gemini provides additional feedback

### Commit Strategy
- Group related changes by category
- Use conventional commit messages
- Separate commits for critical vs. improvements
- Document decision rationale in commits

## Real-World Example

**Scenario**: You receive a Gemini review with 15 comments on your authentication PR.

**Command**: `/gemini-review`

**Output**:
```
📊 Review Summary
- Total Comments: 15
- Critical: 2 (security vulnerability, null pointer)
- Improvements: 8 (error handling, logging, validation)
- Suggestions: 5 (naming, comments, simplification)

🔴 Must-Fix (2 items, ~2 hours)
1. [SECURITY] Password stored in plaintext (auth.js:45)
   → Use bcrypt hashing immediately

2. [BUG] Null pointer in token validation (middleware.js:78)
   → Add null check before access

🟡 Should-Fix (8 items, ~4 hours)
1. [ERROR HANDLING] Missing try-catch in login endpoint
2. [LOGGING] Add security audit logs
...

🟢 Nice-to-Have (5 items, ~2 hours)
1. [STYLE] Rename getUserData to fetchUserProfile
...

📋 Implementation Plan
Phase 1 (Critical): Fix security & null pointer → 2 hours
Phase 2 (Improvements): Error handling & logging → 4 hours
Phase 3 (Optional): Style improvements → 2 hours
```

## Why This Is Valuable

### For Individual Developers
- **Save Time**: No manual review parsing
- **Clear Priorities**: Know what to fix first
- **Better Decisions**: Understand trade-offs
- **Learn Fast**: See reasoning behind suggestions

### For Teams
- **Consistent Reviews**: Standardized analysis approach
- **Knowledge Sharing**: Documented decision rationale
- **Quality Gates**: Systematic improvement tracking
- **Efficiency**: Faster PR turnaround

### Compared to Manual Review
- ✅ **Structured**: Organized categories vs. scattered comments
- ✅ **Prioritized**: Clear urgency vs. equal weight
- ✅ **Actionable**: Implementation plan vs. just feedback
- ✅ **Documented**: Decision records vs. implicit choices
- ✅ **Efficient**: Automated analysis vs. manual processing

## Best Practices

1. **Run Early**: Analyze reviews as soon as Gemini comments
2. **Review Decisions**: Don't blindly accept all suggestions
3. **Document Trade-offs**: Explain why items are skipped
4. **Iterate**: Re-analyze after addressing critical items
5. **Share Knowledge**: Export plans for team learning

## Tips

- Use `--analyze-only` first to understand feedback before committing to changes
- Combine `--min-severity critical` with `--auto-refactor` for urgent fixes only
- Export analysis for team discussions or async review
- Filter by category when focusing on specific improvement areas
- Run in `--interactive` mode for complex refactoring decisions
