---
name: n8n-master-expert
description: End-to-end n8n workflow design, validation, and orchestration. Use when you need a single expert to plan, build, validate, and troubleshoot workflows; choose patterns, configure nodes, write expressions, or code nodes; and coordinate n8n-mcp tool usage.
---

# n8n Master Expert

Unified guidance for building production-ready n8n workflows by routing you to the right specialized skill at the right time.

---

## Quick Start (End-to-End Workflow)

1. **Templates first**: search existing templates before building from scratch.
2. **Pick a pattern**: choose the workflow pattern that fits the job.
3. **Discover nodes**: search nodes, then get essentials for configuration.
4. **Configure explicitly**: set every parameter that controls behavior (never trust defaults).
5. **Use expressions or code**: expressions in node fields, code in Code nodes only.
6. **Validate**: minimal -> runtime -> workflow validation.
7. **Activate**: activation is manual in n8n UI after validation.

---

## Routing Map (Use These Skills by Path)

- Code node (JavaScript): `cli-tool/components/skills/workflow-automation/n8n/n8n-code-javascript/SKILL.md`
- Code node (Python): `cli-tool/components/skills/workflow-automation/n8n/n8n-code-python/SKILL.md`
- Expressions (`{{ }}` syntax): `cli-tool/components/skills/workflow-automation/n8n/n8n-expression-syntax/SKILL.md`
- Node configuration & dependencies: `cli-tool/components/skills/workflow-automation/n8n/n8n-node-configuration/SKILL.md`
- Validation errors & profiles: `cli-tool/components/skills/workflow-automation/n8n/n8n-validation-expert/SKILL.md`
- Workflow patterns: `cli-tool/components/skills/workflow-automation/n8n/n8n-workflow-patterns/SKILL.md`
- n8n-mcp tools usage: `cli-tool/components/skills/workflow-automation/n8n/n8n-mcp-tools-expert/SKILL.md`

---

## Core Rules (From Antigravity n8n Expert Playbook)

- **Templates first**: always check templates before building new workflows.
- **Parallel tool calls**: run independent MCP tool calls together; respond after all complete.
- **Explicit config**: never rely on defaults; set every behavior-changing parameter.
- **Validation chain**: minimal -> runtime -> workflow validation (then post-deploy if using API).
- **Webhook data lives under `.body`**: use `$json.body` (or `_json["body"]` in Python).
- **Expressions vs Code**: `{{ }}` only in node fields; Code nodes use plain JS/Python.

---

## Validation Chain (Recommended)

```
validate_node_minimal -> validate_node_operation (profile: runtime) -> validate_workflow -> n8n_validate_workflow (post-deploy)
```

---

## When to Escalate to Specialized Skills

- **Confused about expressions** -> use n8n Expression Syntax.
- **Complex transformations** -> use n8n Code JavaScript/Python.
- **Validation errors or false positives** -> use n8n Validation Expert.
- **Operation-specific fields or dependencies** -> use n8n Node Configuration.
- **Choosing architecture** -> use n8n Workflow Patterns.
- **Need MCP tool guidance** -> use n8n MCP Tools Expert.

---

## Output Expectations

When producing a workflow, include:
- A clear node list and data flow
- Explicit parameters (no defaults)
- Validation steps executed
- Error handling strategy
- Next steps for activation/testing
