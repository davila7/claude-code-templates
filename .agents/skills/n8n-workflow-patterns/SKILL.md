---
name: n8n-workflow-patterns
description: Build workflows using 5 proven architectural patterns. Activates when creating workflows, connecting nodes, or designing automations. Uses real examples from 2,700+ n8n templates.
---

# n8n Workflow Patterns

## The 5 Core Patterns

### Pattern 1: Webhook Processing
**Use when:** Receiving HTTP requests, handling form submissions, processing events from external services.

```
Webhook → [Validate/Transform] → [Process] → Respond to Webhook
```

**Key nodes:** `n8n-nodes-base.webhook`, `n8n-nodes-base.respondToWebhook`, `n8n-nodes-base.if`

**Example:**
```
Webhook Trigger
  → IF (check auth header)
    → [TRUE] Process Request → Respond (200 OK)
    → [FALSE] Respond (401 Unauthorized)
```

---

### Pattern 2: HTTP API Integration
**Use when:** Calling external APIs, fetching data, posting to services.

```
Trigger → HTTP Request → [Process Response] → Output
```

**Key nodes:** `n8n-nodes-base.httpRequest`, `n8n-nodes-base.set`

**Example:**
```
Manual Trigger
  → HTTP Request (GET /api/data)
  → Set (extract needed fields)
  → Send Email with results
```

---

### Pattern 3: Database Operations
**Use when:** Reading/writing to databases, syncing data, batch processing records.

```
Trigger → Read DB → [Transform] → Write DB → Notify
```

**Key nodes:** `n8n-nodes-base.postgres`, `n8n-nodes-base.mysql`, `n8n-nodes-base.splitInBatches`

**Example:**
```
Schedule Trigger (daily)
  → Google Sheets (read new rows)
  → Split In Batches (50 per batch)
  → HTTP Request (send to API)
  → Update Sheet (mark as processed)
```

---

### Pattern 4: AI Agent Workflow
**Use when:** Building AI-powered automations, chat bots, intelligent data processing.

```
Trigger → AI Agent → [Tools/Memory] → Output
```

**Key nodes:** `@n8n/n8n-nodes-langchain.agent`, `@n8n/n8n-nodes-langchain.lmChatOpenAi`, `@n8n/n8n-nodes-langchain.toolWorkflow`

**Example:**
```
Webhook (user message)
  → AI Agent
      ├── Language Model (OpenAI GPT-4)
      ├── Memory (Window Buffer)
      └── Tools:
          ├── Search Tool (HTTP Request)
          └── Calculator Tool (Code Node)
  → Respond to Webhook
```

**AI Connection Types:**
- `ai_languageModel` — Connect LLM to Agent
- `ai_memory` — Connect Memory to Agent
- `ai_tool` — Connect Tools to Agent
- `ai_outputParser` — Connect output parser
- `ai_vectorStore` — Connect vector database
- `ai_retriever` — Connect document retriever
- `ai_textSplitter` — Connect text splitter
- `ai_document` — Connect document loader

---

### Pattern 5: Scheduled Automation
**Use when:** Running tasks on a schedule, periodic data sync, regular reports.

```
Schedule Trigger → [Fetch Data] → [Process] → [Output/Notify]
```

**Key nodes:** `n8n-nodes-base.scheduleTrigger`, `n8n-nodes-base.gmail`, `n8n-nodes-base.telegram`

**Example:**
```
Schedule Trigger (every Monday 9am)
  → Google Sheets (get weekly data)
  → Code (calculate statistics)
  → Gmail (send weekly report)
```

---

## Pattern Selection Guide

| Condition | Pattern |
|-----------|---------|
| External service sends data to you | Webhook Processing |
| You need to call an external API | HTTP API Integration |
| Working with databases/spreadsheets | Database Operations |
| Need AI/LLM capabilities | AI Agent Workflow |
| Time-based execution | Scheduled Automation |

---

## Common Workflow Components

### Triggers (Start Points)
```
n8n-nodes-base.webhook           # HTTP request trigger
n8n-nodes-base.scheduleTrigger   # Time-based trigger
n8n-nodes-base.manualTrigger     # Manual button click
n8n-nodes-base.executeWorkflowTrigger  # Called by another workflow
```

### Data Transformation
```
n8n-nodes-base.set           # Set/modify fields
n8n-nodes-base.code          # Custom JS/Python logic
n8n-nodes-base.merge         # Merge multiple inputs
n8n-nodes-base.splitInBatches # Process in chunks
```

### Flow Control
```
n8n-nodes-base.if      # True/False branching
n8n-nodes-base.switch  # Multi-branch routing (like switch/case)
n8n-nodes-base.merge   # Wait for branches to complete
```

### Error Handling
Every workflow should have error handling:
```
Any Node
  → [On Error] → Telegram/Gmail/Slack notify
```
Enable via node settings: "Continue On Fail" or "Error Workflow"

---

## Data Flow Patterns

### Linear Flow
```
A → B → C → D
```

### Branching Flow
```
A → IF
  → [TRUE] B → D
  → [FALSE] C → D
```

### Parallel Processing  
```
A → B (branch 1)
A → C (branch 2)
B + C → Merge → D
```

### Loop Pattern
```
A → Split In Batches → B → [loop back or continue]
```

### Error Handler Pattern
```
A → B
B → [on error] Error Handler (notify + log)
```

---

## Workflow Creation Checklist

### Planning Phase
- [ ] Identify trigger type (webhook/schedule/manual/sub-workflow)  
- [ ] Map data flow (what goes in, what comes out of each node)
- [ ] Identify required integrations
- [ ] Check for existing templates first!

### Implementation Phase
- [ ] Start with trigger node
- [ ] Add transformation nodes
- [ ] Configure all parameters explicitly (never trust defaults!)
- [ ] Add error handling
- [ ] Add sticky notes for documentation

### Validation Phase
- [ ] Validate each node: `validate_node(mode='minimal')` then `mode='full'`
- [ ] Validate whole workflow: `validate_workflow(workflow)`
- [ ] Check all connections are correct
- [ ] Test with sample data

### Deployment Phase
- [ ] Activate workflow in n8n
- [ ] Test with real data
- [ ] Monitor first few executions

---

## Common Gotchas

### 1. Webhook Data Structure
```javascript
// ❌ WRONG
{{ $json.message }}

// ✅ CORRECT
{{ $json.body.message }}
```

### 2. Multiple Input Items
When a node receives multiple items, each is processed separately. Use `splitInBatches` for controlled batch processing.

### 3. IF Node Output Routing
IF node has TWO outputs:
- Output 0 = TRUE branch
- Output 1 = FALSE branch

Always connect both outputs!

### 4. Node Execution Order
n8n executes nodes when ALL their inputs have data. Plan your flow to avoid deadlocks.

### 5. Expression Errors
If a field might not exist, use optional chaining:
```javascript
{{ $json.user?.email ?? 'no email' }}
```

---

## Quick Start Examples

### Simple Webhook → Slack
```json
{
  "nodes": [
    {"type": "n8n-nodes-base.webhook", "name": "Webhook"},
    {"type": "n8n-nodes-base.slack", "name": "Slack"}
  ],
  "connections": {
    "Webhook": {"main": [[{"node": "Slack", "type": "main", "index": 0}]]}
  }
}
```

### Scheduled Report
```
Schedule → Fetch Data → Format → Email
```

### AI Chat Bot
```
Webhook → AI Agent (OpenAI + Memory) → Respond to Webhook
```

---

## Best Practices

### ✅ Do
- Check templates first (2,700+ available)
- Add error handling to every workflow
- Use Sticky Notes for documentation
- Process in batches for large datasets
- Set explicit timeout values on HTTP requests

### ❌ Don't
- Build complex workflows without testing intermediate steps
- Skip error handling
- Use Code nodes when standard nodes can do the job
- Rely on default node parameter values
