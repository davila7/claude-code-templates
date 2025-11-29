# Gemini CLI Integration Patterns

Advanced patterns for orchestrating Gemini CLI effectively from Claude Code.

## Pattern 1: Generate-Review-Fix Cycle

The most reliable pattern for quality code generation.

```bash
# Step 1: Generate code
gemini "Create [code description]" --yolo -o text

# Step 2: Have Gemini review its own work
gemini "Review [generated file] for bugs and security issues" -o text

# Step 3: Fix identified issues
gemini "Fix these issues in [file]: [list from review]. Apply now." --yolo -o text
```

### Why It Works
- Different "mindset" for generation vs review
- Self-correction catches common mistakes
- Security vulnerabilities often caught in review phase

### Example
```bash
# Generate
gemini "Create a user authentication module with bcrypt and JWT" --yolo -o text

# Review
gemini "Review auth.js for security vulnerabilities" -o text
# Output: "Found XSS risk, missing input validation, weak JWT secret"

# Fix
gemini "Fix in auth.js: XSS risk, add input validation, use env var for JWT secret. Apply now." --yolo -o text
```

## Pattern 2: JSON Output for Programmatic Processing

Use JSON output when you need to process results programmatically.

```bash
gemini "[prompt]" -o json 2>&1
```

### Parsing the Response

```javascript
// In Node.js or with jq
const result = JSON.parse(output);
const content = result.response;
const tokenUsage = result.stats.models["gemini-2.5-flash"].tokens.total;
const toolCalls = result.stats.tools.byName;
```

### Use Cases
- Extracting specific data from responses
- Monitoring token usage
- Tracking tool call success/failure
- Building automation pipelines

## Pattern 3: Background Execution

For long-running tasks, execute in background and continue working.

```bash
# Start in background
gemini "[long task]" --yolo -o text 2>&1 &

# Get process ID for later
echo $!

# Monitor output incrementally with BashOutput tool
```

### When to Use
- Code generation for large projects
- Documentation generation
- Running multiple Gemini tasks in parallel

### Parallel Execution
```bash
# Run multiple tasks simultaneously
gemini "Create frontend" --yolo -o text 2>&1 &
gemini "Create backend" --yolo -o text 2>&1 &
gemini "Create tests" --yolo -o text 2>&1 &
```

## Pattern 4: Model Selection Strategy

Choose the right model for the task.

### Decision Tree

```
Is the task complex (architecture, multi-file, deep analysis)?
├── Yes → Use default (Gemini 3 Pro)
└── No → Is speed critical?
    ├── Yes → Use gemini-2.5-flash
    └── No → Is it trivial (formatting, simple query)?
        ├── Yes → Use gemini-2.5-flash-lite
        └── No → Use gemini-2.5-flash
```

### Examples
```bash
# Complex: Architecture analysis
gemini "Analyze codebase architecture" -o text

# Quick: Simple formatting
gemini "Format this JSON" -m gemini-2.5-flash -o text

# Trivial: One-liner
gemini "What is 2+2?" -m gemini-2.5-flash -o text
```

## Pattern 5: Rate Limit Handling

Strategies for working within rate limits.

### Approach 1: Let Auto-Retry Handle It
Default behavior - CLI retries automatically with backoff.

### Approach 2: Use Flash for Lower Priority
```bash
# High priority: Use Pro
gemini "[important task]" --yolo -o text

# Lower priority: Use Flash (different quota)
gemini "[less critical task]" -m gemini-2.5-flash -o text
```

### Approach 3: Batch Operations
Combine related operations into single prompts:
```bash
# Instead of multiple calls:
gemini "Create file A" --yolo
gemini "Create file B" --yolo
gemini "Create file C" --yolo

# Single call:
gemini "Create files A, B, and C with [specs]. Create all now." --yolo
```

### Approach 4: Sequential with Delays
For automated scripts, add delays:
```bash
gemini "[task 1]" --yolo -o text
sleep 2
gemini "[task 2]" --yolo -o text
```

## Pattern 6: Context Enrichment

Provide rich context for better results.

### Using File References
```bash
gemini "Based on @./package.json and @./src/index.js, suggest improvements" -o text
```

### Using GEMINI.md
Create project context that's automatically included:
```markdown
# .gemini/GEMINI.md

## Project Overview
This is a React app using TypeScript.

## Coding Standards
- Use functional components
- Prefer hooks over classes
- All functions need JSDoc
```

### Explicit Context in Prompt
```bash
gemini "Given this context:
- Project uses React 18 with TypeScript
- State management: Zustand
- Styling: Tailwind CSS

Create a user profile component." --yolo -o text
```

## Pattern 7: Validation Pipeline

Always validate Gemini's output before using.

### Validation Steps

1. **Syntax Check**
   ```bash
   # For JavaScript
   node --check generated.js

   # For TypeScript
   tsc --noEmit generated.ts
   ```

2. **Security Scan**
   - Check for innerHTML with user input (XSS)
   - Look for eval() or Function() calls
   - Verify input validation

3. **Functional Test**
   - Run any generated tests
   - Manual smoke test

4. **Style Check**
   ```bash
   eslint generated.js
   prettier --check generated.js
   ```

### Automated Validation Pattern
```bash
# Generate
gemini "Create utility functions" --yolo -o text

# Validate
node --check utils.js && eslint utils.js && npm test
```

## Pattern 8: Incremental Refinement

Build complex outputs in stages.

```bash
# Stage 1: Core structure
gemini "Create basic Express server with routes for /api/users" --yolo -o text

# Stage 2: Add feature
gemini "Add authentication middleware to the Express server in server.js" --yolo -o text

# Stage 3: Add another feature
gemini "Add rate limiting to the Express server in server.js" --yolo -o text

# Stage 4: Review all
gemini "Review server.js for issues and optimize" -o text
```

### Benefits
- Easier to debug issues
- Each stage validates before continuing
- Clear audit trail

## Pattern 9: Cross-Validation with Claude

Use both AIs for highest quality.

### Claude Generates, Gemini Reviews
```bash
# 1. Claude writes code (using normal Claude Code tools)
# 2. Gemini reviews
gemini "Review this code for bugs and security issues: [paste code]" -o text
```

### Gemini Generates, Claude Reviews
```bash
# 1. Gemini generates
gemini "Create [code]" --yolo -o text

# 2. Claude reviews the output (in conversation)
# "Review this code that Gemini generated..."
```

### Different Perspectives
- Claude: Strong on reasoning, following complex instructions
- Gemini: Strong on current web knowledge, codebase investigation

## Pattern 10: Session Continuity

Use sessions for multi-turn workflows.

```bash
# Initial task
gemini "Analyze this codebase architecture" -o text
# Session saved automatically

# List sessions
gemini --list-sessions

# Continue with follow-up
echo "What patterns did you find?" | gemini -r 1 -o text

# Further refinement
echo "Focus on the authentication flow" | gemini -r 1 -o text
```

### Use Cases
- Iterative analysis
- Building on previous context
- Debugging sessions

## Anti-Patterns to Avoid

### Don't: Expect Immediate Execution
YOLO mode doesn't prevent planning. Gemini may still present plans.

**Do**: Use forceful language ("Apply now", "Start immediately")

### Don't: Ignore Rate Limits
Hammering the API wastes time on retries.

**Do**: Use appropriate models, batch operations

### Don't: Trust Output Blindly
Gemini can make mistakes, especially with security.

**Do**: Always validate generated code

### Don't: Over-Specify in Single Prompt
Extremely long prompts can confuse the model.

**Do**: Use incremental refinement for complex tasks

### Don't: Forget Context Limits
Even with 1M tokens, context can overflow.

**Do**: Use .geminiignore, be specific about files
