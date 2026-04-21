# 🚀 Create Your Own Autonomous Team

This template helps you build autonomous agent teams similar to the Code Review System. Follow this guide to create specialized teams for any domain.

## 📋 What You'll Create

An autonomous team consists of:
- **Orchestrator**: Coordinates the team workflow
- **Specialized Agents**: Each handles specific tasks
- **Team Configuration**: Defines roles, priorities, and workflow
- **Shared Resources**: Rules, templates, and examples
- **Documentation**: User guides and API docs

## 🎯 Quick Start

### 1. Choose Your Domain

Examples:
- **Customer Support Team**: ticket-triage, response-writer, escalation-handler
- **Content Creation Team**: researcher, writer, editor, seo-optimizer
- **DevOps Team**: deployment-manager, monitoring-agent, incident-responder
- **Data Analysis Team**: data-cleaner, analyzer, visualizer, reporter
- **Marketing Team**: campaign-planner, content-creator, analytics-tracker

### 2. Copy This Template

```bash
cp -r cli-tool/templates/autonomous-team-template my-team-name
cd my-team-name
```

### 3. Customize Files

Follow the checklist below to customize each file.

## 📁 Template Structure

```
my-team-name/
├── INDEX.md                    # Navigation hub (customize)
├── README.md                   # Main documentation (customize)
├── team.yaml                   # Team configuration (customize)
├── orchestrator.md             # Team coordinator (customize)
├── CHANGELOG.md                # Version history (start fresh)
├── EXAMPLE_EXECUTION.md        # Usage example (customize)
├── agents/
│   ├── agent-1.md             # First specialist (customize)
│   ├── agent-2.md             # Second specialist (customize)
│   └── agent-3.md             # Third specialist (customize)
├── rules/
│   ├── rule-1.md              # Domain rules (customize)
│   └── rule-2.md              # More rules (customize)
├── templates/
│   ├── template-1.txt         # Output templates (customize)
│   └── template-2.txt         # More templates (customize)
├── examples/
│   └── example-1.md           # Real examples (customize)
└── docs/
    ├── ARCHITECTURE.md        # System design (customize)
    └── USER_GUIDE.md          # How to use (customize)
```

## ✅ Customization Checklist

### Step 1: Team Configuration (team.yaml)

```yaml
team:
  name: my-team-name           # ✏️ CHANGE THIS
  version: 1.0.0
  description: What your team does  # ✏️ CHANGE THIS
  
orchestrator:
  agent: orchestrator-name     # ✏️ CHANGE THIS
  role: Coordinates workflow   # ✏️ CHANGE THIS
  
agents:
  # ✏️ ADD YOUR AGENTS HERE
  - id: agent-1
    role: What agent-1 does
    priority: 1
    dependencies: []
    
  - id: agent-2
    role: What agent-2 does
    priority: 2
    dependencies: [agent-1]

workflow:
  mode: hybrid  # sequential, parallel, or hybrid
  
  phases:
    # ✏️ DEFINE YOUR WORKFLOW PHASES
    - name: phase-1
      type: parallel
      agents: [agent-1, agent-2]
      
    - name: phase-2
      type: sequential
      agents: [orchestrator-name]
      wait_for: phase-1
```

### Step 2: Orchestrator (orchestrator.md)

````markdown
# [Team Name] Orchestrator

You are the orchestrator for the [Team Name] - an autonomous system of specialized agents.

## Your Role

You coordinate the entire workflow by:
1. ✏️ [What you analyze]
2. ✏️ [How you delegate]
3. ✏️ [How you aggregate results]
4. ✏️ [How you handle conflicts]

## Team Structure

### Phase 1: [Phase Name]
- **agent-1**: ✏️ [What it does]
- **agent-2**: ✏️ [What it does]

### Phase 2: [Phase Name]
- **agent-3**: ✏️ [What it does]

## Workflow Protocol

✏️ [Define your workflow steps]

## Example Execution

✏️ [Show a real execution flow]
````

### Step 3: Specialized Agents (agents/*.md)

For each agent, create a file like `agents/agent-1.md`:

````markdown
---
name: agent-1
role: What this agent does
priority: 1
dependencies: []
---

# Agent 1 Name

## Role
You are a specialized agent responsible for ✏️ [specific task].

## Capabilities
- ✏️ Capability 1
- ✏️ Capability 2
- ✏️ Capability 3

## Input Format
```json
{
  "task": "...",
  "context": {...}
}
```

## Output Format
```json
{
  "agent_id": "agent-1",
  "status": "completed",
  "results": {...}
}
```

## Rules
✏️ [Link to relevant rules files]

## Examples
✏️ [Link to examples]
````

### Step 4: Rules (rules/*.md)

Create domain-specific rules:

````markdown
# Rule Category Name

## Overview
✏️ [What these rules cover]

## Rules

### Rule 1: [Rule Name]
**Description**: ✏️ [What to check]
**Detection**: ✏️ [How to detect]
**Fix**: ✏️ [How to fix]
**Example**:
```
✏️ [Code example]
```

### Rule 2: [Rule Name]
...
````

### Step 5: Documentation

#### README.md
````markdown
# [Team Name]

✏️ [One-line description]

## Features
- ✏️ Feature 1
- ✏️ Feature 2

## Quick Start
```bash
✏️ [How to use your team]
```

## Team Members
- **Orchestrator**: ✏️ [Role]
- **Agent 1**: ✏️ [Role]
- **Agent 2**: ✏️ [Role]

## Workflow
✏️ [Explain the workflow]

## Examples
✏️ [Link to examples]
````

#### INDEX.md
````markdown
# [Team Name] - Complete Index

## Quick Navigation
- [README.md](README.md) - Start here
- [team.yaml](team.yaml) - Configuration
- [orchestrator.md](orchestrator.md) - Coordinator

## Agents
- [agent-1.md](agents/agent-1.md) - ✏️ [Description]
- [agent-2.md](agents/agent-2.md) - ✏️ [Description]

## Rules
- [rule-1.md](rules/rule-1.md) - ✏️ [Description]

## Examples
- [example-1.md](examples/example-1.md) - ✏️ [Description]
````

## 🎨 Design Patterns

### Pattern 1: Sequential Pipeline
```yaml
workflow:
  mode: sequential
  phases:
    - name: step-1
      agents: [agent-1]
    - name: step-2
      agents: [agent-2]
      wait_for: step-1
```

**Use when**: Each step depends on previous output

### Pattern 2: Parallel Processing
```yaml
workflow:
  mode: parallel
  phases:
    - name: parallel-work
      agents: [agent-1, agent-2, agent-3]
```

**Use when**: Tasks are independent

### Pattern 3: Hybrid (Recommended)
```yaml
workflow:
  mode: hybrid
  phases:
    - name: initial
      type: parallel
      agents: [agent-1, agent-2]
    - name: synthesis
      type: sequential
      agents: [orchestrator]
      wait_for: initial
```

**Use when**: Mix of parallel and sequential work

## 💡 Best Practices

### 1. Clear Responsibilities
Each agent should have ONE clear purpose. Don't create "do everything" agents.

### 2. Proper Dependencies
```yaml
# ✅ Good: Clear dependency chain
- id: analyzer
  dependencies: []
- id: reporter
  dependencies: [analyzer]

# ❌ Bad: Circular dependencies
- id: agent-a
  dependencies: [agent-b]
- id: agent-b
  dependencies: [agent-a]
```

### 3. Shared Context
Use `shared_context` in team.yaml for resources all agents need:
```yaml
shared_context:
  rules:
    - rules/common.md
  templates:
    - templates/output.md
```

### 4. Error Handling
```yaml
error_handling:
  on_agent_failure: continue    # Don't stop entire team
  on_critical_failure: escalate # Escalate serious issues
  max_retries: 2
```

### 5. Output Aggregation
Let orchestrator synthesize all findings:
```yaml
output:
  format: markdown
  aggregation: orchestrator-name
  location: ./team-report.md
```

## 🚀 Publishing Your Team

### 1. Test Locally
```bash
# Test your team configuration
claude-code --team my-team-name --test

# Run on sample data
claude-code --team my-team-name --target ./sample
```

### 2. Document Everything
- Write clear README
- Add usage examples
- Document all agents
- Explain workflow

### 3. Add to Repository
```bash
# Move to components directory (replace [category] with actual category like 'development-tools')
mv my-team-name cli-tool/components/agents/development-tools/my-team-name

# Commit
git add .
git commit -m "Add my-team-name autonomous team"
```

### 4. Submit PR
- Follow CONTRIBUTING.md guidelines
- Include examples
- Add tests if applicable

## 📊 Real-World Examples

### Example 1: Customer Support Team
```yaml
team:
  name: customer-support-team
  
agents:
  - id: ticket-classifier
    role: Categorizes incoming tickets
    priority: 1
    
  - id: sentiment-analyzer
    role: Detects customer emotion
    priority: 1
    
  - id: response-generator
    role: Drafts responses
    priority: 2
    dependencies: [ticket-classifier, sentiment-analyzer]
    
  - id: escalation-detector
    role: Identifies tickets needing human attention
    priority: 2
    dependencies: [sentiment-analyzer]
```

### Example 2: Content Creation Team
```yaml
team:
  name: content-creation-team
  
agents:
  - id: topic-researcher
    role: Researches topic and gathers sources
    priority: 1
    
  - id: outline-creator
    role: Creates content outline
    priority: 2
    dependencies: [topic-researcher]
    
  - id: content-writer
    role: Writes full content
    priority: 3
    dependencies: [outline-creator]
    
  - id: seo-optimizer
    role: Optimizes for search engines
    priority: 4
    dependencies: [content-writer]
    
  - id: editor
    role: Edits and polishes
    priority: 4
    dependencies: [content-writer]
```

## 🎯 Next Steps

1. ✅ Copy this template
2. ✅ Customize team.yaml
3. ✅ Write orchestrator.md
4. ✅ Create agent files
5. ✅ Add domain rules
6. ✅ Write documentation
7. ✅ Test locally
8. ✅ Submit PR

## 💰 Monetization (Optional)

If you want to sell your team:
1. Mark as premium in metadata
2. Set pricing tier
3. Add license key validation
4. Submit to marketplace

```yaml
# Add to team.yaml
marketplace:
  tier: premium
  price: 29.99
  license: commercial
  creator_id: your-id
```

## 🤝 Get Help

- Check existing teams for inspiration
- Ask in discussions
- Read CONTRIBUTING.md
- Join community Discord

---

**Ready to build your autonomous team?** 🚀

Start with a simple 2-3 agent team and expand from there!
