# /sugar-review

Interactive task queue review and prioritization for efficient work management.

## Purpose

The `/sugar-review` command helps you efficiently review, prioritize, and manage your Sugar task queue through an interactive interface. It provides insights into workload balance, identifies stale tasks, and enables bulk operations for queue maintenance.

## Usage

### Review All Pending Tasks
```
/sugar-review
```

### Review by Priority
```
/sugar-review --priority 5
```

### Review by Type
```
/sugar-review --type bug_fix
```

### Custom Limit
```
/sugar-review --limit 20
```

## Implementation

The agent provides an interactive review experience:

1. **Fetch and Organize Queue:** Retrieve pending tasks grouped by priority
2. **Present Clearly:** Format with visual hierarchy and status indicators
3. **Offer Actions:** View details, update priority, edit, remove, or execute
4. **Provide Insights:** Analyze workload balance and recommend optimizations
5. **Enable Bulk Operations:** Support multi-task updates efficiently

### Review Presentation Format

```
📋 Sugar Task Review
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Found 15 pending tasks

🔴 Priority 5 (Urgent) - 3 tasks
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. [bug_fix] Critical auth vulnerability (task-123)
   Created: 2 hours ago
   Context: SQL injection in user search affecting production
   Agents: tech-lead, backend-developer, qa-test-engineer

2. [hotfix] Database connection pool exhaustion (task-124)
   Created: 1 hour ago
   Context: Production outage risk, 500 errors reported

3. [bug_fix] Payment processing failures (task-125)
   Created: 30 minutes ago
   Context: Stripe webhook timing out, revenue impact

🟡 Priority 4 (High) - 5 tasks
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
4. [feature] Implement OAuth2 integration (task-126)
5. [refactor] Modernize legacy authentication (task-127)
6. [test] Add E2E tests for checkout flow (task-128)
...

🟢 Priority 3 (Medium) - 7 tasks
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
...

💡 Insights & Recommendations
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚠️ Workload: Heavy on bug fixes (8 of 15) - consider refactoring sprint
✅ Priority distribution healthy
⚠️ 2 tasks over 30 days old - review or remove
💡 Several features lack agent assignments - consider adding
```

## Examples

### Example 1: Standard Review
**User:** `/sugar-review`

**Agent presents full queue, then offers:**

"Would you like to:
1. **Execute urgent tasks** - Run `/sugar-run --once` for priority 5 items
2. **Review specific task** - View details with `sugar view TASK_ID`
3. **Update priorities** - Adjust based on current needs
4. **Clean up old tasks** - Remove stale items
5. **View by type** - Filter to specific category"

### Example 2: Priority Focus
**User:** `/sugar-review --priority 5`

**Agent Response:**
"Focusing on urgent (priority 5) tasks...

🔴 3 Urgent Tasks Requiring Immediate Attention
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. Critical auth vulnerability (task-123)
   Age: 2 hours
   Impact: Security risk affecting all users
   Status: Needs immediate execution

2. Database connection exhaustion (task-124)
   Age: 1 hour
   Impact: Production 500 errors
   Status: Ready for execution

3. Payment processing failures (task-125)
   Age: 30 minutes
   Impact: Revenue loss
   Status: Needs investigation

**Recommendation:** Execute these immediately

```bash
# Start autonomous execution focusing on urgent work
/sugar-run --once
```

These tasks will be processed in order. Monitor progress:
```bash
tail -f .sugar/sugar.log
```
"

### Example 3: Workload Analysis
**User:** `/sugar-review` (with insights analysis)

**Agent Response:**
"Queue Analysis Complete - Here's what I found:

📊 Workload Distribution
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- Bug Fixes: 8 tasks (53%) ⚠️  HIGH
- Features: 4 tasks (27%)
- Tests: 2 tasks (13%)
- Refactoring: 1 task (7%)

⚠️ **Insight:** Heavy bug fix load suggests potential technical debt

**Recommendations:**
1. Address critical bugs immediately (3 priority-5 items)
2. Schedule refactoring sprint to reduce future bugs
3. Add more test tasks to prevent regressions

🕐 Age Analysis
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- <1 day: 8 tasks ✅
- 1-7 days: 5 tasks ✅
- >30 days: 2 tasks ⚠️  STALE

**Stale Tasks:**
- Redesign admin panel (task-98) - 45 days old
- Migrate to PostgreSQL (task-102) - 35 days old

**Action:** Review these tasks - still relevant? If not, remove to clean queue.

🤖 Agent Assignments
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- With agents: 9 tasks (60%)
- Without agents: 6 tasks (40%) ⚠️

**Recommendation:** Add agent assignments to unassigned tasks for better autonomous execution.

**Suggested Next Steps:**
1. Execute urgent work: `/sugar-run --once`
2. Review stale tasks: `sugar view task-98`, `sugar view task-102`
3. Add agent assignments to complex features
4. Consider scheduling refactoring sprint
"

## Integration with Claude Code

The command enables:
- **Quick queue assessment** at a glance
- **Actionable insights** from workload analysis
- **Interactive task management** with clear options
- **Bulk operations** for efficient queue maintenance
- **Strategic planning** based on queue composition

This helps users maintain a healthy, prioritized task queue that supports effective autonomous development.
