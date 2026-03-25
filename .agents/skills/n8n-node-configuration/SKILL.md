---
name: n8n-node-configuration
description: Operation-aware node configuration guidance. Activates when configuring nodes, understanding property dependencies, setting up AI workflows, or when properties depend on other properties.
---

# n8n Node Configuration

## Configuration Philosophy

**Every node parameter has dependencies.** The cardinal rule: **NEVER trust default values** — they are the #1 cause of runtime failures. Always explicitly configure every parameter that controls node behavior.

---

## Core Concepts

### 1. Operation-Aware Configuration
Most nodes have a `resource` + `operation` structure that changes which fields are required:

```
Slack Node:
  resource: "message"
  operation: "post"   → requires: channel, text
  operation: "get"    → requires: channel, timestamp
  
  resource: "file"
  operation: "upload" → requires: channels, filename, fileContent
```

**Always set resource and operation FIRST, then configure remaining fields.**

### 2. Property Dependencies (`displayOptions`)
Properties only appear/matter when other properties have specific values:

```javascript
// sendBody only appears when method is POST/PUT/PATCH
httpRequest:
  method: "POST"     → sendBody becomes relevant
  sendBody: true     → contentType becomes relevant
  contentType: "json" → body becomes relevant
```

**If `sendBody` is not `true`, setting `body` has no effect.**

### 3. Progressive Discovery
Don't configure all fields at once:
1. Set `resource` + `operation`
2. Validate → see what's required
3. Add required fields
4. Validate again → add optional fields
5. Final validation

---

## get_node Detail Levels

### Standard Detail (DEFAULT — Use This!)
```javascript
get_node({nodeType: 'n8n-nodes-base.slack', detail: 'standard', includeExamples: true})
// ~500-1500 tokens, covers 90% of use cases
```

### Full Detail (Use Sparingly)
```javascript
get_node({nodeType: 'n8n-nodes-base.slack', detail: 'full'})
// ~3000-8000 tokens, only when standard isn't enough
```

### Search Properties Mode
```javascript
// Find specific property and its dependencies
get_node({nodeType: 'n8n-nodes-base.httpRequest', mode: 'search_properties', propertyQuery: 'auth'})
get_node({nodeType: 'n8n-nodes-base.slack', mode: 'search_properties', propertyQuery: 'channel'})
```

### Decision Tree
```
Need node info?
├── Standard case → detail: 'standard', includeExamples: true
├── Specific property unclear → mode: 'search_properties'
├── Human-readable docs → mode: 'docs'
└── Need everything → detail: 'full' (avoid if possible)
```

---

## Common Node Patterns

### Pattern 1: Resource/Operation Nodes
(Slack, Airtable, Google Sheets, HubSpot, etc.)

```javascript
{
  resource: "message",     // MUST SET FIRST
  operation: "post",       // MUST SET SECOND
  // Now set operation-specific fields
  select: "channel",       // How to specify channel
  channelId: "C123456",    // Channel ID
  text: "Hello!"           // Message content
}
```

### Pattern 2: HTTP-Based Nodes
```javascript
{
  method: "POST",          // GET/POST/PUT/PATCH/DELETE
  url: "https://api.example.com/endpoint",
  authentication: "genericCredentialType",
  genericAuthType: "httpBearerAuth",
  sendBody: true,          // REQUIRED to enable body
  contentType: "json",     // REQUIRED when sendBody=true
  body: {                  // REQUIRED when contentType=json
    key: "value"
  },
  // Response handling
  responseFormat: "json"
}
```

### Pattern 3: Database Nodes (Postgres, MySQL)
```javascript
{
  operation: "executeQuery",  // Or: insert, update, delete, select
  query: "SELECT * FROM users WHERE id = $1",
  additionalFields: {
    queryParams: "[userId]"  // Parameterized queries
  }
}
```

### Pattern 4: Conditional Logic (IF Node)
```javascript
{
  conditions: {
    options: {
      caseSensitive: false,
      leftValue: "",
      typeValidation: "strict"
    },
    conditions: [{
      leftValue: "={{ $json.status }}",
      rightValue: "active",
      operator: {
        type: "string",
        operation: "equals"
      }
    }],
    combinator: "and"  // 'and' or 'or'
  }
}
```

---

## Operation-Specific Configuration Examples

### Slack — Post Message
```javascript
{
  resource: "message",
  operation: "post",
  select: "channel",      // 'channel' or 'user'
  channelId: {
    __rl: true,
    value: "C1234567890",
    mode: "id"
  },
  text: "Hello from n8n!",
  // Optional:
  username: "n8n Bot",
  blocks: []
}
```

### HTTP Request — POST with JSON
```javascript
{
  method: "POST",
  url: "https://api.example.com/data",
  sendHeaders: true,
  headerParameters: {
    parameters: [{
      name: "Authorization",
      value: "Bearer {{ $env.API_KEY }}"
    }]
  },
  sendBody: true,
  contentType: "json",
  body: {
    name: "={{ $json.name }}",
    email: "={{ $json.email }}"
  }
}
```

### Schedule Trigger — Every Monday 9am
```javascript
{
  rule: {
    interval: [{
      field: "cronExpression",
      expression: "0 9 * * 1"  // At 09:00 on Monday
    }]
  }
}
```

---

## AI Workflow Configuration

### AI Agent Node
```javascript
{
  agent: "conversationalAgent",  // or: 'openAiFunctionsAgent', 'reActAgent', 'planAndExecuteAgent'
  promptType: "auto",            // 'auto' or 'define'
  options: {
    maxIterations: 10,
    returnIntermediateSteps: false
  }
}
```

### AI Connection Types (8 types)
```
ai_languageModel    → Connect LLM (required)
ai_memory           → Connect memory buffer
ai_tool             → Connect tools (any node can be a tool!)
ai_outputParser     → Connect output parser
ai_vectorStore      → Connect vector database
ai_retriever        → Connect document retriever
ai_textSplitter     → Connect text splitter
ai_document         → Connect document loader
```

**IMPORTANT:** ANY n8n node can be used as an AI tool — not just nodes marked as "AI tools".

---

## Handling Conditional Requirements

### Example: HTTP Request Body
```javascript
// Step 1: Set method
{method: "POST"}

// Step 2: Enable body (required for POST)
{method: "POST", sendBody: true}

// Step 3: Set content type (required when sendBody=true)
{method: "POST", sendBody: true, contentType: "json"}

// Step 4: Set body content (required when contentType=json)
{method: "POST", sendBody: true, contentType: "json", body: {...}}
```

### Example: IF Node with singleValue  
```javascript
// For simple comparisons, use string operator with conditions
{
  conditions: {
    conditions: [{
      leftValue: "={{ $json.count }}",
      rightValue: 10,
      operator: {type: "number", operation: "larger"}
    }]
  }
}
```

---

## Best Practices

### ✅ Do
- Set `resource` and `operation` before any other field
- Use `includeExamples: true` in `get_node` — real examples from templates
- Configure ALL parameters that affect behavior explicitly
- Use `mode: 'search_properties'` when a specific property behavior is unclear
- Validate after each major configuration change

### ❌ Don't
- Assume defaults will work (they won't in production)
- Configure fields without first checking their dependencies
- Use `detail: 'full'` when `detail: 'standard'` suffices
- Set body fields without first enabling `sendBody: true`
- Ignore operation-specific required fields
