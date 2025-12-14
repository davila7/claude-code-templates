# Rust Error Patterns

Common Rust errors with diagnosis and solutions.

## Ownership Errors

### cannot move out of borrowed content

```rust
error[E0507]: cannot move out of borrowed content
 --> src/main.rs:5:9
  |
5 |     let s = &vec[0];
  |             ^^^^^^^ cannot move out of borrowed content
```

**Solutions**:
```rust
// Clone if needed
let s = vec[0].clone();

// Or borrow instead of move
let s = &vec[0];

// Use .get() for Option
if let Some(s) = vec.get(0) {
    // use s as reference
}
```

---

### cannot borrow as mutable because it is also borrowed as immutable

```rust
error[E0502]: cannot borrow `x` as mutable because it is also borrowed as immutable
```

**Causes**:
1. Mutable and immutable borrows overlap
2. Iterator invalidation

**Solutions**:
```rust
// Wrong
let r1 = &vec;
let r2 = &mut vec;  // Error!

// Correct - end immutable borrow first
let r1 = &vec;
println!("{:?}", r1);  // Last use of r1
let r2 = &mut vec;     // OK now

// For collections, use indices instead
let len = vec.len();
for i in 0..len {
    vec[i] += 1;  // OK
}

// Or use interior mutability
use std::cell::RefCell;
let vec = RefCell::new(vec![1, 2, 3]);
```

---

### cannot borrow as mutable more than once

```rust
error[E0499]: cannot borrow `x` as mutable more than once at a time
```

**Solutions**:
```rust
// Wrong
let r1 = &mut vec;
let r2 = &mut vec;  // Error!

// Correct - scope the first borrow
{
    let r1 = &mut vec;
    // use r1
}  // r1 goes out of scope
let r2 = &mut vec;  // OK now

// Or use split_at_mut for slices
let (left, right) = slice.split_at_mut(mid);
```

---

### value borrowed here after move

```rust
error[E0382]: borrow of moved value: `s`
```

**Solutions**:
```rust
// Wrong
let s = String::from("hello");
let s2 = s;
println!("{}", s);  // Error! s was moved

// Option 1: Clone
let s = String::from("hello");
let s2 = s.clone();
println!("{}", s);  // OK

// Option 2: Use references
let s = String::from("hello");
let s2 = &s;
println!("{}", s);  // OK

// Option 3: Copy types (implement Copy)
let x = 5;
let y = x;
println!("{}", x);  // OK, i32 is Copy
```

---

## Lifetime Errors

### missing lifetime specifier

```rust
error[E0106]: missing lifetime specifier
 --> src/main.rs:1:17
  |
1 | fn longest(x: &str, y: &str) -> &str {
  |               ----     ----     ^ expected named lifetime parameter
```

**Solutions**:
```rust
// Add lifetime annotation
fn longest<'a>(x: &'a str, y: &'a str) -> &'a str {
    if x.len() > y.len() { x } else { y }
}

// For structs holding references
struct Parser<'a> {
    input: &'a str,
}

impl<'a> Parser<'a> {
    fn new(input: &'a str) -> Self {
        Parser { input }
    }
}
```

---

### lifetime may not live long enough

```rust
error: lifetime may not live long enough
 --> src/main.rs:3:5
  |
2 | fn example<'a>(x: &'a str) -> &'static str {
  |            -- lifetime `'a` defined here
3 |     x
  |     ^ returning this value requires that `'a` must outlive `'static`
```

**Solutions**:
```rust
// Match lifetimes correctly
fn example<'a>(x: &'a str) -> &'a str {
    x
}

// Or convert to owned type
fn example(x: &str) -> String {
    x.to_string()
}

// Use 'static only for actual static data
fn example() -> &'static str {
    "literal string"  // String literals are 'static
}
```

---

## Type Errors

### mismatched types

```rust
error[E0308]: mismatched types
 --> src/main.rs:3:20
  |
3 |     let x: i32 = "hello";
  |            ---   ^^^^^^^ expected `i32`, found `&str`
  |            |
  |            expected due to this
```

**Solutions**:
```rust
// Parse strings to numbers
let x: i32 = "42".parse().unwrap();
// Or with error handling
let x: i32 = "42".parse()?;

// Convert between numeric types
let x: i32 = 42;
let y: i64 = x as i64;
let z: i64 = x.into();  // If From trait implemented

// Convert to String
let s = x.to_string();
let s = format!("{}", x);
```

---

### the trait bound is not satisfied

```rust
error[E0277]: the trait bound `MyType: Debug` is not satisfied
```

**Solutions**:
```rust
// Derive the trait
#[derive(Debug)]
struct MyType {
    field: i32,
}

// Or implement manually
impl std::fmt::Debug for MyType {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "MyType {{ field: {} }}", self.field)
    }
}

// Common derivable traits
#[derive(Debug, Clone, PartialEq, Eq, Hash, Default)]
struct MyType {
    // ...
}
```

---

### cannot find type/value in this scope

```rust
error[E0412]: cannot find type `MyType` in this scope
error[E0425]: cannot find value `my_var` in this scope
```

**Solutions**:
```rust
// Import from module
use my_module::MyType;

// Or use full path
let x = my_module::MyType::new();

// For std types
use std::collections::HashMap;

// Check visibility - pub needed for external use
pub struct MyType;  // Visible outside module
```

---

## Option/Result Errors

### cannot use `?` operator on Option in function that returns Result

```rust
error[E0277]: the `?` operator can only be used in a function that returns `Result` or `Option`
```

**Solutions**:
```rust
// Match return types
fn example() -> Option<i32> {
    let x = some_option()?;  // OK
    Some(x)
}

fn example() -> Result<i32, Error> {
    let x = some_result()?;  // OK
    Ok(x)
}

// Convert Option to Result
fn example() -> Result<i32, &'static str> {
    let x = some_option().ok_or("value was None")?;
    Ok(x)
}

// Convert Result to Option
fn example() -> Option<i32> {
    let x = some_result().ok()?;
    Some(x)
}
```

---

### called `unwrap()` on a `None` value / `Err` value

```rust
thread 'main' panicked at 'called `Option::unwrap()` on a `None` value'
thread 'main' panicked at 'called `Result::unwrap()` on an `Err` value: ...'
```

**Solutions**:
```rust
// Use pattern matching
match option {
    Some(value) => println!("{}", value),
    None => println!("No value"),
}

// Use if let
if let Some(value) = option {
    println!("{}", value);
}

// Use unwrap_or for defaults
let value = option.unwrap_or(default);
let value = option.unwrap_or_else(|| compute_default());

// Use ? for propagation
let value = option?;  // Returns None if None
let value = result?;  // Returns Err if Err

// Use expect for better panic messages
let value = option.expect("option should have a value here");
```

---

## Concurrency Errors

### cannot be sent between threads safely

```rust
error[E0277]: `Rc<T>` cannot be sent between threads safely
```

**Solutions**:
```rust
// Use Arc instead of Rc for threads
use std::sync::Arc;
let data = Arc::new(vec![1, 2, 3]);
let data_clone = Arc::clone(&data);

std::thread::spawn(move || {
    println!("{:?}", data_clone);
});

// For mutation, use Arc<Mutex<T>>
use std::sync::{Arc, Mutex};
let data = Arc::new(Mutex::new(vec![1, 2, 3]));

let data_clone = Arc::clone(&data);
std::thread::spawn(move || {
    let mut guard = data_clone.lock().unwrap();
    guard.push(4);
});
```

---

### cannot be shared between threads safely

```rust
error[E0277]: `RefCell<T>` cannot be shared between threads safely
```

**Solutions**:
```rust
// Use Mutex or RwLock instead of RefCell
use std::sync::Mutex;
let data = Mutex::new(0);

// Multiple readers, single writer
use std::sync::RwLock;
let data = RwLock::new(0);

// Read
let value = *data.read().unwrap();

// Write
*data.write().unwrap() = 42;
```

---

### closure may outlive the current function

```rust
error[E0373]: closure may outlive the current function, but it borrows `x`
```

**Solutions**:
```rust
// Use move to take ownership
let x = String::from("hello");
let closure = move || {
    println!("{}", x);
};

// For threads
let x = String::from("hello");
std::thread::spawn(move || {
    println!("{}", x);
});
```

---

## Macro Errors

### no rules expected this token

```rust
error: no rules expected the token `)`
 --> src/main.rs:5:10
  |
5 |     vec![,];
  |          ^ no rules expected this token in macro call
```

**Solutions**:
```rust
// Check macro syntax
vec![]           // Empty vector
vec![1, 2, 3]    // With elements
vec![0; 5]       // 5 zeros

// For custom macros, check pattern matching
macro_rules! my_macro {
    ($($x:expr),*) => { ... };     // Comma separated
    ($($x:expr),+ $(,)?) => { ... }; // With trailing comma
}
```

---

## Async Errors

### future cannot be sent between threads safely

```rust
error: future cannot be sent between threads safely
```

**Solutions**:
```rust
// Use Send-safe types
// Arc instead of Rc
// Mutex instead of RefCell

// Avoid holding non-Send types across await
{
    let guard = mutex.lock().unwrap();
    // use guard
}  // Drop before await
async_operation().await;

// Use spawn_local for non-Send futures
tokio::task::spawn_local(async move {
    // Can use non-Send types here
});
```

---

### `await` is only allowed inside `async` functions

```rust
error[E0728]: `await` is only allowed inside `async` functions and blocks
```

**Solutions**:
```rust
// Mark function as async
async fn example() {
    some_async_fn().await;
}

// Or use async block
fn example() -> impl Future<Output = ()> {
    async {
        some_async_fn().await;
    }
}

// In main, use runtime
#[tokio::main]
async fn main() {
    example().await;
}
```

---

## Build Errors

### unresolved import

```rust
error[E0432]: unresolved import `crate::module`
```

**Solutions**:
```rust
// Check module structure
// src/lib.rs or src/main.rs
mod my_module;  // Declares module

// src/my_module.rs or src/my_module/mod.rs
pub fn my_function() {}

// Then import
use crate::my_module::my_function;

// For external crates, add to Cargo.toml
[dependencies]
serde = "1.0"
```

---

### use of undeclared crate or module

```rust
error[E0433]: failed to resolve: use of undeclared crate or module `tokio`
```

**Solutions**:
```toml
# Add to Cargo.toml
[dependencies]
tokio = { version = "1.0", features = ["full"] }
```

```bash
# Then run
cargo build
```

---

## Quick Reference Table

| Error | Category | Quick Fix |
|-------|----------|-----------|
| cannot move out of borrowed | Ownership | Clone or use reference |
| cannot borrow as mutable | Borrow | End previous borrow first |
| value borrowed after move | Move | Clone or use reference |
| missing lifetime specifier | Lifetime | Add `<'a>` annotation |
| mismatched types | Type | Use conversion methods |
| trait bound not satisfied | Trait | Derive or implement trait |
| `?` operator wrong return | Error | Match return type |
| unwrap on None/Err | Error | Use `?` or pattern match |
| cannot be sent between threads | Concurrency | Use Arc/Mutex |
| closure may outlive | Closure | Add `move` keyword |
| unresolved import | Module | Check mod declaration |
