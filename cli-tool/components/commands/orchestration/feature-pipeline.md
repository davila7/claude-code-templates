---
description: Execute implementation tasks from a design document. Tasks are tracked as markdown checkboxes directly in the design file.
argument-hint: <design-file.md>
allowed-tools: Read, Write, Edit, Bash, Glob, Grep, TodoWrite, Task, AskUserQuestion
---

# Feature Pipeline

Execute implementation tasks from a design document using markdown checkboxes.

## Input Detection

`$ARGUMENTS` should be a path to a design markdown file (e.g., `docs/designs/xxx.md`)

If empty or unclear, ask user for the design file path.

## Phase 1: Initialize

1. Read the design file
2. Run `python3 .claude/skills/task-execution-engine/scripts/task_manager.py status --file <design.md>` to show current progress
3. If all tasks completed, report and exit
4. Otherwise, proceed to execution

## Phase 2: Execution Loop

**UNATTENDED MODE - No questions, no stopping**

```
LOOP:
  1. RUN: task_manager.py next --file <design.md> --json
  2. IF no task available → EXIT to Phase 3
  3. READ task details (files, criteria)
  4. IMPLEMENT the task
     - Create/modify files as specified
     - Follow codebase patterns
     - Run tests if applicable
  5. VERIFY acceptance criteria
  6. UPDATE status:
     - Success: task_manager.py done --file <design.md> --task "Title"
     - Failure: task_manager.py fail --file <design.md> --task "Title" --reason "..."
  7. OUTPUT result summary
  8. CONTINUE (go to step 1)
```

## Phase 3: Completion

1. Run `task_manager.py status --file <design.md>` to show final summary
2. Report:
   - Tasks completed
   - Tasks failed (with reasons)
   - Files modified
3. Ask if user wants to commit changes to git

## Implementation Guidelines

### For Each Task:

1. **Read files** specified in task's `files:` line
2. **Understand criteria** from the checkbox items
3. **Implement** following existing codebase patterns
4. **Verify** each acceptance criterion is met
5. **Update** the design file with completion status

### Decision Making:

- If unclear about implementation details → use codebase patterns
- If blocked by missing dependency → mark as failed, continue
- If needs external resource → mark as failed with reason, continue

### Status Updates:

```bash
# Mark task completed (updates checkbox to [x] ✅)
python3 .claude/skills/task-execution-engine/scripts/task_manager.py done \
  --file <design.md> --task "Task Title"

# Mark task failed (updates checkbox to [x] ❌ with reason)
python3 .claude/skills/task-execution-engine/scripts/task_manager.py fail \
  --file <design.md> --task "Task Title" --reason "Error description"
```

## Output Format

After each task:

```
---TASK RESULT---
task: Task Title
status: completed|failed
files: [list of modified files]
notes: Brief description
---END TASK RESULT---
```

## Error Handling

| Error | Action |
|-------|--------|
| Task implementation fails | Mark failed, continue to next |
| Script error | Log error, retry once, then fail task |
| No tasks available | Exit loop, show summary |
| File not found | Ask user for correct path |

## Key Rules

1. **NEVER stop** in the middle of execution loop
2. **NEVER ask** questions during execution
3. **ALWAYS** update task status in design file
4. **Exit only** when no pending tasks remain
