---
allowed-tools: Bash(gh:*), Read, Grep, TodoWrite, Edit, MultiEdit
argument-hint: [pr-number] | --analyze-only | --preview | --priority high|medium|low
description: Transform Gemini Code Assist PR reviews into prioritized TodoLists with automated execution
model: claude-sonnet-4-5-20250929
---

# Gemini PR Review Automation

## Why This Command Exists

**The Problem**: Gemini Code Assist provides free, automated PR reviews on GitHub. But AI-generated reviews often get ignored because they lack the urgency of human feedback.

**The Pain Point**: Manually asking Claude Code to:
1. "Analyze PR #42's Gemini review"
2. "Prioritize the issues"
3. "Create a TodoList"
4. "Start working on them"

...gets tedious fast.

**The Solution**: One command that automatically fetches Gemini's review, analyzes severity, creates prioritized TodoLists, and optionally starts execution.

## What Makes This Different

| | Code Analysis | Code Improvement | Gemini Review |
|---|---|---|---|
| **Trigger** | When you want analysis | When you want improvements | **When Gemini already reviewed** |
| **Input** | Local codebase | Local codebase | **GitHub PR's Gemini comments** |
| **Purpose** | General analysis | General improvements | **Convert AI review → actionable TODOs** |
| **Output** | Analysis report | Applied improvements | **TodoList + Priority + Execution** |

## Triggers
- PR has Gemini Code Assist review comments waiting to be addressed
- Need to convert AI feedback into structured action items
- Want to systematically process automated review feedback
- Reduce manual context switching between GitHub and development

## Usage
```bash
/gemini-review [pr-number] [--analyze-only] [--preview] [--priority high|medium|low]
```

## Behavioral Flow
1. **Fetch**: Retrieve PR details and Gemini review comments using GitHub CLI
2. **Analyze**: Parse and categorize review comments by type and severity
3. **Prioritize**: Assess each comment for refactoring necessity and impact
4. **TodoList**: Generate structured TodoList with priority ordering
5. **Execute**: (Optional) Start working on high-priority items with user confirmation

Key behaviors:
- Intelligent comment categorization (critical, improvement, suggestion, style)
- Impact assessment for each review item with effort estimation
- Automatic TodoList creation with priority matrix (must-fix, should-fix, nice-to-have)
- Code location mapping and dependency analysis
- Implementation strategy with phased approach

## Tool Coordination
- **Bash**: GitHub CLI operations for PR and review data fetching
- **Sequential Thinking**: Multi-step reasoning for complex refactoring decisions
- **Grep**: Code pattern analysis and issue location identification
- **Read**: Source code inspection for context understanding
- **TodoWrite**: Automatic TodoList generation with priorities
- **Edit/MultiEdit**: Code modifications when executing fixes

## Key Patterns
- **Review Parsing**: Gemini comments → structured analysis data
- **Severity Classification**: Comment type → priority level assignment (Must-fix/Should-fix/Nice-to-have/Skip)
- **TodoList Generation**: Analysis results → TodoWrite with prioritized items
- **Impact Analysis**: Code changes → ripple effect assessment
- **Execution Planning**: Strategy → actionable implementation steps

## Examples

### Analyze Current Branch's PR
```bash
/gemini-review
# Automatically detects current branch's PR
# Generates prioritized TodoList from Gemini review
# Ready to execute after user confirmation
```

### Analyze Specific PR
```bash
/gemini-review 42
# Analyzes Gemini review comments on PR #42
# Creates prioritized TodoList with effort estimates
```

### Preview Mode (Safe Execution)
```bash
/gemini-review --preview
# Shows what would be fixed without applying changes
# Creates TodoList for manual execution
# Allows review before implementation
```

## Real Workflow Example

**Before (Manual, Tedious)**:
```bash
1. Open GitHub PR page
2. Read Gemini review (often skipped because "AI generated")
3. Tell Claude: "Analyze PR #42 Gemini review"
4. Tell Claude: "Prioritize these issues"
5. Tell Claude: "Create TodoList"
6. Tell Claude: "Start working on them"
```

**After (Automated)**:
```bash
/gemini-review 42
# → TodoList automatically created
# → Priorities set based on severity
# → Ready to execute immediately
```

## Analysis Output Structure

### 1. Review Summary
- Total comments count by severity
- Severity distribution (critical/improvement/suggestion/style)
- Common themes and patterns identified
- Overall review sentiment and key focus areas
- Estimated total effort required

### 2. Categorized Analysis
For each review comment:
- **Category**: Critical | Improvement | Suggestion | Style
- **Location**: File path and line numbers with context
- **Issue**: Description of the problem from Gemini
- **Impact**: Potential consequences if unaddressed
- **Decision**: Must-fix | Should-fix | Nice-to-have | Skip
- **Reasoning**: Why this priority was assigned
- **Effort**: Estimated implementation time (Small/Medium/Large)

### 3. TodoList Generation

**Automatically creates TodoList with user confirmation before execution**

```
High Priority (Must-Fix):
✓ Fix SQL injection in auth.js:45 (15 min)
✓ Remove exposed API key in config.js:12 (5 min)

Medium Priority (Should-Fix):
○ Refactor UserService complexity (45 min)
○ Add error handling to payment flow (30 min)

Low Priority (Nice-to-Have):
○ Update JSDoc comments (20 min)
○ Rename variable for clarity (5 min)

Skipped:
- Style suggestion conflicts with project standards
- Already addressed in different approach
```

*Note: User reviews and confirms TodoList before any code modifications are made*

### 4. Execution Plan
- **Phase 1 - Critical Fixes**: Security and breaking issues (immediate)
- **Phase 2 - Important Improvements**: Maintainability and performance (same PR)
- **Phase 3 - Optional Enhancements**: Style and documentation (future PR)
- **Dependencies**: Order of implementation based on code dependencies
- **Testing Strategy**: Required test updates for each phase

### 5. Decision Record
- **Accepted Changes**: What will be implemented and why
- **Deferred Changes**: What will be addressed in future iterations
- **Rejected Changes**: What won't be implemented and reasoning
- **Trade-offs**: Analyzed costs vs. benefits for each decision

## Boundaries

**Will:**
- Fetch and analyze Gemini Code Assist review comments from GitHub PRs
- Categorize and prioritize review feedback systematically
- Generate TodoLists with priority ordering and effort estimates
- Provide decision reasoning and trade-off analysis
- Map review comments to specific code locations
- Execute fixes with user confirmation in preview mode

**Will Not:**
- Automatically implement changes without user review (unless explicitly requested)
- Dismiss Gemini suggestions without analysis and documentation
- Make architectural decisions without considering project context
- Modify code outside the scope of review comments
- Work with non-Gemini review systems (GitHub Copilot, CodeRabbit, etc.)

## Decision Criteria

### Must-Fix (Critical) - High Priority
- Security vulnerabilities and data exposure
- Data integrity issues and potential corruption
- Breaking changes or runtime errors
- Critical performance problems (>100ms delay, memory leaks)
- Violations of core architecture principles

### Should-Fix (Improvement) - Medium Priority
- Code maintainability issues and technical debt
- Moderate performance improvements (10-100ms gains)
- Important best practice violations
- Significant readability and documentation gaps
- Error handling and resilience improvements

### Nice-to-Have (Suggestion) - Low Priority
- Code style improvements and formatting
- Minor optimizations (<10ms gains)
- Optional refactoring opportunities
- Enhanced error messages and logging
- Additional code comments and documentation

### Skip (Not Applicable)
- Conflicts with established project standards
- Out of scope for current iteration
- Low ROI improvements (high effort, low impact)
- Overly opinionated suggestions without clear benefit
- Already addressed by other means or different approach

## Integration with Git Workflow

### Recommended Flow
```bash
1. Create PR → Gemini reviews automatically
2. Run /gemini-review to generate TodoList
3. Review TodoList priorities and adjust if needed
4. Execute fixes systematically (Phase 1 → Phase 2 → Phase 3)
5. Commit changes with conventional commit messages
6. Update PR and re-request Gemini review if needed
```

### Commit Strategy
- Group related refactoring changes by category
- Use conventional commit messages referencing review items
  - `fix(auth): resolve SQL injection vulnerability (Gemini PR#42)`
  - `refactor(services): reduce UserService complexity (Gemini PR#42)`
  - `docs: update JSDoc comments (Gemini PR#42)`
- Create separate commits for critical vs. improvement changes
- Document decision rationale in commit messages

## Advanced Usage

### Interactive Mode (Recommended for Complex Reviews)
```
/gemini-review --interactive
# Step through each review comment with decision prompts
# Allows manual priority adjustment
# Shows code context for each issue
```

### Export Analysis
```
/gemini-review --export gemini-analysis.md
# Export comprehensive analysis to markdown file
# Useful for team review and documentation
# Includes all decisions and reasoning
```

### Dry Run (No TodoList Creation)
```
/gemini-review --dry-run
# Shows analysis and priorities without creating TodoList
# Useful for understanding scope before committing
# No changes to workflow state
```

## Tool Requirements
- **GitHub CLI** (`gh`) installed and authenticated
- **Repository** must have Gemini Code Assist configured as PR reviewer
- **Current branch** must have associated PR or provide PR number explicitly

## Setup Gemini Code Assist

If you haven't set up Gemini Code Assist yet:

1. Visit [Gemini Code Assist GitHub App](https://developers.google.com/gemini-code-assist/docs/set-up-code-assist-github)
2. Install the app on your organization/account
3. Select repositories for integration
4. Gemini will automatically review PRs with `/gemini` tag or auto-review

**Why Gemini?**
- **Free**: No cost for automated PR reviews
- **Comprehensive**: Covers security, performance, best practices
- **GitHub Native**: Integrated directly into PR workflow
- **Automated**: No manual review requests needed

## Limitations

- Only supports Gemini Code Assist reviews (not GitHub Copilot, CodeRabbit, etc.)
- Requires GitHub CLI access and authentication
- Analysis quality depends on Gemini review quality
- Cannot modify reviews or re-trigger Gemini analysis
