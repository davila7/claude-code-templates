---
allowed-tools: Bash(git:*), Read, Edit
argument-hint: [--no-delete] [--no-tag]
description: Complete and merge current Git Flow branch (feature/release/hotfix) with proper cleanup and tagging
---

# Git Flow Finish Branch

Complete current Git Flow branch: **$ARGUMENTS**

## Current Repository State

- Current branch: !`git branch --show-current`
- Branch type: !`git branch --show-current | grep -oE '^(feature|release|hotfix)' || echo "Not a Git Flow branch"`
- Git status: !`git status --porcelain`
- Unpushed commits: !`git log @{u}.. --oneline 2>/dev/null | wc -l | tr -d ' '`
- Latest tag: !`git describe --tags --abbrev=0 2>/dev/null || echo "No tags"`
- Test status: !`npm test 2>/dev/null | tail -20 || echo "No test command available"`

## Task

Complete the current Git Flow branch by merging it to appropriate target branch(es):

### 1. Branch Type Detection

Detect the current branch type and determine merge strategy:

```bash
CURRENT_BRANCH=$(git branch --show-current)

if [[ $CURRENT_BRANCH == feature/* ]]; then
  BRANCH_TYPE="feature"
  MERGE_TO="develop"
  CREATE_TAG="no"
elif [[ $CURRENT_BRANCH == release/* ]]; then
  BRANCH_TYPE="release"
  MERGE_TO="main develop"
  CREATE_TAG="yes"
  TAG_NAME="${CURRENT_BRANCH#release/}"
elif [[ $CURRENT_BRANCH == hotfix/* ]]; then
  BRANCH_TYPE="hotfix"
  MERGE_TO="main develop"
  CREATE_TAG="yes"
  # Increment patch version from current tag
  CURRENT_TAG=$(git describe --tags --abbrev=0 origin/main 2>/dev/null)
  TAG_NAME="${CURRENT_TAG%.*}.$((${CURRENT_TAG##*.} + 1))"
else
  echo "❌ Not on a Git Flow branch (feature/release/hotfix)"
  exit 1
fi
```

### 2. Pre-Merge Validation

Before merging, validate these conditions:

**Critical Checks:**
- ✅ All changes are committed (no uncommitted files)
- ✅ All commits are pushed to remote
- ✅ Tests are passing (run test suite)
- ✅ No merge conflicts with target branch
- ✅ Branch is up to date with remote

```
🔍 Pre-Merge Validation

✓ Working directory clean
✓ All commits pushed to remote
✓ Running tests...
  ├─ Unit tests: 45/45 passed
  ├─ Integration tests: 12/12 passed
  └─ All tests passed ✓

✓ Checking for merge conflicts with develop...
  └─ No conflicts detected ✓

✓ Branch is up to date with remote ✓

Ready to merge!
```

### 3. Feature Branch Finish

For **feature/** branches:

```bash
# Ensure all commits are pushed
git push

# Switch to develop
git checkout develop

# Pull latest changes
git pull origin develop

# Merge feature branch (no fast-forward)
git merge --no-ff feature/$NAME -m "Merge feature/$NAME into develop

$(git log develop..feature/$NAME --oneline)

🤖 Generated with Claude Code
Co-Authored-By: Claude <noreply@anthropic.com>"

# Push to remote
git push origin develop

# Delete local branch (unless --no-delete)
git branch -d feature/$NAME

# Delete remote branch (unless --no-delete)
git push origin --delete feature/$NAME
```

**Success Response:**
```
✓ Pushed all commits to remote
✓ Switched to develop
✓ Pulled latest changes
✓ Merged feature/$NAME into develop
✓ Pushed to origin/develop
✓ Deleted local branch: feature/$NAME
✓ Deleted remote branch: origin/feature/$NAME

🌿 Feature Complete!

Merged: feature/$NAME
Target: develop
Commits included: 5
Files changed: 12

🎉 Your feature is now in the develop branch!

Next steps:
- Feature will be included in next release
- Other team members can pull from develop
- You can start a new feature branch
```

### 4. Release Branch Finish

For **release/** branches:

```bash
# Extract version from branch name
VERSION="${CURRENT_BRANCH#release/}"

# Ensure all commits are pushed
git push

# Merge to main first
git checkout main
git pull origin main
git merge --no-ff release/$VERSION -m "Merge release/$VERSION into main

Release notes:
$(cat CHANGELOG.md | sed -n "/## \[$VERSION\]/,/## \[/p" | head -n -1)

🤖 Generated with Claude Code
Co-Authored-By: Claude <noreply@anthropic.com>"

# Create tag on main (unless --no-tag)
git tag -a $VERSION -m "Release $VERSION

$(cat CHANGELOG.md | sed -n "/## \[$VERSION\]/,/## \[/p" | head -n -1)"

# Push main with tags
git push origin main --tags

# Merge back to develop
git checkout develop
git pull origin develop
git merge --no-ff release/$VERSION -m "Merge release/$VERSION back into develop

🤖 Generated with Claude Code
Co-Authored-By: Claude <noreply@anthropic.com>"

# Push develop
git push origin develop

# Delete branches (unless --no-delete)
git branch -d release/$VERSION
git push origin --delete release/$VERSION
```

**Success Response:**
```
✓ Pushed all commits to remote
✓ Merged release/$VERSION into main
✓ Created tag: $VERSION
✓ Pushed main with tags
✓ Merged release/$VERSION into develop
✓ Pushed to origin/develop
✓ Deleted local branch: release/$VERSION
✓ Deleted remote branch: origin/release/$VERSION

🚀 Release Complete: $VERSION

Merged to: main, develop
Tag created: $VERSION
Commits included: 15
Changes:
  - 5 features
  - 3 bug fixes
  - 2 performance improvements

🎉 Release $VERSION is now in production!

Next steps:
- Deploy to production: [deployment command]
- Monitor production for issues
- Announce release to team
- Update documentation if needed

Tag details:
  git show $VERSION
```

### 5. Hotfix Branch Finish

For **hotfix/** branches:

```bash
# Determine new version (patch bump)
CURRENT_VERSION=$(git describe --tags --abbrev=0 origin/main)
NEW_VERSION="${CURRENT_VERSION%.*}.$((${CURRENT_VERSION##*.} + 1))"

# Ensure all commits are pushed
git push

# Merge to main first
git checkout main
git pull origin main
git merge --no-ff hotfix/$NAME -m "Merge hotfix/$NAME into main

Critical fix for: $NAME

🤖 Generated with Claude Code
Co-Authored-By: Claude <noreply@anthropic.com>"

# Create tag on main (unless --no-tag)
git tag -a $NEW_VERSION -m "Hotfix $NEW_VERSION: $NAME

Critical production fix"

# Push main with tags
git push origin main --tags

# Merge back to develop
git checkout develop
git pull origin develop
git merge --no-ff hotfix/$NAME -m "Merge hotfix/$NAME back into develop

🤖 Generated with Claude Code
Co-Authored-By: Claude <noreply@anthropic.com>"

# Push develop
git push origin develop

# Delete branches (unless --no-delete)
git branch -d hotfix/$NAME
git push origin --delete hotfix/$NAME
```

**Success Response:**
```
✓ Pushed all commits to remote
✓ Merged hotfix/$NAME into main
✓ Created tag: $NEW_VERSION (patch bump)
✓ Pushed main with tags
✓ Merged hotfix/$NAME into develop
✓ Pushed to origin/develop
✓ Deleted local branch: hotfix/$NAME
✓ Deleted remote branch: origin/hotfix/$NAME

🔥 Hotfix Complete: $NEW_VERSION

Merged to: main, develop
Tag created: $NEW_VERSION
Issue fixed: $NAME
Previous version: $CURRENT_VERSION

⚠️ CRITICAL: Deploy to production immediately!

Next steps:
1. Deploy $NEW_VERSION to production NOW
2. Monitor production systems closely
3. Verify fix is working
4. Notify team of hotfix deployment
5. Update incident documentation

Deployment command:
  [your deployment command here]

Monitor:
  - Error rates
  - System metrics
  - User reports
```

### 6. Error Handling

**Not on Git Flow Branch:**
```
❌ Not on a Git Flow branch

Current branch: $CURRENT_BRANCH

/finish only works on:
- feature/* branches
- release/* branches
- hotfix/* branches

To finish this branch manually:
1. Switch to target branch
2. Merge manually: git merge $CURRENT_BRANCH
3. Push: git push
```

**Uncommitted Changes:**
```
❌ Cannot finish: Uncommitted changes detected

Modified files:
M  src/file1.js
M  src/file2.js

Please commit or stash your changes first:
1. Commit: git add . && git commit
2. Stash: git stash
3. Discard: git checkout .
```

**Unpushed Commits:**
```
⚠️  Warning: 3 unpushed commits detected

Commits not on remote:
  abc1234 feat: add new feature
  def5678 fix: resolve bug
  ghi9012 docs: update README

Would you like to push now? [Y/n]
✓ Pushing commits...
✓ All commits pushed to remote
```

**Test Failures:**
```
❌ Cannot finish: Tests are failing

Failed tests:
  ✗ UserService.test.js
    - should authenticate user (expected 200, got 401)
  ✗ PaymentController.test.js
    - should process payment (timeout)

Fix the failing tests before finishing:
1. Run tests: npm test
2. Fix failures
3. Commit fixes
4. Try /finish again

Skip tests? (NOT RECOMMENDED) [y/N]
```

**Merge Conflicts:**
```
❌ Merge conflict detected with develop

Conflicting files:
  src/config.js
  package.json

Resolution steps:
1. Fetch latest develop: git fetch origin develop
2. Try merge locally: git merge origin/develop
3. Resolve conflicts manually
4. Commit resolution
5. Try /finish again

Would you like to see conflict details? [Y/n]
```

**Missing Tag for Release:**
```
⚠️  Release branch missing version in CHANGELOG

Expected format in CHANGELOG.md:
## [v1.2.0] - 2025-10-01

Current CHANGELOG:
[show relevant section]

Please update CHANGELOG.md with release version.
Continue anyway? [y/N]
```

### 7. Arguments

**--no-delete**: Keep branch after merging
```bash
/finish --no-delete

# Merges but keeps local and remote branches
```

**--no-tag**: Skip tag creation (release/hotfix only)
```bash
/finish --no-tag

# Merges but doesn't create version tag
```

### 8. Interactive Confirmation

For destructive operations, ask for confirmation:

```
🔍 Finish Summary

Branch: release/v1.2.0
Type: Release
Will merge to: main, develop
Will create tag: v1.2.0
Will delete: Local and remote branches

Actions to perform:
  1. Merge to main
  2. Create tag v1.2.0 on main
  3. Push main with tags
  4. Merge to develop
  5. Push develop
  6. Delete release/v1.2.0 (local)
  7. Delete origin/release/v1.2.0 (remote)

Proceed with finish? [Y/n]
```

### 9. Post-Finish Checklist

**For Features:**
```
✅ Feature Finished Checklist

- [x] Merged to develop
- [x] Remote branch deleted
- [x] Local branch deleted

What's next:
- Feature is now in develop
- Will be included in next release
- Team can pull from develop
- You can start new feature

Start new feature:
  /feature <name>
```

**For Releases:**
```
✅ Release Finished Checklist

- [x] Merged to main
- [x] Merged to develop
- [x] Tag created: v1.2.0
- [x] Branches deleted

Deployment checklist:
- [ ] Deploy to production
- [ ] Verify deployment
- [ ] Monitor for issues
- [ ] Announce release
- [ ] Update documentation

Deploy command:
  [your deployment command]
```

**For Hotfixes:**
```
✅ Hotfix Finished Checklist

- [x] Merged to main
- [x] Merged to develop
- [x] Tag created: v1.2.1
- [x] Branches deleted

🚨 IMMEDIATE ACTIONS REQUIRED:
- [ ] Deploy to production NOW
- [ ] Monitor production systems
- [ ] Verify fix is working
- [ ] Notify team
- [ ] Update incident documentation

This was an emergency hotfix - production deployment is CRITICAL!
```

## Environment Variables

- `GIT_FLOW_MAIN_BRANCH`: Main branch (default: "main")
- `GIT_FLOW_DEVELOP_BRANCH`: Develop branch (default: "develop")

## Related Commands

- `/feature <name>` - Start new feature branch
- `/release <version>` - Start new release branch
- `/hotfix <name>` - Start new hotfix branch
- `/flow-status` - Check Git Flow status

## Best Practices

**DO:**
- ✅ Run tests before finishing
- ✅ Ensure all commits are pushed
- ✅ Review changes one last time
- ✅ Update CHANGELOG for releases
- ✅ Create tags for releases/hotfixes
- ✅ Merge to all required branches
- ✅ Clean up branches after merge

**DON'T:**
- ❌ Finish with failing tests
- ❌ Skip pushing commits
- ❌ Forget to merge to develop
- ❌ Leave branches undeleted
- ❌ Skip tags for releases
- ❌ Force push after merge
