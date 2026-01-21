# Root Cause Analysis

Techniques for finding the real cause of errors, not just symptoms.

## The 5 Whys Method

Ask "why" repeatedly until you reach the root cause.

### Example 1: API Error

```
Problem: API returns 500 error

Why 1: Server threw an exception
  -> Exception: "Cannot read property 'email' of null"

Why 2: User object is null
  -> getUserById() returned null

Why 3: User ID doesn't exist in database
  -> ID came from session, user was deleted

Why 4: User deletion doesn't invalidate sessions
  -> No session cleanup on user deletion

Why 5: Session management wasn't considered in delete feature
  -> Missing requirement in original spec

ROOT CAUSE: Incomplete user deletion implementation
FIX: Add session invalidation to user deletion flow
```

### Example 2: Production Outage

```
Problem: Website down

Why 1: Server not responding
  -> Out of memory

Why 2: Memory leak
  -> Event listeners accumulating

Why 3: Listeners not cleaned up
  -> useEffect missing cleanup function

Why 4: Developer didn't know cleanup needed
  -> No code review caught it

Why 5: Code review checklist doesn't include React cleanup
  -> Checklist outdated

ROOT CAUSE: Missing code review guidelines
FIX: Update checklist + add ESLint rule
```

## Error Categories & Common Root Causes

### Category: Null/Undefined Errors

| Symptom | Common Root Causes |
|---------|-------------------|
| `undefined` variable | Missing return statement |
| `null` from API | Resource not found, not handled |
| Missing property | Object schema changed |
| Array index undefined | Off-by-one error |

### Category: Network Errors

| Symptom | Common Root Causes |
|---------|-------------------|
| Connection refused | Service not started/crashed |
| Timeout | Database slow, N+1 queries |
| 401/403 | Token expired, wrong credentials |
| CORS | Missing server headers |

### Category: Type Errors

| Symptom | Common Root Causes |
|---------|-------------------|
| Not a function | Wrong import (default vs named) |
| Cannot iterate | Expected array, got object |
| Invalid JSON | HTML error page returned |
| Type mismatch | Form data is string, expected number |

### Category: State Errors

| Symptom | Common Root Causes |
|---------|-------------------|
| Stale data | Missing refresh, caching issue |
| Race condition | Async operations not synchronized |
| Infinite loop | useEffect dependencies wrong |
| Memory leak | Event listeners not cleaned |

---

## Debugging Decision Tree

```
Start
  |
  v
Is the error reproducible?
  |
  +-- No --> Add logging, wait for next occurrence
  |
  +-- Yes --> Continue
  |
  v
Is the error in your code?
  |
  +-- No (framework/library) --> Check version, open issue
  |
  +-- Yes --> Continue
  |
  v
When did it start?
  |
  +-- Recently --> git bisect to find commit
  |
  +-- Always --> Design issue, review logic
  |
  v
Is it data-dependent?
  |
  +-- Yes --> Validate input, check edge cases
  |
  +-- No --> Check environment, config
  |
  v
Is it timing-dependent?
  |
  +-- Yes --> Race condition, add synchronization
  |
  +-- No --> Logic error, trace execution
```

---

## Isolation Techniques

### Binary Search (Code)

Find which code section causes the error:

```javascript
async function processData(data) {
  // Comment out half
  // step1(data)
  // step2(data)

  // Keep other half
  step3(data)
  step4(data)
}
// Error still happens? -> Problem in step3 or step4
// Error gone? -> Problem in step1 or step2
// Repeat until found
```

### Binary Search (Time) - Git Bisect

Find which commit introduced the bug:

```bash
git bisect start
git bisect bad                    # Current commit is bad
git bisect good v1.0.0            # Last known good version
# Git checks out middle commit
# Test and mark:
git bisect good  # or
git bisect bad
# Repeat until found
git bisect reset
```

### Minimal Reproduction

Create smallest code that reproduces error:

```javascript
// Start with empty file
// Add code piece by piece until error appears

// Step 1 - Basic setup
const express = require('express')
const app = express()
// No error yet

// Step 2 - Add middleware
app.use(express.json())
// No error yet

// Step 3 - Add route
app.get('/user', async (req, res) => {
  const user = await getUser(req.query.id)
  res.json({ name: user.name })  // ERROR HERE!
})

// Minimal repro: getUser returns undefined for invalid ID
```

---

## Environment Analysis

### Questions to Ask

1. **What changed recently?**
   - New deployment?
   - Config change?
   - Dependency update?
   - Infrastructure change?

2. **Where does it fail?**
   - Production only?
   - Development too?
   - Specific browser/OS?
   - Specific user?

3. **When does it fail?**
   - Always?
   - Sometimes? (timing)
   - Under load? (resource)
   - After time? (memory leak)

### Environment Comparison

| Factor | Working | Broken |
|--------|---------|--------|
| Node version | 18.0 | 20.0 |
| Database | Local | Remote |
| Auth | Dev token | Prod token |
| Data volume | 100 rows | 1M rows |

---

## Data Flow Analysis

Trace data from source to error:

```
User Input
    |
    v
API Request
    |
    v
Validation -----> [Check: Is data valid here?]
    |
    v
Database Query
    |
    v
Processing -----> [Check: Is data correct here?]
    |
    v
Response -------> [Check: Is response correct?]
    |
    v
Error!
```

### Add Checkpoints

```javascript
async function processOrder(orderId) {
  console.log('[1] Input:', orderId)

  const order = await getOrder(orderId)
  console.log('[2] Order:', JSON.stringify(order))

  const user = await getUser(order.userId)
  console.log('[3] User:', JSON.stringify(user))

  const result = calculateTotal(order, user)
  console.log('[4] Result:', result)

  return result
}
```

---

## Common Anti-Patterns

### Symptom Fixing

```javascript
// BAD: Fix symptom
if (user === undefined) {
  user = {}  // Hide the problem
}
return user.name

// GOOD: Fix root cause
const user = await getUser(id)
if (!user) {
  throw new NotFoundError(`User ${id} not found`)
}
return user.name
```

### Blame Shifting

```
"It works on my machine"
"It must be the library"
"The data is wrong"
```

Instead: Verify assumptions with evidence.

### Random Changes

```javascript
// Don't do this
// Try 1: Add timeout?
// Try 2: Change order?
// Try 3: Add try/catch everywhere?
```

Instead: Understand before changing.

---

## Root Cause Documentation

After finding root cause, document:

```markdown
## Incident: API 500 Errors on /users endpoint

### Symptom
500 errors returned for some user IDs

### Root Cause
getUserById() returns null for deleted users,
but caller doesn't handle null case

### Contributing Factors
1. No input validation on user ID
2. Soft delete doesn't mark related sessions
3. Missing null check in handler

### Fix
1. Add null check with proper error response
2. Invalidate sessions on user deletion
3. Add validation for user ID format

### Prevention
1. Add nullable return type to function signature
2. Update code review checklist
3. Add integration test for deleted user case
```

---

## Quick Checklist

When debugging:

- [ ] Read the full error message
- [ ] Find exact line/file where error occurs
- [ ] Check what changed recently
- [ ] Reproduce in isolation
- [ ] Check input data validity
- [ ] Verify assumptions with logging
- [ ] Consider timing/race conditions
- [ ] Check resource limits (memory, connections)
- [ ] Review environment differences
- [ ] Ask "why" until root cause found
