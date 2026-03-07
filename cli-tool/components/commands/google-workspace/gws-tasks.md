---
allowed-tools: Bash, Read, Write, Edit
argument-hint: [resource] [method] [flags]
description: Google Tasks: Manage task lists and tasks.
---

# Google Workspace Tasks

Execute Google Workspace Tasks operations: $ARGUMENTS

## Prerequisites

- Google Workspace CLI (`gws`) must be installed
- Authentication configured: Run `gws auth status` to verify
- Review `gws tasks --help` for all available commands

## Available Resources and Methods

# tasks (v1)

> **PREREQUISITE:** Read `../gws-shared/SKILL.md` for auth, global flags, and security rules. If missing, run `gws generate-skills` to create it.

```bash
gws tasks <resource> <method> [flags]
```

## API Resources

### tasklists

  - `delete` — Deletes the authenticated user's specified task list. If the list contains assigned tasks, both the assigned tasks and the original tasks in the assignment surface (Docs, Chat Spaces) are deleted.
  - `get` — Returns the authenticated user's specified task list.
  - `insert` — Creates a new task list and adds it to the authenticated user's task lists. A user can have up to 2000 lists at a time.
  - `list` — Returns all the authenticated user's task lists. A user can have up to 2000 lists at a time.
  - `patch` — Updates the authenticated user's specified task list. This method supports patch semantics.
  - `update` — Updates the authenticated user's specified task list.

### tasks

  - `clear` — Clears all completed tasks from the specified task list. The affected tasks will be marked as 'hidden' and no longer be returned by default when retrieving all tasks for a task list.
  - `delete` — Deletes the specified task from the task list. If the task is assigned, both the assigned task and the original task (in Docs, Chat Spaces) are deleted. To delete the assigned task only, navigate to the assignment surface and unassign the task from there.
  - `get` — Returns the specified task.
  - `insert` — Creates a new task on the specified task list. Tasks assigned from Docs or Chat Spaces cannot be inserted from Tasks Public API; they can only be created by assigning them from Docs or Chat Spaces. A user can have up to 20,000 non-hidden tasks per list and up to 100,000 tasks in total at a time.
  - `list` — Returns all tasks in the specified task list. Doesn't return assigned tasks by default (from Docs, Chat Spaces). A user can have up to 20,000 non-hidden tasks per list and up to 100,000 tasks in total at a time.
  - `move` — Moves the specified task to another position in the destination task list. If the destination list is not specified, the task is moved within its current list. This can include putting it as a child task under a new parent and/or move it to a different position among its sibling tasks. A user can have up to 2,000 subtasks per task.
  - `patch` — Updates the specified task. This method supports patch semantics.
  - `update` — Updates the specified task.

## Discovering Commands

Before calling any API method, inspect it:

```bash
# Browse resources and methods
gws tasks --help

# Inspect a method's required params, types, and defaults
gws schema tasks.<resource>.<method>
```

Use `gws schema` output to build your `--params` and `--json` flags.

## Usage

```bash
# List available resources and methods
gws tasks --help

# Inspect method schema before calling
gws schema tasks.<resource>.<method>

# Execute command with arguments
gws tasks $ARGUMENTS
```

## Task

Execute the requested Tasks operation: $ARGUMENTS

1. **Verify Prerequisites**
   - Check `gws` is installed: `gws --version`
   - Verify authentication: `gws auth status`
   - Review available commands: `gws tasks --help`

2. **Inspect Method Schema**
   - Before calling any method, inspect its parameters
   - Use `gws schema` to understand required fields
   - Review parameter types and constraints

3. **Execute Operation**
   - Build command with appropriate flags
   - Use `--params` for query/path parameters
   - Use `--json` for request body
   - Handle pagination with `--max-results` or `--page-token`

4. **Error Handling**
   - Check command output for errors
   - Review API quotas and rate limits
   - Handle authentication issues
   - Retry transient failures

---

**License**: Apache License 2.0
**Source**: [Google Workspace CLI](https://github.com/googleworkspace/cli)
**Original Skill**: `gws-tasks`
