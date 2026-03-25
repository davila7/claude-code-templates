# Task Format Specification

## Basic Structure

```markdown
## Implementation Tasks

- [ ] **Task Title** `priority:N` `phase:PHASE` `deps:Dep1,Dep2`
  - files: file1.py, file2.py
  - [ ] Acceptance criterion 1
  - [ ] Acceptance criterion 2
```

## Task Line

```
- [ ] **Task Title** `priority:1` `phase:model` `deps:Other Task`
```

| Component | Required | Description |
|-----------|----------|-------------|
| `- [ ]` | Yes | Checkbox (unchecked) |
| `**Title**` | Yes | Task title in bold |
| `priority:N` | No | Priority 1-10 (default: 5, lower = higher) |
| `phase:X` | No | Phase: model, api, ui, test, docs |
| `deps:A,B` | No | Comma-separated dependency task titles |

## Task Details (Indented)

### Files Line

```markdown
  - files: src/models/user.py, tests/test_user.py
```

Comma-separated list of files to create/modify.

### Acceptance Criteria

```markdown
  - [ ] User model has email field
  - [ ] Password hashing uses bcrypt
```

Checkboxes for each acceptance criterion. All must be checked for task to be complete.

### Failure Reason (Auto-added)

```markdown
  - reason: Database connection failed
```

Added automatically when task is marked as failed.

## Status Markers

| Status | Checkbox | Marker |
|--------|----------|--------|
| Pending | `- [ ]` | (none) |
| Completed | `- [x]` | ✅ |
| Failed | `- [x]` | ❌ |

## Priority Order

1. Lower priority number = execute first
2. Dependencies must be completed first
3. Tasks with unsatisfied dependencies are "blocked"

## Examples

### Pending Task

```markdown
- [ ] **Create User model** `priority:1` `phase:model`
  - files: src/models/user.py
  - [ ] User model has email and password_hash fields
  - [ ] Email validation implemented
```

### Completed Task

```markdown
- [x] **Create User model** `priority:1` `phase:model` ✅
  - files: src/models/user.py
  - [x] User model has email and password_hash fields
  - [x] Email validation implemented
```

### Failed Task

```markdown
- [x] **Create User model** `priority:1` `phase:model` ❌
  - files: src/models/user.py
  - [ ] User model has email and password_hash fields
  - reason: bcrypt package not installed
```

### Task with Dependencies

```markdown
- [ ] **Create auth API** `priority:3` `phase:api` `deps:Create User model,Implement JWT`
  - files: src/api/auth.py
  - [ ] POST /register endpoint
  - [ ] POST /login endpoint
```

This task will not be selected by `next` until both "Create User model" and "Implement JWT" are completed.
