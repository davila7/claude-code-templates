# Git Error Patterns

Common Git errors with diagnosis and solutions.

## Push/Pull Errors

### Failed to push: rejected

```
! [rejected]        main -> main (non-fast-forward)
error: failed to push some refs to 'origin'
```

**Causes**:
1. Remote has commits you don't have locally
2. Force push required (history rewritten)
3. Branch protection rules

**Solutions**:
```bash
# Option 1: Pull and merge first (safest)
git pull origin main
git push origin main

# Option 2: Pull with rebase
git pull --rebase origin main
git push origin main

# Option 3: Force push (CAREFUL - overwrites remote)
# Only if you intentionally rewrote history
git push --force-with-lease origin main
```

---

### Remote contains work you do not have locally

```
hint: Updates were rejected because the remote contains work that you do not have locally.
```

**Same as above** - pull first, then push.

```bash
# Standard workflow
git fetch origin
git merge origin/main  # Or: git rebase origin/main
git push
```

---

### Permission denied (publickey)

```
Permission denied (publickey).
fatal: Could not read from remote repository.
```

**Causes**:
1. SSH key not added to agent
2. SSH key not added to GitHub/GitLab
3. Wrong SSH key
4. Using HTTPS URL instead of SSH

**Diagnosis**:
```bash
# Test SSH connection
ssh -T git@github.com
ssh -vT git@github.com  # Verbose for debugging

# Check loaded keys
ssh-add -l
```

**Solutions**:
```bash
# Add SSH key to agent
eval "$(ssh-agent -s)"
ssh-add ~/.ssh/id_ed25519  # Or your key file

# Generate new key if needed
ssh-keygen -t ed25519 -C "your@email.com"

# Copy public key to GitHub/GitLab
cat ~/.ssh/id_ed25519.pub
# Then add in GitHub Settings -> SSH Keys

# Or use HTTPS instead of SSH
git remote set-url origin https://github.com/user/repo.git
```

---

### Authentication failed

```
remote: Invalid username or password.
fatal: Authentication failed for 'https://github.com/...'
```

**Causes**:
1. Wrong credentials
2. Password auth disabled (GitHub)
3. Token expired

**Solutions**:
```bash
# Use Personal Access Token instead of password
# Generate at: GitHub -> Settings -> Developer settings -> Personal access tokens

# Update stored credentials
git credential reject
protocol=https
host=github.com
# Press Enter twice

# Or use credential helper
git config --global credential.helper cache
git config --global credential.helper 'cache --timeout=3600'

# Or switch to SSH
git remote set-url origin git@github.com:user/repo.git
```

---

## Merge Conflicts

### Automatic merge failed

```
CONFLICT (content): Merge conflict in file.js
Automatic merge failed; fix conflicts and then commit the result.
```

**Resolution Workflow**:
```bash
# 1. See conflicting files
git status

# 2. Open file and look for conflict markers
<<<<<<< HEAD
your changes
=======
their changes
>>>>>>> branch-name

# 3. Edit file to resolve (remove markers, keep desired code)

# 4. Stage resolved files
git add file.js

# 5. Complete merge
git commit
# Or if rebasing: git rebase --continue
```

**Tools**:
```bash
# Use merge tool
git mergetool

# Configure VS Code as merge tool
git config --global merge.tool vscode
git config --global mergetool.vscode.cmd 'code --wait $MERGED'
```

**Abort if needed**:
```bash
git merge --abort
# Or
git rebase --abort
```

---

### Cannot pull with rebase: unstaged changes

```
error: cannot pull with rebase: You have unstaged changes.
```

**Solutions**:
```bash
# Option 1: Stash changes
git stash
git pull --rebase
git stash pop

# Option 2: Commit changes first
git add .
git commit -m "WIP"
git pull --rebase

# Option 3: Discard changes (CAREFUL)
git checkout -- .
git pull --rebase
```

---

## Checkout/Switch Errors

### Cannot checkout: local changes would be overwritten

```
error: Your local changes to the following files would be overwritten by checkout
```

**Solutions**:
```bash
# Option 1: Stash changes
git stash
git checkout other-branch
git stash pop  # To get changes back

# Option 2: Commit changes
git add .
git commit -m "WIP"
git checkout other-branch

# Option 3: Discard changes (CAREFUL)
git checkout -- file.js      # Single file
git checkout -- .            # All files
git reset --hard             # Everything including staged
```

---

### Pathspec did not match any file

```
error: pathspec 'branch-name' did not match any file(s) known to git
```

**Causes**:
1. Branch doesn't exist
2. Typo in branch name
3. Remote branch not fetched

**Solutions**:
```bash
# List all branches
git branch -a

# Fetch remote branches
git fetch origin

# Checkout remote branch
git checkout -b branch-name origin/branch-name
# Or (newer Git)
git switch branch-name
```

---

## Reset/Revert Errors

### HEAD detached

```
You are in 'detached HEAD' state.
```

**What it means**: You checked out a commit, not a branch.

**Solutions**:
```bash
# Go back to branch
git checkout main

# Create new branch from current state
git checkout -b new-branch-name

# See where HEAD is
git log --oneline -1
```

---

### Cannot do soft reset with paths

```
fatal: Cannot do soft reset with paths.
```

**Solution**: Use different command:
```bash
# To unstage file
git restore --staged file.js
# Or older Git:
git reset HEAD file.js
```

---

### Refusing to reset in dirty worktree

```
fatal: Failed to resolve 'HEAD~1' as a valid ref.
```

**Solution**:
```bash
# Stash changes first
git stash
git reset --hard HEAD~1
git stash pop
```

---

## Stash Errors

### No stash entries found

```
No stash entries found.
```

**Check stashes**:
```bash
# List all stashes
git stash list

# If empty, nothing was stashed
```

---

### Conflict when applying stash

```
CONFLICT (content): Merge conflict in file.js
```

**Solutions**:
```bash
# Resolve conflicts manually (same as merge conflicts)
# Then either:
git stash drop  # Remove stash after resolving

# Or if you want to keep stash:
# Just resolve conflicts, add, and commit
```

---

## Rebase Errors

### Cannot rebase: uncommitted changes

```
error: cannot rebase: You have unstaged changes.
```

**Solution**:
```bash
git stash
git rebase origin/main
git stash pop
```

---

### Rebase conflict

```
CONFLICT (content): Merge conflict in file.js
error: could not apply abc1234... commit message
```

**Resolution**:
```bash
# 1. Fix conflicts in files

# 2. Stage resolved files
git add file.js

# 3. Continue rebase
git rebase --continue

# Or abort entire rebase
git rebase --abort

# Skip this commit (lose its changes)
git rebase --skip
```

---

## Submodule Errors

### Submodule not initialized

```
fatal: no submodule mapping found in .gitmodules for path 'submodule-path'
```

**Solutions**:
```bash
# Initialize submodules
git submodule init
git submodule update

# Or clone with submodules
git clone --recurse-submodules repo-url

# Update existing clone
git submodule update --init --recursive
```

---

### Submodule HEAD detached

```
HEAD detached at abc1234
```

**Solution**:
```bash
cd submodule-path
git checkout main  # Or desired branch
cd ..
git add submodule-path
git commit -m "Update submodule to main"
```

---

## LFS Errors

### File exceeds GitHub file size limit

```
remote: error: File large-file.zip is 150.00 MB; this exceeds GitHub's file size limit of 100.00 MB
```

**Solutions**:
```bash
# Install Git LFS
brew install git-lfs  # macOS
git lfs install

# Track large files
git lfs track "*.zip"
git lfs track "*.psd"
git add .gitattributes

# If already committed, need to rewrite history
git filter-branch --tree-filter 'git lfs track "*.zip"' HEAD
# Or use BFG Repo Cleaner
```

---

### LFS objects missing

```
Encountered 1 file that should have been a pointer, but wasn't
```

**Solutions**:
```bash
# Fetch LFS objects
git lfs fetch --all

# Or pull LFS objects
git lfs pull

# Migrate existing files to LFS
git lfs migrate import --include="*.psd"
```

---

## Configuration Errors

### Author identity unknown

```
Author identity unknown
Please tell me who you are.
```

**Solution**:
```bash
git config --global user.email "you@example.com"
git config --global user.name "Your Name"
```

---

### Unsafe repository

```
fatal: detected dubious ownership in repository
```

**Causes**: Repository owned by different user (common in Docker/WSL).

**Solution**:
```bash
# Add exception for this repo
git config --global --add safe.directory /path/to/repo

# Or for all repos (less secure)
git config --global --add safe.directory '*'
```

---

## Quick Reference Table

| Error | Category | Quick Fix |
|-------|----------|-----------|
| Push rejected | Push | `git pull --rebase` then push |
| Permission denied | Auth | Check SSH key: `ssh-add -l` |
| Auth failed | Auth | Use Personal Access Token |
| Merge conflict | Merge | Edit file, remove markers, `git add` |
| Unstaged changes | Checkout | `git stash` first |
| Pathspec not found | Branch | `git fetch` then checkout |
| HEAD detached | Branch | `git checkout main` |
| No stash entries | Stash | Nothing was stashed |
| Rebase conflict | Rebase | Fix conflict, `git rebase --continue` |
| File too large | LFS | Use Git LFS for large files |
| Identity unknown | Config | Set user.email and user.name |
