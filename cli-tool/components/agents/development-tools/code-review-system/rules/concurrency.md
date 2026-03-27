# Advanced Concurrency & Async Bug Detection Rules

## Critical Concurrency Bugs

### 1. Race Conditions in State Updates
**Pattern**: Multiple async operations modifying shared state
```javascript
// ❌ Race condition
let balance = 1000;
async function withdraw(amount) {
  if (balance >= amount) {
    await delay(100); // Simulate async operation
    balance -= amount;
    return true;
  }
  return false;
}
// Two concurrent withdrawals can overdraw account
```

**Detection**: 
- Multiple async functions accessing same variable
- State checks followed by async operations
- No locking or transaction mechanism

**Impact**: Data corruption, financial loss, security breach
**Confidence**: 92%

**Fix**:
```javascript
// ✅ Use atomic operations or locks
const mutex = new Mutex();
async function withdraw(amount) {
  const release = await mutex.acquire();
  try {
    if (balance >= amount) {
      await delay(100);
      balance -= amount;
      return true;
    }
    return false;
  } finally {
    release();
  }
}
```

---

### 2. React Hook Stale Closures
**Pattern**: Closures in useEffect/useCallback capturing old state
```javascript
// ❌ Stale closure
function Counter() {
  const [count, setCount] = useState(0);
  
  useEffect(() => {
    const interval = setInterval(() => {
      console.log(count); // Always logs 0!
    }, 1000);
    return () => clearInterval(interval);
  }, []); // Missing dependency
  
  return <button onClick={() => setCount(count + 1)}>Increment</button>;
}
```

**Detection**:
- useEffect/useCallback with empty deps array
- Closure references state/props
- No ref usage for current values

**Impact**: Wrong values displayed, incorrect calculations, user confusion
**Confidence**: 95%

**Fix**:
```javascript
// ✅ Include dependencies or use ref
function Counter() {
  const [count, setCount] = useState(0);
  
  useEffect(() => {
    const interval = setInterval(() => {
      console.log(count); // Correct value
    }, 1000);
    return () => clearInterval(interval);
  }, [count]); // Include dependency
  
  return <button onClick={() => setCount(count + 1)}>Increment</button>;
}
```

---

### 3. Promise Race Conditions
**Pattern**: Rapid async calls with stale results
```javascript
// ❌ Race condition
function SearchComponent() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  
  useEffect(() => {
    fetchResults(query).then(setResults);
  }, [query]);
  // If user types "abc" quickly, results for "a" might arrive last
}
```

**Detection**:
- useEffect with async operation
- No cleanup function
- State can change before async completes

**Impact**: Wrong data displayed, user confusion, privacy violation
**Confidence**: 93%

**Fix**:
```javascript
// ✅ Cancel stale requests
function SearchComponent() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  
  useEffect(() => {
    let cancelled = false;
    fetchResults(query).then(data => {
      if (!cancelled) setResults(data);
    });
    return () => { cancelled = true; };
  }, [query]);
}
```

---

### 4. Deadlocks in Async Code
**Pattern**: Circular async dependencies
```javascript
// ❌ Deadlock
async function processA() {
  await lockA.acquire();
  await delay(10);
  await lockB.acquire(); // Waits for B
  // ... work
  lockB.release();
  lockA.release();
}

async function processB() {
  await lockB.acquire();
  await delay(10);
  await lockA.acquire(); // Waits for A - DEADLOCK!
  // ... work
  lockA.release();
  lockB.release();
}
```

**Detection**:
- Multiple lock acquisitions
- Different acquisition order in different functions
- No timeout mechanism

**Impact**: Application hangs, requires restart, data loss
**Confidence**: 88%

**Fix**:
```javascript
// ✅ Consistent lock ordering
async function processA() {
  await lockA.acquire();
  await lockB.acquire(); // Always A then B
  // ... work
  lockB.release();
  lockA.release();
}

async function processB() {
  await lockA.acquire(); // Same order
  await lockB.acquire();
  // ... work
  lockB.release();
  lockA.release();
}
```

---

### 5. Event Loop Blocking
**Pattern**: Synchronous operations in async context
```javascript
// ❌ Blocks event loop
app.get('/process', async (req, res) => {
  const data = req.body.data;
  
  // Synchronous CPU-intensive work
  for (let i = 0; i < 1000000000; i++) {
    // Heavy computation
  }
  
  res.json({ result: 'done' });
});
// Server becomes unresponsive
```

**Detection**:
- Long synchronous loops in async functions
- CPU-intensive work without yielding
- No worker threads or child processes

**Impact**: Server unresponsive, request timeouts, DoS vulnerability
**Confidence**: 90%

**Fix**:
```javascript
// ✅ Use worker threads
const { Worker } = require('worker_threads');

app.get('/process', async (req, res) => {
  const worker = new Worker('./heavy-work.js', {
    workerData: req.body.data
  });
  
  worker.on('message', (result) => {
    res.json({ result });
  });
});
```

---

### 6. Unhandled Promise Rejections
**Pattern**: Async functions without error handling
```javascript
// ❌ Silent failure
async function saveUser(user) {
  await db.insert(user); // If this fails, error is swallowed
  showSuccessMessage();
}

button.onclick = () => saveUser(userData);
```

**Detection**:
- Async function calls without await
- No try/catch around await
- No .catch() on promises

**Impact**: Silent data loss, user sees success but data not saved
**Confidence**: 94%

**Fix**:
```javascript
// ✅ Proper error handling
async function saveUser(user) {
  try {
    await db.insert(user);
    showSuccessMessage();
  } catch (error) {
    showErrorMessage(error.message);
    logError(error);
  }
}

button.onclick = () => saveUser(userData);
```

---

### 7. Memory Leaks in Event Listeners
**Pattern**: Event listeners not cleaned up
```javascript
// ❌ Memory leak
function useWebSocket(url) {
  const [messages, setMessages] = useState([]);
  
  useEffect(() => {
    const ws = new WebSocket(url);
    ws.onmessage = (event) => {
      setMessages(prev => [...prev, event.data]);
    };
    return () => ws.close(); // Doesn't remove listener!
  }, [url]);
}
// Memory grows 10KB per reconnection
```

**Detection**:
- Event listener assignment (onX = handler)
- Cleanup doesn't set listener to null
- No removeEventListener call

**Impact**: Memory grows over time, app crashes after hours
**Confidence**: 91%

**Fix**:
```javascript
// ✅ Proper cleanup
function useWebSocket(url) {
  const [messages, setMessages] = useState([]);
  
  useEffect(() => {
    const ws = new WebSocket(url);
    const handler = (event) => {
      setMessages(prev => [...prev, event.data]);
    };
    ws.addEventListener('message', handler);
    
    return () => {
      ws.removeEventListener('message', handler);
      ws.close();
    };
  }, [url]);
}
```

---

### 8. Async/Await Anti-Patterns
**Pattern**: Sequential awaits that could be parallel
```javascript
// ❌ Slow - 3 seconds total
async function loadData() {
  const user = await fetchUser(); // 1s
  const posts = await fetchPosts(); // 1s
  const comments = await fetchComments(); // 1s
  return { user, posts, comments };
}
```

**Detection**:
- Multiple await statements in sequence
- No data dependencies between calls
- Could use Promise.all

**Impact**: Slow response times, poor user experience
**Confidence**: 96%

**Fix**:
```javascript
// ✅ Parallel - 1 second total
async function loadData() {
  const [user, posts, comments] = await Promise.all([
    fetchUser(),
    fetchPosts(),
    fetchComments()
  ]);
  return { user, posts, comments };
}
```

---

### 9. TOCTOU (Time-of-Check Time-of-Use)
**Pattern**: Check then use with async gap
```javascript
// ❌ TOCTOU vulnerability
async function deleteFile(filename) {
  if (await fs.exists(filename)) {
    // Gap here - file could be deleted by another process
    await fs.unlink(filename);
  }
}
```

**Detection**:
- Async check followed by async operation
- No atomic operation
- File system or database operations

**Impact**: Race condition, errors, security vulnerability
**Confidence**: 87%

**Fix**:
```javascript
// ✅ Handle errors instead of checking
async function deleteFile(filename) {
  try {
    await fs.unlink(filename);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
}
```

---

### 10. Goroutine Leaks (Go)
**Pattern**: Goroutines that never exit
```go
// ❌ Goroutine leak
func process() {
    ch := make(chan int)
    go func() {
        for val := range ch {  // Blocks forever if ch never closes
            process(val)
        }
    }()
}
```

**Detection**:
- Goroutine with blocking operation
- No context for cancellation
- Channel never closed

**Impact**: Memory leak, goroutine count grows, eventual crash
**Confidence**: 89%

**Fix**:
```go
// ✅ Use context for cancellation
func process(ctx context.Context) {
    ch := make(chan int)
    go func() {
        for {
            select {
            case val := <-ch:
                process(val)
            case <-ctx.Done():
                return
            }
        }
    }()
}
```

---

### 11. Channel Deadlocks (Go)
**Pattern**: Unbuffered channel with no receiver
```go
// ❌ Deadlock
func send() {
    ch := make(chan int)
    ch <- 42  // Blocks forever - no receiver!
}
```

**Detection**:
- Unbuffered channel creation
- Send without concurrent receiver
- No goroutine to receive

**Impact**: Goroutine blocks forever, deadlock
**Confidence**: 93%

**Fix**:
```go
// ✅ Use buffered channel or goroutine
func send() {
    ch := make(chan int, 1)  // Buffered
    ch <- 42
}

// Or
func send() {
    ch := make(chan int)
    go func() {
        fmt.Println(<-ch)
    }()
    ch <- 42
}
```

---

### 12. Python GIL Contention
**Pattern**: CPU-bound work in threads
```python
# ❌ GIL bottleneck - no parallelism
import threading

def cpu_work():
    # Heavy computation
    sum(range(10000000))

threads = [threading.Thread(target=cpu_work) for _ in range(10)]
for t in threads:
    t.start()
# All threads compete for GIL - slower than single thread!
```

**Detection**:
- Threading module for CPU-bound work
- No I/O operations
- Pure computation in threads

**Impact**: Slower than single-threaded, wasted resources
**Confidence**: 95%

**Fix**:
```python
# ✅ Use multiprocessing for CPU-bound
from multiprocessing import Process

def cpu_work():
    sum(range(10000000))

processes = [Process(target=cpu_work) for _ in range(10)]
for p in processes:
    p.start()
# True parallelism
```

---

### 13. Async Context Manager Misuse (Python)
**Pattern**: Regular context manager with async code
```python
# ❌ Blocks event loop
async def fetch_data():
    with open('data.txt') as f:  # Blocking I/O!
        data = f.read()
    return data
```

**Detection**:
- Regular context manager in async function
- File I/O without aiofiles
- Database operations without async driver

**Impact**: Event loop blocked, poor concurrency
**Confidence**: 91%

**Fix**:
```python
# ✅ Use async context manager
import aiofiles

async def fetch_data():
    async with aiofiles.open('data.txt') as f:
        data = await f.read()
    return data
```

---

### 14. Double-Checked Locking Bug
**Pattern**: Optimization that breaks thread safety
```javascript
// ❌ Broken singleton
let instance = null;

function getInstance() {
  if (!instance) {  // Check 1
    lock.acquire();
    if (!instance) {  // Check 2
      instance = new Singleton();  // Not atomic!
    }
    lock.release();
  }
  return instance;
}
```

**Detection**:
- Double-check pattern
- Object creation between checks
- No memory barrier

**Impact**: Multiple instances created, race condition
**Confidence**: 85%

**Fix**:
```javascript
// ✅ Use proper synchronization
let instance = null;
const lock = new Mutex();

async function getInstance() {
  if (!instance) {
    const release = await lock.acquire();
    try {
      if (!instance) {
        instance = new Singleton();
      }
    } finally {
      release();
    }
  }
  return instance;
}
```

---

### 15. Event Emitter Memory Leaks
**Pattern**: Event listeners never removed
```javascript
// ❌ Memory leak
class DataService {
  constructor() {
    this.emitter = new EventEmitter();
  }
  
  subscribe(callback) {
    this.emitter.on('data', callback);
    // No way to unsubscribe!
  }
}
```

**Detection**:
- EventEmitter.on without corresponding off
- No unsubscribe mechanism
- Listeners accumulate over time

**Impact**: Memory grows, performance degrades, eventual crash
**Confidence**: 92%

**Fix**:
```javascript
// ✅ Provide unsubscribe
class DataService {
  constructor() {
    this.emitter = new EventEmitter();
  }
  
  subscribe(callback) {
    this.emitter.on('data', callback);
    return () => this.emitter.off('data', callback);
  }
}

// Usage
const unsubscribe = service.subscribe(handleData);
// Later...
unsubscribe();
```

---

## Detection Confidence Levels

- **90-100%**: Definitely a concurrency bug
- **80-89%**: Very likely a bug, investigate
- **70-79%**: Potential issue, review carefully

## Quick Reference

| Bug Type | Severity | Confidence | Common In |
|----------|----------|------------|-----------|
| Race Condition | 🔴 Critical | 92% | Async state |
| Stale Closure | 🔴 Critical | 95% | React hooks |
| Promise Race | 🔴 Critical | 93% | User input |
| Deadlock | 🔴 Critical | 88% | Multi-lock |
| Event Loop Block | ⚠️ High | 90% | CPU work |
| Unhandled Rejection | ⚠️ High | 94% | Async calls |
| Memory Leak | ⚠️ High | 91% | Event listeners |
| Sequential Await | ⚠️ High | 96% | Data fetching |
| TOCTOU | ⚠️ High | 87% | File ops |
| Goroutine Leak | ⚠️ High | 89% | Go channels |
| GIL Contention | ⚠️ High | 95% | Python threads |

## Prevention Strategies

1. **Use Locking**: Protect shared state with mutexes
2. **Cleanup Listeners**: Always remove event listeners
3. **Include Dependencies**: Add all deps to React hooks
4. **Cancel Stale Requests**: Use cleanup functions
5. **Parallel When Possible**: Use Promise.all
6. **Handle Errors**: Try/catch all async operations
7. **Use Context**: Go context for cancellation
8. **Multiprocessing**: Python CPU work in processes
9. **Async I/O**: Use async libraries for I/O
10. **Test Concurrency**: Simulate race conditions in tests
