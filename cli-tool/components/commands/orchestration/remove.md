# Orchestration Remove Command

Safely remove a task from the orchestration system, updating all references and dependencies.

## Usage

```
/orchestration/remove TASK-ID [options]
```

## Description

Removes a task completely from the orchestration system, handling all dependencies, references, and related documentation. Provides impact analysis before removal and ensures system consistency.

## Basic Commands

### Remove Single Task
```
/orchestration/remove TASK-003
```
Shows impact analysis and confirms before removal.

### Force Remove
```
/orchestration/remove TASK-003 --force
```
Skips confirmation (use with caution).

### Dry Run
```
/orchestration/remove TASK-003 --dry-run
```
Shows what would be affected without making changes.

## Impact Analysis

Before removal, the system analyzes:

```
Task Removal Impact Analysis: TASK-003
======================================

Task Details:
- Title: JWT token validation
- Status: in_progress
- Location: /tasks/in_progress/TASK-003-jwt-validation.md

Dependencies:
- Blocks: TASK-005 (User profile API)
- Blocks: TASK-007 (Session management)
- Depends on: None

References Found:
- MASTER-COORDINATION.md: Line 45 (Wave 1 tasks)
- EXECUTION-TRACKER.md: Active task count
- TASK-005: Lists TASK-003 as dependency
- TASK-007: Lists TASK-003 as dependency

Git History:
- 2 commits reference this task
- Branch: feature/jwt-auth

Warning: This task has downstream dependencies!

Proceed with removal? [y/N]
```

## Removal Process

### 1. Update Dependent Tasks
```
Updating dependent tasks:
- TASK-005: Removing dependency on TASK-003
  New status: Ready to start (no blockers)
  
- TASK-007: Removing dependency on TASK-003
  Warning: Still blocked by TASK-009
```

### 2. Update Tracking Files
```yaml
# TASK-STATUS-TRACKER.yaml updates:
status_history:
  TASK-003: [REMOVED - archived to .removed/]
  
current_status_summary:
  in_progress: [TASK-003 removed from list]

removal_log:
  - task_id: TASK-003
    removed_at: "2024-03-15T16:00:00Z"
    removed_by: "user"
    reason: "Requirement changed"
    final_status: "in_progress"
```

### 3. Update Coordination Documents
```
Updates applied:
✓ MASTER-COORDINATION.md - Removed from Wave 1
✓ EXECUTION-TRACKER.md - Updated task counts
✓ TASK-DEPENDENCIES.yaml - Removed all references
✓ Dependency graph regenerated
```

## Options

### Archive Instead of Delete
```
/orchestration/remove TASK-003 --archive
```
Moves to `.removed/` directory instead of deleting.

### Remove Multiple Tasks
```
/orchestration/remove TASK-003,TASK-005,TASK-008
```
Analyzes and removes multiple tasks in dependency order.

### Remove by Pattern
```
/orchestration/remove --pattern "oauth-*"
```
Removes all tasks matching pattern.

### Cascade Removal
```
/orchestration/remove TASK-003 --cascade
```
Also removes tasks that depend on this task.

## Handling Special Cases

### Task with Commits
```
Warning: TASK-003 has associated commits:
- abc123: "feat(auth): implement JWT validation"
- def456: "test(auth): add JWT tests"

Options:
[1] Keep commits, remove task only
[2] Add removal note to commit messages
[3] Cancel removal
```

### Task in QA/Completed
```
Warning: TASK-003 is in 'completed' status

This usually means work was done. Consider:
[1] Archive task instead of removing
[2] Document why it's being removed
[3] Check if commits should be reverted
```

### Critical Path Task
```
ERROR: TASK-003 is on the critical path!

Removing this task will impact project timeline:
- Current completion: 5 days
- After removal: 7 days (due to replanning)

Override with --force-critical
```

## Removal Strategies

### Soft Remove (Default)
```
/orchestration/remove TASK-003
```
- Archives task file
- Updates all references
- Logs removal reason
- Preserves git history

### Hard Remove
```
/orchestration/remove TASK-003 --hard
```
- Deletes task file permanently
- Removes all traces
- Updates git tracking
- No recovery possible

### Replace Remove
```
/orchestration/remove TASK-003 --replace-with TASK-015
```
- Transfers dependencies to new task
- Updates all references
- Maintains continuity

## Undo Capabilities

### Recent Removal
```
/orchestration/remove --undo-last
```
Restores the most recently removed task.

### Restore from Archive
```
/orchestration/remove --restore TASK-003
```
Restores archived task with all references.

## Examples

### Example 1: Obsolete Feature
```
/orchestration/remove TASK-008 --reason "Feature descoped"

Removing TASK-008: OAuth provider integration
- No dependencies
- No commits yet
- Safe to remove

Task removed successfully.
```

### Example 2: Duplicate Task
```
/orchestration/remove TASK-012 --replace-with TASK-005

Removing duplicate: TASK-012
Transferring to: TASK-005
- Dependencies transferred: 2
- References updated: 4

Duplicate removed, TASK-005 updated.
```

### Example 3: Changed Requirements
```
/orchestration/remove TASK-003,TASK-004,TASK-005 --reason "Auth system redesigned"

Removing authentication task group:
- 3 tasks to remove
- 2 have commits (will archive)
- 5 dependent tasks need updates

Proceed? [y/N]
```

## Audit Trail

All removals are logged:
```yaml
# .orchestration-audit.yaml
removals:
  - task_id: TASK-003
    removed_at: "2024-03-15T16:00:00Z"
    removed_by: "user-id"
    reason: "Requirement changed"
    status_at_removal: "in_progress"
    dependencies_affected: ["TASK-005", "TASK-007"]
    commits_preserved: ["abc123", "def456"]
    archived_to: ".removed/2024-03-15/TASK-003/"
```

## Best Practices

1. **Always Check Dependencies**: Review impact before removing
2. **Document Reason**: Provide clear removal reason
3. **Archive Important Work**: Use --archive for completed work
4. **Update Team**: Notify about critical removals
5. **Review Commits**: Check if code needs reverting

## Integration

### With Other Commands
```
# First check status
/orchestration/status --task TASK-003

# Then remove if needed
/orchestration/remove TASK-003
```

### Bulk Operations
```
# Find and remove all on-hold tasks older than 30 days
/orchestration/find --status on_hold --older-than 30d | /orchestration/remove --batch
```

## Safety Features

- Confirmation required (unless --force)
- Dependencies checked and warned
- Commits preserved by default
- Audit trail maintained
- Undo capability for recent removals

## Notes

- Removed tasks are archived for 30 days by default
- Git commits are never automatically reverted
- Dependencies are gracefully handled
- System consistency is maintained throughout