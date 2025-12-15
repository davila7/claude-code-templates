---
name: Error Resolver
description: Systematic error diagnosis and resolution using first-principle analysis. Use when encountering any error message, stack trace, or unexpected behavior. Supports replay functionality to record and reuse solutions.
---

# Error Resolver

A first-principle approach to diagnosing and resolving errors across all languages and frameworks.

## Core Philosophy

**The 5-step Error Resolution Process:**

```
1. CLASSIFY  ->  2. PARSE  ->  3. MATCH  ->  4. ANALYZE  ->  5. RESOLVE
     |              |             |             |              |
  What type?    Extract key    Known       Root cause      Fix +
               information    pattern?     analysis       Prevent
```

## Quick Start

When you encounter an error:

1. **Paste the full error** (including stack trace if available)
2. **Provide context** (what were you trying to do?)
3. **Share relevant code** (the file/function involved)

## Error Classification Framework

### Primary Categories

| Category | Indicators | Common Causes |
|----------|------------|---------------|
| **Syntax** | Parse error, Unexpected token | Typos, missing brackets, invalid syntax |
| **Type** | TypeError, type mismatch | Wrong data type, null/undefined access |
| **Reference** | ReferenceError, NameError | Undefined variable, scope issues |
| **Runtime** | RuntimeError, Exception | Logic errors, invalid operations |
| **Network** | ECONNREFUSED, timeout, 4xx/5xx | Connection issues, wrong URL, server down |
| **Permission** | EACCES, PermissionError | File/directory access, sudo needed |
| **Dependency** | ModuleNotFound, Cannot find module | Missing package, version mismatch |
| **Configuration** | Config error, env missing | Wrong settings, missing env vars |
| **Database** | Connection refused, query error | DB down, wrong credentials, bad query |
| **Memory** | OOM, heap out of memory | Memory leak, large data processing |

### Secondary Attributes

- **Severity**: Fatal / Error / Warning / Info
- **Scope**: Build-time / Runtime / Test-time
- **Origin**: User code / Framework / Third-party / System

## Analysis Workflow

### Step 1: Classify

Identify the error category by examining:
- Error name/code (e.g., `ENOENT`, `TypeError`)
- Error message keywords
- Where it occurred (compile, runtime, test)

### Step 2: Parse

Extract key information:
```
- Error code: [specific code if any]
- File path: [where the error originated]
- Line number: [exact line if available]
- Function/method: [context of the error]
- Variable/value: [what was involved]
- Stack trace depth: [how deep is the call stack]
```

### Step 3: Match Patterns

Check against known error patterns:
- See `patterns/` directory for language-specific patterns
- Match error signatures to known solutions
- Check replay history for previous solutions

### Step 4: Root Cause Analysis

Apply the **5 Whys** technique:
```
Error: Cannot read property 'name' of undefined
  Why 1? -> user object is undefined
  Why 2? -> API call returned null
  Why 3? -> User ID doesn't exist in database
  Why 4? -> ID was from stale cache
  Why 5? -> Cache invalidation not implemented

Root Cause: Missing cache invalidation logic
```

### Step 5: Resolve

Generate actionable solution:
1. **Immediate fix** - Get it working now
2. **Proper fix** - The right way to solve it
3. **Prevention** - How to avoid in the future

## Output Format

When resolving an error, provide:

```
## Error Diagnosis

**Classification**: [Category] / [Severity] / [Scope]

**Error Signature**:
- Code: [error code]
- Type: [error type]
- Location: [file:line]

## Root Cause

[Explanation of why this error occurred]

**Contributing Factors**:
1. [Factor 1]
2. [Factor 2]

## Solution

### Immediate Fix
[Quick steps to resolve]

### Code Change
[Specific code to add/modify]

### Verification
[How to verify the fix works]

## Prevention

[How to prevent this error in the future]

## Replay Tag

[Unique identifier for this solution - for future reference]
```

## Replay System

The replay system records successful solutions for future reference.

### Recording a Solution

After resolving an error, record it:

```bash
# Create solution record in project
mkdir -p .claude/error-solutions

# Solution file format: [error-type]-[hash].yaml
```

### Solution Record Format

```yaml
# .claude/error-solutions/[error-signature].yaml
id: "nodejs-module-not-found-express"
created: "2024-01-15T10:30:00Z"
updated: "2024-01-20T14:22:00Z"

error:
  type: "dependency"
  category: "ModuleNotFound"
  language: "nodejs"
  pattern: "Cannot find module 'express'"
  context: "npm project, missing dependency"

diagnosis:
  root_cause: "Package not installed or node_modules corrupted"
  factors:
    - "Missing npm install after git clone"
    - "Corrupted node_modules directory"
    - "Package not in package.json"

solution:
  immediate:
    - "Run: npm install express"
  proper:
    - "Check package.json has express listed"
    - "Run: rm -rf node_modules && npm install"
  code_change: null

verification:
  - "Run the application again"
  - "Check express is in node_modules"

prevention:
  - "Add npm install to project setup docs"
  - "Use npm ci in CI/CD pipelines"

metadata:
  occurrences: 5
  last_resolved: "2024-01-20T14:22:00Z"
  success_rate: 1.0
  tags: ["nodejs", "npm", "dependency"]
```

### Replay Lookup

When encountering an error:
1. Generate error signature from the error message
2. Search `.claude/error-solutions/` for matching patterns
3. If found, apply the recorded solution
4. If new, proceed with full analysis and record the solution

### Error Signature Generation

```
signature = hash(
  error_type +
  error_code +
  normalized_message +  # remove specific values
  language +
  framework
)
```

Example transformations:
- `Cannot find module 'express'` -> `Cannot find module '{module}'`
- `TypeError: Cannot read property 'name' of undefined` -> `TypeError: Cannot read property '{prop}' of undefined`

## Debug Commands

Useful commands during debugging:

### Node.js
```bash
# Verbose error output
NODE_DEBUG=* node app.js

# Memory debugging
node --inspect app.js

# Check installed packages
npm ls [package-name]

# Verify package.json
npm ls --depth=0
```

### Python
```bash
# Debug mode
python -m pdb script.py

# Check installed packages
pip show [package-name]
pip list
```

### General
```bash
# Check file permissions
ls -la [file]

# Check port usage
lsof -i :[port]
netstat -an | grep [port]

# Check environment variables
env | grep [VAR_NAME]
printenv [VAR_NAME]

# Check disk space
df -h

# Check memory
free -m  # Linux
vm_stat  # macOS
```

## Common Debugging Patterns

### Pattern 1: Binary Search
When the error location is unclear:
1. Comment out half the code
2. If error persists, it's in the remaining half
3. Repeat until you find the exact line

### Pattern 2: Minimal Reproduction
Create the smallest code that reproduces the error:
1. Start with empty file
2. Add code piece by piece
3. Stop when error appears
4. That's your minimal repro case

### Pattern 3: Rubber Duck Debugging
Explain the problem out loud (or to Claude):
1. What should happen?
2. What actually happens?
3. What changed recently?
4. What assumptions am I making?

### Pattern 4: Git Bisect
Find which commit introduced the bug:
```bash
git bisect start
git bisect bad  # current commit is bad
git bisect good [last-known-good-commit]
# Git will checkout commits for you to test
git bisect good/bad  # mark each as good or bad
git bisect reset  # when done
```

## Reference Files

- **patterns/** - Language-specific error patterns
  - `nodejs.md` - Node.js common errors
  - `python.md` - Python common errors
  - `react.md` - React/Next.js errors
  - `database.md` - Database errors
  - `docker.md` - Docker/container errors
  - `git.md` - Git errors
  - `network.md` - Network/API errors

- **analysis/** - Analysis methodologies
  - `stack-trace.md` - Stack trace parsing guide
  - `root-cause.md` - Root cause analysis techniques

- **replay/** - Replay system
  - `solution-template.yaml` - Template for recording solutions
