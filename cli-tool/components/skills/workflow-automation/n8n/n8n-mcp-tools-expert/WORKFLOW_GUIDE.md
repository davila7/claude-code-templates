# Workflow Management Tools Guide

Complete guide for creating, updating, and managing n8n workflows.

---

## Tool Availability

**⚠️ Requires n8n API**: All tools in this guide need `N8N_API_URL` and `N8N_API_KEY` configured.

If unavailable, use template examples and validation-only workflows.

---

## n8n_create_workflow

**Success Rate**: 96.8% | **Speed**: 100-500ms

**Use when**: Creating new workflows from scratch

**Syntax**:
```javascript
n8n_create_workflow({
  name: "Webhook to Slack",  // Required
  nodes: [...],              // Required: array of nodes
  connections: {...},        // Required: connections object
  settings: {...}            // Optional: workflow settings
})
```

**Returns**: Created workflow with ID

**Example**:
```javascript
n8n_create_workflow({
  name: "Webhook to Slack",
  nodes: [
    {
      id: "webhook-1",
      name: "Webhook",
      type: "n8n-nodes-base.webhook",  // Full prefix!
      typeVersion: 1,
      position: [250, 300],
      parameters: {
        path: "slack-notify",
        httpMethod: "POST"
      }
    },
    {
      id: "slack-1",
      name: "Slack",
      type: "n8n-nodes-base.slack",
      typeVersion: 1,
      position: [450, 300],
      parameters: {
        resource: "message",
        operation: "post",
        channel: "#general",
        text: "={{$json.body.message}}"
      }
    }
  ],
  connections: {
    "Webhook": {
      "main": [[{node: "Slack", type: "main", index: 0}]]
    }
  }
})
```

**Notes**:
- Workflows created **inactive** (must activate separately)
- Auto-sanitization runs on creation
- Validate before creating for best results

---

## n8n_update_partial_workflow (MOST USED!)

**Success Rate**: 99.0% | **Speed**: 50-200ms | **Uses**: 38,287 (most used tool!)

**Use when**: Making incremental changes to workflows

**Common pattern**: 56s average between edits (iterative building!)

### 15 Operation Types

**Node Operations** (6 types):
1. `addNode` - Add new node
2. `removeNode` - Remove node by ID or name
3. `updateNode` - Update node properties
4. `moveNode` - Change position
5. `enableNode` - Enable disabled node
6. `disableNode` - Disable active node

**Connection Operations** (5 types):
7. `addConnection` - Connect nodes
8. `removeConnection` - Remove connection
9. `rewireConnection` - Change target
10. `cleanStaleConnections` - Auto-remove broken connections
11. `replaceConnections` - Replace entire connections object

**Metadata Operations** (4 types):
12. `updateSettings` - Workflow settings
13. `updateName` - Rename workflow
14. `addTag` - Add tag
15. `removeTag` - Remove tag

### Smart Parameters (NEW!)

**IF nodes** - Use semantic branch names:
```javascript
{
  type: "addConnection",
  source: "IF",
  target: "True Handler",
  branch: "true"  // Instead of sourceIndex: 0
}

{
  type: "addConnection",
  source: "IF",
  target: "False Handler",
  branch: "false"  // Instead of sourceIndex: 1
}
```

**Switch nodes** - Use semantic case numbers:
```javascript
{
  type: "addConnection",
  source: "Switch",
  target: "Handler A",
  case: 0
}

{
  type: "addConnection",
  source: "Switch",
  target: "Handler B",
  case: 1
}
```

### AI Connection Types (8 types)

**Full support** for AI workflows:

```javascript
// Language Model
{
  type: "addConnection",
  source: "OpenAI Chat Model",
  target: "AI Agent",
  sourceOutput: "ai_languageModel"
}

// Tool
{
  type: "addConnection",
  source: "HTTP Request Tool",
  target: "AI Agent",
  sourceOutput: "ai_tool"
}

// Memory
{
  type: "addConnection",
  source: "Window Buffer Memory",
  target: "AI Agent",
  sourceOutput: "ai_memory"
}

// All 8 types:
// - ai_languageModel
// - ai_tool
// - ai_memory
// - ai_outputParser
// - ai_embedding
// - ai_vectorStore
// - ai_document
// - ai_textSplitter
```

### Example Usage

```javascript
n8n_update_partial_workflow({
  id: "workflow-id",
  operations: [
    // Add node
    {
      type: "addNode",
      node: {
        name: "Transform",
        type: "n8n-nodes-base.set",
        position: [400, 300],
        parameters: {}
      }
    },
    // Connect it (smart parameter)
    {
      type: "addConnection",
      source: "IF",
      target: "Transform",
      branch: "true"  // Clear and semantic!
    }
  ]
})
```

### Cleanup & Recovery

**cleanStaleConnections** - Remove broken connections:
```javascript
{
  type: "cleanStaleConnections"
}
```

**Best-effort mode** - Apply what works:
```javascript
n8n_update_partial_workflow({
  id: "workflow-id",
  operations: [...],
  continueOnError: true  // Don't fail if some operations fail
})
```

---

## n8n_validate_workflow (by ID)

**Success Rate**: 99.7% | **Speed**: Network-dependent

**Use when**: Validating workflow stored in n8n

**Syntax**:
```javascript
n8n_validate_workflow({
  id: "workflow-id",
  options: {
    validateNodes: true,
    validateConnections: true,
    validateExpressions: true,
    profile: "runtime"
  }
})
```

**Returns**: Same as validate_workflow (from validation guide)

---

## Workflow Lifecycle

**Standard pattern**:
```
1. CREATE
   n8n_create_workflow({...})
   → Returns workflow ID

2. VALIDATE
   n8n_validate_workflow({id})
   → Check for errors

3. EDIT (iterative! 56s avg between edits)
   n8n_update_partial_workflow({id, operations: [...]})
   → Make changes

4. VALIDATE AGAIN
   n8n_validate_workflow({id})
   → Verify changes

5. ACTIVATE (when ready)
   ⚠️ **IMPORTANT LIMITATION**: Workflow activation is NOT supported via API or MCP.
   Users must activate workflows manually in the n8n UI.

   The following operation will NOT activate the workflow:
   n8n_update_partial_workflow({id, operations: [{
     type: "updateSettings",
     settings: {active: true}
   }]})

   **Manual activation required**: Navigate to workflow in n8n UI and toggle activation.

6. MONITOR
   n8n_list_executions({workflowId: id})
   n8n_get_execution({id: execution_id})
```

**Deployment Note**: After creating and validating workflows via MCP, inform users they must:
1. Open the workflow in n8n UI (provide workflow ID)
2. Review the workflow configuration
3. Manually activate the workflow using the activation toggle

---

## Common Patterns from Telemetry

### Pattern 1: Edit → Validate (7,841 occurrences)

```javascript
// Edit
n8n_update_partial_workflow({...})
// ↓ 23s (thinking about what to validate)
// Validate
n8n_validate_workflow({id})
```

### Pattern 2: Validate → Fix (7,266 occurrences)

```javascript
// Validate
n8n_validate_workflow({id})
// ↓ 58s (fixing errors)
// Fix
n8n_update_partial_workflow({...})
```

### Pattern 3: Iterative Building (31,464 occurrences)

```javascript
update → update → update → ... (56s avg between edits)
```

**This shows**: Workflows are built **iteratively**, not in one shot!

---

## Retrieval Tools

### n8n_get_workflow
```javascript
n8n_get_workflow({id: "workflow-id"})
// Returns: Complete workflow JSON
```

### n8n_get_workflow_structure
```javascript
n8n_get_workflow_structure({id: "workflow-id"})
// Returns: Nodes + connections only (no parameters)
```

### n8n_get_workflow_minimal
```javascript
n8n_get_workflow_minimal({id: "workflow-id"})
// Returns: ID, name, active, tags only (fast!)
```

### n8n_list_workflows
```javascript
n8n_list_workflows({
  active: true,  // Optional: filter by status
  limit: 100,    // Optional: max results
  tags: ["production"]  // Optional: filter by tags
})
```

---

## Best Practices

### ✅ Do

- Build workflows **iteratively** (avg 56s between edits)
- Use **smart parameters** (branch, case) for clarity
- Validate **after** significant changes
- Use **atomic mode** (default) for critical updates
- Specify **sourceOutput** for AI connections
- Clean stale connections after node renames/deletions

### ❌ Don't

- Try to build workflows in one shot
- Use sourceIndex when branch/case available
- Skip validation before activation
- Forget to test workflows after creation
- Ignore auto-sanitization behavior

---

## Summary

**Most Important**:
1. **n8n_update_partial_workflow** is most-used tool (38,287 uses, 99.0% success)
2. Workflows built **iteratively** (56s avg between edits)
3. Use **smart parameters** (branch="true", case=0) for clarity
4. **AI connections** supported (8 types with sourceOutput)
5. **Auto-sanitization** runs on all operations
6. Validate frequently (7,841 edit → validate patterns)

**Related**:
- [SEARCH_GUIDE.md](SEARCH_GUIDE.md) - Find nodes to add
- [VALIDATION_GUIDE.md](VALIDATION_GUIDE.md) - Validate workflows
