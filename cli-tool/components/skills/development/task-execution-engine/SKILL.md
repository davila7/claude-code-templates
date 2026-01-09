---
name: task-execution-engine
description: Execute implementation tasks from design documents using markdown checkboxes. Use when (1) implementing features from feature-design-assistant output, (2) resuming interrupted work, (3) batch executing tasks. Triggers on 'start implementation', 'run tasks', 'resume'.
---

# Feature Pipeline

Execute implementation tasks directly from design documents. Tasks are managed as markdown checkboxes - no separate session files needed.

## Quick Reference

```bash
# Get next task
python3 scripts/task_manager.py next --file <design.md>

# Mark task completed
python3 scripts/task_manager.py done --file <design.md> --task "Task Title"

# Mark task failed
python3 scripts/task_manager.py fail --file <design.md> --task "Task Title" --reason "..."

# Show status
python3 scripts/task_manager.py status --file <design.md>
```

## Task Format

Tasks are written as markdown checkboxes in the design document:

```markdown
## Implementation Tasks

- [ ] **Create User model** `priority:1` `phase:model`
  - files: src/models/user.py, tests/models/test_user.py
  - [ ] User model has email and password_hash fields
  - [ ] Email validation implemented
  - [ ] Password hashing uses bcrypt

- [ ] **Implement JWT utils** `priority:2` `phase:model`
  - files: src/utils/jwt.py
  - [ ] generate_token() creates valid JWT
  - [ ] verify_token() validates JWT

- [ ] **Create auth API** `priority:3` `phase:api` `deps:Create User model,Implement JWT utils`
  - files: src/api/auth.py
  - [ ] POST /register endpoint
  - [ ] POST /login endpoint
```

See [references/task-format.md](references/task-format.md) for full format specification.

## Execution Loop

```
LOOP until no tasks remain:
  1. GET next task (task_manager.py next)
  2. READ task details (files, criteria)
  3. IMPLEMENT the task
  4. VERIFY acceptance criteria
  5. UPDATE status (task_manager.py done/fail)
  6. CONTINUE
```

### Unattended Mode Rules

- **NO stopping** for questions
- **NO asking** for clarification
- Make autonomous decisions based on codebase patterns
- If blocked, mark as failed and continue

## Status Updates

Completed task:
```markdown
- [x] **Create User model** `priority:1` `phase:model` ✅
  - files: src/models/user.py
  - [x] User model has email field
  - [x] Password hashing implemented
```

Failed task:
```markdown
- [x] **Create User model** `priority:1` `phase:model` ❌
  - files: src/models/user.py
  - [ ] User model has email field
  - reason: Missing database configuration
```

## Resume / Recovery

To resume interrupted work, simply run again with the same design file:

```
/feature-pipeline docs/designs/xxx.md
```

The task manager will find the first uncompleted task and continue from there.

## Integration

This skill is typically triggered after `/feature-analyzer` completes:

```
User: /feature-analyzer implement user auth

Claude: [designs feature, generates task list]
        Design saved to docs/designs/2026-01-02-user-auth.md
        Ready to start implementation?

User: Yes / 开始实现

Claude: [executes tasks via task-execution-engine]
```
