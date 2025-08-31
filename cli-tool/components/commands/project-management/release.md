---
allowed-tools: Read, Write, Edit, Bash
argument-hint: [version-type] | --patch | --minor | --major | --prerelease
description: Prepare and execute project release with version management and changelog updates
model: sonnet
---

# Project Release

Update CHANGELOG.md with changes since the last version increase. Check our README.md for any necessary changes. Check the scope of changes since the last release and increase our version number as appropriate: **$ARGUMENTS**

## Current Project State

- Git status: !`git status --porcelain`
- Current version: !`git describe --tags --abbrev=0 2>/dev/null || echo "No previous tags"`
- Recent commits: !`git log --oneline --since="1 month ago" | head -10`
- Package info: @package.json or @setup.py or @Cargo.toml (if exists)

## Task

Prepare a project release following these steps:

1. **Analyze Changes**: Review git history since last release to determine appropriate version increment
2. **Update Version**: Update version in package.json, setup.py, or other version files based on semantic versioning
3. **Update Changelog**: Add new entries to CHANGELOG.md with proper categorization (Added, Changed, Fixed, etc.)
4. **Update Documentation**: Review and update README.md if necessary for new features or changes
5. **Create Release**: Tag the release and prepare release notes

If version type is specified in $ARGUMENTS, use that increment. Otherwise, analyze the changes and suggest appropriate versioning.

Focus on maintaining proper semantic versioning and clear changelog documentation.