---
description: "Execute implementation from tasks.md — phase by phase, marking tasks complete as they finish"
argument-hint: "[optional: 'phase 1' to run specific phase, or 'resume' to continue from last checkpoint]"
allowed-tools: Bash(git:*), Bash(mkdir:*), Bash(npm:*), Bash(pip:*), Bash(python:*), Bash(node:*), Bash(dotnet:*), Bash(go:*), Bash(cargo:*), Bash(mvn:*), Read, Write, Edit
---

# SDD Implement

Execute implementation plan: $ARGUMENTS

## Instructions

Execute the task plan defined in `tasks.md`. Process phases in order, respect dependencies, mark tasks complete as they finish.

### Step 1: Detect Active Feature

```bash
BRANCH=$(git branch --show-current)
```

Verify `$BRANCH` matches `NNN-feature-name`. Load from `specs/$BRANCH/`:

- **Required**: `tasks.md`, `plan.md`
- **Load if exists**: `data-model.md`, `contracts/`, `research.md`

If `tasks.md` is missing, STOP: "Run `/sdd-tasks` first to generate the task breakdown."

### Step 2: Pre-Implementation Checks

1. **Count incomplete items in tasks.md:**
   - `- [ ]` = incomplete
   - `- [x]` or `- [X]` = complete

2. **Check for previous progress:**
   If any tasks already marked complete, inform user:
   "Found N completed tasks. Resuming from last checkpoint."

3. **Parse `$ARGUMENTS`:**
   - `phase N` → run only Phase N
   - `resume` → skip to first incomplete task
   - `story N` → run only Phase for User Story N
   - Empty → run all phases sequentially

4. **Verify project setup** (from plan.md tech stack):
   - Ensure required ignore files exist (`.gitignore`, `.dockerignore` if Docker detected)
   - Create missing ignore files with appropriate patterns for the tech stack

### Step 3: Parse Task Structure

From `tasks.md`, extract:
- Phase list in order
- For each phase: tasks with IDs, [P] markers, [USN] labels, file paths
- Dependency relationships (sequential vs parallel)

### Step 4: Execute Phase by Phase

For each phase (in order):

1. **Announce phase start:**
   ```
   ## Phase N: [Phase Name]
   Goal: [Phase purpose]
   Tasks: [count] ([count P] parallelizable)
   ```

2. **Execute tasks:**
   - For `[P]`-marked tasks in same phase: execute conceptually in parallel
     (in practice: complete each, but note they have no inter-dependencies)
   - For sequential tasks: complete each fully before starting the next
   - Follow TDD if tasks include test tasks: tests FIRST, verify they FAIL, then implement

3. **After each task completes:**
   - Mark task as complete in `tasks.md`: change `- [ ]` to `- [x]`
   - Report: `✅ T0XX complete — [brief description]`
   - If task fails, STOP that task, report error clearly, suggest diagnosis

4. **Phase checkpoint:**
   After all tasks in a phase complete:
   ```
   ✅ Phase N complete. [N] tasks done.

   Checkpoint: [What should work now, per tasks.md]
   Verify independently before proceeding to Phase N+1.
   ```

   For User Story phases, explicitly validate the story works independently.

### Step 5: Implementation Rules

**File creation:**
- Use exact paths from tasks.md
- Create parent directories if they don't exist
- Follow code structure from plan.md

**Code quality:**
- Follow tech stack conventions from plan.md
- Apply all MUST principles from CONSTITUTION.md
- Implement error handling for all operations
- No hardcoded secrets, connection strings, or environment-specific values

**For TDD tasks (if included):**
- Write test FIRST (it must fail before implementation)
- Confirm test fails: run test suite, show failure
- Then write implementation to make test pass
- Run test again to confirm green

**Progress tracking in tasks.md:**
```markdown
- [x] T001 Initialize project structure ← mark complete after doing
- [x] T002 Install dependencies
- [ ] T003 [P] Configure linting  ← still pending
```

### Step 6: Error Handling

If a task fails:
1. Report clearly: "❌ T0XX failed: [error message]"
2. Show relevant output/error
3. Attempt diagnosis from context
4. Propose fix options
5. STOP and wait for user input before continuing
6. Do NOT skip failed tasks (unless user explicitly instructs)

For `[P]`-marked tasks: if one parallel task fails, continue others, collect all failures, report together.

### Step 7: Completion Validation

After all selected phases/tasks complete:

1. Verify implementation matches spec acceptance scenarios
2. Verify all tasks in selected scope are marked `[x]`
3. Run any test suite if available
4. Check that plan.md technical targets are met (performance, structure)

Report:
```
✅ Implementation complete!

Summary:
  Tasks completed: N/N
  Tests: [N passing / N failing / not included]

Verify your feature works end-to-end:
  [Paste relevant quickstart/test commands from plan.md or spec.md]

Next steps:
  1. Test the feature manually against User Story acceptance scenarios
  2. Commit: git add . && git commit -m "feat(NNN-feature): implement [feature name]"
  3. Push and open PR: git push -u origin NNN-feature-name
  4. After PR is merged, delete the feature branch
```

## Key Rules

- NEVER skip a failed task without user approval
- ALWAYS mark tasks complete in tasks.md after finishing
- ALWAYS stop at phase checkpoints and confirm the increment works
- NEVER deviate from plan.md tech stack without flagging it
- Commit after each phase or logical group (not required — user preference)
