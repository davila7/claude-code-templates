# Excalidraw Skill

A Claude Code skill for efficiently working with Excalidraw diagram files through intelligent subagent delegation.

## Purpose

This skill provides a pattern for working with Excalidraw files (*.excalidraw, *.excalidraw.json) without exhausting the main agent's context budget. Excalidraw JSON files are extremely verbose (4k-22k tokens per file) but have low information density, making them perfect candidates for subagent delegation.

## When to Use

Use this skill when:

- Working with files ending in `.excalidraw` or `.excalidraw.json`
- User requests diagram operations: "explain diagram", "update flowchart", "create architecture visualization"
- User mentions: "flowchart", "architecture diagram", "Excalidraw file"
- Performing architecture/design documentation tasks involving visual artifacts

**Important:** Use delegation even for:
- "Small" files (smallest is still 4k tokens)
- "Quick checks" (loading full JSON even just to check component names)
- Single file operations (isolation prevents context pollution)
- Modifications (don't need full format understanding in main context)

## The Problem This Solves

Excalidraw files have an extremely low signal-to-noise ratio:

- Each shape has 20+ properties (x, y, width, height, strokeColor, seed, version, etc.)
- Most properties are visual metadata (positioning, styling, roughness)
- Actual useful content: text labels and element relationships (<10% of file)
- **Token cost**: Single files range from 4k-22k tokens
- **Context exhaustion**: Reading 7 diagrams = 67k tokens (33% of 200k budget)

### Real Examples

- 14-element diagram: 596 lines, 16K, ~4k tokens
- 79-element diagram: 2,916 lines, 88K, ~22k tokens (exceeds read limits)

## How It Works

### Core Principle

**Main agents NEVER read Excalidraw files directly. Always delegate to subagents.**

### The Delegation Pattern

1. Main agent receives request involving Excalidraw file
2. Main agent creates a task description for subagent
3. Subagent reads/modifies the Excalidraw JSON in isolation
4. Subagent returns text-only summary (not raw JSON)
5. Main agent context remains clean

### What Main Agents Should NEVER Do

- Use Read tool on *.excalidraw files
- Parse Excalidraw JSON in main context
- Load multiple diagrams for comparison
- Inspect file to "understand the format"

### What Main Agents Should ALWAYS Do

- Delegate ALL Excalidraw operations to subagents
- Provide clear task description to subagent
- Request text-only summaries (not raw JSON)
- Keep diagram analysis isolated from main work

## Key Features

### Token Efficiency

| Scenario | Without Delegation | With Delegation | Savings |
|----------|-------------------|-----------------|---------|
| Single large file | 22k tokens (45% budget) | ~500 tokens | 98% |
| Two-file comparison | 18k tokens (9% budget) | ~800 tokens | 96% |
| Modification task | 14k tokens (7% budget) | ~300 tokens | 98% |

### Context Preservation

- Reading all 7 project diagrams directly: 67k tokens (33% of budget)
- With delegation: ~2k tokens (isolated in subagents)
- **Overall savings: 97% context budget preserved**

## Usage Examples

### Example 1: Understanding a Diagram

**User Request:** "What architecture is shown in detailed-architecture.excalidraw.json?"

**Correct Approach:**
```
Agent: I'll use a subagent to extract the architecture details.

Task: Extract and explain the components in detailed-architecture.excalidraw.json

Approach:
1. Read the Excalidraw JSON
2. Extract only text elements (ignore positioning/styling)
3. Identify relationships between components
4. Summarize architecture/flow

Return:
- List of components/services with descriptions
- Connection/dependency relationships
- Key insights about the architecture
- DO NOT return raw JSON or verbose element details
```

**Result:** ~500 token summary with component list and relationships, main context preserved.

### Example 2: Modifying a Diagram

**User Request:** "Add a Redis cache component to the architecture diagram, connected to the API service"

**Correct Approach:**
```
Task: Add Redis cache to architecture.excalidraw.json, connected to API service

Approach:
1. Read file to identify existing elements
2. Find API service element and its position
3. Create new element JSON for Redis cache
4. Add arrow elements for connections
5. Write updated file

Return:
- Confirmation of changes made
- Position of new element
- IDs of created elements
```

### Example 3: Creating a New Diagram

**User Request:** "Create a flowchart showing the user authentication flow"

**Correct Approach:**
```
Task: Create new Excalidraw diagram showing user authentication flow

Approach:
1. Design layout for authentication steps (login, validate, token, response)
2. Create rectangle elements with text labels
3. Add arrows showing relationships
4. Use consistent styling (colors, fonts)
5. Write to auth-flow.excalidraw.json

Return:
- Confirmation of file created
- Summary of components included
- File location
```

### Example 4: Comparing Diagrams

**User Request:** "Compare the monolith vs microservices architecture diagrams"

**Correct Approach:**
```
Task: Compare architecture approaches in monolith.excalidraw.json vs microservices.excalidraw.json

Approach:
1. Read both files
2. Extract text labels from each
3. Identify structural differences
4. Compare component relationships

Return:
- Key differences in architecture
- Components unique to each approach
- Relationship/flow differences
- DO NOT return full element details from both files
```

## Common Rationalizations to Avoid

Agents often try to justify reading Excalidraw files directly. Here are common excuses and why they're wrong:

| Excuse | Reality | What to Do |
|--------|---------|------------|
| "Direct reading is most efficient" | Consumes 4k-22k tokens unnecessarily | Delegate to subagent |
| "It's token-efficient to read directly" | Baseline tests showed 9-45% budget used | Always delegate |
| "This is optimal for one-time analysis" | "One-time" still pollutes main context | Subagent isolation |
| "The JSON is straightforward" | Simplicity ≠ token efficiency | Delegate anyway |
| "I need to understand the format" | Format understanding not needed in main agent | Subagent handles format |
| "Within reasonable bounds" (18k tokens) | "Reasonable" is subjective rationalization | Hard rule: delegate |
| "Just a quick check of components" | "Quick check" still loads full JSON | Extract text via subagent |
| "File is small (16K)" | 4k tokens is NOT small | Size threshold doesn't matter |

## Red Flags - Stop and Delegate

If you find yourself about to:

- Use Read tool on .excalidraw file
- "Quickly check" what components exist
- "Understand the structure" before modifying
- Load file to "see what's there"
- Compare multiple diagrams side-by-side
- Parse JSON to "extract just the text"

**STOP. Use the Task tool with a subagent instead.**

## Quick Reference

| Operation | Main Agent Action | Subagent Returns |
|-----------|-------------------|------------------|
| **Understand diagram** | Delegate with "Extract and explain" template | Component list + relationships |
| **Modify diagram** | Delegate with "Add [X] connected to [Y]" template | Confirmation + changes made |
| **Create diagram** | Delegate with "Create showing [description]" template | File location + summary |
| **Compare diagrams** | Delegate with "Compare [A] vs [B]" template | Key differences (not raw JSON) |

## The Iron Law

**Main agents NEVER read Excalidraw files. No exceptions.**

Not for:
- "Quick checks"
- "Small files"
- "Understanding format"
- "One-time analysis"
- "Optimal efficiency"

**Always delegate. Isolation is free via subagents.**

## Why "Straightforward JSON" Doesn't Matter

Agents often rationalize: "The format is simple, I can just read it."

The problem isn't complexity - it's verbosity:
- Simple structure with 20+ properties per element
- Repetitive metadata (seed, version, nonce, roughness)
- Positioning data (x, y, width, height) not semantically useful
- Visual styling (strokeColor, opacity, fillStyle) irrelevant to content

Token cost comes from volume, not complexity:
- 79 elements × ~280 tokens/element = 22k tokens
- Most tokens are metadata noise
- Only text labels and relationships matter (~10% of content)

## Task Templates

### Read/Understand Operation
```
Task: Extract and explain the components in [file.excalidraw.json]

Approach:
1. Read the Excalidraw JSON
2. Extract only text elements (ignore positioning/styling)
3. Identify relationships between components
4. Summarize architecture/flow

Return:
- List of components/services with descriptions
- Connection/dependency relationships
- Key insights about the architecture
- DO NOT return raw JSON or verbose element details
```

### Modify Operation
```
Task: Add [component] to [file.excalidraw.json], connected to [existing-component]

Approach:
1. Read file to identify existing elements
2. Find [existing-component] and its position
3. Create new element JSON for [component]
4. Add arrow elements for connections
5. Write updated file

Return:
- Confirmation of changes made
- Position of new element
- IDs of created elements
```

### Create Operation
```
Task: Create new Excalidraw diagram showing [description]

Approach:
1. Design layout for [number] components
2. Create rectangle elements with text labels
3. Add arrows showing relationships
4. Use consistent styling (colors, fonts)
5. Write to [file.excalidraw.json]

Return:
- Confirmation of file created
- Summary of components included
- File location
```

### Compare Operation
```
Task: Compare architecture approaches in [file1] vs [file2]

Approach:
1. Read both files
2. Extract text labels from each
3. Identify structural differences
4. Compare component relationships

Return:
- Key differences in architecture
- Components unique to each approach
- Relationship/flow differences
- DO NOT return full element details from both files
```

## Contributing

When improving this skill:

1. Never weaken the delegation requirement
2. Add new task templates as patterns emerge
3. Document token costs of new operations
4. Update examples with real-world scenarios
5. Keep the "Iron Law" absolute

## License

Part of the Softaworks Agent Skills collection.
