---
allowed-tools: Bash(git:*), Read, Edit, Write
argument-hint: <version>
description: Create a new Git Flow release branch from develop with version bumping and changelog generation
---

# Git Flow Release Branch

Create new release branch: **$ARGUMENTS**

## Current Repository State

- Current branch: !`git branch --show-current`
- Git status: !`git status --porcelain`
- Latest tag: !`git describe --tags --abbrev=0 2>/dev/null || echo "No tags found"`
- Commits since last tag: !`git log $(git describe --tags --abbrev=0 2>/dev/null)..HEAD --oneline 2>/dev/null | wc -l | tr -d ' '`
- Package.json version: !`cat package.json 2>/dev/null | grep '"version"' | head -1 || echo "No package.json found"`
- Recent commits: !`git log --oneline -10`

## Task

Create a Git Flow release branch following these steps:

### 1. Version Validation

Validate the version format and ensure it's newer than current:

**Version Format Requirements:**
- Must follow semantic versioning: `vMAJOR.MINOR.PATCH`
- Examples: `v1.0.0`, `v2.1.3`, `v0.5.0-beta.1`
- Pattern: `v` + `NUMBER.NUMBER.NUMBER` + optional `-prerelease.NUMBER`

**Version Increment Logic:**

Analyze commits since last tag to suggest version:
- **MAJOR** (v2.0.0): Breaking changes (contains "BREAKING CHANGE:" in commits)
- **MINOR** (v1.3.0): New features (contains "feat:" commits)
- **PATCH** (v1.2.1): Bug fixes only (only "fix:" and "chore:" commits)

**Current Version Analysis:**
```
Latest tag: [from git describe]
Suggested version: [based on commit analysis]
Provided version: $ARGUMENTS
```

If version is invalid or not newer, show:
```
❌ Invalid version format: "$ARGUMENTS"

✅ Use semantic versioning: vMAJOR.MINOR.PATCH

Examples:
  - v1.0.0 (initial release)
  - v1.2.0 (new features)
  - v1.2.1 (bug fixes)
  - v2.0.0 (breaking changes)
  - v1.0.0-beta.1 (pre-release)

💡 Suggested version based on commits: v1.3.0
```

### 2. Create Release Branch Workflow

```bash
# Switch to develop and update
git checkout develop
git pull origin develop

# Create release branch
git checkout -b release/$ARGUMENTS

# Update package.json version (if Node.js project)
npm version ${ARGUMENTS#v} --no-git-tag-version

# Generate CHANGELOG.md from commits
# (analyze git log since last tag)

# Commit version bump
git add package.json CHANGELOG.md
git commit -m "chore(release): bump version to ${ARGUMENTS#v}

- Updated package.json version
- Generated CHANGELOG.md from commits

🤖 Generated with Claude Code
Co-Authored-By: Claude <noreply@anthropic.com>"

# Push to remote with tracking
git push -u origin release/$ARGUMENTS
```

### 3. CHANGELOG Generation

Generate changelog from commits since last tag, grouped by type:

```markdown
# Changelog

## [$ARGUMENTS] - [Current Date]

### ✨ Features
- [List all feat: commits with PR links]

### 🐛 Bug Fixes
- [List all fix: commits with PR links]

### 📝 Documentation
- [List all docs: commits]

### ♻️ Refactoring
- [List all refactor: commits]

### ⚡️ Performance
- [List all perf: commits]

### 🔒️ Security
- [List all security-related commits]

### 💥 Breaking Changes
- [List all commits with BREAKING CHANGE]

### 🧪 Tests
- [List all test: commits]

### 🔧 Chore
- [List all chore: commits]
```

### 4. Release Checklist

Display this checklist after creation:

```
🚀 Release Checklist for $ARGUMENTS

Pre-Release Tasks:
- [ ] All tests passing (run: npm test)
- [ ] Documentation updated
- [ ] CHANGELOG.md reviewed and accurate
- [ ] Version numbers consistent across files
- [ ] No breaking changes (or properly documented)
- [ ] Dependencies updated (run: npm audit)

Testing Tasks:
- [ ] Manual testing completed
- [ ] Regression tests passed
- [ ] Performance benchmarks acceptable
- [ ] Security scan clean (run: npm audit)
- [ ] Cross-browser testing (if applicable)

Deployment Preparation:
- [ ] Staging deployment successful
- [ ] Production deployment plan reviewed
- [ ] Rollback plan documented
- [ ] Monitoring and alerts configured

Final Steps:
- [ ] Create PR to main (run: gh pr create)
- [ ] Get required approvals (minimum 2 reviewers)
- [ ] Run /finish to merge and tag release
- [ ] Announce release to team

🎯 Next Commands:
- Review CHANGELOG: cat CHANGELOG.md
- Run tests: npm test
- Create PR: gh pr create --base main --head release/$ARGUMENTS
- When ready: /finish
```

### 5. Success Response

```
✓ Switched to develop branch
✓ Pulled latest changes from origin/develop
✓ Created branch: release/$ARGUMENTS
✓ Updated package.json version to ${ARGUMENTS#v}
✓ Generated CHANGELOG.md (15 commits analyzed)
✓ Committed version bump changes
✓ Set up remote tracking: origin/release/$ARGUMENTS
✓ Pushed branch to remote

🚀 Release Branch Ready: $ARGUMENTS

Branch: release/$ARGUMENTS
Base: develop
Target: main (after review)

📊 Release Statistics:
  - 5 new features
  - 3 bug fixes
  - 1 performance improvement
  - 0 breaking changes
  - 2 documentation updates

📝 CHANGELOG Summary:
  - Created with 15 commits
  - Grouped by commit type
  - Includes PR references
  - Ready for review

🎯 Next Steps:
1. Review CHANGELOG.md for accuracy
2. Run final tests: npm test
3. Test on staging environment
4. Create PR to main: gh pr create
5. Get team approvals
6. Run /finish to complete release

💡 Release Tips:
- No new features should be added to release branch
- Only bug fixes and documentation updates allowed
- Keep release branch short-lived (hours, not days)
- Tag will be created automatically when merged to main
```

### 6. Error Handling

**No Version Provided:**
```
❌ Version is required

Usage: /release <version>

Examples:
  /release v1.2.0
  /release v2.0.0-beta.1

Current version: v1.1.0
Suggested version: v1.2.0 (based on commits)
```

**Invalid Version Format:**
```
❌ Invalid version format: "1.0"

✅ Correct format: v1.0.0 (must start with 'v')

Examples:
  ✅ v1.0.0
  ✅ v2.1.3
  ✅ v1.0.0-beta.1
  ❌ 1.0.0 (missing 'v')
  ❌ v1.0 (incomplete)
  ❌ version-1.0.0 (wrong format)
```

**Version Not Incremented:**
```
❌ Version $ARGUMENTS is not newer than current v1.2.0

💡 Valid version bumps from v1.2.0:
  - v1.2.1 (patch - bug fixes only)
  - v1.3.0 (minor - new features)
  - v2.0.0 (major - breaking changes)

📊 Commit Analysis:
  - 3 feat: commits → suggests MINOR bump (v1.3.0)
  - 0 BREAKING CHANGE → no MAJOR bump needed
  - 2 fix: commits → could use PATCH (v1.2.1)

Recommended: v1.3.0
```

**Uncommitted Changes:**
```
⚠️  Uncommitted changes detected:
M  src/feature.js
M  README.md

Before creating release:
1. Commit your changes
2. Stash them: git stash
3. Or discard them: git checkout .

Please clean your working directory first.
```

**Develop Behind Remote:**
```
⚠️  Local develop is behind origin/develop by 3 commits

✓ Pulling latest changes...
✓ Fetched 3 commits
✓ Develop is now up to date with remote
✓ Ready to create release branch
```

## Creating Pull Request

If `gh` CLI is available, offer to create PR:

```bash
gh pr create \
  --title "Release $ARGUMENTS" \
  --body "$(cat <<'EOF'
## Release Summary

Version: $ARGUMENTS
Base: develop
Target: main

## Changes Included

[Auto-generated from CHANGELOG.md]

## Release Checklist

- [ ] All tests passing
- [ ] Documentation updated
- [ ] CHANGELOG reviewed
- [ ] No breaking changes (or documented)
- [ ] Security audit clean
- [ ] Staging deployment successful

## Deployment Plan

1. Merge to main
2. Tag release: $ARGUMENTS
3. Deploy to production
4. Merge back to develop
5. Monitor for issues

---
🤖 Generated with Claude Code
EOF
)" \
  --base main \
  --head release/$ARGUMENTS \
  --label "release" \
  --assignee @me
```

## Semantic Versioning Guide

**MAJOR version (X.0.0)**: Breaking changes
- API changes that break backward compatibility
- Removal of deprecated features
- Major architectural changes

**MINOR version (1.X.0)**: New features
- New functionality added
- Backward compatible changes
- New APIs or methods

**PATCH version (1.0.X)**: Bug fixes
- Bug fixes only
- No new features
- No breaking changes

## Environment Variables

- `GIT_FLOW_DEVELOP_BRANCH`: Develop branch name (default: "develop")
- `GIT_FLOW_MAIN_BRANCH`: Main branch name (default: "main")
- `GIT_FLOW_PREFIX_RELEASE`: Release prefix (default: "release/")

## Related Commands

- `/finish` - Complete release (merge to main and develop, create tag)
- `/flow-status` - Check current Git Flow status
- `/feature <name>` - Create feature branch
- `/hotfix <name>` - Create hotfix branch

## Best Practices

**DO:**
- ✅ Analyze commits to determine correct version bump
- ✅ Generate comprehensive CHANGELOG
- ✅ Test thoroughly on release branch
- ✅ Keep release branch short-lived
- ✅ Only allow bug fixes on release branch
- ✅ Create PR for team review

**DON'T:**
- ❌ Add new features to release branch
- ❌ Skip testing phase
- ❌ Let release branch live for days
- ❌ Skip CHANGELOG generation
- ❌ Forget to merge back to develop
- ❌ Create releases without team approval
