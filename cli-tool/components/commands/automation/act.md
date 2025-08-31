---
allowed-tools: Read, Edit, Bash
argument-hint: [workflow-name]
description: Execute GitHub Actions locally using act
model: sonnet
---

# Act - GitHub Actions Local Execution

Execute GitHub Actions workflows locally using act: $ARGUMENTS

## Current Workflows

- Available workflows: !`find .github/workflows -name "*.yml" -o -name "*.yaml" | head -10`
- Act configuration: @.actrc (if exists)
- Docker status: !`docker --version`

## Task

Execute GitHub Actions workflow locally:

1. **Setup Verification**
   - Ensure act is installed: `act --version`
   - Verify Docker is running
   - Check available workflows in `.github/workflows/`

2. **Workflow Selection**
   - If workflow specified: Run specific workflow `$ARGUMENTS`
   - If no workflow: List all available workflows
   - Check workflow triggers and events

3. **Local Execution**
   - Run workflow with appropriate flags
   - Use secrets from `.env` or `.secrets`
   - Handle platform-specific runners
   - Monitor execution and logs

4. **Debugging Support**
   - Use `--verbose` for detailed output
   - Use `--dry-run` for testing
   - Use `--list` to show available actions

## Example Commands

```bash
# List all workflows
act --list

# Run specific workflow
act workflow_dispatch -W .github/workflows/$ARGUMENTS.yml

# Run with secrets
act --secret-file .env

# Debug mode
act --verbose --dry-run
```
