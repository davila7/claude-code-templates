---
name: n8n-expression-syntax
description: Teaches correct n8n expression syntax and common patterns. Activates when writing expressions, using {{}} syntax, accessing $json/$node variables, or troubleshooting expression errors.
---

# n8n Expression Syntax

## Expression Format

All n8n expressions use double curly braces:
```
{{ expression }}
```

Expressions work in **node parameter fields** — NOT in Code nodes (those use plain JavaScript).

---

## Core Variables

### `$json` — Current Node Output
```javascript
{{ $json.fieldName }}              // Access field
{{ $json.nested.field }}           // Nested field
{{ $json["field with spaces"] }}   // Field with spaces
{{ $json.items[0].name }}          // Array first item
{{ $json.items.length }}           // Array length
```

### `$node` — Reference Other Nodes
```javascript
{{ $node["Node Name"].json.field }}        // Node output
{{ $node["HTTP Request"].json.statusCode }} // Specific node field
{{ $node["Set"].json.myVariable }}          // Variable set earlier
```

### `$now` — Current Timestamp
```javascript
{{ $now }}                              // ISO timestamp
{{ $now.toFormat('yyyy-MM-dd') }}       // Formatted date
{{ $now.plus({days: 7}).toISO() }}      // Future date
{{ $now.minus({hours: 2}).toISO() }}    // Past time
```

### `$env` — Environment Variables
```javascript
{{ $env.MY_API_KEY }}       // Access env var
{{ $env.BASE_URL }}         // Base URL from env
```

---

## 🚨 CRITICAL: Webhook Data Structure

**Webhook data is NOT directly in `$json`! It's nested under `$json.body`:**

```javascript
// ❌ WRONG — field is undefined
{{ $json.message }}

// ✅ CORRECT — webhook data is under .body
{{ $json.body.message }}
{{ $json.body.user.email }}
{{ $json.body.data[0].id }}
```

**Webhook node output structure:**
```json
{
  "headers": { "content-type": "application/json" },
  "params": {},
  "query": { "page": "1" },
  "body": {
    "message": "Hello",
    "user": { "email": "test@example.com" }
  }
}
```

**Other webhook properties:**
```javascript
{{ $json.headers["content-type"] }}  // Request headers
{{ $json.query.page }}               // Query parameters
{{ $json.params.userId }}            // URL parameters
```

---

## Common Patterns

### Access Nested Fields
```javascript
{{ $json.user.profile.firstName }}
{{ $json.data[0].title }}
{{ $json.metadata?.tags?.join(', ') }}  // Optional chaining
```

### Reference Other Nodes
```javascript
{{ $node["Fetch User"].json.userId }}
{{ $node["HTTP Request"].json.data.items[0].name }}
```

### Combine Variables
```javascript
Hello {{ $json.firstName }} {{ $json.lastName }}!
Order #{{ $json.orderId }} placed on {{ $now.toFormat('MMM dd, yyyy') }}
{{ $json.firstName }}'s email: {{ $node["Get User"].json.email }}
```

### Conditional Content
```javascript
{{ $json.status === 'active' ? 'Active User' : 'Inactive User' }}
{{ $json.count > 0 ? $json.count + ' items' : 'No items' }}
```

### String Operations
```javascript
{{ $json.name.toLowerCase() }}
{{ $json.text.replace('old', 'new') }}
{{ $json.tags.join(', ') }}
{{ $json.fullName.split(' ')[0] }}  // First name
```

### Date Manipulation
```javascript
{{ $now.toFormat('yyyy-MM-dd HH:mm:ss') }}
{{ DateTime.fromISO($json.createdAt).toFormat('MMM dd, yyyy') }}
{{ $now.plus({days: 30}).toISO() }}
```

### Number Operations
```javascript
{{ ($json.price * 1.1).toFixed(2) }}   // 10% markup
{{ Math.round($json.score) }}
{{ parseInt($json.count) + 1 }}
```

---

## When NOT to Use Expressions

### ❌ Code Nodes
```javascript
// WRONG: expressions don't work in code nodes
const name = {{ $json.name }}  // ❌ Syntax error!

// CORRECT: use JavaScript directly
const name = $input.first().json.name;  // ✅
```

### ❌ Webhook URL Paths
```
// WRONG: expression in webhook path
/webhook/{{ $json.userId }}  // ❌

// CORRECT: use static path
/webhook/my-trigger  // ✅
```

### ❌ Credential Fields
Credentials cannot use expressions for security reasons.

---

## Validation Rules

1. **Always wrap in `{{}}`** — `{{ $json.field }}` not `$json.field`
2. **Use quotes for field names with spaces** — `$json["my field"]`
3. **Match EXACT node names** — `$node["Fetch Data"]` must match node name exactly  
4. **No nested `{{}}`** — `{{ "{{nested}}" }}` ❌ — use concatenation instead

---

## Common Mistakes

| Mistake | Fix |
|---------|-----|
| `$json.message` (webhook) | `$json.body.message` |
| `{{ $json.field }}` in Code node | `$input.first().json.field` |
| `$node["wrong name"]` | Match exact node name with correct case |
| Nested `{{ {{ }} }}` | Use string concatenation |
| `$json.field` without `{{}}` | `{{ $json.field }}` |

---

## Data Type Handling

```javascript
// Arrays
{{ $json.items.length }}           // Array length
{{ $json.tags.join(', ') }}        // Join to string
{{ $json.numbers.reduce((a,b) => a+b, 0) }}  // Sum

// Objects  
{{ Object.keys($json.data).join(', ') }}  // Get keys
{{ JSON.stringify($json.obj) }}            // To JSON string

// Strings
{{ $json.text.trim() }}
{{ $json.name.toUpperCase() }}

// Numbers
{{ parseFloat($json.price).toFixed(2) }}
{{ Math.max(...$json.scores) }}
```

---

## Best Practices

### ✅ Do
- Always use `{{ }}` wrapper
- Use optional chaining (`?.`) for potentially undefined fields
- Test expressions in n8n's Expression Editor before using
- Access webhook data via `$json.body`

### ❌ Don't
- Use expressions inside Code nodes
- Mix expression and non-expression syntax
- Nest `{{ }}` inside each other
- Assume field names are case-insensitive
