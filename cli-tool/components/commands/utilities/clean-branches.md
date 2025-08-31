# Clean Branches Command

Clean up merged and stale git branches

## Instructions

Follow this systematic approach to clean up git branches: **$ARGUMENTS**

1. **Repository State Analysis**
   - Check current branch and uncommitted changes
   - List all local and remote branches
   - Identify the main/master branch name
   - Review recent branch activity and merge history

   ```bash
   # Check current status
   git status
   git branch -a
   git remote -v
   
   # Check main branch name
   git symbolic-ref refs/remotes/origin/HEAD | sed 's@^refs/remotes/origin/@@'
   ```

2. **Safety Precautions**
   - Ensure working directory is clean
   - Switch to main/master branch
   - Pull latest changes from remote
   - Create backup of current branch state if needed

   ```bash
   # Ensure clean state
   git stash push -m "Backup before branch cleanup"
   git checkout main  # or master
   git pull origin main
   ```

3. **Identify Merged Branches**
   - List branches that have been merged into main
   - Exclude protected branches (main, master, develop)
   - Check both local and remote merged branches
   - Verify merge status to avoid accidental deletion

   ```bash
   # List merged local branches
   git branch --merged main | grep -v "main\\|master\\|develop\\|\\*"
   
   # List merged remote branches
   git branch -r --merged main | grep -v "main\\|master\\|develop\\|HEAD"
   ```

4. **Identify Stale Branches**
   - Find branches with no recent activity
   - Check last commit date for each branch
   - Identify branches older than specified timeframe (e.g., 30 days)
   - Consider branch naming patterns for feature/hotfix branches

   ```bash
   # List branches by last commit date
   git for-each-ref --format='%(committerdate) %(authorname) %(refname)' --sort=committerdate refs/heads
   
   # Find branches older than 30 days
   git for-each-ref --format='%(refname:short) %(committerdate)' refs/heads | awk '$2 < "'$(date -d '30 days ago' '+%Y-%m-%d')'"'
   ```

5. **Interactive Branch Review**
   - Review each branch before deletion
   - Check if branch has unmerged changes
   - Verify branch purpose and status
   - Ask for confirmation before deletion

   ```bash
   # Check for unmerged changes
   git log main..branch-name --oneline
   
   # Show branch information
   git show-branch branch-name main
   ```

6. **Protected Branch Configuration**
   - Identify branches that should never be deleted
   - Configure protection rules for important branches
   - Document branch protection policies
   - Set up automated protection for new repositories

   ```bash
   # Example protected branches
   PROTECTED_BRANCHES=("main" "master" "develop" "staging" "production")
   ```

7. **Local Branch Cleanup**
   - Delete merged local branches safely
   - Remove stale feature branches
   - Clean up tracking branches for deleted remotes
   - Update local branch references

   ```bash
   # Delete merged branches (interactive)
   git branch --merged main | grep -v "main\\|master\\|develop\\|\\*" | xargs -n 1 -p git branch -d
   
   # Force delete if needed (use with caution)
   git branch -D branch-name
   ```

8. **Remote Branch Cleanup**
   - Remove merged remote branches
   - Clean up remote tracking references
   - Delete obsolete remote branches
   - Update remote branch information

   ```bash
   # Prune remote tracking branches
   git remote prune origin
   
   # Delete remote branch
   git push origin --delete branch-name
   
   # Remove local tracking of deleted remote branches
   git branch -dr origin/branch-name
   ```

9. **Automated Cleanup Script**
   
   ```bash
   #!/bin/bash
   
   # Git branch cleanup script
   set -e
   
   # Configuration
   MAIN_BRANCH="main"
   PROTECTED_BRANCHES=("main" "master" "develop" "staging" "production")
   STALE_DAYS=30
   
   # Functions
   is_protected() {
       local branch=$1
       for protected in "${PROTECTED_BRANCHES[@]}"; do
           if [[ "$branch" == "$protected" ]]; then
               return 0
           fi
       done
       return 1
   }
   
   # Switch to main branch
   git checkout $MAIN_BRANCH
   git pull origin $MAIN_BRANCH
   
   # Clean up merged branches
   echo "Cleaning up merged branches..."
   merged_branches=$(git branch --merged $MAIN_BRANCH | grep -v "\\*\\|$MAIN_BRANCH")
   
   for branch in $merged_branches; do
       if ! is_protected "$branch"; then
           echo "Deleting merged branch: $branch"
           git branch -d "$branch"
       fi
   done
   
   # Prune remote tracking branches
   echo "Pruning remote tracking branches..."
   git remote prune origin
   
   echo "Branch cleanup completed!"
   ```

10. **Team Coordination**
    - Notify team before cleaning shared branches
    - Check if branches are being used by others
    - Coordinate branch cleanup schedules
    - Document branch cleanup procedures

11. **Branch Naming Convention Cleanup**
    - Identify branches with non-standard naming
    - Clean up temporary or experimental branches
    - Remove old hotfix and feature branches
    - Enforce consistent naming conventions

12. **Verification and Validation**
    - Verify important branches are still present
    - Check that no active work was deleted
    - Validate remote branch synchronization
    - Confirm team members have no issues

    ```bash
    # Verify cleanup results
    git branch -a
    git remote show origin
    ```

13. **Documentation and Reporting**
    - Document what branches were cleaned up
    - Report any issues or conflicts found
    - Update team documentation about branch lifecycle
    - Create branch cleanup schedule and policies

14. **Rollback Procedures**
    - Document how to recover deleted branches
    - Use reflog to find deleted branch commits
    - Create emergency recovery procedures
    - Set up branch restoration scripts

    ```bash
    # Recover deleted branch using reflog
    git reflog --no-merges --since="2 weeks ago"
    git checkout -b recovered-branch commit-hash
    ```

15. **Automation Setup**
    - Set up automated branch cleanup scripts
    - Configure CI/CD pipeline for branch cleanup
    - Create scheduled cleanup jobs
    - Implement branch lifecycle policies

16. **Best Practices Implementation**
    - Establish branch lifecycle guidelines
    - Set up automated merge detection
    - Configure branch protection rules
    - Implement code review requirements

**Advanced Cleanup Options:**

```bash
# Clean up all merged branches except protected ones
git branch --merged main | grep -E "^  (feature|hotfix|bugfix)/" | xargs -n 1 git branch -d

# Interactive cleanup with confirmation
git branch --merged main | grep -v "main\|master\|develop" | xargs -n 1 -p git branch -d

# Batch delete remote branches
git branch -r --merged main | grep origin | grep -v "main\|master\|develop\|HEAD" | cut -d/ -f2- | xargs -n 1 git push origin --delete

# Clean up branches older than specific date
git for-each-ref --format='%(refname:short) %(committerdate:short)' refs/heads | awk '$2 < "2023-01-01"' | cut -d' ' -f1 | xargs -n 1 git branch -D
```

Remember to:
- Always backup important branches before cleanup
- Coordinate with team members before deleting shared branches
- Test cleanup scripts in a safe environment first
- Document all cleanup procedures and policies
- Set up regular cleanup schedules to prevent accumulation