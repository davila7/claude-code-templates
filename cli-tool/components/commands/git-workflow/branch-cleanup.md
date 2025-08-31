---
allowed-tools: Bash(git branch:*), Bash(git checkout:*), Bash(git push:*), Bash(git merge:*), Bash(gh:*), Read, Grep
argument-hint: [--dry-run] | [--force] | [--remote-only] | [--local-only]
description: Use PROACTIVELY to clean up merged branches, stale remotes, and organize branch structure
model: sonnet
---

# Git Branch Cleanup & Organization

Clean up merged branches and organize repository structure: $ARGUMENTS

## Current Repository State

- All branches: !`git branch -a`
- Recent branches: !`git for-each-ref --count=10 --sort=-committerdate refs/heads/ --format='%(refname:short) - %(committerdate:relative)'`
- Remote branches: !`git branch -r`
- Merged branches: !`git branch --merged main 2>/dev/null || git branch --merged master 2>/dev/null || echo "No main/master branch found"`
- Current branch: !`git branch --show-current`

## Task

Perform comprehensive branch cleanup and organization based on the repository state and provided arguments.

## Cleanup Operations

### 1. Identify Branches for Cleanup
- **Merged branches**: Find local branches already merged into main/master
- **Stale remote branches**: Identify remote-tracking branches that no longer exist
- **Old branches**: Detect branches with no recent activity (>30 days)
- **Feature branches**: Organize feature/* hotfix/* release/* branches

### 2. Safety Checks Before Deletion
- Verify branches are actually merged using `git merge-base`
- Check if branches have unpushed commits
- Confirm branches aren't the current working branch
- Validate against protected branch patterns

### 3. Branch Categories to Handle
- **Safe to delete**: Merged feature branches, old hotfix branches
- **Needs review**: Unmerged branches with old commits
- **Keep**: Main branches (main, master, develop), active feature branches
- **Archive**: Long-running branches that might need preservation

### 4. Remote Branch Synchronization
- Remove remote-tracking branches for deleted remotes
- Prune remote references with `git remote prune origin`
- Update branch tracking relationships
- Clean up remote branch references

## Command Modes

### Default Mode (Interactive)
1. Show branch analysis with recommendations
2. Ask for confirmation before each deletion
3. Provide summary of actions taken
4. Offer to push deletions to remote

### Dry Run Mode (`--dry-run`)
1. Show what would be deleted without making changes
2. Display branch analysis and recommendations
3. Provide cleanup statistics
4. Exit without modifying repository

### Force Mode (`--force`)
1. Delete merged branches without confirmation
2. Clean up stale remotes automatically
3. Provide summary of all actions taken
4. Use with caution - no undo capability

### Remote Only (`--remote-only`)
1. Only clean up remote-tracking branches
2. Synchronize with actual remote state
3. Remove stale remote references
4. Keep all local branches intact

### Local Only (`--local-only`)
1. Only clean up local branches
2. Don't affect remote-tracking branches
3. Keep remote synchronization intact
4. Focus on local workspace organization

## Safety Features

### Pre-cleanup Validation
- Ensure working directory is clean
- Check for uncommitted changes
- Verify current branch is safe (not target for deletion)
- Create backup references if requested

### Protected Branches
Never delete branches matching these patterns:
- `main`, `master`, `develop`, `staging`, `production`
- `release/*` (unless explicitly confirmed)
- Current working branch
- Branches with unpushed commits (unless forced)

### Recovery Information
- Display git reflog references for deleted branches
- Provide commands to recover accidentally deleted branches
- Show SHA hashes for branch tips before deletion
- Create recovery script if multiple branches deleted

## Branch Organization Features

### Naming Convention Enforcement
- Suggest renaming branches to follow team conventions
- Organize branches by type (feature/, bugfix/, hotfix/)
- Identify branches that don't follow naming patterns
- Provide batch renaming suggestions

### Branch Tracking Setup
- Set up proper upstream tracking for feature branches
- Configure push/pull behavior for new branches
- Identify branches missing upstream configuration
- Fix broken tracking relationships

## Output and Reporting

### Cleanup Summary
```
Branch Cleanup Summary:
✅ Deleted 3 merged feature branches
✅ Removed 5 stale remote references
✅ Cleaned up 2 old hotfix branches
⚠️  Found 1 unmerged branch requiring attention
📊 Repository now has 8 active branches (was 18)
```

### Recovery Instructions
```
Branch Recovery Commands:
git checkout -b feature/user-auth 1a2b3c4d  # Recover feature/user-auth
git push origin feature/user-auth            # Restore to remote
```

## Best Practices

### Regular Maintenance Schedule
- Run cleanup weekly for active repositories
- Use `--dry-run` first to review changes
- Coordinate with team before major cleanups
- Document any non-standard branches to preserve

### Team Coordination
- Communicate branch deletion plans with team
- Check if anyone has work-in-progress on old branches
- Use GitHub/GitLab branch protection rules
- Maintain shared documentation of branch policies

### Branch Lifecycle Management
- Delete feature branches immediately after merge
- Keep release branches until next major release
- Archive long-term experimental branches
- Use tags to mark important branch states before deletion

## Example Usage

```bash
# Safe interactive cleanup
/branch-cleanup

# See what would be cleaned without changes
/branch-cleanup --dry-run

# Clean only remote tracking branches
/branch-cleanup --remote-only

# Force cleanup of merged branches
/branch-cleanup --force

# Clean only local branches
/branch-cleanup --local-only
```

## Integration with GitHub/GitLab

If GitHub CLI or GitLab CLI is available:
- Check PR status before deleting branches
- Verify branches are actually merged in web interface
- Clean up both local and remote branches consistently
- Update branch protection rules if needed