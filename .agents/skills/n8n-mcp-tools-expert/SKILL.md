---
name: n8n-mcp-tools-expert
description: Expert guide for using n8n-mcp MCP tools effectively. Activates when searching for nodes, validating configurations, accessing templates, or managing n8n workflows. HIGHEST PRIORITY skill.
---

# n8n MCP Tools Expert (HIGHEST PRIORITY)

You have access to the **n8n-mcp MCP server** with 20+ specialized tools for building n8n workflows. This skill teaches you how to use them correctly.

## Tool Categories

### Core Tools (Always Available)
| Tool | Purpose | When to Use |
|------|---------|-------------|
| `tools_documentation` | Get best practices for all MCP tools | START HERE every session |
| `search_nodes` | Find nodes by keyword | When looking for a specific integration |
| `get_node` | Get complete node documentation | Before configuring any node |
| `validate_node` | Validate node configuration | After configuring, before building |
| `validate_workflow` | Validate entire workflow | Before deployment |
| `search_templates` | Search 2,700+ ready templates | ALWAYS check before building from scratch |
| `get_template` | Get complete template JSON | When using a template |

### n8n Management Tools (Requires API Key)
| Tool | Purpose |
|------|---------|
| `n8n_create_workflow` | Deploy workflow directly to n8n |
| `n8n_update_partial_workflow` | Batch update nodes/connections |
| `n8n_trigger_webhook_workflow` | Test webhook workflows |
| `n8n_executions` | Monitor execution status |
| `n8n_validate_workflow` | Post-deployment validation |
| `n8n_autofix_workflow` | Auto-fix common errors |

---

## CRITICAL: nodeType Format Differences

```
# For search_nodes, validate_node:
nodes-base.slack              ← WITHOUT "n8n-" prefix

# For get_node, workflow JSON:
n8n-nodes-base.slack          ← WITH "n8n-" prefix
@n8n/n8n-nodes-langchain.agent ← LangChain nodes use this format
```

**Conversion rule:** Remove `n8n-` prefix for search/validate, add it back for workflow building.

---

## Tool Selection Guide

### Finding Nodes
```
# Step 1: Search broadly
search_nodes({query: 'slack'})
search_nodes({query: 'AI agent langchain'})
search_nodes({query: 'trigger'})

# Step 2: Get details
get_node({nodeType: 'n8n-nodes-base.slack', detail: 'standard', includeExamples: true})
```

### Validating Configuration
```
# Quick check first (<100ms)
validate_node({nodeType: 'nodes-base.slack', config: {...}, mode: 'minimal'})

# Full validation before building
validate_node({nodeType: 'nodes-base.slack', config: {...}, mode: 'full', profile: 'runtime'})
```

### Finding Templates
```
# By task type (most targeted)
search_templates({searchMode: 'by_task', task: 'webhook_processing'})

# By service
search_templates({searchMode: 'by_nodes', nodeTypes: ['n8n-nodes-base.slack']})

# By complexity
search_templates({searchMode: 'by_metadata', complexity: 'simple', maxSetupMinutes: 30})

# Text search
search_templates({query: 'slack notification'})
```

---

## Execution Rules

### ✅ ALWAYS
1. **Parallel execution** — Call independent tools simultaneously, never sequentially
2. **Silent execution** — No commentary between tool calls, only respond AFTER all complete
3. **Templates first** — Check templates before building from scratch
4. **Validate everything** — minimal → full → workflow validation chain
5. **includeExamples: true** — Always add this to `search_nodes` and `get_node`

### ❌ NEVER
- Use `detail: 'full'` by default (too slow, 3000-8000 tokens) — use `'standard'`
- Skip validation before building
- Make sequential tool calls when parallel is possible
- Trust default parameter values (they cause runtime failures)

---

## Smart Parameters

### `get_node` Modes
```javascript
// Standard (DEFAULT - use this 90% of time)
get_node({nodeType: 'n8n-nodes-base.slack', detail: 'standard', includeExamples: true})

// Docs mode (human-readable)
get_node({nodeType: 'n8n-nodes-base.slack', mode: 'docs'})

// Search specific property
get_node({nodeType: 'n8n-nodes-base.slack', mode: 'search_properties', propertyQuery: 'auth'})

// Full details (only when necessary)
get_node({nodeType: 'n8n-nodes-base.slack', detail: 'full'})
```

### `search_templates` Filters
```javascript
// Beginner-friendly
{searchMode: 'by_metadata', complexity: 'simple', maxSetupMinutes: 30}

// By audience
{searchMode: 'by_metadata', targetAudience: 'developers'} // or 'marketers', 'analysts'

// By required service
{searchMode: 'by_metadata', requiredService: 'openai'}
```

### `validate_node` Profiles
```javascript
'minimal'    // Required fields only, fastest (<100ms)
'runtime'    // Full validation, catches most runtime errors (RECOMMENDED)
'ai-friendly' // Flexible, good for AI-generated configs
'strict'     // Strictest, for production
```

---

## Batch Operations (n8n API)

**ONE call with multiple operations — ALWAYS batch:**
```json
n8n_update_partial_workflow({
  "id": "wf-123",
  "operations": [
    {"type": "updateNode", "nodeId": "slack-1", "changes": {"position": [100, 200]}},
    {"type": "updateNode", "nodeId": "http-1", "changes": {"position": [300, 200]}},
    {"type": "cleanStaleConnections"}
  ]
})
```

### addConnection Syntax (CRITICAL)
```json
// ✅ CORRECT - Four separate string parameters
{
  "type": "addConnection",
  "source": "source-node-id",
  "target": "target-node-id",
  "sourcePort": "main",
  "targetPort": "main"
}

// For IF nodes - use branch parameter
{"type": "addConnection", "source": "if-id", "target": "true-handler", "sourcePort": "main", "targetPort": "main", "branch": "true"}
{"type": "addConnection", "source": "if-id", "target": "false-handler", "sourcePort": "main", "targetPort": "main", "branch": "false"}
```

---

## Performance Characteristics

| Tool | Response Time | Token Cost |
|------|-------------|-----------|
| `validate_node` minimal | <100ms | Low |
| `search_nodes` | 200-500ms | Medium |
| `get_node` standard | 300-800ms | Medium (500-1500 tokens) |
| `get_node` full | 500-2000ms | High (3000-8000 tokens) |
| `search_templates` | 300-600ms | Medium |

---

## Most Popular nodes for get_node

```
n8n-nodes-base.code               # JavaScript/Python scripting
n8n-nodes-base.httpRequest         # HTTP API calls
n8n-nodes-base.webhook             # Event triggers
n8n-nodes-base.set                 # Data transformation
n8n-nodes-base.if                  # Conditional routing
n8n-nodes-base.manualTrigger       # Manual execution
n8n-nodes-base.respondToWebhook    # Webhook responses
n8n-nodes-base.scheduleTrigger     # Time-based triggers
@n8n/n8n-nodes-langchain.agent     # AI agents
n8n-nodes-base.googleSheets        # Spreadsheets
n8n-nodes-base.merge               # Data merging
n8n-nodes-base.switch              # Multi-branch routing
n8n-nodes-base.telegram            # Telegram bots
@n8n/n8n-nodes-langchain.lmChatOpenAi  # OpenAI chat
n8n-nodes-base.splitInBatches      # Batch processing
n8n-nodes-base.gmail               # Email automation
n8n-nodes-base.executeWorkflowTrigger  # Sub-workflows
```

**Note:** LangChain nodes use `@n8n/n8n-nodes-langchain.` prefix, core nodes use `n8n-nodes-base.`
