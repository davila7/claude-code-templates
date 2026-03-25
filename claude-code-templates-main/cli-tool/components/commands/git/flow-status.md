---
allowed-tools: Bash(git:*), Read
description: Display comprehensive Git Flow status including branch type, sync status, changes, and merge targets
---

# Git Flow Status

Display comprehensive Git Flow repository status

## Current Repository State

- Current branch: !`git branch --show-current`
- Git status: !`git status --porcelain`
- Branch list: !`git branch -a | grep -E '(feature|release|hotfix|develop|main)' | head -20`
- Latest tags: !`git tag --sort=-version:refname | head -5`
- Recent commits: !`git log --oneline --graph --all -10`
- Remote status: !`git remote -v`

## Task

Provide a comprehensive Git Flow status report:

### 1. Branch Analysis

Determine current branch type and state:

```bash
CURRENT_BRANCH=$(git branch --show-current)

# Detect branch type
if [[ $CURRENT_BRANCH == "main" ]]; then
  BRANCH_TYPE="🏠 Production"
  ICON="🏠"
  STATUS_COLOR="red"
elif [[ $CURRENT_BRANCH == "develop" ]]; then
  BRANCH_TYPE="🔀 Integration"
  ICON="🔀"
  STATUS_COLOR="blue"
elif [[ $CURRENT_BRANCH == feature/* ]]; then
  BRANCH_TYPE="🌿 Feature"
  ICON="🌿"
  STATUS_COLOR="green"
elif [[ $CURRENT_BRANCH == release/* ]]; then
  BRANCH_TYPE="🚀 Release"
  ICON="🚀"
  STATUS_COLOR="yellow"
elif [[ $CURRENT_BRANCH == hotfix/* ]]; then
  BRANCH_TYPE="🔥 Hotfix"
  ICON="🔥"
  STATUS_COLOR="red"
else
  BRANCH_TYPE="📁 Other"
  ICON="📁"
  STATUS_COLOR="gray"
fi
```

### 2. Comprehensive Status Display

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🌿 GIT FLOW STATUS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📍 CURRENT BRANCH
   $ICON $CURRENT_BRANCH
   Type: $BRANCH_TYPE
   Base: [origin branch]
   Target: [merge destination]

📊 REPOSITORY INFO
   Remote: origin ($REMOTE_URL)
   Latest tag: v1.2.0
   Total branches: 12
   Active features: 3
   Active releases: 0
   Active hotfixes: 0

🔄 SYNC STATUS
   Commits ahead: ↑ 2
   Commits behind: ↓ 1
   Status: ⚠️  Branch diverged from remote

   Recommendations:
   - Pull latest changes: git pull
   - Push your commits: git push

📝 WORKING DIRECTORY
   Modified: ● 3 files
   Added: ✚ 5 files
   Deleted: ✖ 1 file
   Untracked: ? 2 files
   Total changes: 11 files

   Status: ⚠️  Uncommitted changes

📈 COMMIT HISTORY
   Commits on branch: 5
   Commits since base: 7
   Last commit: 2 hours ago
   Author: John Doe <john@example.com>

🎯 MERGE TARGET
   Will merge to: develop
   Merge status: ✓ Ready (no conflicts)

   Estimated files affected: 12
   Estimated lines changed: +245 -87

🏷️  VERSION INFO
   Current production: v1.2.0 (on main)
   Last release: 3 days ago
   Next suggested: v1.3.0 (based on commits)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### 3. Branch-Specific Information

**For Feature Branches:**
```
🌿 FEATURE BRANCH: feature/user-authentication

Branch info:
  Created: 2 days ago
  Base branch: develop
  Merge target: develop

Progress:
  Commits: 5
  Files changed: 12
  Lines added: 245
  Lines removed: 87

Status:
  ✓ No merge conflicts with develop
  ✓ Branch is up to date with remote
  ⚠️  3 uncommitted changes
  ⚠️  Tests not run recently

Next steps:
  1. Commit your changes
  2. Run tests: npm test
  3. Push to remote: git push
  4. When ready: /finish
```

**For Release Branches:**
```
🚀 RELEASE BRANCH: release/v1.3.0

Release info:
  Version: v1.3.0
  Created: 1 day ago
  Base branch: develop
  Merge targets: main, develop

Release contents:
  Features: 5
  Bug fixes: 3
  Performance: 1
  Total commits: 15

Version analysis:
  Current: v1.2.0
  Proposed: v1.3.0
  Increment: MINOR (new features)

Checklist:
  ✓ CHANGELOG.md updated
  ✓ Version in package.json
  ⚠️  Tests not run
  ✗ No tag created yet

Next steps:
  1. Run final tests: npm test
  2. Review CHANGELOG.md
  3. Create PR: gh pr create
  4. Get approvals
  5. Finish release: /finish
```

**For Hotfix Branches:**
```
🔥 HOTFIX BRANCH: hotfix/critical-security-patch

Hotfix info:
  Issue: critical-security-patch
  Created: 2 hours ago
  Base branch: main
  Merge targets: main, develop
  Severity: CRITICAL

Version info:
  Current production: v1.2.0
  Hotfix version: v1.2.1
  Increment: PATCH

Status:
  ✓ Fix implemented
  ✓ Tests passing
  ⚠️  Not yet deployed
  ⚠️  2 uncommitted changes

⚠️  URGENT: This is a critical production hotfix!

Next steps:
  1. Commit remaining changes
  2. Final testing
  3. Create emergency PR
  4. Get fast-track approval
  5. Finish and deploy: /finish
  6. Monitor production
```

**For Main Branch:**
```
🏠 MAIN BRANCH (Production)

Production info:
  Latest tag: v1.2.0
  Released: 3 days ago
  Last commit: 3 days ago
  Status: ✓ Clean and stable

Active work:
  Feature branches: 3
  Release branches: 0
  Hotfix branches: 0

Recent releases:
  v1.2.0 - 3 days ago
  v1.1.5 - 1 week ago
  v1.1.4 - 2 weeks ago

⚠️  WARNING: You are on the production branch!

Avoid committing directly to main.
Use feature/release/hotfix branches instead.

To start new work:
  /feature <name>    - New feature
  /release <version> - New release
  /hotfix <name>     - Emergency fix
```

**For Develop Branch:**
```
🔀 DEVELOP BRANCH (Integration)

Integration info:
  Ahead of main: 12 commits
  Last merge: 1 day ago
  Status: ✓ Stable

Merged features:
  feature/user-authentication (2 days ago)
  feature/payment-gateway (1 week ago)
  feature/dashboard-redesign (2 weeks ago)

Active features:
  feature/notifications (in progress)
  feature/api-v2 (in progress)
  feature/mobile-app (in progress)

Next release:
  Suggested version: v1.3.0
  Estimated features: 5
  Estimated timeline: 1 week

To start new work:
  /feature <name> - Create new feature
```

### 4. All Git Flow Branches

List all active Git Flow branches:

```
📋 ACTIVE BRANCHES

🌿 Features (3):
  feature/notifications        (2 commits, 1 day old)
  feature/api-v2              (8 commits, 1 week old)
  feature/mobile-app          (15 commits, 2 weeks old)

🚀 Releases (0):
  No active releases

🔥 Hotfixes (0):
  No active hotfixes

🏠 Main branches:
  main    (production, v1.2.0)
  develop (integration, +12 commits ahead)

📦 Stale branches (older than 30 days):
  feature/old-experiment       (45 days old)
  feature/deprecated-feature   (60 days old)

  Cleanup suggestion: /clean-branches
```

### 5. Recommendations

Provide actionable recommendations based on status:

```
💡 RECOMMENDATIONS

Priority Actions:
  1. ⚠️  Commit your 3 uncommitted changes
  2. ⚠️  Push 2 unpushed commits to remote
  3. ⚠️  Pull 1 commit from remote (behind)
  4. ℹ️  Run tests before finishing

Branch Hygiene:
  - 2 stale branches can be deleted
  - feature/mobile-app is 2 weeks old (consider splitting)
  - No merge conflicts detected ✓

Next Steps:
  1. Commit changes: git add . && git commit
  2. Pull updates: git pull
  3. Push commits: git push
  4. Run tests: npm test
  5. Finish when ready: /finish
```

### 6. Error States

**Not in Git Repository:**
```
❌ Not in a git repository

Initialize git repository:
  git init
  git remote add origin <url>

Or navigate to a git repository.
```

**No Git Flow Structure:**
```
⚠️  Git Flow structure not detected

Missing branches:
  - develop (integration branch)
  - main (production branch)

Initialize Git Flow:
  git flow init

Or create branches manually:
  git checkout -b develop
  git checkout -b main
```

**Remote Not Configured:**
```
⚠️  No remote repository configured

Add remote:
  git remote add origin <repository-url>

Verify remote:
  git remote -v
```

### 7. Quick Stats

```
📊 QUICK STATS

Commits:
  Today: 3
  This week: 12
  This month: 45

Branches:
  Features: 3 active
  Releases: 0 active
  Hotfixes: 0 active
  Other: 5

Contributors:
  Active this week: 4
  Total: 8

Repository:
  Total commits: 1,234
  Total tags: 25
  Latest: v1.2.0
  Age: 6 months
```

### 8. Workflow Suggestions

Based on current state, suggest next commands:

```
🎯 SUGGESTED NEXT COMMANDS

For current branch (feature/user-authentication):
  /finish           - Complete and merge feature
  /flow-status      - Refresh this status

To start new work:
  /feature <name>   - New feature branch
  /release <version> - New release
  /hotfix <name>    - Emergency fix

Repository maintenance:
  /clean-branches   - Clean up old branches
  git fetch --prune - Remove stale remote refs
```

## Related Commands

- `/feature <name>` - Create feature branch
- `/release <version>` - Create release branch
- `/hotfix <name>` - Create hotfix branch
- `/finish` - Complete current branch

## Best Practices

**Regular Status Checks:**
- ✅ Run /flow-status daily
- ✅ Check before starting new work
- ✅ Verify before finishing branches
- ✅ Monitor for stale branches

**Status Indicators:**
- ✓ Green: Good to proceed
- ⚠️ Yellow: Attention needed
- ✗ Red: Action required
- ℹ️ Blue: Informational
