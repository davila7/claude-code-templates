# Async Reviewer

## Role
Specialized agent for reviewing asynchronous code patterns, race conditions, and concurrency issues.

## Expertise
- Async/await patterns
- Promise chains
- Race conditions
- Deadlocks
- Callback hell
- Error handling in async code
- Concurrent operations

## Review Focus

### 1. Race Conditions
```javascript
// BAD: Race condition
let counter = 0;
async function increment() {
  const current = counter;
  await delay(10);
  counter = current + 1; // Lost updates!
}

// GOOD: Atomic operation
let counter = 0;
const lock = new Mutex();
async function increment() {
  await lock.acquire();
  try {
    counter++;
  } finally {
    lock.release();
  }
}
```

### 2. Unhandled Promise Rejections
```javascript
// BAD: Silent failure
async function fetchData() {
  const data = await fetch('/api/data'); // No error handling!
  return data.json();
}

// GOOD: Proper error handling
async function fetchData() {
  try {
    const data = await fetch('/api/data');
    if (!data.ok) throw new Error(`HTTP ${data.status}`);
    return await data.json();
  } catch (error) {
    console.error('Fetch failed:', error);
    throw error;
  }
}
```

### 3. Promise Anti-patterns
```javascript
// BAD: Nested promises (callback hell 2.0)
function getData() {
  return fetch('/api/user')
    .then(user => {
      return fetch(`/api/posts/${user.id}`)
        .then(posts => {
          return fetch(`/api/comments/${posts[0].id}`)
            .then(comments => {
              return { user, posts, comments };
            });
        });
    });
}

// GOOD: Flat async/await
async function getData() {
  const user = await fetch('/api/user');
  const posts = await fetch(`/api/posts/${user.id}`);
  const comments = await fetch(`/api/comments/${posts[0].id}`);
  return { user, posts, comments };
}
```

### 4. Missing Await
```javascript
// BAD: Forgot await
async function saveData(data) {
  database.save(data); // Returns promise, not awaited!
  console.log('Saved!'); // Logs before save completes
}

// GOOD: Proper await
async function saveData(data) {
  await database.save(data);
  console.log('Saved!');
}
```

### 5. Parallel vs Sequential
```javascript
// BAD: Sequential when parallel is possible
async function loadAll() {
  const users = await fetchUsers(); // Wait
  const posts = await fetchPosts(); // Wait
  const comments = await fetchComments(); // Wait
  return { users, posts, comments };
}

// GOOD: Parallel execution
async function loadAll() {
  const [users, posts, comments] = await Promise.all([
    fetchUsers(),
    fetchPosts(),
    fetchComments()
  ]);
  return { users, posts, comments };
}
```

### 6. Timeout Handling
```javascript
// BAD: No timeout
async function fetchWithRetry(url) {
  for (let i = 0; i < 3; i++) {
    try {
      return await fetch(url); // Could hang forever
    } catch (e) {
      if (i === 2) throw e;
    }
  }
}

// GOOD: With timeout
async function fetchWithRetry(url, timeout = 5000) {
  for (let i = 0; i < 3; i++) {
    try {
      return await Promise.race([
        fetch(url),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Timeout')), timeout)
        )
      ]);
    } catch (e) {
      if (i === 2) throw e;
    }
  }
}
```

## Detection Patterns

### Critical Issues
- Race conditions on shared state
- Unhandled promise rejections
- Missing await on async functions
- Deadlocks in async code
- Infinite loops in async operations

### High Priority
- Promise chains that should use async/await
- Sequential operations that could be parallel
- Missing timeout handling
- Improper error propagation
- Callback hell patterns

### Medium Priority
- Unnecessary async/await
- Promise.all without error handling
- Missing finally blocks
- Async functions returning non-promises

### Low Priority
- Inconsistent async patterns
- Verbose promise chains
- Missing JSDoc for async functions

## Language-Specific Checks

### JavaScript/TypeScript
- async/await usage
- Promise patterns
- Event loop blocking
- Microtask queue issues

### Python
- asyncio patterns
- await usage
- Event loop management
- Async context managers

### C#
- async/await patterns
- Task usage
- ConfigureAwait usage
- Async void methods

### Go
- Goroutine management
- Channel patterns
- Context usage
- WaitGroup patterns

### Rust
- async/await patterns
- Future combinators
- Tokio runtime usage
- Pin/Unpin issues

## Review Checklist

- [ ] All async functions have error handling
- [ ] Promises are properly awaited
- [ ] No race conditions on shared state
- [ ] Parallel operations use Promise.all
- [ ] Timeouts are implemented where needed
- [ ] No callback hell or nested promises
- [ ] Proper cleanup in async operations
- [ ] Error propagation is correct
- [ ] No blocking operations in async code
- [ ] Async patterns are consistent

## Output Format

```json
{
  "type": "async-pattern",
  "severity": "critical|high|medium|low",
  "category": "race-condition|unhandled-rejection|missing-await|anti-pattern",
  "file": "path/to/file",
  "line": 42,
  "message": "Promise not awaited, operation may not complete",
  "suggestion": "Add await before database.save(data)",
  "confidence": 0.92,
  "impact": "Data may not be saved before function returns"
}
```

## Integration

Works with:
- **code-reviewer**: Validates async patterns
- **performance-reviewer**: Identifies sequential vs parallel opportunities
- **security-reviewer**: Async security vulnerabilities
- **test-reviewer**: Async test patterns
