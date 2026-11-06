---
allowed-tools: Read, Bash
argument-hint: "[--detailed] [--tasks <n>]"
description: Show Sugar system status, queue statistics and health recommendations
---

# /sugar-status

View real-time Sugar system status, task queue, and execution metrics with actionable insights.

## Purpose

The `/sugar-status` command provides a comprehensive overview of your Sugar autonomous development system's current state, including task queue status, execution metrics, and health indicators. It helps you quickly assess what work is pending, what's executing, and what's been completed.

## Usage

### Basic Status
```
/sugar-status
```
Shows standard status view with task summary and recent queue items.

### Detailed Status
```
/sugar-status --detailed
```
Includes configuration details, failed tasks, active task progress, and system health information.

### Limit Task Display
```
/sugar-status --tasks 20
```
Shows more or fewer recent tasks (default: 5).

## Implementation

When invoked, the agent will:

1. **Gather System Status:**
   - Execute `sugar status` to get overall system state
   - Execute `sugar list --limit N` for recent tasks
   - Check autonomous execution status
   - Review recent completions and failures

2. **Present Information Clearly:**
   - Format results in scannable, organized layout
   - Use status indicators (⏳ pending, ⚡ active, ✅ completed, ❌ failed)
   - Highlight urgent items and critical issues
   - Show key metrics at a glance

3. **Provide Actionable Insights:**
   - Identify issues requiring attention
   - Recommend next steps based on current state
   - Suggest optimizations if needed
   - Flag health concerns

4. **Follow-up Recommendations:**
   - Suggest relevant commands based on status
   - Offer troubleshooting for detected issues
   - Guide on starting or managing autonomous mode

### Standard Status View Format

```
📊 Sugar System Status
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

⚙️  System: Active
📋 Total Tasks: 45
   ⏳ Pending: 20
   ⚡ Active: 2
   ✅ Completed: 22
   ❌ Failed: 1

🤖 Autonomous Mode: Running
⏰ Last Execution: 5 minutes ago

📝 Recent Tasks (last 5):
1. [⚡ Active] Implement OAuth integration (task-123) - 45% complete
2. [⏳ Pending] Fix database connection leak (task-124) - Priority 5
3. [✅ Completed] Add API documentation (task-122) - 2 hours ago
4. [⏳ Pending] Refactor auth module (task-125) - Priority 3
5. [✅ Completed] Update test coverage (task-121) - 4 hours ago
```

### Detailed Status View Format

```
📊 Sugar System Status (Detailed)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

⚙️  System Configuration:
   Database: .sugar/sugar.db
   Log File: .sugar/sugar.log
   Loop Interval: 300s (5 minutes)
   Max Concurrent: 2 tasks
   Dry Run Mode: OFF

📊 Task Statistics:
   Total: 45 tasks
   ⏳ Pending: 20 (44%)
   ⚡ Active: 2 (4%)
   ✅ Completed: 22 (49%)
   ❌ Failed: 1 (2%)

🤖 Autonomous Execution:
   Status: Running (PID: 12345)
   Last Cycle: 5 minutes ago
   Next Cycle: in 2 minutes
   Tasks Processed Today: 8
   Average Task Duration: 45 minutes

⚡ Active Tasks:
   1. Implement OAuth integration (task-123)
      Agent: backend-developer
      Started: 30 minutes ago
      Progress: API implementation complete, testing in progress

   2. Modernize CI/CD pipeline (task-130)
      Agent: devops-specialist
      Started: 10 minutes ago
      Progress: Analyzing current setup

❌ Failed Tasks Requiring Attention:
   1. Deploy monitoring dashboard (task-119)
      Error: Permission denied accessing deployment server
      Failed: 1 day ago
      Action: Check deployment credentials and retry

📈 Discovery Sources:
   Error Logs: 3 tasks created (last 24h)
   Code Quality: 5 tasks created (last scan)
   Test Coverage: 2 tasks created (last analysis)
   GitHub Issues: 0 tasks synced (last sync: 2h ago)

💾 Storage:
   Database Size: 2.4 MB
   Log Size: 15.8 MB (consider rotation)
   Task History: 387 all-time tasks
```

## Examples

### Example 1: Healthy System
**User:** `/sugar-status`

**Agent Response:**
```
📊 Sugar System Status
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

⚙️  System: Active ✅
📋 Total Tasks: 31
   ⏳ Pending: 8
   ⚡ Active: 1
   ✅ Completed: 22
   ❌ Failed: 0

🤖 Autonomous Mode: Running
⏰ Last Execution: 3 minutes ago

📝 Recent Tasks (last 5):
1. [⚡ Active] Add user profile customization (task-145)
2. [⏳ Pending] Implement dark mode (task-146)
3. [✅ Completed] Fix login redirect bug (task-144) - 1 hour ago
4. [✅ Completed] Update dependency versions (task-143) - 2 hours ago
5. [⏳ Pending] Add integration tests (task-147)
```

**System Health: ✅ Healthy**

Your Sugar system is running smoothly:
- Balanced task distribution
- Autonomous mode actively processing work
- No failed tasks requiring attention
- Recent completions show good progress

**Suggested Actions:**
- Continue current autonomous execution
- Consider using `/sugar-task` to add new work
- Review completed tasks for quality

### Example 2: Needs Attention
**User:** `/sugar-status`

**Agent Response:**
```
📊 Sugar System Status
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

⚙️  System: Active
📋 Total Tasks: 48
   ⏳ Pending: 25 ⚠️
   ⚡ Active: 0
   ✅ Completed: 20
   ❌ Failed: 3 🚨

🤖 Autonomous Mode: Stopped ⚠️
⏰ Last Execution: 4 hours ago

📝 Recent Tasks (last 5):
1. [⏳ Pending] Critical auth vulnerability (task-150) - Priority 5 🔴
2. [⏳ Pending] Database performance issue (task-149) - Priority 5 🔴
3. [❌ Failed] Deploy new API endpoints (task-148)
4. [⏳ Pending] Refactor payment processing (task-147)
5. [❌ Failed] Update production database (task-146)
```

**System Health: ⚠️ Needs Attention**

Issues detected:
1. **Large Pending Queue:** 25 tasks waiting (above recommended threshold)
2. **Autonomous Mode Stopped:** No active execution for 4 hours
3. **Failed Tasks:** 3 tasks need review and possible retry
4. **Urgent Work:** 2 priority-5 tasks require immediate attention

**Recommended Actions:**

1. **Address Failed Tasks:**
   ```
   sugar view task-148  # Review failure details
   sugar view task-146  # Review failure details
   ```

2. **Review Urgent Tasks:**
   ```
   /sugar-review --priority 5
   ```

3. **Restart Autonomous Mode:**
   ```
   /sugar-run --validate  # Check configuration
   /sugar-run --dry-run --once  # Test
   /sugar-run  # Start autonomous execution
   ```

4. **Consider Adjustments:**
   - Increase max_concurrent_work in config for faster processing
   - Review and prioritize pending tasks with `/sugar-review`
   - Remove obsolete tasks to clean up queue

### Example 3: Troubleshooting with Detailed View
**User:** `/sugar-status --detailed`

**Agent Response:**
```
📊 Sugar System Status (Detailed)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

⚙️  System Configuration:
   Database: .sugar/sugar.db (OK)
   Log File: .sugar/sugar.log (15.2 MB - consider rotation)
   Loop Interval: 300s
   Max Concurrent: 2 tasks
   Dry Run Mode: OFF

📊 Task Statistics:
   Total: 67 tasks (current queue)
   ⏳ Pending: 15
   ⚡ Active: 1
   ✅ Completed: 48
   ❌ Failed: 3

🤖 Autonomous Execution:
   Status: Running (PID: 42315)
   Last Cycle: 2 minutes ago
   Next Cycle: in 3 minutes
   Uptime: 2 days, 14 hours
   Tasks Processed Today: 5
   Success Rate: 94% (last 30 days)

⚡ Active Tasks:
   1. Implement caching layer (task-198)
      Agent: backend-developer
      Started: 25 minutes ago
      Estimated: 45 minutes remaining
      Progress: Redis integration implemented, testing in progress

❌ Failed Tasks:
   1. Automated E2E tests (task-195)
      Error: ChromeDriver version mismatch
      Failed: 3 hours ago
      Action: Update ChromeDriver or adjust test config

   2. Deploy staging environment (task-192)
      Error: AWS credentials expired
      Failed: 1 day ago
      Action: Refresh credentials and retry

   3. Generate API documentation (task-189)
      Error: Missing docstrings in 12 endpoints
      Failed: 2 days ago
      Action: Add docstrings or skip validation

📈 Performance Metrics:
   Average Task Duration: 42 minutes
   Fastest Completion: 8 minutes (simple bug fix)
   Slowest Completion: 3.5 hours (complex feature)
   Tasks Per Day: 6.2 average

🔍 Discovery Activity (Last 7 Days):
   Error Logs: 8 tasks created
   Code Quality: 12 tasks created
   Test Coverage: 5 tasks created
   GitHub Issues: 3 tasks synced
   Manual: 15 tasks added

💾 Storage & Logs:
   Database: 3.8 MB (387 total tasks)
   Log File: 15.2 MB (⚠️ recommend rotation)
   Oldest Task: 45 days ago
   Completed Task Retention: 30 days

📊 Health Indicators:
   ✅ System responsive
   ✅ Database accessible
   ✅ Autonomous mode running
   ⚠️ Log file large (consider rotation)
   ✅ No resource constraints
```

**System Health: ✅ Mostly Healthy**

Your system is performing well overall. Minor attention items:
1. Log file size approaching 20 MB - consider log rotation
2. 3 failed tasks need review (not critical, can be addressed in batch)

**Performance Insights:**
- Good success rate (94%) indicates effective autonomous execution
- Average 6.2 tasks/day shows steady productivity
- Discovery sources creating good mix of work

**Suggested Actions:**
1. Review failed tasks when convenient: `sugar list --status failed`
2. Rotate logs by archiving `.sugar/sugar.log` manually, then restarting
3. System is healthy - continue current operation

## Integration with Claude Code

The command provides:
- **Clear visual hierarchy** using emojis and separators
- **Actionable insights** based on current state
- **Contextual recommendations** for next steps
- **Health indicators** at a glance
- **Troubleshooting guidance** when issues detected

This enables users to quickly understand their system's state and know exactly what actions to take, if any.
