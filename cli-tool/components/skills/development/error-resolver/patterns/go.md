# Go Error Patterns

Common Go errors with diagnosis and solutions.

## Nil Pointer Errors

### panic: runtime error: invalid memory address or nil pointer dereference

```go
panic: runtime error: invalid memory address or nil pointer dereference
[signal SIGSEGV: segmentation violation]
```

**Causes**:
1. Calling method on nil pointer
2. Accessing field of nil struct
3. Dereferencing nil pointer

**Solutions**:
```go
// Check for nil before use
if user != nil {
    fmt.Println(user.Name)
}

// Return early on nil
func processUser(user *User) error {
    if user == nil {
        return errors.New("user is nil")
    }
    // proceed
}

// Use zero values where appropriate
type Config struct {
    Timeout time.Duration
}

func (c *Config) GetTimeout() time.Duration {
    if c == nil {
        return 30 * time.Second // default
    }
    return c.Timeout
}
```

---

## Slice/Array Errors

### panic: runtime error: index out of range

```go
panic: runtime error: index out of range [5] with length 3
```

**Causes**:
1. Accessing index beyond slice length
2. Empty slice access
3. Off-by-one error

**Solutions**:
```go
// Check length first
if len(items) > index {
    item := items[index]
}

// Safe first/last element
func first(items []string) (string, bool) {
    if len(items) == 0 {
        return "", false
    }
    return items[0], true
}

// Use range for iteration
for i, item := range items {
    // safe access
}
```

---

### panic: runtime error: slice bounds out of range

```go
panic: runtime error: slice bounds out of range [:5] with length 3
```

**Solutions**:
```go
// Validate slice bounds
func safeSlice(s []int, start, end int) []int {
    if start < 0 {
        start = 0
    }
    if end > len(s) {
        end = len(s)
    }
    if start > end {
        return nil
    }
    return s[start:end]
}
```

---

## Map Errors

### panic: assignment to entry in nil map

```go
panic: assignment to entry in nil map
```

**Causes**:
1. Writing to uninitialized map
2. Map declared but not made

**Solutions**:
```go
// Wrong
var m map[string]int
m["key"] = 1  // panic!

// Correct - use make
m := make(map[string]int)
m["key"] = 1

// Or initialize with literal
m := map[string]int{}
m["key"] = 1

// In structs, initialize in constructor
type Cache struct {
    data map[string]string
}

func NewCache() *Cache {
    return &Cache{
        data: make(map[string]string),
    }
}
```

---

### Map access returns zero value

```go
value := m["nonexistent"]  // Returns zero value, not error
```

**Solutions**:
```go
// Check if key exists
value, ok := m["key"]
if !ok {
    // key doesn't exist
}

// Or use default
func getOrDefault(m map[string]int, key string, def int) int {
    if v, ok := m[key]; ok {
        return v
    }
    return def
}
```

---

## Channel Errors

### fatal error: all goroutines are asleep - deadlock!

```go
fatal error: all goroutines are asleep - deadlock!
```

**Causes**:
1. Channel send/receive with no corresponding operation
2. Unbuffered channel blocking
3. Waiting on channel that's never written to

**Solutions**:
```go
// Wrong - unbuffered channel blocks
ch := make(chan int)
ch <- 1  // blocks forever, no receiver

// Correct - use goroutine
ch := make(chan int)
go func() {
    ch <- 1
}()
value := <-ch

// Or use buffered channel
ch := make(chan int, 1)
ch <- 1  // doesn't block
value := <-ch

// Always close channels when done sending
go func() {
    defer close(ch)
    for _, item := range items {
        ch <- item
    }
}()
```

---

### panic: send on closed channel

```go
panic: send on closed channel
```

**Solutions**:
```go
// Only sender should close channel
// Use sync.Once for safe closing
var once sync.Once
closeCh := func() {
    once.Do(func() {
        close(ch)
    })
}

// Or use context for cancellation
ctx, cancel := context.WithCancel(context.Background())
defer cancel()

go func() {
    for {
        select {
        case <-ctx.Done():
            return
        case ch <- value:
        }
    }
}()
```

---

## Interface Errors

### panic: interface conversion: X is nil, not Y

```go
panic: interface conversion: interface {} is nil, not string
```

**Solutions**:
```go
// Use type assertion with ok
value, ok := i.(string)
if !ok {
    // handle non-string or nil
}

// Use type switch
switch v := i.(type) {
case string:
    fmt.Println("string:", v)
case int:
    fmt.Println("int:", v)
case nil:
    fmt.Println("nil")
default:
    fmt.Println("unknown type")
}
```

---

### panic: interface conversion: X is Y, not Z

```go
panic: interface conversion: interface {} is int, not string
```

**Same solution** - always use type assertion with `ok` check.

---

## Concurrency Errors

### fatal error: concurrent map writes

```go
fatal error: concurrent map writes
```

**Causes**:
1. Multiple goroutines writing to same map
2. No synchronization

**Solutions**:
```go
// Option 1: Use sync.Mutex
type SafeMap struct {
    mu sync.RWMutex
    m  map[string]int
}

func (s *SafeMap) Set(key string, value int) {
    s.mu.Lock()
    defer s.mu.Unlock()
    s.m[key] = value
}

func (s *SafeMap) Get(key string) (int, bool) {
    s.mu.RLock()
    defer s.mu.RUnlock()
    v, ok := s.m[key]
    return v, ok
}

// Option 2: Use sync.Map
var m sync.Map
m.Store("key", 1)
value, ok := m.Load("key")
```

---

### data race detected

```
WARNING: DATA RACE
Write by goroutine X:
  ...
Previous read by goroutine Y:
  ...
```

**Solutions**:
```go
// Use mutex for shared state
var (
    mu    sync.Mutex
    count int
)

func increment() {
    mu.Lock()
    count++
    mu.Unlock()
}

// Or use atomic operations
var count int64

func increment() {
    atomic.AddInt64(&count, 1)
}

// Run with race detector
// go run -race main.go
// go test -race ./...
```

---

## Import/Module Errors

### cannot find package

```
cannot find package "github.com/user/repo" in any of:
    /usr/local/go/src/github.com/user/repo (from $GOROOT)
    /home/user/go/src/github.com/user/repo (from $GOPATH)
```

**Solutions**:
```bash
# Initialize go modules
go mod init myproject

# Download dependencies
go mod tidy

# Or get specific package
go get github.com/user/repo
```

---

### module declares its path as X but was required as Y

```
module declares its path as: github.com/old/path
        but was required as: github.com/new/path
```

**Solutions**:
```bash
# Update go.mod with replace directive
# go.mod
replace github.com/old/path => github.com/new/path v1.0.0

# Or update import paths in code
```

---

## Error Handling Patterns

### Wrapping Errors (Go 1.13+)

```go
// Wrap with context
if err != nil {
    return fmt.Errorf("failed to process user %d: %w", userID, err)
}

// Unwrap to check original error
if errors.Is(err, sql.ErrNoRows) {
    // handle not found
}

// Get specific error type
var pathErr *os.PathError
if errors.As(err, &pathErr) {
    fmt.Println("Path:", pathErr.Path)
}
```

---

### Custom Errors

```go
// Sentinel errors
var ErrNotFound = errors.New("not found")

// Custom error type
type ValidationError struct {
    Field   string
    Message string
}

func (e *ValidationError) Error() string {
    return fmt.Sprintf("%s: %s", e.Field, e.Message)
}

// Check with errors.As
var valErr *ValidationError
if errors.As(err, &valErr) {
    fmt.Printf("Validation failed on %s\n", valErr.Field)
}
```

---

## Build Errors

### undefined: X

```
./main.go:10:2: undefined: someFunction
```

**Causes**:
1. Function/variable not defined
2. Wrong package imported
3. Unexported name (lowercase)

**Solutions**:
```go
// Check export - must be uppercase
func PublicFunction() {}  // Exported
func privateFunction() {} // Not exported

// Check import
import "mypackage"
mypackage.PublicFunction()
```

---

### imported and not used

```
./main.go:4:2: "fmt" imported and not used
```

**Solutions**:
```go
// Remove unused import
// Or use blank identifier if needed for side effects
import _ "database/sql/driver"

// Use goimports to auto-fix
// goimports -w .
```

---

### declared and not used

```
./main.go:10:2: x declared and not used
```

**Solutions**:
```go
// Use the variable or remove it
// Use blank identifier if intentionally unused
_ = someFunction()

// For error checking
result, _ := riskyFunction()  // Intentionally ignore error (not recommended)
```

---

## Quick Reference Table

| Error | Category | Quick Fix |
|-------|----------|-----------|
| nil pointer dereference | Nil | Check for nil before use |
| index out of range | Slice | Check `len()` first |
| assignment to nil map | Map | Use `make(map[K]V)` |
| deadlock | Channel | Ensure send/receive pairs match |
| send on closed channel | Channel | Only sender closes |
| interface conversion nil | Interface | Use type assertion with ok |
| concurrent map writes | Concurrency | Use `sync.Mutex` or `sync.Map` |
| data race | Concurrency | Add synchronization, use `-race` |
| cannot find package | Module | Run `go mod tidy` |
| undefined | Build | Check export (uppercase) |
