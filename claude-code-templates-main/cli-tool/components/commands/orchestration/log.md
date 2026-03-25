# Orchestration Log Command

Log work from orchestrated tasks to external project management tools like Linear, Obsidian, Jira, or GitHub Issues.

## Usage

```
/orchestration/log [TASK-ID] [options]
```

## Description

Automatically creates work logs in your connected project management tools or knowledge bases, transferring task completion data, time spent, and progress notes to keep external systems synchronized.

## Basic Commands

### Log Current Task
```
/orchestration/log
```
Logs the currently in-progress task to available tools.

### Log Specific Task
```
/orchestration/log TASK-003
```
Logs a specific task's work.

### Choose Destination
```
/orchestration/log TASK-003 --choose
```
Manually select where to log the work.

## Destination Selection

When multiple tools are available or no obvious connection exists:

```
Where would you like to log this work?

Available destinations:
1. Linear (ENG-1234 detected)
2. Obsidian (Daily Note)
3. Obsidian (Project: Authentication)
4. GitHub Issue (#123)
5. None - Skip logging

Choose destination [1-5]: 
```

## Obsidian Integration

### Daily Note Logging
```
/orchestration/log --obsidian-daily
```
Appends to today's daily note:

```markdown
## Work Log - 15:30

### TASK-003: JWT Implementation ✅

**Time Spent**: 4.5 hours (10:00 - 14:30)
**Status**: Completed → QA

**What I did:**
- Implemented JWT token validation middleware
- Added refresh token logic  
- Created comprehensive test suite
- Fixed edge case with token expiration

**Code Stats:**
- Files: 8 modified
- Lines: +245 -23
- Coverage: 95%

**Related Tasks:**
- Next: [[TASK-005]] - User Profile API
- Blocked: [[TASK-007]] - Waiting for this

**Commits:**
- `abc123`: feat(auth): implement JWT validation
- `def456`: test(auth): add validation tests

#tasks/completed #project/authentication
```

### Project Note Logging
```
/orchestration/log --obsidian-project "Authentication System"
```
Creates or appends to project-specific note.

### Custom Obsidian Location
```
/orchestration/log --obsidian-path "Projects/Sprint 24/Work Log"
```

## Linear Integration
```
/orchestration/log TASK-003 --linear-issue ENG-1234
```
Creates work log comment in Linear issue.

## Smart Detection

The system detects available destinations:

```
Analyzing task context...

Found connections:
✓ Linear: ENG-1234 (from branch name)
✓ Obsidian: Project note exists
✓ GitHub: No issue reference
✗ Jira: Not connected

Suggested: Linear ENG-1234
Use suggestion? [Y/n/choose different]
```

## Work Log Formats

### Obsidian Format
```markdown
## 📋 Task: TASK-003 - JWT Implementation

### Summary
- **Status**: 🟢 Completed  
- **Duration**: 4h 30m
- **Date**: 2024-03-15

### Progress Details
- [x] Token structure design
- [x] Validation middleware
- [x] Refresh mechanism
- [x] Test coverage

### Technical Notes
- Used RS256 algorithm for signing
- Tokens expire after 15 minutes
- Refresh tokens last 7 days

### Links
- Linear: [ENG-1234](linear://issue/ENG-1234)
- PR: [#456](github.com/...)
- Docs: [[JWT Implementation Guide]]

### Next Actions
- [ ] Code review feedback
- [ ] Deploy to staging
- [ ] Update API documentation

---
*Logged via Task Orchestration at 15:30*
```

### Linear Format
```
Work log comment in Linear with task details, time tracking, and progress updates.
```

## Multiple Destination Logging

```
/orchestration/log TASK-003 --multi

Select all destinations for logging:
[x] Linear - ENG-1234
[x] Obsidian - Daily Note
[ ] Obsidian - Project Note
[ ] GitHub - Create new issue

Press Enter to confirm, Space to toggle
```

## Batch Operations

### Daily Summary to Obsidian
```
/orchestration/log --daily-summary --obsidian

Creates summary in daily note:

## Work Summary - 2024-03-15

### Completed Tasks
- [[TASK-003]]: JWT Implementation (4.5h) ✅
- [[TASK-008]]: Login UI Updates (2h) ✅

### In Progress  
- [[TASK-005]]: User Profile API (1.5h) 🔄

### Total Time: 8 hours

### Key Achievements
- Authentication system core complete
- All tests passing
- Ready for code review

### Tomorrow's Focus
- Complete user profile endpoints
- Start OAuth integration
```

### Weekly Report
```
/orchestration/log --weekly --obsidian-path "Weekly Reviews/Week 11"
```

## Templates

### Configure Obsidian Template
```yaml
obsidian_template:
  daily_note:
    heading: "## Work Log - {time}"
    include_stats: true
    add_tags: true
    link_tasks: true
  
  project_note:
    create_if_missing: true
    append_to_section: "## Task Progress"
    include_commits: true
```

### Configure Linear Template
```yaml
linear_template:
  include_time: true
  update_status: true
  add_labels: ["from-orchestration"]
```

## Interactive Mode

```
/orchestration/log --interactive

Task: TASK-003 - JWT Implementation
Status: Completed
Time: 4.5 hours

Where to log? (Space to select, Enter to confirm)
> [x] Linear (ENG-1234)
> [x] Obsidian Daily Note
> [ ] Obsidian Project Note
> [ ] New GitHub Issue

Add custom notes? [y/N]: y
> Implemented using RS256, ready for review

Logging to 2 destinations...
✓ Linear: Comment added to ENG-1234
✓ Obsidian: Added to daily note

View logs? [y/N]: 
```

## Examples

### Example 1: End of Day Logging
```
/orchestration/log --eod

End of Day Summary:
- 3 tasks worked on
- 7.5 hours logged
- 2 completed, 1 in progress

Log to:
1. Obsidian Daily Note (recommended)
2. Linear (update all 3 issues)
3. Both
4. Skip

Choice [1]: 1

✓ Daily work log created in Obsidian
```

### Example 2: Sprint Review
```
/orchestration/log --sprint-review --week 11

Gathering week 11 data...
- 15 tasks completed
- 3 in progress
- 52 hours logged

Create sprint review in:
1. Obsidian - "Sprint Reviews/Sprint 24"
2. Linear - Sprint 24 cycle
3. Both

Choice [3]: 3

✓ Sprint review created in both systems
```

### Example 3: No Connection Found
```
/orchestration/log TASK-009

No automatic destination found for TASK-009.

Where would you like to log this?
1. Obsidian - Daily Note
2. Obsidian - Create Project Note
3. Linear - Search for issue
4. GitHub - Create new issue  
5. Skip logging

Choice: 2

Enter project name: Security Audit
✓ Created "Security Audit" note with work log
```

## Configuration

### Default Destinations
```yaml
log_defaults:
  no_connection: "ask"  # ask|obsidian-daily|skip
  multi_connection: "ask"  # ask|all|first
  
  obsidian:
    default_location: "daily"  # daily|project|custom
    project_folder: "Projects"
    daily_folder: "Daily Notes"
  
  linear:
    auto_update_status: true
    include_commits: true
```

## Best Practices

1. **Set Preferences**: Configure default destinations
2. **Link Early**: Connect tasks to PM tools when creating
3. **Use Daily Notes**: Great for personal tracking
4. **Project Notes**: Better for team collaboration
5. **Regular Syncs**: Don't let logs pile up

## Notes

- Respects MCP connections and permissions
- Obsidian logs create backlinks automatically
- Supports multiple simultaneous destinations
- Preserves formatting across systems
- Can be automated with task status changes