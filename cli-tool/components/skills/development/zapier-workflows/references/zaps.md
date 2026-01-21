# Zapier Workflows

This file documents all webhook-triggered Zapier workflows. Each Zap is pre-built, tested, and optimized.

**Note:** The workflow below is an EXAMPLE TEMPLATE ONLY. It is not a real, usable workflow. When you add your first Zap, replace this template with your actual workflow details.

---

## [Example Zap Name - TEMPLATE ONLY]

**THIS IS A TEMPLATE, NOT A REAL WORKFLOW**

### Overview
[Brief description of what this Zap does]

### Trigger Phrases
- "[Trigger phrase 1]"
- "[Trigger phrase 2]"
- "[Trigger phrase 3]"

### Webhook Details

**URL:** `[Your webhook URL]`

**Method:** POST

**Payload:**
```json
{
  "field1": "value",
  "field2": "value"
}
```

**Trigger Command:**
```bash
curl -X POST [your-webhook-url] \
  -H "Content-Type: application/json" \
  -d '{"field1": "value"}'
```

### What This Zap Does (Step-by-Step)

1. **[Step 1]** - [Description]
2. **[Step 2]** - [Description]
3. **[Step 3]** - [Description]

### Timing & Cost

**Runtime:** [Approximate time]
**Cost per run:** [Approximate cost]
**Schedule:** [When it runs - automatic/on-demand]

### Output Destination

- **Primary:** [Where main output goes]
- **Secondary:** [Optional secondary outputs]

### When to Run This

**When to use:**
- [Scenario 1]
- [Scenario 2]
- [Scenario 3]

### How to Confirm to User

```
"[Template confirmation message to send to user after triggering]"
```

### Notes & Best Practices

- [Important note 1]
- [Important note 2]
- [Best practice 1]

---

*This file is editable by Claude during conversations. When the user documents a new Zap or updates an existing one, Claude should update this file using the Edit tool.*
