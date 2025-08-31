# Orchestration Resume Command

Resume work on existing task orchestrations after session loss or context switch.

## Usage

```
/orchestration/resume [options]
```

## Description

Restores full context for active orchestrations, showing current progress, identifying next actions, and providing all necessary information to continue work seamlessly.

## Basic Commands

### List Active Orchestrations
```
/orchestration/resume
```
Shows all orchestrations with active (non-completed) tasks.

### Resume Specific Orchestration
```
/orchestration/resume --date 03_15_2024 --project auth_system
```
Loads complete context for a specific orchestration.

### Resume Most Recent
```
/orchestration/resume --latest
```
Automatically resumes the most recently active orchestration.

## Output Format

### Orchestration List View
```
Active Task Orchestrations
==========================

1. 03_15_2024/authentication_system
   Started: 3 days ago | Progress: 65% | Active Tasks: 3
   └─ Focus: JWT implementation, OAuth integration

2. 03_14_2024/payment_processing  
   Started: 4 days ago | Progress: 40% | Active Tasks: 2
   └─ Focus: Stripe webhooks, refund handling

3. 03_12_2024/admin_dashboard
   Started: 1 week ago | Progress: 85% | Active Tasks: 1
   └─ Focus: Final testing and deployment

Select orchestration to resume: [1-3] or use --date and --project
```

### Detailed Resume View
```
Resuming: authentication_system (03_15_2024)
============================================

## Current Status Summary
- Total Tasks: 24 (12 completed, 3 in progress, 2 on hold, 7 todos)
- Time Elapsed: 3 days
- Estimated Remaining: 2 days

## Tasks In Progress
┌──────────┬────────────────────────────┬───────────────┬──────────────┐
│ Task ID  │ Title                      │ Agent         │ Duration     │
├──────────┼────────────────────────────┼───────────────┼──────────────┤
│ TASK-003 │ JWT token validation       │ dev-backend   │ 2.5h         │
│ TASK-007 │ OAuth provider setup       │ dev-frontend  │ 1h           │
│ TASK-011 │ Integration tests          │ test-dev      │ 30m          │
└──────────┴────────────────────────────┴───────────────┴──────────────┘

## Blocked Tasks (Require Attention)
- TASK-005: User profile API - Blocked by TASK-003 (JWT validation)
- TASK-009: OAuth callback handling - Waiting for provider credentials

## Next Available Tasks (Ready to Start)
1. TASK-013: Password reset flow (4h, frontend)
   Files: src/auth/reset.tsx, src/api/auth.ts
   
2. TASK-014: Session management (3h, backend)
   Files: src/services/session.ts, src/middleware/auth.ts

## Recent Git Activity
- feature/jwt-auth: 2 commits behind, last commit 2h ago
- feature/oauth-setup: clean, last commit 1h ago

## Quick Actions
[1] Show TASK-003 details (current focus)
[2] Pick up TASK-013 (password reset)
[3] View dependency graph
[4] Show recent commits
[5] Generate status report
```

## Context Recovery Features

### Task Context
```
/orchestration/resume --task TASK-003
```
Shows:
- Full task description and requirements
- Implementation progress and notes
- Related files with recent changes
- Test requirements and status
- Dependencies and blockers

### File Context
```
/orchestration/resume --show-files
```
Lists all files mentioned in active tasks with:
- Last modified time
- Current git status
- Which tasks reference them

### Dependency Context
```
/orchestration/resume --deps
```
Shows dependency graph focused on active tasks.

## Working State Recovery

### Git State Summary
```
## Git Working State
Current Branch: feature/jwt-auth
Status: 2 files modified, 1 untracked

Modified Files:
- src/auth/jwt.ts (related to TASK-003)
- tests/auth.test.ts (related to TASK-003)

Untracked:
- src/auth/jwt.config.ts (new file for TASK-003)

Recommendation: Commit current changes before switching tasks
```

### Last Session Summary
```
## Last Session (2 hours ago)
- Completed: TASK-002 (Database schema)
- Started: TASK-003 (JWT validation)
- Commits: 2 (feat: add user auth schema, test: auth unit tests)
- Next planned: Continue TASK-003, then TASK-005
```

## Filtering Options

### By Status
```
/orchestration/resume --show in_progress,on_hold
```

### By Date Range
```
/orchestration/resume --since "last week"
```

### By Completion
```
/orchestration/resume --incomplete  # < 50% done
/orchestration/resume --nearly-done  # > 80% done
```

## Integration Features

### Direct Task Pickup
```
/orchestration/resume --pickup TASK-013
```
Automatically:
1. Shows task details
2. Moves to in_progress
3. Shows relevant files
4. Creates feature branch if needed

### Status Check Integration
```
/orchestration/resume --with-status
```
Includes full status report with resume context.

### Commit History
```
/orchestration/resume --commits 5
```
Shows last 5 commits related to the orchestration.

## Quick Resume Patterns

### Morning Standup
```
/orchestration/resume --latest --with-status
```
Perfect for daily standups - shows what you were working on and current state.

### Context Switch
```
/orchestration/resume --save-state
```
Saves current working state before switching to another orchestration.

### Team Handoff
```
/orchestration/resume --handoff
```
Generates detailed handoff notes for another developer.

## Examples

### Example 1: Quick Continue
```
/orchestration/resume --latest --pickup-where-left-off
```
Resumes exactly where you stopped, showing the in-progress task.

### Example 2: Monday Morning
```
/orchestration/resume --since friday --show-completed
```
Shows what was done Friday and what's next for Monday.

### Example 3: Multiple Projects
```
/orchestration/resume --all --summary
```
Quick overview of all active orchestrations.

## State Persistence

The command reads from:
- EXECUTION-TRACKER.md for progress metrics
- TASK-STATUS-TRACKER.yaml for current state
- Task files for detailed context
- Git for working directory state

## Best Practices

1. **Use at Session Start**: Run `/orchestration/resume` when starting work
2. **Save State**: Use `--save-state` before extended breaks
3. **Check Dependencies**: Review blocked tasks that may now be unblocked
4. **Commit Regularly**: Keep git state aligned with task progress

## Notes

- Automatically detects uncommitted changes related to tasks
- Suggests next actions based on dependencies and priorities
- Integrates with git worktrees if in use
- Preserves task history for full context