---
allowed-tools: Read, Write, Edit, Bash
argument-hint: [format] | --generate | --validate | --demo
description: Demonstrate changelog automation features with real examples and validation
model: sonnet
---

# Changelog Automation Demo

Demonstrate changelog automation features: $ARGUMENTS

## Current Project State

- Existing changelog: @CHANGELOG.md (if exists)
- Package version: @package.json or @pyproject.toml or @Cargo.toml (if exists)
- Recent commits: !`git log --oneline -10`
- Git tags: !`git tag -l | tail -5`

## Demo Features

### 1. **Changelog Generation Demo**
- Generate sample changelog entries from git commits
- Show different changelog formats (Keep a Changelog, conventional-changelog)
- Demonstrate automatic categorization of changes
- Show version numbering and semantic versioning

### 2. **Format Validation Demo**
- Validate existing changelog format compliance
- Show format inconsistencies and suggestions
- Demonstrate automated formatting fixes
- Show integration with release automation

### 3. **Integration Testing**
- Test changelog automation without affecting main workflow
- Validate changelog generation pipeline
- Test different commit message patterns
- Show error handling and recovery

### 4. **Performance Benchmarking**
- Measure changelog generation speed
- Test with large commit histories
- Show memory usage and optimization
- Benchmark different parsing strategies
