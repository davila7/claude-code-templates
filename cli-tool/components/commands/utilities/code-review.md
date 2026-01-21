---
allowed-tools: Read, Bash, Grep, Glob
argument-hint: [file-path] | [commit-hash] | --full
description: Comprehensive code quality review with security, performance, and architecture analysis
---

# Code Quality Review

Perform comprehensive code quality review: $ARGUMENTS

## Current State

- Git status: !`git status --porcelain`
- Recent changes: !`git diff --stat HEAD~5`
- Repository info: !`git log --oneline -5`
- Build status: !`npm run build --dry-run 2>/dev/null || echo "No build script"`

## Task

Follow these steps to conduct a thorough code review:

1. **Repository Analysis**
   - Examine the repository structure and identify the primary language/framework
   - Check for configuration files (package.json, requirements.txt, Cargo.toml, etc.)
   - Review README and documentation for context

2. **Code Quality Assessment**
   - Scan for code smells, anti-patterns, and potential bugs
   - Check for consistent coding style and naming conventions
   - Identify unused imports, variables, or dead code
   - Review error handling and logging practices

3. **Security Review**
   - Look for common security vulnerabilities (SQL injection, XSS, etc.)
   - Check for hardcoded secrets, API keys, or passwords
   - Review authentication and authorization logic
   - Examine input validation and sanitization

4. **Performance Analysis**
   - Identify potential performance bottlenecks
   - Check for inefficient algorithms or database queries
   - Review memory usage patterns and potential leaks
   - Analyze bundle size and optimization opportunities

5. **Architecture & Design**
   - Evaluate code organization and separation of concerns
   - Check for proper abstraction and modularity
   - Review dependency management and coupling
   - Assess scalability and maintainability

6. **Testing Coverage**
   - Check existing test coverage and quality
   - Identify areas lacking proper testing
   - Review test structure and organization
   - Suggest additional test scenarios

7. **Documentation Review**
   - Evaluate code comments and inline documentation
   - Check API documentation completeness
   - Review README and setup instructions
   - Identify areas needing better documentation

8. **Recommendations**
   - Prioritize issues by severity (critical, high, medium, low)
   - Provide specific, actionable recommendations
   - Suggest tools and practices for improvement
   - Create a summary report with next steps

Remember to be constructive and provide specific examples with file paths and line numbers where applicable.