---
sidebar_position: 3
---

# Commands ⚡

**Commands** are pre-built slash commands that extend Claude Code's functionality with project-specific actions. They provide quick access to common development tasks and workflows, making your Claude Code sessions more efficient and productive.

## What Are Commands?

Commands are custom slash commands (starting with `/`) that:

- **Automate Common Tasks**: Streamline repetitive development workflows
- **Provide Quick Access**: Execute complex operations with simple command syntax
- **Enhance Productivity**: Reduce context switching and manual operations
- **Standardize Workflows**: Ensure consistent execution of common tasks across team members

## Command Categories

### 🔍 Code Analysis Commands

#### `/check-file`
**Purpose**: Quickly analyze file structure and identify potential issues

**Usage**:
```bash
/check-file src/components/UserProfile.tsx
```

**What it does**:
- Analyzes code structure and patterns
- Identifies potential bugs or anti-patterns
- Suggests improvements for code quality
- Checks for common security vulnerabilities
- Validates adherence to project conventions

**Example Output**:
```
File Analysis: src/components/UserProfile.tsx
✅ Component structure follows React best practices
⚠️  Missing PropTypes or TypeScript interface for props
❌ Inline styles detected - consider moving to CSS modules
✅ No unused imports found
🔧 Suggestion: Add error boundaries for better error handling
```

#### `/analyze-dependencies`
**Purpose**: Review and analyze project dependencies

**Usage**:
```bash
/analyze-dependencies
/analyze-dependencies --outdated
```

**What it does**:
- Lists all project dependencies
- Identifies outdated packages
- Suggests security updates
- Analyzes bundle size impact
- Recommends dependency optimizations

### 🧪 Testing Commands

#### `/generate-tests`
**Purpose**: Auto-generate test files based on existing code

**Usage**:
```bash
/generate-tests src/utils/dateHelper.js
/generate-tests src/components/Button.tsx --framework=jest
```

**What it does**:
- Analyzes the target file's functions and exports
- Generates comprehensive test cases
- Includes edge cases and error scenarios
- Follows project testing conventions
- Creates properly structured test files

**Example Output**:
```javascript
// Generated test file: src/utils/dateHelper.test.js
import { formatDate, isValidDate, calculateAge } from './dateHelper';

describe('dateHelper', () => {
  describe('formatDate', () => {
    it('should format date correctly', () => {
      const date = new Date('2023-12-25');
      expect(formatDate(date)).toBe('2023-12-25');
    });

    it('should handle invalid dates', () => {
      expect(formatDate(null)).toBe('Invalid Date');
    });
  });
  // ... more tests
});
```

#### `/run-tests`
**Purpose**: Execute tests with intelligent filtering and reporting

**Usage**:
```bash
/run-tests
/run-tests --changed
/run-tests --pattern=Button
```

**What it does**:
- Runs project test suite
- Provides detailed failure analysis
- Suggests fixes for failing tests
- Tracks test coverage changes
- Offers performance insights

### 🛠️ Code Generation Commands

#### `/create-component`
**Purpose**: Generate new components following project patterns

**Usage**:
```bash
/create-component UserCard --type=functional
/create-component Modal --with-styles --with-tests
```

**What it does**:
- Creates component files following project structure
- Includes TypeScript interfaces if applicable
- Generates associated styles and test files
- Adds proper imports and exports
- Follows established naming conventions

#### `/generate-api-client`
**Purpose**: Create API client code from OpenAPI specifications

**Usage**:
```bash
/generate-api-client swagger.json
/generate-api-client --endpoint=https://api.example.com/swagger
```

**What it does**:
- Parses OpenAPI/Swagger specifications
- Generates type-safe API client code
- Creates request/response interfaces
- Includes error handling patterns
- Adds documentation comments

### 🔧 Optimization Commands

#### `/optimize-imports`
**Purpose**: Clean up and optimize import statements

**Usage**:
```bash
/optimize-imports src/
/optimize-imports --remove-unused --sort-alphabetically
```

**What it does**:
- Removes unused imports
- Sorts imports alphabetically
- Groups imports by type (external, internal, relative)
- Identifies redundant imports
- Suggests more efficient import patterns

**Example Result**:
```javascript
// Before
import React from 'react';
import { useState, useEffect, useCallback } from 'react';
import { Button } from './Button';
import axios from 'axios';
import { debounce } from 'lodash';

// After optimization
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { debounce } from 'lodash';
import { Button } from './Button';
```

#### `/bundle-analysis`
**Purpose**: Analyze and optimize bundle size

**Usage**:
```bash
/bundle-analysis
/bundle-analysis --detailed --suggestions
```

**What it does**:
- Analyzes bundle composition
- Identifies large dependencies
- Suggests code splitting opportunities
- Recommends tree-shaking improvements
- Provides size optimization strategies

### 📚 Documentation Commands

#### `/generate-docs`
**Purpose**: Auto-generate documentation from code comments

**Usage**:
```bash
/generate-docs src/api/
/generate-docs --format=markdown --include-examples
```

**What it does**:
- Extracts JSDoc/docstring comments
- Generates formatted documentation
- Creates API reference guides
- Includes usage examples
- Maintains documentation structure

#### `/update-readme`
**Purpose**: Update README with current project information

**Usage**:
```bash
/update-readme
/update-readme --include-scripts --include-dependencies
```

**What it does**:
- Updates project description and features
- Refreshes installation instructions
- Updates available scripts
- Includes dependency information
- Maintains consistent formatting

## Installation

### CLI Parameter Installation (Recommended)
Install commands using the `--command` parameter:

```bash
# Install specific commands directly
npx claude-code-templates@latest --command=check-file --yes
npx claude-code-templates@latest --command=generate-tests --yes
npx claude-code-templates@latest --command=optimize-imports --yes
npx claude-code-templates@latest --command=create-component --yes
npx claude-code-templates@latest --command=bundle-analysis --yes
```

### Direct Download Method (Alternative)
Commands can also be installed directly to your `.claude/commands/` directory:

```bash
# Create commands directory if it doesn't exist
mkdir -p .claude/commands

# Install specific commands via direct download
curl -o .claude/commands/check-file.md \
  https://raw.githubusercontent.com/davila7/claude-code-templates/main/components/commands/check-file.md

curl -o .claude/commands/generate-tests.md \
  https://raw.githubusercontent.com/davila7/claude-code-templates/main/components/commands/generate-tests.md

curl -o .claude/commands/optimize-imports.md \
  https://raw.githubusercontent.com/davila7/claude-code-templates/main/components/commands/optimize-imports.md
```

### Batch Installation
Install multiple commands using CLI parameters:

```bash
# Install multiple commands using CLI parameters (recommended)
npx claude-code-templates@latest --command=check-file --yes
npx claude-code-templates@latest --command=generate-tests --yes
npx claude-code-templates@latest --command=run-tests --yes
npx claude-code-templates@latest --command=create-component --yes

# Or install via direct download (alternative)
commands=("check-file" "generate-tests" "run-tests" "create-component")
for cmd in "${commands[@]}"; do
  curl -o .claude/commands/${cmd}.md \
    https://raw.githubusercontent.com/davila7/claude-code-templates/main/components/commands/${cmd}.md
done
```

### Via Web Interface
Browse and install commands through the unified interface:

1. Run `npx claude-code-templates@latest`
2. Select "⚙️ Project Setup"
3. Filter by "Commands" in the navigation
4. Click on command cards to see installation instructions
5. Copy and run the provided curl commands

## Command Structure

### Command File Format
Commands are defined in Markdown files with specific structure:

```markdown
# Command Name

## Description
Brief description of what the command does.

## Usage
```bash
/command-name [arguments] [options]
```

## Parameters
- `argument1`: Description of first argument
- `--option1`: Description of first option

## Examples
```bash
/command-name example-arg --example-option
```

## Implementation
Detailed implementation instructions for Claude Code.

## Expected Output
Description of what the command should return.
```

### Custom Command Development

#### Creating New Commands
You can create custom commands for your project:

1. **Identify Need**: Find repetitive tasks that could be automated
2. **Design Interface**: Plan command syntax and parameters
3. **Write Documentation**: Create clear usage instructions
4. **Test Thoroughly**: Validate command works in various scenarios
5. **Share with Team**: Add to project's command collection

#### Command Best Practices

##### Design Principles
- **Clear Naming**: Use descriptive, action-oriented command names
- **Consistent Syntax**: Follow established parameter patterns
- **Helpful Output**: Provide actionable feedback and suggestions
- **Error Handling**: Include clear error messages and recovery suggestions

##### Implementation Guidelines
- **Single Responsibility**: Each command should focus on one specific task
- **Parameterization**: Make commands flexible with appropriate options
- **Documentation**: Include comprehensive usage examples
- **Performance**: Optimize for common use cases

## Working with Commands

### Command Discovery
List available commands in your project:

```bash
# View all available commands
ls .claude/commands/

# Search for specific command types
ls .claude/commands/ | grep test
ls .claude/commands/ | grep generate
```

### Command Usage Tips

#### Effective Command Usage
- **Learn Gradually**: Start with basic commands and gradually explore advanced options
- **Combine Commands**: Chain commands together for complex workflows
- **Customize Parameters**: Use command options to tailor output to your needs
- **Document Workflows**: Keep track of useful command combinations

#### Common Patterns
```bash
# Development workflow example
/check-file src/components/NewComponent.tsx
/generate-tests src/components/NewComponent.tsx
/optimize-imports src/components/
/run-tests --pattern=NewComponent

# Code review workflow
/analyze-dependencies --outdated
/bundle-analysis --suggestions
/generate-docs src/api/ --format=markdown
/update-readme --include-scripts
```

## Troubleshooting

### Common Issues

#### Command Not Found
- **Check Installation**: Verify the command file exists in `.claude/commands/`
- **Verify Naming**: Ensure the command name matches the file name
- **Restart Claude Code**: Refresh your Claude Code session to load new commands

#### Command Not Working as Expected
- **Check Syntax**: Review command documentation for correct usage
- **Verify Context**: Ensure you're in the correct directory/context
- **Update Commands**: Check for newer versions of the command

#### Performance Issues
- **Limit Scope**: Use parameters to limit command scope when possible
- **Optimize Frequency**: Avoid running heavy commands too frequently
- **Clean Up**: Remove unused commands to reduce loading time

### Command Maintenance

#### Regular Updates
- **Check for Updates**: Periodically update commands from the repository
- **Review Changelog**: Understand what changes were made
- **Test Updates**: Validate updated commands work with your project

#### Custom Command Maintenance
- **Version Control**: Track your custom commands in version control
- **Documentation**: Keep command documentation up to date
- **Team Sync**: Ensure team members have access to the same commands

---

**Related Documentation:**
- [Components Overview](./overview) - Understanding the component system
- [Agents](./agents) - AI specialists for development tasks
- [MCPs](./mcps) - External service integrations
- [Contributing](../contributing) - How to contribute new commands