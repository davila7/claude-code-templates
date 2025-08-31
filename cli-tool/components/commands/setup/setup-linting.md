---
allowed-tools: Read, Write, Edit, Bash
argument-hint: [language] | --javascript | --typescript | --python | --multi-language
description: Configure comprehensive code linting and quality analysis tools with automated enforcement
model: sonnet
---

# Setup Code Linting

Configure comprehensive code linting and quality analysis: **$ARGUMENTS**

## Current Code Quality State

- Languages detected: !`find . -name "*.js" -o -name "*.ts" -o -name "*.py" -o -name "*.rs" | head -5`
- Existing linters: @.eslintrc.* or @pyproject.toml or @tslint.json
- Package manager: @package.json or @requirements.txt or @Cargo.toml
- Code quality tools: !`which eslint flake8 pylint mypy clippy 2>/dev/null | wc -l`

## Task

Setup comprehensive code linting system with quality analysis and automated enforcement:

**Language Focus**: Use $ARGUMENTS to configure JavaScript/TypeScript ESLint, Python linting, or multi-language quality analysis

**Linting Configuration**:
1. **Tool Installation** - ESLint, Flake8, Pylint, MyPy, Clippy, language-specific linters and plugins
2. **Rule Configuration** - Code style rules, error detection, best practices, security patterns, performance guidelines
3. **IDE Integration** - Real-time linting, error highlighting, quick fixes, workspace settings
4. **Quality Gates** - Pre-commit validation, CI/CD integration, pull request checks, quality metrics
5. **Custom Rules** - Project-specific patterns, architectural constraints, team conventions
6. **Performance** - Incremental linting, caching strategies, parallel execution, optimization

**Advanced Features**: Security linting, accessibility checks, performance analysis, dependency analysis, code complexity metrics.

**Team Standards**: Shared configurations, style guides, review guidelines, onboarding documentation.

**Output**: Complete linting system with automated quality gates, team standards enforcement, and comprehensive code analysis.