---
allowed-tools: Read, Write, Edit, Bash
argument-hint: [release-type] | --semantic | --conventional-commits | --github-actions | --full-automation
description: Setup automated release workflows with semantic versioning, conventional commits, and comprehensive automation
model: sonnet
---

# Automated Release System

Setup automated release workflows: $ARGUMENTS

## Current Project Analysis

- Project structure: @package.json or @setup.py or @go.mod (detect project type)
- Existing workflows: !`find .github/workflows -name "*.yml" 2>/dev/null | head -3`
- Current versioning: @package.json version or git tags analysis
- Commit patterns: !`git log --oneline -20 | grep -E "^(feat|fix|docs|style|refactor|test|chore)" | wc -l || echo "0"` conventional commits
- Release history: !`git tag -l | wc -l || echo "0"` existing releases

## Task

Implement comprehensive automated release system:

1. **Analyze Repository Structure**
   - Detect project type (Node.js, Python, Go, etc.)
   - Check for existing CI/CD workflows
   - Identify current versioning approach
   - Review existing release processes

2. **Create Version Tracking**
   - For Node.js: Use package.json version field
   - For Python: Use __version__ in __init__.py or pyproject.toml
   - For Go: Use version in go.mod
   - For others: Create version.txt file
   - Ensure version follows semantic versioning (MAJOR.MINOR.PATCH)

3. **Set Up Conventional Commits**
   - Create CONTRIBUTING.md with commit conventions:
     - `feat:` for new features (minor bump)
     - `fix:` for bug fixes (patch bump)
     - `feat!:` or `BREAKING CHANGE:` for breaking changes (major bump)
     - `docs:`, `chore:`, `style:`, `refactor:`, `test:` for non-releasing changes
   - Include examples and guidelines for each type

4. **Create Pull Request Template**
   - Add `.github/pull_request_template.md`
   - Include conventional commit reminder
   - Add checklist for common requirements
   - Reference contributing guidelines

5. **Create Release Workflow**
   - Add `.github/workflows/release.yml`:
     - Trigger on push to main branch
     - Analyze commits since last release
     - Determine version bump type
     - Update version in appropriate file(s)
     - Generate release notes from commits
     - Update CHANGELOG.md
     - Create git tag
     - Create GitHub Release
     - Attach distribution artifacts
   - Include manual trigger option for forced releases

6. **Create PR Validation Workflow**
   - Add `.github/workflows/pr-check.yml`:
     - Validate PR title follows conventional format
     - Check commit messages
     - Provide feedback on version impact
     - Run tests and quality checks

7. **Configure GitHub Release Notes**
   - Create `.github/release.yml`
   - Define categories for different change types
   - Configure changelog exclusions
   - Set up contributor recognition

8. **Update Documentation**
   - Add release badges to README:
     - Current version badge
     - Latest release badge
     - Build status badge
   - Document release process
   - Add link to CONTRIBUTING.md
   - Explain version bump rules

9. **Set Up Changelog Management**
   - Ensure CHANGELOG.md follows Keep a Changelog format
   - Add [Unreleased] section for upcoming changes
   - Configure automatic changelog updates
   - Set up changelog categories

10. **Configure Branch Protection**
    - Recommend branch protection rules:
      - Require PR reviews
      - Require status checks
      - Require conventional PR titles
      - Dismiss stale reviews
    - Document recommended settings

11. **Add Security Scanning**
    - Set up Dependabot for dependency updates
    - Configure security alerts
    - Add security policy if needed

12. **Test the System**
    - Create example PR with conventional title
    - Verify PR checks work correctly
    - Test manual release trigger
    - Validate changelog generation

Arguments: $ARGUMENTS

### Additional Considerations

**For Monorepos:**
- Set up independent versioning per package
- Configure changelog per package
- Use conventional commits scopes

**For Libraries:**
- Include API compatibility checks
- Generate API documentation
- Add upgrade guides for breaking changes

**For Applications:**
- Include Docker image versioning
- Set up deployment triggers
- Add rollback procedures

**Best Practices:**
- Always create release branches for hotfixes
- Use release candidates for major versions
- Maintain upgrade guides
- Keep releases small and frequent
- Document rollback procedures

This automated release system provides:
- ✅ Consistent versioning
- ✅ Automatic changelog generation
- ✅ Clear contribution guidelines
- ✅ Professional release notes
- ✅ Reduced manual work
- ✅ Better project maintainability