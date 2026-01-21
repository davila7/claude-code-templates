# Stack Trace Analysis Guide

How to read and analyze stack traces across different languages.

## Anatomy of a Stack Trace

A stack trace shows the call sequence that led to an error:

```
Error: Something went wrong
    at functionC (file3.js:10:5)     <- Error thrown here
    at functionB (file2.js:20:3)     <- Called by functionB
    at functionA (file1.js:30:7)     <- Called by functionA
    at main (index.js:5:1)           <- Entry point
```

**Reading Order**: Top = where error occurred, Bottom = entry point

## JavaScript/Node.js Stack Traces

### Standard Format

```
TypeError: Cannot read property 'name' of undefined
    at getUser (/app/src/services/user.js:45:23)
    at async handler (/app/src/routes/api.js:12:18)
    at Layer.handle [as handle_request] (/app/node_modules/express/lib/router/layer.js:95:5)
    at next (/app/node_modules/express/lib/router/route.js:144:13)
```

**Components**:
- `TypeError` - Error type
- `Cannot read property 'name' of undefined` - Error message
- `/app/src/services/user.js:45:23` - File:Line:Column
- `getUser` - Function name
- `async handler` - Async function indicator

### Key Patterns

**User Code vs Framework**:
```
    at getUser (/app/src/services/user.js:45:23)     <- YOUR CODE
    at handler (/app/src/routes/api.js:12:18)        <- YOUR CODE
    at Layer.handle [as handle_request] (express/...) <- FRAMEWORK
    at next (express/lib/router/route.js:144:13)      <- FRAMEWORK
```

Focus on frames in YOUR code first.

**Anonymous Functions**:
```
    at Object.<anonymous> (/app/index.js:5:1)
    at Array.forEach (<anonymous>)
    at /app/src/utils.js:10:5
```

Add function names for better traces:
```javascript
// Instead of
const handler = () => { ... }

// Use
const handler = function userHandler() { ... }
```

**Async Stack Traces** (Node.js 12+):
```
Error: Failed
    at fetchData (/app/src/api.js:10:9)
    at async main (/app/src/index.js:5:3)
    // -- async gap --
    at Object.<anonymous> (/app/src/index.js:1:1)
```

Enable: `node --async-stack-traces app.js`

---

## Python Stack Traces

### Standard Format (Traceback)

```python
Traceback (most recent call last):
  File "/app/main.py", line 10, in <module>
    result = process_data(data)
  File "/app/processor.py", line 25, in process_data
    return transform(data['items'])
  File "/app/transformer.py", line 15, in transform
    return [parse(item) for item in items]
  File "/app/transformer.py", line 15, in <listcomp>
    return [parse(item) for item in items]
KeyError: 'name'
```

**Reading Order**: Top = entry point, Bottom = error (opposite of JS!)

**Components**:
- `File "/app/processor.py"` - File path
- `line 25` - Line number
- `in process_data` - Function name
- `return transform(data['items'])` - Actual code line

### Key Patterns

**Chained Exceptions** (Python 3):
```python
Traceback (most recent call last):
  File "app.py", line 5, in main
    data = json.loads(text)
json.JSONDecodeError: Expecting value

During handling of the above exception, another exception occurred:

Traceback (most recent call last):
  File "app.py", line 8, in main
    raise ValueError("Invalid JSON input") from e
ValueError: Invalid JSON input
```

Read both tracebacks - first is root cause, second is re-raised.

**List Comprehension**:
```python
  File "/app/transformer.py", line 15, in <listcomp>
```

Error inside list comprehension - check the item being processed.

---

## Java Stack Traces

### Standard Format

```java
java.lang.NullPointerException: Cannot invoke method on null
    at com.example.UserService.getUser(UserService.java:45)
    at com.example.ApiController.handleRequest(ApiController.java:23)
    at sun.reflect.NativeMethodAccessorImpl.invoke0(Native Method)
    at org.springframework.web.servlet.FrameworkServlet.service(FrameworkServlet.java:897)
    ... 20 more
```

**Components**:
- `java.lang.NullPointerException` - Exception class
- `com.example.UserService.getUser` - Package.Class.Method
- `UserService.java:45` - File:Line
- `... 20 more` - Truncated frames (same as parent)

### Key Patterns

**Caused By Chain**:
```java
Exception in thread "main" RuntimeException: Processing failed
    at App.main(App.java:10)
Caused by: SQLException: Connection refused
    at DB.connect(DB.java:25)
    ... 5 more
Caused by: SocketException: Connection reset
    at Socket.connect(Socket.java:100)
    ... 3 more
```

Root cause is at the bottom "Caused by".

**Lambda Expressions**:
```java
    at App.lambda$main$0(App.java:15)
```

Lambda defined in `main` method.

---

## Go Stack Traces

### Standard Format

```go
panic: runtime error: index out of range [5] with length 3

goroutine 1 [running]:
main.processItems(0xc0000a4000, 0x3, 0x3)
    /app/main.go:25 +0x5e
main.main()
    /app/main.go:10 +0x3a
exit status 2
```

**Components**:
- `panic: runtime error` - Error type
- `goroutine 1 [running]` - Which goroutine
- `main.processItems` - Package.Function
- `(0xc0000a4000, 0x3, 0x3)` - Arguments (pointers, values)
- `/app/main.go:25 +0x5e` - File:Line + PC offset

### Key Patterns

**Multiple Goroutines**:
```go
goroutine 1 [running]:
    ...
goroutine 5 [chan receive]:
    ...
goroutine 6 [IO wait]:
    ...
```

Error in goroutine 1, others show their state.

---

## Rust Stack Traces

### Standard Format

```rust
thread 'main' panicked at 'index out of bounds', src/main.rs:15:5
stack backtrace:
   0: rust_begin_unwind
   1: core::panicking::panic_fmt
   2: core::panicking::panic_bounds_check
   3: <usize as core::slice::index::SliceIndex<[T]>>::index
   4: my_app::process_data
             at ./src/processor.rs:25:10
   5: my_app::main
             at ./src/main.rs:10:5
```

Enable full backtraces: `RUST_BACKTRACE=1`

---

## Analysis Workflow

### Step 1: Find the Error

- **JavaScript**: Top of stack
- **Python**: Bottom of traceback
- **Java/Go/Rust**: Start of panic/exception

### Step 2: Identify Your Code

Skip framework/library frames, focus on your code:

```
    at getUser (YOUR CODE)              <- Focus here
    at express.Router (FRAMEWORK)       <- Skip
    at mongoose.Query (LIBRARY)         <- Skip
```

### Step 3: Extract Key Info

| What | Example |
|------|---------|
| Error Type | `TypeError`, `NullPointerException` |
| Message | `Cannot read property 'x' of undefined` |
| File | `/app/src/user.js` |
| Line | `45` |
| Function | `getUser` |
| Value | `undefined` |

### Step 4: Read the Context

```javascript
// Line 45
const userName = user.profile.name
//               ^--- user is undefined
```

### Step 5: Trace the Source

Go up the stack:
1. Where is `user` defined?
2. Where does it come from?
3. Why is it undefined?

```javascript
// In API handler (line 12)
const user = await getUserById(id)  // Returns undefined if not found!
return response.json({ name: user.profile.name })
```

---

## Common Stack Trace Issues

### Minified Code

```
TypeError: n is not a function
    at e (bundle.js:1:12345)
    at t (bundle.js:1:23456)
```

**Solutions**:
1. Use source maps
2. Run unminified build for debugging
3. Add `devtool: 'source-map'` to webpack

### Missing Stack Trace

```
Error: Something went wrong
    at Object.<anonymous> (index.js:1:1)
```

**Causes**:
- Error created with `new Error()` but not thrown
- Stack trimmed by error handling
- Async context lost

### Infinite/Very Deep Stack

```
RangeError: Maximum call stack size exceeded
    at recursive (app.js:10:3)
    at recursive (app.js:12:5)
    at recursive (app.js:12:5)
    ... (repeating)
```

**Cause**: Infinite recursion - find base case issue.

---

## Tools

### Node.js

```bash
# Enable long stack traces
node --stack-trace-limit=100 app.js

# V8 flags for debugging
node --trace-warnings app.js
```

Note: Async stack traces are enabled by default in Node.js 12+.

### Python

```bash
# Low-level crash debugging
python -X faulthandler script.py
```

```python
# Rich traceback (pip install rich)
from rich import traceback
traceback.install()
```

### Browser

```javascript
// Get stack trace anywhere
console.trace('Here')

// Error with custom stack
const err = new Error('Debug')
console.log(err.stack)
```
