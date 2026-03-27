# Hidden Bug Detection Rules

## Critical Security Bugs

### Race Conditions in Async Code
**Pattern**: Multiple async operations without synchronization
```javascript
// ❌ Bug
useEffect(() => {
  fetchUser(userId).then(setUser);
  fetchPosts(userId).then(setPosts);
}, [userId]);
```
**Detection**: Look for parallel async calls with shared state
**Impact**: Data corruption, privacy violations
**Fix**: Use cleanup functions, Promise.all, or transactions

### Memory Leaks in Event Listeners
**Pattern**: Event listeners not removed on cleanup
```javascript
// ❌ Bug
ws.onmessage = (event) => handleMessage(event);
return () => ws.close(); // Listener not removed!
```
**Detection**: Event listeners without removeEventListener
**Impact**: Memory grows over time, app crashes
**Fix**: Use addEventListener/removeEventListener pairs

### SQL Injection via Template Literals
**Pattern**: Template literals in SQL queries
```javascript
// ❌ Bug
const sql = `SELECT * FROM users WHERE name = '${name}'`;
```
**Detection**: ${} inside SQL strings
**Impact**: Complete database compromise
**Fix**: Use parameterized queries

### Prototype Pollution
**Pattern**: Unvalidated object merging
```javascript
// ❌ Bug
for (let key in source) {
  target[key] = source[key];
}
```
**Detection**: Object iteration without __proto__ check
**Impact**: Global object manipulation, privilege escalation
**Fix**: Check for __proto__, constructor, prototype keys

### Path Traversal
**Pattern**: User input in file paths
```javascript
// ❌ Bug
const filepath = path.join(__dirname, 'uploads', req.params.filename);
```
**Detection**: User input + file operations
**Impact**: Read any file on system
**Fix**: Use path.basename, validate against whitelist

### ReDoS (Regex Denial of Service)
**Pattern**: Complex regex with nested quantifiers
```javascript
// ❌ Bug
/^([a-zA-Z0-9_\-\.]+)@([a-zA-Z0-9_\-\.]+)\.([a-zA-Z]{2,5})$/
```
**Detection**: Nested quantifiers like (.*)+, (.+)*
**Impact**: Server hangs, DoS attack
**Fix**: Simplify regex or use validation library

### Insecure Deserialization
**Pattern**: eval() or Function() with user data
```javascript
// ❌ Bug
const data = eval('(' + userInput + ')');
```
**Detection**: eval, Function constructor with external data
**Impact**: Remote code execution
**Fix**: Use JSON.parse, validate input

### CORS Misconfiguration
**Pattern**: Wildcard origin with credentials
```javascript
// ❌ Bug
cors({ origin: '*', credentials: true })
```
**Detection**: origin: '*' + credentials: true
**Impact**: CSRF attacks, data theft
**Fix**: Whitelist specific origins

## Precision & Logic Bugs

### Integer Overflow
**Pattern**: Large number calculations
```javascript
// ❌ Bug
const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
```
**Detection**: Math operations on large numbers
**Impact**: Incorrect calculations, revenue loss
**Fix**: Use BigInt or decimal library

### Floating Point Precision
**Pattern**: Direct float arithmetic
```javascript
// ❌ Bug
const total = price1 + price2; // 0.1 + 0.2 = 0.30000000000000004
```
**Detection**: Float addition/subtraction
**Impact**: Incorrect financial calculations
**Fix**: Use integer arithmetic (cents) or decimal library

### Timezone Bugs
**Pattern**: Date comparison without UTC
```javascript
// ❌ Bug
return new Date() > new Date(expiryDate);
```
**Detection**: Date comparisons without getTime() or UTC
**Impact**: Wrong results for international users
**Fix**: Use getTime() or UTC methods

### Unhandled Promise Rejection
**Pattern**: Async function without await or catch
```javascript
// ❌ Bug
fetch('/api/save', { method: 'POST', body: data });
showSuccessMessage();
```
**Detection**: Promise without await/then/catch
**Impact**: Silent failures, data loss
**Fix**: Add await and try/catch

### Stale Closures
**Pattern**: Closures in React hooks
```javascript
// ❌ Bug
useEffect(() => {
  setInterval(() => console.log(count), 1000);
}, []);
```
**Detection**: Closures without dependencies
**Impact**: Wrong values, stale data
**Fix**: Add dependencies or use refs

## Performance & Resource Bugs

### N+1 Query Problem
**Pattern**: Query inside loop
```javascript
// ❌ Bug
for (const user of users) {
  user.posts = await db.query('SELECT * FROM posts WHERE user_id = ?', [user.id]);
}
```
**Detection**: Database query inside iteration
**Impact**: Slow response, database overload
**Fix**: Use JOIN or IN clause

### Resource Exhaustion
**Pattern**: No limits on user input
```javascript
// ❌ Bug
app.post('/upload', (req, res) => {
  req.files.upload.mv('/uploads/' + req.files.upload.name);
});
```
**Detection**: File operations without size/type validation
**Impact**: Disk exhaustion, server crash
**Fix**: Add limits, validate types

### Event Listener Leaks
**Pattern**: Listeners added but never removed
```javascript
// ❌ Bug
element.addEventListener('click', handler);
// No cleanup
```
**Detection**: addEventListener without removeEventListener
**Impact**: Memory leaks, performance degradation
**Fix**: Remove listeners on cleanup

## Detection Confidence Levels

- **90-100%**: Definitely a bug, fix immediately
- **80-89%**: Very likely a bug, investigate
- **70-79%**: Potential bug, review carefully
- **60-69%**: Code smell, consider refactoring

## Quick Reference

| Bug Type | Severity | Confidence | Common In |
|----------|----------|------------|-----------|
| SQL Injection | 🔴 Critical | 95% | Backend APIs |
| Race Condition | 🔴 Critical | 90% | Async code |
| Prototype Pollution | 🔴 Critical | 93% | Object merging |
| Path Traversal | 🔴 Critical | 95% | File operations |
| ReDoS | 🔴 Critical | 91% | Input validation |
| Memory Leak | ⚠️ High | 91% | Event handlers |
| N+1 Query | ⚠️ High | 95% | Database code |
| Integer Overflow | ⚠️ High | 88% | Financial calc |
| Float Precision | ⚠️ High | 92% | Currency |
| Timezone Bug | ⚠️ High | 87% | Date handling |
