---
name: n8n-code-python
description: Write Python code in n8n Code nodes with proper limitations awareness. Activates when writing Python in Code nodes, need to know Python limitations, or working with standard library only.
---

# Python Code Node (Beta)

## ⚠️ IMPORTANT: Use JavaScript for 95% of Use Cases

Python support in n8n is **beta** and has significant limitations. **Prefer JavaScript** unless:
- You specifically need Python syntax
- You're doing statistical calculations with standard library
- You have regex/text processing that's cleaner in Python

---

## Quick Start

```python
# Mode: "Run Once for All Items" (DEFAULT)
items = _input.all()

result = []
for item in items:
  data = item['json']
  result.append({
    'json': {
      'processedName': data.get('name', '').upper(),
      'count': len(data.get('items', []))
    }
  })

return result
```

---

## Essential Rules

1. **Use `_input`** (underscore), NOT `$input`
2. **Return format MUST be `[{'json': {...}}]`** — list of dicts with 'json' key
3. **No external libraries** — ONLY Python standard library
4. **Webhook data under `.body`** — `item['json']['body']['field']`
5. **Use `.get()` for dict access** — prevent KeyError crashes

---

## Data Access Patterns

### Pattern 1: `_input.all()` — Most Common
```python
items = _input.all()
# items = [{'json': {...}}, ...]

first_item = items[0]['json']
all_names = [i['json'].get('name') for i in items]
```

### Pattern 2: `_input.first()` — Single Item
```python
item = _input.first()
data = item['json']
value = data.get('fieldName', 'default')
```

### Pattern 3: `_input.item` — Each Item Mode Only
```python
# Only in "Run Once for Each Item" mode
data = _input.item['json']
return {'json': {'result': data.get('field')}}
```

### Pattern 4: `_node` — Reference Other Nodes
```python
node_data = _node['HTTP Request']['json']
all_from_node = _node['Fetch Users'].all()
```

---

## 🚨 CRITICAL: Webhook Data Structure

```python
items = _input.all()
data = items[0]['json']

# ❌ WRONG
message = data.get('message')  # Returns None for webhook data

# ✅ CORRECT — webhook data is nested under 'body'
message = data.get('body', {}).get('message')
email = data.get('body', {}).get('user', {}).get('email')
```

---

## Return Format Requirements

### ✅ Correct Return Formats
```python
# List of items (most common)
return [
  {'json': {'name': 'Alice', 'age': 30}},
  {'json': {'name': 'Bob', 'age': 25}}
]

# From list comprehension
return [{'json': {'value': item['json']['count'] * 2}} for item in items]

# Single item
return [{'json': {'result': 'done', 'total': total}}]
```

### ❌ Incorrect Return Formats
```python
# ❌ Missing list wrapper
return {'json': {'name': 'Alice'}}

# ❌ Missing 'json' key
return [{'name': 'Alice'}]

# ❌ Returning plain value
return "result"
return 42
```

---

## 🚫 CRITICAL: No External Libraries

```python
# ❌ NOT AVAILABLE — will crash immediately
import requests        # ❌
import pandas as pd    # ❌
import numpy as np     # ❌
import flask           # ❌
import boto3           # ❌
import pydantic        # ❌

# ✅ AVAILABLE — Python standard library only
import json
import datetime
import re
import math
import random
import collections
import itertools
import functools
import hashlib
import base64
import urllib.parse
import csv
import io
import os
import sys
```

### Workarounds for Missing Libraries

```python
# Instead of requests → Use HTTP Request node (before Code node)
# Instead of pandas → Use JavaScript code node
# Instead of numpy → Use math module + list comprehensions

# Math without numpy:
import math
average = sum(numbers) / len(numbers)
std_dev = math.sqrt(sum((x - average)**2 for x in numbers) / len(numbers))
```

---

## Common Patterns

### 1. Data Transformation
```python
items = _input.all()
return [{
  'json': {
    'id': item['json'].get('id'),
    'fullName': f"{item['json'].get('firstName', '')} {item['json'].get('lastName', '')}".strip(),
    'emailLower': item['json'].get('email', '').lower(),
    'processed': True
  }
} for item in items]
```

### 2. Filtering
```python
items = _input.all()
active_items = [item for item in items if item['json'].get('status') == 'active']
return [{'json': item['json']} for item in active_items]
```

### 3. Aggregation
```python
items = _input.all()
total = sum(item['json'].get('amount', 0) for item in items)
count = len(items)
return [{'json': {
  'total': total,
  'count': count,
  'average': total / count if count > 0 else 0
}}]
```

### 4. Regex Processing
```python
import re
items = _input.all()

email_pattern = re.compile(r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$')

return [{
  'json': {
    'email': item['json'].get('email'),
    'isValid': bool(email_pattern.match(item['json'].get('email', '')))
  }
} for item in items]
```

### 5. Date Processing
```python
from datetime import datetime, timedelta

items = _input.all()
result = []

for item in items:
  data = item['json']
  created_str = data.get('createdAt', '')
  
  try:
    created = datetime.fromisoformat(created_str.replace('Z', '+00:00'))
    age_days = (datetime.now(created.tzinfo) - created).days
    result.append({'json': {**data, 'ageDays': age_days}})
  except (ValueError, AttributeError):
    result.append({'json': {**data, 'ageDays': -1}})

return result
```

---

## Top 5 Python-Specific Mistakes

### #1: Importing External Libraries
```python
# ❌ CRASHES immediately
import requests
response = requests.get("https://api.example.com")

# ✅ Use HTTP Request node before this Code node
# Then access: _input.first()['json']
```

### #2: Missing Return
```python
# ❌ Returns nothing (None)
items = _input.all()
processed = [{'json': item['json']} for item in items]
# forgot return!

# ✅ Add return
return processed
```

### #3: Wrong Return Format
```python
# ❌ Missing list wrapper
return {'json': {'result': 'done'}}

# ✅ Correct
return [{'json': {'result': 'done'}}]
```

### #4: KeyError on Dict Access
```python
# ❌ Crashes if key missing
name = item['json']['user']['name']

# ✅ Safe access
name = item['json'].get('user', {}).get('name', 'Unknown')
```

### #5: Webhook Body Nesting
```python
# ❌ Returns None
message = _input.first()['json'].get('message')

# ✅ Correct
message = _input.first()['json'].get('body', {}).get('message')
```

---

## Standard Library Reference

```python
# JSON processing
import json
data = json.loads(json_string)
string = json.dumps(data, indent=2)

# Date/time
from datetime import datetime, timedelta, date
now = datetime.now()
formatted = now.strftime('%Y-%m-%d %H:%M:%S')

# Regular expressions
import re
matches = re.findall(r'\d+', text)
cleaned = re.sub(r'[^a-zA-Z0-9]', '', text)

# Math
import math
sqrt = math.sqrt(16)        # 4.0
rounded = round(3.14159, 2) # 3.14

# Collections
from collections import Counter, defaultdict
counts = Counter(['a', 'b', 'a', 'c', 'a'])  # Counter({'a': 3, 'b': 1, 'c': 1})

# URL encoding
from urllib.parse import urlencode, quote
params = urlencode({'name': 'John Doe', 'age': 30})

# Base64
import base64
encoded = base64.b64encode(b"hello").decode()
decoded = base64.b64decode(encoded).decode()

# Hashing
import hashlib
md5 = hashlib.md5(b"data").hexdigest()
sha256 = hashlib.sha256(b"data").hexdigest()
```

---

## Use Python vs JavaScript Decision

| Scenario | Language |
|----------|---------|
| Complex regex text processing | Either (Python may be cleaner) |
| Statistical calculations | Python (if no numpy needed) |
| HTTP requests inside code | JavaScript (`$helpers.httpRequest`) |
| Complex data transformation | JavaScript |
| External library needed | JavaScript |
| Simple data aggregation | Either |
| Date manipulation | JavaScript (Luxon is easier) |
| Most n8n use cases | **JavaScript** |
