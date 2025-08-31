---
allowed-tools: Read, Write, Edit, Bash
argument-hint: [language] | --javascript | --typescript | --python | --multi-language
description: Configure comprehensive code formatting tools with consistent style enforcement
model: sonnet
---

# Setup Code Formatting

Configure comprehensive code formatting with consistent style enforcement: **$ARGUMENTS**

## Current Project State

- Languages detected: !`find . -name "*.js" -o -name "*.ts" -o -name "*.py" -o -name "*.rs" | head -5`
- Existing formatters: @.prettierrc or @pyproject.toml or @rustfmt.toml
- Package manager: @package.json or @requirements.txt or @Cargo.toml
- IDE config: @.vscode/settings.json or @.editorconfig

## Task

Setup comprehensive code formatting system with automated enforcement and team consistency:

**Language Focus**: Use $ARGUMENTS to configure JavaScript/TypeScript, Python, Rust, or multi-language formatting

**Formatting Setup**:
1. **Tool Installation** - Prettier, Black, rustfmt, language-specific formatters and plugins
2. **Configuration** - Style rules, line length, indentation, quotes, trailing commas, language-specific options
3. **IDE Integration** - Editor extensions, format-on-save, keyboard shortcuts, workspace settings
4. **Automation** - Pre-commit hooks, CI/CD formatting checks, automated formatting scripts
5. **Team Sync** - Shared configurations, style guides, enforcement policies, onboarding documentation
6. **Validation** - Formatting verification, CI integration, team compliance monitoring

**Advanced Features**: Custom rules, framework-specific formatting, performance optimization, incremental formatting.

**Consistency**: Cross-platform compatibility, team standardization, legacy code migration strategies.

**Output**: Complete formatting system with automated enforcement, team configurations, and style compliance monitoring.