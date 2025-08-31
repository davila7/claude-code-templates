---
allowed-tools: Read, Glob, Grep, Bash
argument-hint: [scope] | --modules | --patterns | --dependencies | --security
description: Comprehensive architecture review with design patterns analysis and improvement recommendations
model: sonnet
---

# Architecture Review

Perform comprehensive system architecture analysis and improvement planning: **$ARGUMENTS**

## Current Architecture Context

- Project structure: !`find . -name "*.js" -o -name "*.ts" -o -name "*.py" -o -name "*.go" | head -5 && echo "..."`
- Package dependencies: !`[ -f package.json ] && echo "Node.js project" || [ -f requirements.txt ] && echo "Python project" || [ -f go.mod ] && echo "Go project" || echo "Multiple languages"`
- Testing framework: !`find . -name "*.test.*" -o -name "*spec.*" | head -3 && echo "..." || echo "No test files found"`
- Documentation: !`find . -name "README*" -o -name "*.md" | wc -l` documentation files

## Task

Execute comprehensive architectural analysis with actionable improvement recommendations:

**Review Scope**: Use $ARGUMENTS to focus on specific modules, design patterns, dependency analysis, or security architecture

**Architecture Analysis Framework**:
1. **System Structure Assessment** - Map component hierarchy, identify architectural patterns, analyze module boundaries, assess layered design
2. **Design Pattern Evaluation** - Identify implemented patterns, assess pattern consistency, detect anti-patterns, evaluate pattern effectiveness
3. **Dependency Architecture** - Analyze coupling levels, detect circular dependencies, evaluate dependency injection, assess architectural boundaries
4. **Data Flow Analysis** - Trace information flow, evaluate state management, assess data persistence strategies, validate transformation patterns
5. **Scalability & Performance** - Analyze scaling capabilities, evaluate caching strategies, assess bottlenecks, review resource management
6. **Security Architecture** - Review trust boundaries, assess authentication patterns, analyze authorization flows, evaluate data protection

**Advanced Analysis**: Component testability, configuration management, error handling patterns, monitoring integration, extensibility assessment.

**Quality Assessment**: Code organization, documentation adequacy, team communication patterns, technical debt evaluation.

**Output**: Detailed architecture assessment with specific improvement recommendations, refactoring strategies, and implementation roadmap.