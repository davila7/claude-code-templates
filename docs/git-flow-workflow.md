## Git Flow Workflow Guide

### Branch Structure

This repository uses Git Flow methodology with the following branch structure:

- **main** - Production-ready code (protected)
- **develop** - Integration branch for features (protected)
- **feature/** - New features and enhancements
- **release/** - Release preparation
- **hotfix/** - Critical production fixes
- **support/** - Long-term support branches

### Branch Protection

Both `main` and `develop` branches are protected with:
- Required pull request reviews (1 approval minimum)
- Dismiss stale reviews on new commits
- No force pushes allowed
- No deletions allowed

### Starting New Work

#### Create a Feature Branch
```bash
# From develop branch
git checkout develop
git pull origin develop
git flow feature start <feature-name>
# Or manually:
git checkout -b feature/<feature-name> develop
```

#### Create a Hotfix Branch
```bash
# From main branch (for critical production fixes)
git checkout main
git pull origin main
git flow hotfix start <version>
# Or manually:
git checkout -b hotfix/<fix-name> main
```

### Completing Work

#### Finish a Feature
```bash
# Merge feature into develop
git flow feature finish <feature-name>
# Or manually:
git checkout develop
git merge --no-ff feature/<feature-name>
git branch -d feature/<feature-name>
git push origin develop
git push origin --delete feature/<feature-name>
```

#### Create a Release
```bash
# Start release from develop
git checkout develop
git pull origin develop
git flow release start v1.22.0
# Or manually:
git checkout -b release/v1.22.0 develop

# Update version in package.json
npm version minor  # or patch/major

# Finish release (merges to main and develop)
git flow release finish v1.22.0
# Or manually:
git checkout main
git merge --no-ff release/v1.22.0
git tag -a v1.22.0 -m "Release v1.22.0"
git checkout develop
git merge --no-ff release/v1.22.0
git branch -d release/v1.22.0
git push origin main develop --tags
```

#### Finish a Hotfix
```bash
# Merge to both main and develop
git flow hotfix finish <version>
# Or manually:
git checkout main
git merge --no-ff hotfix/<fix-name>
git tag -a v1.21.14 -m "Hotfix v1.21.14"
git checkout develop
git merge --no-ff hotfix/<fix-name>
git branch -d hotfix/<fix-name>
git push origin main develop --tags
```

### Common Commands

```bash
# List all feature branches
git flow feature list
# Or: git branch | grep "feature/"

# List all release branches
git flow release list
# Or: git branch | grep "release/"

# Check current Git Flow configuration
git config --get-regexp gitflow

# View branch structure
git log --graph --oneline --all --decorate
```

### Pull Request Workflow

1. **Create feature branch** from `develop`
2. **Make changes** and commit regularly
3. **Push to origin** and create Pull Request
4. **Request review** from team members
5. **Address feedback** and update PR
6. **Merge via PR** once approved (requires 1 approval)
7. **Delete feature branch** after merge

### Release Process

1. **Create release branch** from `develop`
   ```bash
   git flow release start v1.22.0
   ```

2. **Update version** in package.json
   ```bash
   npm version minor
   ```

3. **Update CHANGELOG** (if applicable)

4. **Test thoroughly** on release branch

5. **Merge to main and develop**
   ```bash
   git flow release finish v1.22.0
   ```

6. **Push everything**
   ```bash
   git push origin main develop --tags
   ```

7. **Publish to npm** (if applicable)
   ```bash
   npm publish
   ```

### Best Practices

- **Never commit directly** to `main` or `develop`
- **Always use feature branches** for new work
- **Keep features small** and focused
- **Rebase before merging** to keep history clean
- **Write meaningful commit messages**
- **Delete branches** after merging
- **Tag all releases** with semantic versioning

### Troubleshooting

#### Rename a feature branch
```bash
git branch -m feature/old-name feature/new-name
git push origin feature/new-name
git push origin --delete feature/old-name
```

#### Abort a release
```bash
git checkout develop
git branch -D release/v1.22.0
```

#### Fix conflicts during merge
```bash
# If conflicts occur during feature finish
git status  # See conflicting files
# Edit files to resolve conflicts
git add .
git commit
```

### Git Flow Configuration

Current configuration:
```
Production branch: main
Development branch: develop
Feature prefix: feature/
Release prefix: release/
Hotfix prefix: hotfix/
Support prefix: support/
Version tag prefix: v
```
