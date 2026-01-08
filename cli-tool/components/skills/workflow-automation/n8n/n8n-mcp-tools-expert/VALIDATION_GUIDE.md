# Configuration Validation Tools Guide

Complete guide for validating node configurations and workflows.

---

## Validation Philosophy

**Validate early, validate often**

Validation is typically iterative with validate → fix cycles

---

## validate_node_minimal (QUICK CHECK)

**Success Rate**: 97.4% | **Speed**: <100ms

**Use when**: Checking what fields are required

**Syntax**:
```javascript
validate_node_minimal({
  nodeType: "nodes-base.slack",
  config: {}  // Empty to see all required fields
})
```

**Returns**:
```javascript
{
  "valid": true,           // Usually true (most nodes have no strict requirements)
  "missingRequiredFields": []
}
```

**When to use**: Planning configuration, seeing basic requirements

---

## validate_node_operation (FULL VALIDATION)

**Success Rate**: Varies | **Speed**: <100ms

**Use when**: Validating actual configuration before deployment

**Syntax**:
```javascript
validate_node_operation({
  nodeType: "nodes-base.slack",
  config: {
    resource: "channel",
    operation: "create",
    channel: "general"
  },
  profile: "runtime"  // Recommended!
})
```

### Validation Profiles

Choose based on your stage:

**minimal** - Only required fields
- Fastest
- Most permissive
- Use: Quick checks during editing

**runtime** - Values + types (**RECOMMENDED**)
- Balanced validation
- Catches real errors
- Use: Pre-deployment validation

**ai-friendly** - Reduce false positives
- For AI-generated configs
- Tolerates minor issues
- Use: When AI configures nodes

**strict** - Maximum validation
- Strictest rules
- May have false positives
- Use: Production deployment

### Returns

```javascript
{
  "valid": false,
  "errors": [
    {
      "type": "missing_required",
      "property": "name",
      "message": "Channel name is required",
      "fix": "Provide a channel name (lowercase, no spaces, 1-80 characters)"
    }
  ],
  "warnings": [
    {
      "type": "best_practice",
      "property": "errorHandling",
      "message": "Slack API can have rate limits",
      "suggestion": "Add onError: 'continueRegularOutput' with retryOnFail"
    }
  ],
  "suggestions": [],
  "summary": {
    "hasErrors": true,
    "errorCount": 1,
    "warningCount": 1
  }
}
```

### Error Types

- `missing_required` - Must fix
- `invalid_value` - Must fix
- `type_mismatch` - Must fix
- `best_practice` - Should fix (warning)
- `suggestion` - Optional improvement

---

## validate_workflow (STRUCTURE VALIDATION)

**Success Rate**: 95.5% | **Speed**: 100-500ms

**Use when**: Checking complete workflow before execution

**Syntax**:
```javascript
validate_workflow({
  workflow: {
    nodes: [...],        // Array of nodes
    connections: {...}   // Connections object
  },
  options: {
    validateNodes: true,       // Default: true
    validateConnections: true, // Default: true
    validateExpressions: true, // Default: true
    profile: "runtime"         // For node validation
  }
})
```

**Validates**:
- Node configurations
- Connection validity (no broken references)
- Expression syntax ({{ }} patterns)
- Workflow structure (triggers, flow)
- AI connections (8 types)

**Returns**: Comprehensive validation report with errors, warnings, suggestions

---

## Validation Loop Pattern

**Typical cycle**: 23s thinking, 58s fixing

```
1. Configure node
   ↓
2. validate_node_operation (23s thinking about errors)
   ↓
3. Fix errors
   ↓
4. validate_node_operation again (58s fixing)
   ↓
5. Repeat until valid
```

**Example**:
```javascript
// Iteration 1
let config = {
  resource: "channel",
  operation: "create"
};

const result1 = validate_node_operation({
  nodeType: "nodes-base.slack",
  config,
  profile: "runtime"
});
// → Error: Missing "name"

// Iteration 2 (~58s later)
config.name = "general";

const result2 = validate_node_operation({
  nodeType: "nodes-base.slack",
  config,
  profile: "runtime"
});
// → Valid!
```

---

## Auto-Sanitization System

**When it runs**: On ANY workflow update (create or update_partial)

**What it fixes** (automatically on ALL nodes):
1. Binary operators (equals, contains, greaterThan) → removes `singleValue`
2. Unary operators (isEmpty, isNotEmpty, true, false) → adds `singleValue: true`
3. Invalid operator structures → corrects to proper format
4. IF v2.2+ nodes → adds complete `conditions.options` metadata
5. Switch v3.2+ nodes → adds complete `conditions.options` for all rules

**What it CANNOT fix**:
- Broken connections (references to non-existent nodes)
- Branch count mismatches (3 Switch rules but only 2 outputs)
- Paradoxical corrupt states (API returns corrupt, rejects updates)

**Example**:
```javascript
// Before auto-sanitization
{
  "type": "boolean",
  "operation": "equals",
  "singleValue": true  // ❌ Binary operators shouldn't have this
}

// After auto-sanitization (automatic!)
{
  "type": "boolean",
  "operation": "equals"
  // singleValue removed automatically
}
```

**Recovery tools**:
- `cleanStaleConnections` operation - removes broken connections
- `n8n_autofix_workflow` - preview/apply fixes

---

## Binary vs Unary Operators

**Binary operators** (compare two values):
- equals, notEquals, contains, notContains
- greaterThan, lessThan, startsWith, endsWith
- **Must NOT have** `singleValue: true`

**Unary operators** (check single value):
- isEmpty, isNotEmpty, true, false
- **Must have** `singleValue: true`

**Auto-sanitization fixes these automatically!**

---

## Handling Validation Errors

### Process

```
1. Read error message carefully
2. Check if it's a known false positive
3. Fix real errors
4. Validate again
5. Iterate until clean
```

### Common Errors

**"Required field missing"**
→ Add the field with appropriate value

**"Invalid value"**
→ Check allowed values in essentials/documentation

**"Type mismatch"**
→ Convert to correct type (string/number/boolean)

**"Cannot have singleValue"**
→ Auto-sanitization will fix on next update

**"Missing operator metadata"**
→ Auto-sanitization will fix on next update

### False Positives

Some validation warnings may be acceptable:
- Optional best practices
- Node-specific edge cases
- Profile-dependent issues

Use **ai-friendly** profile to reduce false positives.

---

## Best Practices

### ✅ Do

- Use **runtime** profile for pre-deployment
- Validate after every configuration change
- Fix errors immediately (avg 58s)
- Iterate validation loop
- Trust auto-sanitization for operator issues
- Use minimal profile for quick checks
- Complete workflow activation manually in n8n UI (API/MCP cannot activate workflows)

### ❌ Don't

- Skip validation before deployment
- Ignore error messages
- Use strict profile during development (too many warnings)
- Assume validation passed (check result)
- Try to manually fix auto-sanitization issues

---

## Example: Complete Validation Workflow

```javascript
// Step 1: Get node requirements
validate_node_minimal({
  nodeType: "nodes-base.slack",
  config: {}
});
// → Know what's required

// Step 2: Configure node
const config = {
  resource: "message",
  operation: "post",
  channel: "#general",
  text: "Hello!"
};

// Step 3: Validate configuration
const result = validate_node_operation({
  nodeType: "nodes-base.slack",
  config,
  profile: "runtime"
});

// Step 4: Check result
if (result.valid) {
  console.log("✅ Configuration valid!");
} else {
  console.log("❌ Errors:", result.errors);
  // Fix and validate again
}

// Step 5: Validate in workflow context
validate_workflow({
  workflow: {
    nodes: [{...config as node...}],
    connections: {...}
  }
});
```

---

## Summary

**Key Points**:
1. Use **runtime** profile (balanced validation)
2. Validation loop: validate → fix (58s) → validate again
3. Auto-sanitization fixes operator structures automatically
4. Binary operators ≠ singleValue, Unary operators = singleValue: true
5. Iterate until validation passes

**Tool Selection**:
- **validate_node_minimal**: Quick check
- **validate_node_operation**: Full config validation (**use this!**)
- **validate_workflow**: Complete workflow check

**Related**:
- [SEARCH_GUIDE.md](SEARCH_GUIDE.md) - Find nodes
- [WORKFLOW_GUIDE.md](WORKFLOW_GUIDE.md) - Build workflows
