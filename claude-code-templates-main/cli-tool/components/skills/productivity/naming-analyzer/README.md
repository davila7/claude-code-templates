# Naming Analyzer Skill

A skill for Claude Code that analyzes code naming conventions and suggests better variable, function, class, and other identifier names based on context and industry standards.

## Purpose

Good naming is one of the most important aspects of readable, maintainable code. This skill helps developers:

- **Identify naming issues** in existing code before they become technical debt
- **Improve code clarity** by replacing vague or misleading names with descriptive ones
- **Enforce consistency** across a codebase by following language-specific conventions
- **Reduce cognitive load** for anyone reading or maintaining the code

Poor naming leads to bugs, confusion, and wasted time. This skill acts as an expert code reviewer focused specifically on naming quality.

## When to Use

Use this skill when you want to:

- Review naming conventions in a file, directory, or entire codebase
- Get suggestions for better variable, function, or class names
- Check if code follows language-specific naming conventions
- Identify misleading names that don't match their actual behavior
- Clean up unclear abbreviations or single-letter variables
- Standardize boolean naming with proper prefixes

**Trigger phrases:**

- "Analyze the naming in this file"
- "Suggest better names for my variables"
- "Check naming conventions in src/"
- "Review this code for naming issues"
- "Help me rename these functions"

## How It Works

1. **Analysis Phase**: The skill examines all identifiers in the target code:
   - Variables and constants
   - Functions and methods
   - Classes, interfaces, and types
   - Files and directories
   - Database tables and columns
   - API endpoints

2. **Issue Detection**: Each identifier is evaluated for common problems:
   - Unclear or vague names (`data`, `info`, `temp`, `x`)
   - Abbreviations that obscure meaning (`usrCfg`, `calcTtl`)
   - Inconsistent naming conventions (mixing `camelCase` and `snake_case`)
   - Misleading names (function called `getUser` that also updates data)
   - Names that are too short or too long
   - Single-letter variables outside of loop contexts
   - Missing boolean prefixes (`active` instead of `isActive`)

3. **Convention Checking**: The skill validates against language-specific standards:
   - JavaScript/TypeScript: camelCase for variables/functions, PascalCase for classes
   - Python: snake_case for variables/functions, PascalCase for classes
   - Java: camelCase for variables/methods, PascalCase for classes
   - Go: PascalCase for exported, camelCase for unexported

4. **Report Generation**: A structured report is produced with:
   - Summary statistics (items analyzed, issues found by severity)
   - Critical issues (misleading names that could cause bugs)
   - Major issues (unclear or vague names)
   - Minor issues (convention violations)
   - Specific suggestions with reasoning for each

## Key Features

### Multi-Language Support

Understands naming conventions for JavaScript, TypeScript, Python, Java, Go, and more. Automatically adapts recommendations to the language being analyzed.

### Severity Classification

Issues are categorized by impact:

| Severity | Description | Example |
|----------|-------------|---------|
| **Critical** | Misleading names that could cause bugs | `getUser()` that also modifies data |
| **Major** | Unclear names requiring mental effort to understand | `proc(data)` instead of `processApiResponse(response)` |
| **Minor** | Convention violations that affect consistency | `API_url` instead of `API_URL` |

### Boolean Naming Guidance

Enforces clear boolean prefixes:

- `is` for state: `isActive`, `isVisible`, `isEnabled`
- `has` for possession: `hasPermission`, `hasError`, `hasChildren`
- `can` for ability: `canEdit`, `canDelete`, `canAccess`
- `should` for decisions: `shouldRender`, `shouldValidate`, `shouldRefresh`

### Magic Number Detection

Identifies unnamed numeric literals and suggests meaningful constant names:

```javascript
// Before
if (age > 18) { }
setTimeout(callback, 3600000);

// After
const LEGAL_AGE = 18;
const ONE_HOUR_IN_MS = 60 * 60 * 1000;

if (age > LEGAL_AGE) { }
setTimeout(callback, ONE_HOUR_IN_MS);
```

### Refactoring Support

Can generate refactoring scripts to apply naming changes across the codebase while maintaining git history.

## Usage Examples

**Analyze a single file:**
```
@naming-analyzer UserService.js
```

**Analyze an entire directory:**
```
@naming-analyzer src/
```

**Show naming conventions reference:**
```
@naming-analyzer --conventions
```

**Analyze and suggest fixes for all issues:**
```
@naming-analyzer --fix-all
```

**General invocation:**
```
@naming-analyzer
```
Then provide the code or file path when prompted.

## Output

The skill produces a detailed markdown report containing:

### Summary Section

```
## Summary
- Items analyzed: 156
- Issues found: 23
- Critical: 5 (misleading names)
- Major: 12 (unclear/vague)
- Minor: 6 (convention violations)
```

### Issue Details

Each issue includes:
- **Current**: The existing name
- **Issue**: Description of the problem
- **Severity**: Critical, Major, or Minor
- **Suggestion**: The recommended replacement
- **Reason**: Why the suggestion is better

### Suggested Renaming

Prioritized list of all recommended changes:
- High Priority: Misleading or critical issues
- Medium Priority: Clarity improvements
- Low Priority: Convention fixes

## Best Practices

### Do

- **Use full words over abbreviations** - `userConfig` not `usrCfg`
- **Be specific and descriptive** - `emailAddress` not `str`
- **Follow language conventions** - camelCase in JavaScript, snake_case in Python
- **Use consistent patterns** - don't mix styles within a file
- **Make booleans obvious** - `isEnabled`, `hasPermission`
- **Include units in constants** - `TIMEOUT_MS`, `MAX_SIZE_MB`

### Don't

- **Use single letters** - except in loops (`i`, `j`, `k`)
- **Use vague names** - avoid `data`, `info`, `temp`, `x`, `result`
- **Mix naming conventions** - pick one and stick with it
- **Use misleading names** - name should match behavior exactly
- **Over-abbreviate** - `calculateTotal` not `calcTtl`
- **Use Hungarian notation** - not needed in modern typed languages

### Acceptable Abbreviations

Some abbreviations are well-known and acceptable:
- `html`, `api`, `url`, `id`, `db`, `io`, `ui`
- `min`, `max`, `src`, `dest`, `config`, `env`
- `req`, `res` (in HTTP context)
- `err` (in error handling context)

## Naming Decision Tree

```
Is it a boolean?
├─ Yes → Use is/has/can/should prefix
└─ No → Is it a function?
    ├─ Yes → Use verb phrase (action)
    └─ No → Is it a class?
        ├─ Yes → Use noun (PascalCase)
        └─ No → Is it a constant?
            ├─ Yes → Use UPPER_SNAKE_CASE
            └─ No → Use descriptive noun (camelCase/snake_case)
```

## Notes

- **Context matters**: Loop counters can be `i`, `j` - not every short name is bad
- **Consistency over perfection**: Being consistent within a project is more important than following every convention perfectly
- **Refactor as understanding improves**: Names should evolve as you better understand the domain
- **Use IDE refactoring tools**: When renaming, use your IDE's rename feature to safely update all references
- **Well-known abbreviations are okay**: `html`, `api`, `url`, `id` are universally understood
