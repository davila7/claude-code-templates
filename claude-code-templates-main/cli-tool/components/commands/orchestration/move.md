# Task Move Command

Move tasks between status folders following the task management protocol.

## Usage

```
/task-move TASK-ID new-status [reason]
```

## Description

Updates task status by moving files between status folders and updating tracking information. Follows all protocol rules including validation and audit trails.

## Basic Commands

### Start Working on a Task
```
/task-move TASK-001 in_progress
```
Moves from todos → in_progress

### Complete Implementation
```
/task-move TASK-001 qa "Implementation complete, ready for testing"
```
Moves from in_progress → qa

### Task Passed QA
```
/task-move TASK-001 completed "All tests passed"
```
Moves from qa → completed

### Block a Task
```
/task-move TASK-004 on_hold "Waiting for TASK-001 API completion"
```
Moves to on_hold with reason

### Unblock a Task
```
/task-move TASK-004 todos "Dependencies resolved"
```
Moves from on_hold → todos

### Failed QA
```
/task-move TASK-001 in_progress "Failed integration test - fixing null pointer"
```
Moves from qa → in_progress

## Bulk Operations

### Move Multiple Tasks
```
/task-move TASK-001,TASK-002,TASK-003 in_progress
```

### Move by Filter
```
/task-move --filter "priority:high status:todos" in_progress
```

### Move with Pattern
```
/task-move TASK-00* qa "Batch testing ready"
```

## Validation Rules

The command enforces:
1. **Valid Transitions**: Only allowed status changes
2. **One Task Per Agent**: Warns if agent has task in_progress
3. **Dependency Check**: Warns if dependencies not met
4. **File Existence**: Verifies task exists before moving

## Status Transition Map

```
todos ──────→ in_progress ──────→ qa ──────→ completed
  ↓               ↓               ↓
  └───────────→ on_hold ←─────────┘
                  ↓
                todos/in_progress
```

## Options

### Force Move
```
/task-move TASK-001 completed --force
```
Bypasses validation (use with caution)

### Dry Run
```
/task-move TASK-001 qa --dry-run
```
Shows what would happen without executing

### With Assignment
```
/task-move TASK-001 in_progress --assign dev-frontend
```
Assigns task to specific agent

### With Time Estimate
```
/task-move TASK-001 in_progress --estimate 4h
```
Updates time estimate when starting

## Error Handling

### Task Not Found
```
Error: TASK-999 not found in any status folder
Suggestion: Use /task-status to see available tasks
```

### Invalid Transition
```
Error: Cannot move from 'completed' to 'todos'
Valid transitions from completed: None (terminal state)
```

### Agent Conflict
```
Warning: dev-frontend already has TASK-002 in progress
Continue? (y/n)
```

### Dependency Block
```
Warning: TASK-004 depends on TASK-001 (currently in_progress)
Moving to on_hold instead? (y/n)
```

## Automation

### Auto-move on Completion
```
/task-move TASK-001 --auto-progress
```
Automatically moves to next status when conditions met

### Scheduled Moves
```
/task-move TASK-005 in_progress --at "tomorrow 9am"
```

### Conditional Moves
```
/task-move TASK-007 qa --when "TASK-006 completed"
```

## Examples

### Example 1: Developer Workflow
```
# Start work
/task-move TASK-001 in_progress

# Complete and test
/task-move TASK-001 qa "Implementation done, tests passing"

# After review
/task-move TASK-001 completed "Code review approved"
```

### Example 2: Handling Blocks
```
# Block due to dependency
/task-move TASK-004 on_hold "Waiting for auth API from TASK-001"

# Unblock when ready
/task-move TASK-004 todos "TASK-001 now in QA, API available"
```

### Example 3: QA Workflow
```
# QA picks up task
/task-move TASK-001 qa --assign qa-engineer

# Found issues
/task-move TASK-001 in_progress "Bug: handling empty responses"

# Fixed and retesting
/task-move TASK-001 qa "Bug fixed, ready for retest"
```

## Status Update Details

Each move updates:
1. **File Location**: Physical file movement
2. **Status Tracker**: TASK-STATUS-TRACKER.yaml entry
3. **Task Metadata**: Status field in task file
4. **Execution Tracker**: Overall progress metrics

## Best Practices

1. **Always Provide Reasons**: Especially for blocks and failures
2. **Check Dependencies**: Before moving to in_progress
3. **Update Estimates**: When starting work
4. **Clear Block Reasons**: Help others understand delays

## Integration

- Use after `/task-status` to see available tasks
- Updates reflected in `/task-report`
- Triggers notifications if configured
- Logs all moves for audit trail

## Notes

- Moves are atomic - either fully complete or rolled back
- Status history is permanent and cannot be edited
- Timestamp uses current time in ISO-8601 format
- Agent name is automatically detected from context