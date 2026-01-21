# Node Discovery Tools Guide

Complete guide for finding and understanding n8n nodes.

---

## search_nodes (START HERE!)

**Success Rate**: 99.9% | **Speed**: <20ms

**Use when**: You know what you're looking for (keyword, service, use case)

**Syntax**:
```javascript
search_nodes({
  query: "slack",      // Required: search keywords
  mode: "OR",          // Optional: OR (default), AND, FUZZY
  limit: 20           // Optional: max results (default 20, max 100)
})
```

**Returns**:
```javascript
{
  "query": "slack",
  "results": [
    {
      "nodeType": "nodes-base.slack",                    // For search/validate tools
      "workflowNodeType": "n8n-nodes-base.slack",       // For workflow tools
      "displayName": "Slack",
      "description": "Consume Slack API",
      "category": "output",
      "relevance": "high"
    }
  ]
}
```

**Tips**:
- Common searches: webhook, http, database, email, slack, google, ai
- OR mode (default): matches any word
- AND mode: requires all words
- FUZZY mode: typo-tolerant (finds "slak" → Slack)

---

## get_node_essentials (RECOMMENDED!)

**Success Rate**: 91.7% | **Speed**: <10ms | **Size**: ~5KB

**Use when**: You've found the node and need configuration details

**Syntax**:
```javascript
get_node_essentials({
  nodeType: "nodes-base.slack",      // Required: SHORT prefix format
  includeExamples: true              // Optional: get real template configs
})
```

**Returns**:
- Available operations and resources
- Essential properties (10-20 most common)
- Metadata (isAITool, isTrigger, hasCredentials)
- Real examples from templates (if includeExamples: true)

**Why use this**:
- 5KB vs 100KB+ (get_node_info)
- 91.7% success vs 80%
- <10ms vs slower
- Focused data (no information overload)

---

## get_node_info (USE SPARINGLY!)

**Success Rate**: 80% ⚠️ | **Size**: 100KB+

**Use when**:
- Debugging complex configuration
- Need complete property schema
- Exploring advanced features

**Syntax**:
```javascript
get_node_info({
  nodeType: "nodes-base.httpRequest"
})
```

**Warning**: 20% failure rate! Use get_node_essentials instead for most cases.

**Better alternatives**:
1. get_node_essentials - operations list
2. get_node_documentation - readable docs
3. search_node_properties - specific property

---

## list_nodes (BROWSE BY CATEGORY)

**Success Rate**: 99.6% | **Speed**: <20ms

**Use when**: Exploring by category or listing all nodes

**Syntax**:
```javascript
list_nodes({
  category: "trigger",        // Optional: filter by category
  package: "n8n-nodes-base", // Optional: filter by package
  limit: 200                 // Optional: default 50
})
```

**Categories**:
- `trigger` - Webhook, Schedule, Manual, etc. (108 total)
- `transform` - Code, Set, Function, etc.
- `output` - HTTP Request, Email, Slack, etc.
- `input` - Read data sources
- `AI` - AI-capable nodes (270 total)

**Packages**:
- `n8n-nodes-base` - Core nodes (437 total)
- `@n8n/n8n-nodes-langchain` - AI nodes (100 total)

---

## search_node_properties (FIND SPECIFIC FIELDS)

**Use when**: Looking for specific property in a node

**Syntax**:
```javascript
search_node_properties({
  nodeType: "nodes-base.httpRequest",
  query: "auth"               // Find authentication properties
})
```

**Returns**: Property paths and descriptions matching query

**Common searches**: auth, header, body, json, url, method

---

## get_node_documentation (READABLE DOCS)

**Coverage**: 88% of nodes (470/537)

**Use when**: Need human-readable documentation with examples

**Syntax**:
```javascript
get_node_documentation({
  nodeType: "nodes-base.slack"
})
```

**Returns**: Formatted docs with:
- Usage examples
- Authentication guide
- Common patterns
- Best practices

**Note**: Better than raw schema for learning!

---

## Common Workflow: Finding & Configuring

```
Step 1: Search
search_nodes({query: "slack"})
→ Returns: nodes-base.slack

Step 2: Get Operations (18s avg thinking time)
get_node_essentials({
  nodeType: "nodes-base.slack",
  includeExamples: true
})
→ Returns: operations list + example configs

Step 3: Validate Config
validate_node_operation({
  nodeType: "nodes-base.slack",
  config: {resource: "channel", operation: "create"},
  profile: "runtime"
})
→ Returns: validation result

Step 4: Use in Workflow
(Configuration ready!)
```

**Most common pattern**: search → essentials (18s average)

---

## Quick Comparison

| Tool | When to Use | Success | Speed | Size |
|------|-------------|---------|-------|------|
| search_nodes | Find by keyword | 99.9% | <20ms | Small |
| get_node_essentials | Get config | 91.7% | <10ms | 5KB |
| get_node_info | Full schema | 80% ⚠️ | Slow | 100KB+ |
| list_nodes | Browse category | 99.6% | <20ms | Small |
| get_node_documentation | Learn usage | N/A | Fast | Medium |

**Best Practice**: search → essentials → validate

---

## nodeType Format (CRITICAL!)

**Search/Validate Tools** (SHORT prefix):
```javascript
"nodes-base.slack"
"nodes-base.httpRequest"
"nodes-langchain.agent"
```

**Workflow Tools** (FULL prefix):
```javascript
"n8n-nodes-base.slack"
"n8n-nodes-base.httpRequest"
"@n8n/n8n-nodes-langchain.agent"
```

**Conversion**: search_nodes returns BOTH formats:
```javascript
{
  "nodeType": "nodes-base.slack",          // Use with essentials
  "workflowNodeType": "n8n-nodes-base.slack"  // Use with create_workflow
}
```

---

## Related

- [VALIDATION_GUIDE.md](VALIDATION_GUIDE.md) - Validate node configs
- [WORKFLOW_GUIDE.md](WORKFLOW_GUIDE.md) - Use nodes in workflows
