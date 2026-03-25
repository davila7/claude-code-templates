---
name: n8n-code-javascript
description: Write effective JavaScript code in n8n Code nodes. Activates when writing JavaScript in Code nodes, troubleshooting Code node errors, making HTTP requests with $helpers, or working with dates.
---

# JavaScript Code Node

## Quick Start

```javascript
// Mode: "Run Once for All Items" (DEFAULT - use this)
const items = $input.all();

const results = items.map(item => {
  return {
    json: {
      // Your output data here
      processedName: item.json.name.toUpperCase(),
      timestamp: new Date().toISOString()
    }
  };
});

return results;
```

---

## Essential Rules

1. **Mode: "Run Once for All Items"** — Most efficient, processes all items in one execution
2. **Return format MUST be `[{json: {...}}]`** — Array of objects with `json` key
3. **Use `$input.all()`** — Always access input data this way
4. **Webhook data is under `.body`** — `item.json.body.field` not `item.json.field`

---

## Mode Selection Guide

### Run Once for All Items (Recommended — Default)
```javascript
// Access all items
const items = $input.all();

// Process and return all
return items.map(item => ({
  json: { result: item.json.field }
}));
```
**Use when:** Processing multiple items, aggregating, filtering, transforming batch data.

### Run Once for Each Item
```javascript
// Runs separately for each item
const item = $input.item;
return {
  json: { result: item.json.field }
};
```
**Use when:** Simple per-item operations where you need `$input.item`.

---

## Data Access Patterns

### Pattern 1: `$input.all()` — Most Common
```javascript
const items = $input.all();
// items = [{json: {...}, binary: {...}}, ...]

const first = items[0].json;
const allNames = items.map(i => i.json.name);
```

### Pattern 2: `$input.first()` — Very Common
```javascript
const item = $input.first();
const data = item.json;
// Access: data.fieldName
```

### Pattern 3: `$input.item` — Each Item Mode Only
```javascript
// Only works in "Run Once for Each Item" mode
const data = $input.item.json;
return { json: { result: data.field } };
```

### Pattern 4: `$node` — Reference Other Nodes
```javascript
const nodeData = $node["HTTP Request"].json;
const allFromNode = $node["Fetch Users"].all();
```

---

## 🚨 CRITICAL: Webhook Data Structure

```javascript
const items = $input.all();
const item = items[0].json;

// ❌ WRONG — properties are undefined
const message = item.message;

// ✅ CORRECT — webhook data is under .body
const message = item.body.message;
const email = item.body.user.email;

// Other webhook properties
const headers = item.headers;
const query = item.query;
```

---

## Return Format Requirements

### ✅ Correct Return Formats

```javascript
// Array of items (most common)
return [
  { json: { name: "Alice", age: 30 } },
  { json: { name: "Bob", age: 25 } }
];

// Single item
return [{ json: { result: "done", count: 42 } }];

// From .map()
return items.map(item => ({
  json: { processed: item.json.value * 2 }
}));
```

### ❌ Incorrect Return Formats
```javascript
// ❌ Missing array wrapper
return { json: { name: "Alice" } };

// ❌ Missing json key
return [{ name: "Alice" }];

// ❌ Returning plain values
return "result";
return 42;
return items[0].json;  // Returns the json object, not array
```

---

## Common Patterns

### 1. Filter Items
```javascript
const items = $input.all();
const filtered = items.filter(item => item.json.status === 'active');
return filtered.map(item => ({ json: item.json }));
```

### 2. Transform Data
```javascript
const items = $input.all();
return items.map(item => ({
  json: {
    id: item.json.id,
    fullName: `${item.json.firstName} ${item.json.lastName}`,
    emailLower: item.json.email.toLowerCase(),
    createdAt: new Date(item.json.timestamp).toISOString()
  }
}));
```

### 3. Aggregate/Sum
```javascript
const items = $input.all();
const total = items.reduce((sum, item) => sum + item.json.amount, 0);
const count = items.length;
return [{ json: { total, count, average: total / count } }];
```

### 4. Merge Data from Multiple Nodes
```javascript
const users = $node["Get Users"].all();
const orders = $input.all();

return orders.map(order => {
  const user = users.find(u => u.json.id === order.json.userId);
  return {
    json: {
      ...order.json,
      userName: user?.json.name ?? 'Unknown'
    }
  };
});
```

### 5. Error-Safe Processing
```javascript
const items = $input.all();
return items.map(item => {
  try {
    const data = item.json;
    return {
      json: {
        result: data.value * 2,
        success: true
      }
    };
  } catch (error) {
    return {
      json: {
        error: error.message,
        success: false,
        originalData: item.json
      }
    };
  }
});
```

---

## Top 5 Error Patterns & Solutions

### #1: Missing Return — Most Common
```javascript
// ❌ WRONG — no return statement
const items = $input.all();
items.map(i => ({ json: i.json }));

// ✅ CORRECT
return $input.all().map(i => ({ json: i.json }));
```

### #2: Expression Confusion
```javascript
// ❌ WRONG — expressions don't work in code nodes
const name = {{ $json.name }};

// ✅ CORRECT — plain JavaScript
const name = $input.first().json.name;
```

### #3: Wrong Return Wrapper
```javascript
// ❌ WRONG
return { json: { result: "done" } };

// ✅ CORRECT
return [{ json: { result: "done" } }];
```

### #4: Missing Null Checks
```javascript
// ❌ WRONG — crashes if user or user.email is undefined
const email = items[0].json.user.email;

// ✅ CORRECT — safe access
const email = items[0]?.json?.user?.email ?? 'no-email';
```

### #5: Webhook Body Nesting
```javascript
// ❌ WRONG
const msg = $input.first().json.message;

// ✅ CORRECT
const msg = $input.first().json.body.message;
```

---

## Built-in Functions & Helpers

### `$helpers.httpRequest()` — HTTP calls inside Code node
```javascript
const response = await $helpers.httpRequest({
  method: 'GET',
  url: 'https://api.example.com/data',
  headers: { 'Authorization': 'Bearer ' + $env.API_KEY }
});
return [{ json: response }];
```

### DateTime (Luxon) — Date operations
```javascript
const { DateTime } = require('luxon');

const now = DateTime.now();
const formatted = now.toFormat('yyyy-MM-dd HH:mm:ss');
const nextWeek = now.plus({ days: 7 }).toISO();
const fromString = DateTime.fromISO(item.json.dateField);
```

### `$jmespath()` — JSON querying
```javascript
// Extract specific fields from complex JSON
const emails = $jmespath($input.first().json, 'users[*].email');
const active = $jmespath($input.first().json, 'users[?status==`active`]');
```

---

## When to Use Code Node

**Use Code node ONLY when standard nodes can't do it:**
- Complex data transformation requiring custom logic
- Multiple data source aggregation
- Custom string/math operations not available in Set node
- Regex operations

**Don't use Code node for:**
- Simple field mapping → Use Set node
- Basic HTTP requests → Use HTTP Request node
- Conditional logic → Use IF node
- Data filtering → Use Filter node

---

## Best Practices

1. **Always validate input** — Check `items.length > 0` before processing
2. **Use try-catch** — Wrap processing in try-catch for error handling
3. **Prefer array methods** — `.map()`, `.filter()`, `.reduce()` over loops
4. **Debug with console.log()** — Visible in n8n execution logs
5. **Return consistent structure** — Same keys in all returned items
