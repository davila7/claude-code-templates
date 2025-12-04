# /sugar-analyze

Discover work opportunities through codebase analysis and automatically create tasks.

## Purpose

The `/sugar-analyze` command proactively discovers work by analyzing error logs, code quality issues, test coverage gaps, and GitHub issues. It's Sugar's work discovery engine that keeps your task queue filled with valuable, data-driven work items.

## Usage

### Comprehensive Analysis (All Sources)
```
/sugar-analyze
```

### Error Log Analysis
```
/sugar-analyze --errors
```

### Code Quality Analysis
```
/sugar-analyze --quality
```

### Test Coverage Analysis
```
/sugar-analyze --tests
```

### GitHub Issues Sync
```
/sugar-analyze --github
```

## Implementation

The agent performs multi-source analysis:

### Analysis Process

1. **Verify Configuration:**
   - Check `.sugar/config.yaml` discovery settings
   - Validate paths and credentials
   - Confirm enabled sources

2. **Execute Discovery:**
   - Scan error logs for recent failures
   - Analyze code for quality issues
   - Identify untested code
   - Fetch GitHub issues (if configured)

3. **Prioritize Findings:**
   - Security issues: Critical priority
   - Production errors: High priority
   - Code quality: Medium priority
   - Test coverage: Based on code importance

4. **Present Results:**
   - Group by severity/priority
   - Show context and impact
   - Recommend task creation

5. **Offer Task Creation:**
   - Create all automatically
   - Create high-priority only
   - Interactive selection
   - Generate report for later

### Result Presentation Format

```
🔍 Sugar Codebase Analysis Results
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📊 Discovery Summary
- 🐛 15 errors in logs (last 24h)
- 🔧 23 code quality issues found
- 🧪 12 files without tests
- 📝 8 open GitHub issues

🚨 Critical (Recommend Priority 5)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. [Error] NullPointerException in auth module
   Frequency: 47 occurrences (last 24h)
   Impact: User authentication failures
   Source: logs/errors/auth-errors.log:145

2. [Security] SQL injection vulnerability
   Location: src/database/queries.py:145
   Severity: Critical (CWE-89)
   Impact: Data breach risk

3. [GitHub] Database connection leak (#342)
   Labels: bug, critical, production
   Age: 2 days, 5 comments
   Impact: Production stability

⚠️ High Priority (Recommend Priority 4)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
4. [Quality] High complexity in PaymentProcessor
   Location: src/payments/processor.py
   Cyclomatic Complexity: 45 (threshold: 10)
   Size: 500+ lines

5. [Test] Missing tests for authentication
   Source: src/auth/authentication.py
   Coverage: 0%
   Critical: Yes (security-sensitive code)

[Additional findings...]

💡 Recommended Actions
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Total: 28 potential tasks discovered

Would you like to:
1. Create all tasks automatically (recommended)
2. Create only critical/high priority (12 tasks)
3. Review each finding individually
4. Save report for later review
```

## Examples

### Example 1: Error Discovery
**User:** `/sugar-analyze --errors`

**Agent Response:**
"Analyzing error logs...

```
🐛 Error Log Analysis (Last 24 Hours)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Found 15 distinct errors across 3 log files

🔴 Critical Errors (Recommend immediate action)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. NullPointerException in UserService.authenticate()
   Occurrences: 47 times
   First seen: 18 hours ago
   Last seen: 5 minutes ago
   Pattern: Happens during OAuth callback
   Impact: Users cannot log in via Google/GitHub

2. TimeoutError in PaymentGateway.charge()
   Occurrences: 23 times
   Pattern: Requests over 30 seconds timing out
   Impact: Failed payments, customer complaints

🟡 Warning Errors
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
3. CacheMiss in ProductService.getDetails()
   Occurrences: 156 times
   Impact: Slow page loads, high database load
   Note: Performance issue, not functional failure
```

**Recommendation:** Create 3 tasks

Would you like me to create these as Sugar tasks?

If yes:
```bash
sugar add \"Fix NullPointerException in OAuth callback\" --type bug_fix --urgent
sugar add \"Resolve PaymentGateway timeout issue\" --type bug_fix --priority 4
sugar add \"Implement caching for ProductService\" --type performance --priority 3
```

Tasks created! View with `/sugar-status`
"

### Example 2: Comprehensive Analysis
**User:** `/sugar-analyze`

**Agent Response:**
"Running comprehensive codebase analysis...

⏳ Scanning error logs... Done (15 issues found)
⏳ Analyzing code quality... Done (23 issues found)
⏳ Checking test coverage... Done (12 gaps found)
⏳ Syncing GitHub issues... Done (8 issues imported)

```
🔍 Comprehensive Analysis Results
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📊 Summary: 58 potential work items discovered

By Source:
- Error Logs: 15 issues
- Code Quality: 23 issues
- Test Coverage: 12 gaps
- GitHub: 8 issues

By Priority:
- 🔴 Priority 5 (Urgent): 5 items
- 🟡 Priority 4 (High): 18 items
- 🟢 Priority 3 (Medium): 35 items

Top 5 Recommendations:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. [Critical] Fix SQL injection in user search (Security)
2. [Urgent] Resolve auth NullPointerException (47 occurrences)
3. [High] Add tests for payment processing (0% coverage)
4. [High] Refactor PaymentProcessor (complexity: 45)
5. [High] Fix database connection leak (GitHub #342)
```

**Task Creation Options:**

1. **Create All (58 tasks)** - Full work backlog
   Pros: Complete coverage, nothing missed
   Cons: Large queue

2. **Create Critical + High (23 tasks)** - Recommended
   Pros: Focused on important work
   Cons: May miss some tech debt

3. **Create Critical Only (5 tasks)** - Minimal
   Pros: Immediate priorities only
   Cons: Ignores valuable improvements

4. **Interactive Review** - I'll present each finding
   Pros: Full control
   Cons: Time consuming

Which would you prefer? I recommend option 2 (Critical + High priority only).

[User selects option 2]

Creating 23 high-priority tasks...

✅ Created 23 tasks:
- 5 urgent bug fixes
- 8 code quality improvements
- 6 test coverage tasks
- 4 GitHub issues imported

View your queue: `/sugar-status`
Review tasks: `/sugar-review`
Start execution: `/sugar-run --dry-run --once`
"

### Example 3: Test Coverage Analysis
**User:** `/sugar-analyze --tests`

**Agent Response:**
"Analyzing test coverage...

```
🧪 Test Coverage Analysis
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📊 Overall Coverage: 67% (Target: 80%)

Critical Gaps (0% coverage):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. src/auth/authentication.py (0%)
   Impact: Critical - security-sensitive
   Lines: 245
   Complexity: High
   Priority: 5 (Urgent)

2. src/payments/processor.py (0%)
   Impact: Critical - revenue-impacting
   Lines: 523
   Complexity: Very High
   Priority: 5 (Urgent)

3. src/api/webhooks.py (0%)
   Impact: High - integration failures
   Lines: 156
   Priority: 4 (High)

Low Coverage (<50%):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
4. src/users/profile.py (35%)
   Missing: Error handling tests
   Priority: 3 (Medium)

5. src/notifications/email.py (42%)
   Missing: Template rendering edge cases
   Priority: 3 (Medium)

[Additional items...]
```

**Recommendations:**

These 12 files need test coverage. Prioritizing by:
1. Security-sensitive code (auth, payments)
2. Business-critical paths (webhooks, orders)
3. Frequently changed files (git history analysis)

**Create tasks?**

I can create 12 test tasks with appropriate priorities and context including:
- Specific files to test
- Suggested test scenarios
- Coverage targets
- Agent assignment (qa-test-engineer)

Proceed with task creation? [yes/no]

[If yes:]
✅ Created 12 test coverage tasks
- 2 urgent (authentication, payments)
- 3 high priority (webhooks, critical APIs)
- 7 medium priority (general coverage improvements)

These tasks include specific test scenarios and coverage targets.
View with `/sugar-review --type test`
"

## Integration with Claude Code

The command provides:
- **Proactive work discovery** from multiple sources
- **Intelligent prioritization** based on impact and severity
- **Flexible task creation** with multiple options
- **Rich context** for autonomous execution
- **Continuous improvement** through regular analysis

This ensures your Sugar system always has valuable, data-driven work to perform, keeping your codebase healthy and improving over time.
