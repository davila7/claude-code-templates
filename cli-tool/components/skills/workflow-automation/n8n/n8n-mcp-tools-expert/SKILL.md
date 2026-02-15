---
name: n8n-mcp-tools-expert
description: Expert guide for using n8n-mcp MCP tools effectively. Use when searching for nodes, validating configurations, accessing templates, managing workflows, or using any n8n-mcp tool. Provides tool selection guidance, parameter formats, and common patterns.
---

# n8n MCP Tools Expert

Master guide for using n8n-mcp MCP server tools to build workflows.

---

## Tool Categories

n8n-mcp provides **40+ tools** organized into categories:

1. **Node Discovery** → [SEARCH_GUIDE.md](SEARCH_GUIDE.md)
2. **Configuration Validation** → [VALIDATION_GUIDE.md](VALIDATION_GUIDE.md)
3. **Workflow Management** → [WORKFLOW_GUIDE.md](WORKFLOW_GUIDE.md)
4. **Template Library** - Search and access 2,653 real workflows
5. **Documentation** - Get tool and node documentation

---

## Quick Reference

### Most Used Tools (by success rate)

| Tool | Use When | Success Rate | Speed |
|------|----------|--------------|-------|
| `search_nodes` | Finding nodes by keyword | 99.9% | <20ms |
| `get_node_essentials` | Understanding node operations | 91.7% | <10ms |
| `validate_node_operation` | Checking configurations | Varies | <100ms |
| `n8n_create_workflow` | Creating workflows | 96.8% | 100-500ms |
| `n8n_update_partial_workflow` | Editing workflows (MOST USED!) | 99.0% | 50-200ms |
| `validate_workflow` | Checking complete workflow | 95.5% | 100-500ms |

---

## Tool Selection Guide

### Finding the Right Node

**Workflow**:
```
1. search_nodes({query: "keyword"})
2. get_node_essentials({nodeType: "nodes-base.name"})
3. [Optional] get_node_documentation({nodeType: "nodes-base.name"})
```

**Example**:
```javascript
// Step 1: Search
search_nodes({query: "slack"})
// Returns: nodes-base.slack

// Step 2: Get details (18s avg between steps)
get_node_essentials({nodeType: "nodes-base.slack"})
// Returns: operations, properties, examples
```

**Common pattern**: search → essentials (18s average)

### Validating Configuration

**Workflow**:
```
1. validate_node_minimal({nodeType, config: {}}) - Check required fields
2. validate_node_operation({nodeType, config, profile: "runtime"}) - Full validation
3. [Repeat] Fix errors, validate again
```

**Common pattern**: validate → fix → validate (23s thinking, 58s fixing per cycle)

### Managing Workflows

**Workflow**:
```
1. n8n_create_workflow({name, nodes, connections})
2. n8n_validate_workflow({id})
3. n8n_update_partial_workflow({id, operations: [...]})
4. n8n_validate_workflow({id}) again
```

**Common pattern**: iterative updates (56s average between edits)

---

## Critical: nodeType Formats

**Two different formats** for different tools!

### Format 1: Search/Validate Tools
```javascript
// Use SHORT prefix
"nodes-base.slack"
"nodes-base.httpRequest"
"nodes-base.webhook"
"nodes-langchain.agent"
```

**Tools that use this**:
- search_nodes (returns this format)
- get_node_essentials
- get_node_info
- validate_node_minimal
- validate_node_operation
- get_property_dependencies

### Format 2: Workflow Tools
```javascript
// Use FULL prefix
"n8n-nodes-base.slack"
"n8n-nodes-base.httpRequest"
"n8n-nodes-base.webhook"
"@n8n/n8n-nodes-langchain.agent"
```

**Tools that use this**:
- n8n_create_workflow
- n8n_update_partial_workflow
- list_node_templates

### Conversion

```javascript
// search_nodes returns BOTH formats
{
  "nodeType": "nodes-base.slack",          // For search/validate tools
  "workflowNodeType": "n8n-nodes-base.slack"  // For workflow tools
}
```

---

## Common Mistakes

### ❌ Mistake 1: Wrong nodeType Format

**Problem**: "Node not found" error

```javascript
❌ get_node_essentials({nodeType: "slack"})  // Missing prefix
❌ get_node_essentials({nodeType: "n8n-nodes-base.slack"})  // Wrong prefix

✅ get_node_essentials({nodeType: "nodes-base.slack"})  // Correct!
```

### ❌ Mistake 2: Using get_node_info Instead of get_node_essentials

**Problem**: 20% failure rate, slow response, huge payload

```javascript
❌ get_node_info({nodeType: "nodes-base.slack"})
// Returns: 100KB+ data, 20% chance of failure

✅ get_node_essentials({nodeType: "nodes-base.slack"})
// Returns: 5KB focused data, 91.7% success, <10ms
```

**When to use get_node_info**:
- Debugging complex configuration issues
- Need complete property schema
- Exploring advanced features

**Better alternatives**:
1. get_node_essentials - for operations list
2. get_node_documentation - for readable docs
3. search_node_properties - for specific property

### ❌ Mistake 3: Not Using Validation Profiles

**Problem**: Too many false positives OR missing real errors

**Profiles**:
- `minimal` - Only required fields (fast, permissive)
- `runtime` - Values + types (recommended for pre-deployment)
- `ai-friendly` - Reduce false positives (for AI configuration)
- `strict` - Maximum validation (for production)

```javascript
❌ validate_node_operation({nodeType, config})  // Uses default

✅ validate_node_operation({nodeType, config, profile: "runtime"})  // Explicit
```

### ❌ Mistake 4: Ignoring Auto-Sanitization

**What happens**: ALL nodes sanitized on ANY workflow update

**Auto-fixes**:
- Binary operators (equals, contains) → removes singleValue
- Unary operators (isEmpty, isNotEmpty) → adds singleValue: true
- IF/Switch nodes → adds missing metadata

**Cannot fix**:
- Broken connections
- Branch count mismatches
- Paradoxical corrupt states

```javascript
// After ANY update, auto-sanitization runs on ALL nodes
n8n_update_partial_workflow({id, operations: [...]})
// → Automatically fixes operator structures
```

### ❌ Mistake 5: Not Using Smart Parameters

**Problem**: Complex sourceIndex calculations for multi-output nodes

**Old way** (manual):
```javascript
// IF node connection
{
  type: "addConnection",
  source: "IF",
  target: "Handler",
  sourceIndex: 0  // Which output? Hard to remember!
}
```

**New way** (smart parameters):
```javascript
// IF node - semantic branch names
{
  type: "addConnection",
  source: "IF",
  target: "True Handler",
  branch: "true"  // Clear and readable!
}

{
  type: "addConnection",
  source: "IF",
  target: "False Handler",
  branch: "false"
}

// Switch node - semantic case numbers
{
  type: "addConnection",
  source: "Switch",
  target: "Handler A",
  case: 0
}
```

---

## Tool Usage Patterns

### Pattern 1: Node Discovery (Most Common)

**Common workflow**: 18s average between steps

```javascript
// Step 1: Search (fast!)
const results = await search_nodes({
  query: "slack",
  mode: "OR",  // Default: any word matches
  limit: 20
});
// → Returns: nodes-base.slack, nodes-base.slackTrigger

// Step 2: Get details (~18s later, user reviewing results)
const details = await get_node_essentials({
  nodeType: "nodes-base.slack",
  includeExamples: true  // Get real template configs
});
// → Returns: operations, properties, metadata
```

### Pattern 2: Validation Loop

**Typical cycle**: 23s thinking, 58s fixing

```javascript
// Step 1: Validate
const result = await validate_node_operation({
  nodeType: "nodes-base.slack",
  config: {
    resource: "channel",
    operation: "create"
  },
  profile: "runtime"
});

// Step 2: Check errors (~23s thinking)
if (!result.valid) {
  console.log(result.errors);  // "Missing required field: name"
}

// Step 3: Fix config (~58s fixing)
config.name = "general";

// Step 4: Validate again
await validate_node_operation({...});  // Repeat until clean
```

### Pattern 3: Workflow Editing

**Most used update tool**: 99.0% success rate, 56s average between edits

```javascript
// Iterative workflow building (NOT one-shot!)
// Edit 1
await n8n_update_partial_workflow({
  id: "workflow-id",
  operations: [{type: "addNode", node: {...}}]
});

// ~56s later...

// Edit 2
await n8n_update_partial_workflow({
  id: "workflow-id",
  operations: [{type: "addConnection", source: "...", target: "..."}]
});

// ~56s later...

// Edit 3 (validation)
await n8n_validate_workflow({id: "workflow-id"});
```

---

## Detailed Guides

### Node Discovery Tools
See [SEARCH_GUIDE.md](SEARCH_GUIDE.md) for:
- search_nodes (99.9% success)
- get_node_essentials vs get_node_info
- list_nodes by category
- search_node_properties for specific fields

### Validation Tools
See [VALIDATION_GUIDE.md](VALIDATION_GUIDE.md) for:
- Validation profiles explained
- validate_node_minimal vs validate_node_operation
- validate_workflow complete structure
- Auto-sanitization system
- Handling validation errors

### Workflow Management
See [WORKFLOW_GUIDE.md](WORKFLOW_GUIDE.md) for:
- n8n_create_workflow
- n8n_update_partial_workflow (15 operation types!)
- Smart parameters (branch, case)
- AI connection types (8 types)
- cleanStaleConnections recovery

---

## Template Usage

### Search Templates

```javascript
// Search by keyword
search_templates({
  query: "webhook slack",
  limit: 20
});
// → Returns: 1,085 templates with metadata

// Get template details
get_template({
  templateId: 2947,  // Weather to Slack
  mode: "structure"  // or "full" for complete JSON
});
```

### Template Metadata

Templates include:
- Complexity (simple, medium, complex)
- Setup time estimate
- Required services
- Categories and use cases
- View counts (popularity)

---

## Self-Help Tools

### Get Tool Documentation

```javascript
// List all tools
tools_documentation()

// Specific tool details
tools_documentation({
  topic: "search_nodes",
  depth: "full"
})
```

### Health Check

```javascript
// Verify MCP server connectivity
n8n_health_check()
// → Returns: status, features, API availability, version
```

### Database Statistics

```javascript
get_database_statistics()
// → Returns: 537 nodes, 270 AI tools, 2,653 templates
```

---

## Tool Availability

**Always Available** (no n8n API needed):
- search_nodes, list_nodes, get_node_essentials ✅
- validate_node_minimal, validate_node_operation ✅
- validate_workflow, get_property_dependencies ✅
- search_templates, get_template, list_tasks ✅
- tools_documentation, get_database_statistics ✅

**Requires n8n API** (N8N_API_URL + N8N_API_KEY):
- n8n_create_workflow ⚠️
- n8n_update_partial_workflow ⚠️
- n8n_validate_workflow (by ID) ⚠️
- n8n_list_workflows, n8n_get_workflow ⚠️
- n8n_trigger_webhook_workflow ⚠️

If API tools unavailable, use templates and validation-only workflows.

---

## Performance Characteristics

| Tool | Response Time | Payload Size | Reliability |
|------|---------------|--------------|-------------|
| search_nodes | <20ms | Small | 99.9% |
| list_nodes | <20ms | Small | 99.6% |
| get_node_essentials | <10ms | ~5KB | 91.7% |
| get_node_info | Varies | 100KB+ | 80% ⚠️ |
| validate_node_minimal | <100ms | Small | 97.4% |
| validate_node_operation | <100ms | Medium | Varies |
| validate_workflow | 100-500ms | Medium | 95.5% |
| n8n_create_workflow | 100-500ms | Medium | 96.8% |
| n8n_update_partial_workflow | 50-200ms | Small | 99.0% |

---

## Best Practices

### ✅ Do

- Use get_node_essentials over get_node_info (91.7% vs 80%)
- Specify validation profile explicitly
- Use smart parameters (branch, case) for clarity
- Follow search → essentials → validate workflow
- Iterate workflows (avg 56s between edits)
- Validate after every significant change
- Use includeExamples: true for real configs

### ❌ Don't

- Use get_node_info unless necessary (20% failure rate!)
- Forget nodeType prefix (nodes-base.*)
- Skip validation profiles (use "runtime")
- Try to build workflows in one shot (iterate!)
- Ignore auto-sanitization behavior
- Use full prefix (n8n-nodes-base.*) with search tools

---

## Summary

**Most Important**:
1. Use **get_node_essentials**, not get_node_info (5KB vs 100KB, 91.7% vs 80%)
2. nodeType formats differ: `nodes-base.*` (search) vs `n8n-nodes-base.*` (workflows)
3. Specify **validation profiles** (runtime recommended)
4. Use **smart parameters** (branch="true", case=0)
5. **Auto-sanitization** runs on ALL nodes during updates
6. Workflows are built **iteratively** (56s avg between edits)

**Common Workflow**:
1. search_nodes → find node
2. get_node_essentials → understand config
3. validate_node_operation → check config
4. n8n_create_workflow → build
5. n8n_validate_workflow → verify
6. n8n_update_partial_workflow → iterate

For details, see:
- [SEARCH_GUIDE.md](SEARCH_GUIDE.md) - Node discovery
- [VALIDATION_GUIDE.md](VALIDATION_GUIDE.md) - Configuration validation
- [WORKFLOW_GUIDE.md](WORKFLOW_GUIDE.md) - Workflow management

---

**Related Skills**:
- n8n Expression Syntax - Write expressions in workflow fields
- n8n Workflow Patterns - Architectural patterns from templates
- n8n Validation Expert - Interpret validation errors
- n8n Node Configuration - Operation-specific requirements
