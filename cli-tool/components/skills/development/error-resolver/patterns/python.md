# Python Error Patterns

Common Python errors with diagnosis and solutions.

## Import Errors

### ModuleNotFoundError

```python
ModuleNotFoundError: No module named 'package_name'
```

**Causes**:
1. Package not installed
2. Virtual environment not activated
3. Wrong Python version
4. Typo in module name

**Diagnosis**:
```bash
# Check if package installed
pip show package_name
pip list | grep package

# Check which Python
which python
python --version

# Check if in venv
echo $VIRTUAL_ENV
```

**Solutions**:
```bash
# Install package
pip install package_name

# If using virtual env
source venv/bin/activate
pip install package_name

# If wrong Python version
python3 -m pip install package_name
pip3 install package_name
```

---

### ImportError: cannot import name 'X' from 'Y'

```python
ImportError: cannot import name 'MyClass' from 'mymodule'
```

**Causes**:
1. Name doesn't exist in module
2. Circular import
3. Module structure changed
4. Typo in name

**Diagnosis**:
```python
# Check what's available
import mymodule
print(dir(mymodule))

# Check if circular import
# Add print at top of each module to see import order
```

**Solutions**:
```python
# Circular import fix - move import inside function
def my_function():
    from other_module import something
    return something()

# Or restructure to avoid circular dependency
```

---

## Type Errors

### TypeError: 'NoneType' object is not subscriptable

```python
TypeError: 'NoneType' object is not subscriptable
```

**Causes**:
1. Function returned None (forgot return)
2. dict.get() returned None
3. API response is None

**Solutions**:
```python
# Add None check
if result is not None:
    value = result['key']

# Use default value
value = result.get('key', 'default') if result else 'default'

# Use walrus operator (Python 3.8+)
if (result := get_result()) is not None:
    value = result['key']
```

---

### TypeError: 'X' object is not callable

```python
TypeError: 'str' object is not callable
```

**Causes**:
1. Variable shadows built-in function
2. Missing method parentheses somewhere
3. Property accessed as method

**Common Culprits**:
```python
# Shadowing built-ins - DON'T DO THIS
list = [1, 2, 3]        # Shadows list()
str = "hello"           # Shadows str()
dict = {'a': 1}         # Shadows dict()
type = "my_type"        # Shadows type()
id = 123                # Shadows id()
```

**Solutions**:
```python
# Rename variables
my_list = [1, 2, 3]
my_str = "hello"

# Or delete the shadow
del list
```

---

### TypeError: unsupported operand type(s)

```python
TypeError: unsupported operand type(s) for +: 'int' and 'str'
```

**Causes**:
1. Mixing types in operation
2. Unexpected type from input/API

**Solutions**:
```python
# Convert types explicitly
result = str(number) + text
result = number + int(text)

# Type checking
if isinstance(value, int):
    result = value + 10
```

---

## Attribute Errors

### AttributeError: 'NoneType' object has no attribute 'X'

```python
AttributeError: 'NoneType' object has no attribute 'split'
```

**Causes**:
1. Variable is None when it shouldn't be
2. Function returned None
3. Failed assignment

**Solutions**:
```python
# Guard against None
if text is not None:
    words = text.split()

# With default
words = (text or "").split()

# Assert early
assert text is not None, "text cannot be None"
```

---

### AttributeError: module 'X' has no attribute 'Y'

```python
AttributeError: module 'json' has no attribute 'loads'
```

**Causes**:
1. Local file shadows standard library
2. Wrong module imported
3. Outdated module version

**Diagnosis**:
```python
import json
print(json.__file__)  # Check which file is loaded
```

**Solutions**:
```bash
# If local file shadows stdlib
mv json.py my_json_utils.py
rm json.pyc __pycache__/json*

# Check for naming conflicts
ls *.py | grep -E "^(json|os|sys|re|io)\.py$"
```

---

## Key/Index Errors

### KeyError

```python
KeyError: 'username'
```

**Causes**:
1. Key doesn't exist in dict
2. Typo in key name
3. Data structure changed

**Solutions**:
```python
# Use .get() with default
username = data.get('username', 'anonymous')

# Check before access
if 'username' in data:
    username = data['username']

# Use defaultdict
from collections import defaultdict
data = defaultdict(str)
```

---

### IndexError: list index out of range

```python
IndexError: list index out of range
```

**Causes**:
1. Accessing index beyond list length
2. Empty list
3. Off-by-one error

**Solutions**:
```python
# Check length first
if len(my_list) > index:
    value = my_list[index]

# Use try/except
try:
    value = my_list[index]
except IndexError:
    value = default_value

# Safe last element
last = my_list[-1] if my_list else None
```

---

## Value Errors

### ValueError: invalid literal for int()

```python
ValueError: invalid literal for int() with base 10: 'abc'
```

**Causes**:
1. Non-numeric string to int()
2. Float string to int()
3. Empty string

**Solutions**:
```python
# Safe conversion
def safe_int(value, default=0):
    try:
        return int(value)
    except (ValueError, TypeError):
        return default

# Check first
if value.isdigit():
    number = int(value)

# For floats as strings
number = int(float("3.14"))  # -> 3
```

---

### ValueError: too many values to unpack

```python
ValueError: too many values to unpack (expected 2)
```

**Causes**:
1. Unpacking mismatch
2. Data has more/fewer items than expected

**Solutions**:
```python
# Use * to capture rest
first, *rest = [1, 2, 3, 4]  # first=1, rest=[2,3,4]
first, second, *_ = [1, 2, 3, 4]  # Ignore extras

# Check length first
if len(items) >= 2:
    a, b = items[0], items[1]
```

---

## File Errors

### FileNotFoundError

```python
FileNotFoundError: [Errno 2] No such file or directory: 'file.txt'
```

**Causes**:
1. File doesn't exist
2. Wrong path (relative vs absolute)
3. Typo in filename

**Solutions**:
```python
from pathlib import Path

# Check existence
path = Path('file.txt')
if path.exists():
    content = path.read_text()

# Use absolute path
path = Path(__file__).parent / 'data' / 'file.txt'

# Create if not exists
path.parent.mkdir(parents=True, exist_ok=True)
path.touch()
```

---

### PermissionError

```python
PermissionError: [Errno 13] Permission denied: '/path/to/file'
```

**Causes**:
1. No write permission
2. File owned by another user
3. File is read-only

**Diagnosis**:
```bash
ls -la /path/to/file
stat /path/to/file
```

**Solutions**:
```bash
# Change permissions
chmod 644 /path/to/file
chmod 755 /path/to/directory

# Change ownership
sudo chown $USER:$USER /path/to/file
```

```python
# Write to user directory instead
from pathlib import Path
user_dir = Path.home() / '.myapp'
user_dir.mkdir(exist_ok=True)
```

---

## Encoding Errors

### UnicodeDecodeError

```python
UnicodeDecodeError: 'utf-8' codec can't decode byte 0xff
```

**Causes**:
1. File not UTF-8 encoded
2. Binary file read as text
3. Mixed encodings

**Solutions**:
```python
# Try different encoding
with open('file.txt', encoding='latin-1') as f:
    content = f.read()

# Detect encoding
import chardet
with open('file.txt', 'rb') as f:
    result = chardet.detect(f.read())
    encoding = result['encoding']

with open('file.txt', encoding=encoding) as f:
    content = f.read()

# Ignore errors (lossy)
with open('file.txt', encoding='utf-8', errors='ignore') as f:
    content = f.read()
```

---

## JSON Errors

### json.decoder.JSONDecodeError

```python
json.decoder.JSONDecodeError: Expecting value: line 1 column 1
```

**Causes**:
1. Invalid JSON syntax
2. Empty string/file
3. HTML returned instead of JSON

**Diagnosis**:
```python
# Print raw content first
print(repr(response.text))
print(response.text[:100])
```

**Solutions**:
```python
# Check before parsing
if response.text:
    try:
        data = json.loads(response.text)
    except json.JSONDecodeError as e:
        print(f"Invalid JSON at line {e.lineno}, col {e.colno}")
        print(f"Content: {response.text[:200]}")

# Handle HTML error pages
if response.text.startswith('<'):
    raise ValueError("Received HTML instead of JSON")
```

---

## Recursion Errors

### RecursionError: maximum recursion depth exceeded

```python
RecursionError: maximum recursion depth exceeded
```

**Causes**:
1. Infinite recursion
2. Missing base case
3. Deep data structure

**Solutions**:
```python
# Increase limit (temporary fix)
import sys
sys.setrecursionlimit(10000)

# Better: convert to iteration
def factorial_iterative(n):
    result = 1
    for i in range(1, n + 1):
        result *= i
    return result

# Use @lru_cache for memoization
from functools import lru_cache

@lru_cache(maxsize=None)
def fib(n):
    if n < 2:
        return n
    return fib(n - 1) + fib(n - 2)
```

---

## Async Errors

### RuntimeError: Event loop is closed

```python
RuntimeError: Event loop is closed
```

**Causes**:
1. Trying to use closed event loop
2. Event loop not properly managed
3. Windows-specific issue with ProactorEventLoop

**Solutions**:
```python
# Use asyncio.run() (Python 3.7+)
asyncio.run(main())

# For Windows
if sys.platform == 'win32':
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

# Explicit loop management
loop = asyncio.new_event_loop()
asyncio.set_event_loop(loop)
try:
    loop.run_until_complete(main())
finally:
    loop.close()
```

---

### RuntimeError: cannot reuse already awaited coroutine

```python
RuntimeError: cannot reuse already awaited coroutine
```

**Causes**:
1. Awaiting same coroutine twice
2. Storing coroutine in variable and reusing

**Solutions**:
```python
# Wrong - reusing coroutine
coro = fetch_data()
await coro
await coro  # Error!

# Correct - create new coroutine each time
await fetch_data()
await fetch_data()

# Or use asyncio.create_task for concurrent execution
task1 = asyncio.create_task(fetch_data())
task2 = asyncio.create_task(fetch_data())
await asyncio.gather(task1, task2)
```

---

## Quick Reference Table

| Error | Category | Quick Fix |
|-------|----------|-----------|
| `ModuleNotFoundError` | Import | `pip install <pkg>` |
| `ImportError: circular` | Import | Move import inside function |
| `TypeError: NoneType subscript` | Type | Add `if x is not None` check |
| `TypeError: not callable` | Type | Check for shadowed built-ins |
| `AttributeError: NoneType` | Attribute | Guard against None |
| `KeyError` | Dict | Use `.get()` with default |
| `IndexError` | List | Check `len()` first |
| `ValueError: int()` | Value | Use try/except |
| `FileNotFoundError` | File | Use `Path.exists()` check |
| `UnicodeDecodeError` | Encoding | Try `encoding='latin-1'` |
| `JSONDecodeError` | JSON | Check response content first |
| `RecursionError` | Recursion | Convert to iteration |
