---
name: n8n-validation-expert
description: Interpret n8n validation errors and guide fixing them. Activates when validation fails, debugging workflow errors, or handling false positives.
---

# n8n Validation Expert

## Validation Philosophy

**Validate early and often.** The validation chain prevents runtime failures:

```
validate_node(mode='minimal')  →  validate_node(mode='full')  →  validate_workflow()
```

Stop and fix ALL errors before moving to next level.

---

## The 4-Level Validation Chain

### Level 1 — Quick Check (before configuring)
```javascript
validate_node({nodeType: 'nodes-base.slack', config: {resource: 'message'}, mode: 'minimal'})
// Fast (<100ms), checks required fields only
```

### Level 2 — Comprehensive (before building workflow)
```javascript
validate_node({nodeType: 'nodes-base.slack', config: fullConfig, mode: 'full', profile: 'runtime'})
// Thorough, catches runtime failures, provides auto-fixes
```

### Level 3 — Workflow Structure (after building)
```javascript
validate_workflow(workflowJson)
// Checks connections, expressions, AI agent tools, overall integrity
```

### Level 4 — Post-Deployment (after deploying to n8n)
```javascript
n8n_validate_workflow({id: 'workflow-id'})
n8n_autofix_workflow({id: 'workflow-id'})  // Auto-fix common errors
```

---

## Validation Profiles

| Profile | When to Use | Strictness |
|---------|-------------|-----------|
| `minimal` | Quick required fields check | Lowest |
| `runtime` | Before building — catches runtime errors | **RECOMMENDED** |
| `ai-friendly` | AI-generated configs, flexible | Medium |
| `strict` | Production-ready, comprehensive | Highest |

---

## Error Severity Levels

### 1. Errors (MUST Fix — workflow will fail)
```json
{
  "type": "missing_required",
  "field": "resource",
  "message": "Resource is required for Slack node"
}
```

### 2. Warnings (Should Fix — may cause issues)
```json
{
  "type": "invalid_value", 
  "field": "channel",
  "message": "Channel format should start with #"
}
```

### 3. Suggestions (Optional — best practice)
```json
{
  "type": "suggestion",
  "message": "Consider adding error handling"
}
```

---

## Common Error Types & Fixes

### `missing_required`
```javascript
// Error: "Resource is required"
// Fix: Add the missing field
config.resource = "message"
config.operation = "post"
```

### `invalid_value`
```javascript
// Error: "Invalid operation for resource"
// Fix: Check allowed values with get_node
get_node({nodeType, mode: 'search_properties', propertyQuery: 'operation'})
```

### `type_mismatch`
```javascript
// Error: "Expected boolean, received string"
// Fix: Use correct type
config.returnAll = true   // ✅ boolean
config.returnAll = "true" // ❌ string
```

### `invalid_expression`
```javascript
// Error: "Invalid n8n expression"
// Fix: Check expression syntax
{{ $json.field }}     // ✅ correct
{ $json.field }       // ❌ missing braces
```

### `invalid_reference`
```javascript
// Error: "Node 'Fetch Data' not found"
// Fix: Match exact node name
{{ $node["Fetch Data"].json.id }}  // ✅ exact match
{{ $node["fetchdata"].json.id }}   // ❌ wrong case
```

---

## Auto-Sanitization System

The validator automatically fixes some issues:

### What It Fixes Automatically
- Extra whitespace in field names
- Case normalization for enum values  
- Empty string → null conversion for optional fields
- Boolean string → boolean conversion (`"true"` → `true`)

### What It CANNOT Fix
- Missing required fields (you must add them)
- Wrong node structure (you must restructure)
- Invalid expressions (you must correct syntax)
- Wrong credentials type

**Always re-validate after auto-sanitization to confirm fixes worked.**

---

## False Positives Guide

Some validation errors may be false positives:

### Common False Positives
1. **Dynamic fields** — Some fields are only required when another field has a specific value
2. **Credential validation** — Credential format errors when format is actually correct
3. **Expression fields** — Validator may flag expressions as invalid_value when they're valid

### Handling False Positives
```javascript
// Use ai-friendly profile for more flexible validation
validate_node({nodeType, config, mode: 'full', profile: 'ai-friendly'})

// Or check if it's truly required
get_node({nodeType, mode: 'search_properties', propertyQuery: 'theFieldName'})
```

---

## Validation Loop Pattern

```
1. Build initial config (minimal fields)
2. validate_node(mode: 'minimal')
   → If errors: fix them
3. Add more fields
4. validate_node(mode: 'full', profile: 'runtime')  
   → If errors: fix them, re-run
   → If warnings: review and fix important ones
5. Build complete workflow
6. validate_workflow(workflowJson)
   → If errors: fix connections/expressions
7. Deploy and test
```

---

## Workflow Validation Errors

### Connection Errors
```javascript
// Error: "Node X has no connections"
// Fix: Connect all node outputs to next node

// Error: "Node X output 1 not connected" (IF node)
// Fix: Connect both TRUE and FALSE outputs
```

### Expression Errors
```javascript
// Error: "Reference to unknown node: 'Old Node'"
// Fix: Update node name in expression or workflow
{{ $node["Old Node"].json.id }}  // ❌ node was renamed
{{ $node["New Name"].json.id }}  // ✅ use current name
```

### AI Agent Errors
```javascript
// Error: "AI Agent requires at least one language model"
// Fix: Connect LangChain LLM node to agent via ai_languageModel connection
```

---

## Recovery Strategies

### Strategy 1: Start Fresh
If too many validation errors, start with minimal config:
```javascript
// Start with just required fields
{resource: "message", operation: "post"}
// Validate → add fields → validate again
```

### Strategy 2: Binary Search
If unsure which field causes error:
```javascript
// Remove half the fields → validate
// If no error, problem was in removed half
// If still error, problem is in remaining half
// Repeat until found
```

### Strategy 3: Clean Stale Connections
```javascript
n8n_update_partial_workflow({
  id: "wf-id",
  operations: [{"type": "cleanStaleConnections"}]
})
```

### Strategy 4: Auto-Fix
```javascript
n8n_autofix_workflow({id: "wf-id"})
```

---

## Best Practices

### ✅ Do
- Run minimal validation first, then full
- Fix ALL errors before proceeding to next level
- Use `runtime` profile for most cases
- Re-validate after any config change

### ❌ Don't
- Skip validation and go straight to deployment
- Ignore warnings (they often become runtime errors)
- Assume a node is correctly configured without validating
- Use `strict` profile for initial development (too many false positives)
