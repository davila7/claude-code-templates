---
name: excalidraw
description: "Use when working with *.excalidraw or *.excalidraw.json files, user mentions diagrams/flowcharts, or requests architecture visualization - delegates all Excalidraw operations to subagents to prevent context exhaustion from verbose JSON (single files: 4k-22k tokens, can exceed read limits)"
---

# Excalidraw Subagent Delegation

## Overview

**Core principle:** Main agents NEVER read Excalidraw files directly. Always delegate to subagents to isolate context consumption.

Excalidraw files are JSON with high token cost but low information density. Single files range from 4k-22k tokens (largest can exceed read tool limits). Reading multiple diagrams quickly exhausts context budget (7 files = 67k tokens = 33% of budget).

## The Problem

Excalidraw JSON structure:
- Each shape has 20+ properties (x, y, width, height, strokeColor, seed, version, etc.)
- Most properties are visual metadata (positioning, styling, roughness)
- Actual content: text labels and element relationships (<10% of file)
- **Signal-to-noise ratio is extremely low**

Example: 14-element diagram = 596 lines, 16K, ~4k tokens. 79-element diagram = 2,916 lines, 88K, ~22k tokens (exceeds read limit).

## When to Use

**Trigger on ANY of these:**
- File path contains `.excalidraw` or `.excalidraw.json`
- User requests: "explain/update/create diagram", "show architecture", "visualize flow"
- User mentions: "flowchart", "architecture diagram", "Excalidraw file"
- Architecture/design documentation tasks involving visual artifacts

**Use delegation even for:**
- "Small" files (smallest is 4k tokens - still significant)
- "Quick checks" (checking component names still loads full JSON)
- Single file operations (isolation prevents context pollution)
- Modifications (don't need full format understanding in main context)

## Delegation Pattern

### Main Agent Responsibilities

**NEVER:**
- ❌ Use Read tool on *.excalidraw files
- ❌ Parse Excalidraw JSON in main context
- ❌ Load multiple diagrams for comparison
- ❌ Inspect file to "understand the format"

**ALWAYS:**
- ✅ Delegate ALL Excalidraw operations to subagents
- ✅ Provide clear task description to subagent
- ✅ Request text-only summaries (not raw JSON)
- ✅ Keep diagram analysis isolated from main work

### Subagent Task Templates

#### Read/Understand Operation
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

#### Modify Operation
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

#### Create Operation
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

#### Compare Operation
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

## Common Rationalizations (STOP and Delegate Instead)

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

## Red Flags - STOP and Delegate

Catch yourself about to:
- Use Read tool on .excalidraw file
- "Quickly check" what components exist
- "Understand the structure" before modifying
- Load file to "see what's there"
- Compare multiple diagrams side-by-side
- Parse JSON to "extract just the text"

**All of these mean: Use Task tool with subagent instead.**

## Quick Reference

| Operation | Main Agent Action | Subagent Returns |
|-----------|-------------------|------------------|
| **Understand diagram** | Delegate with "Extract and explain" template | Component list + relationships |
| **Modify diagram** | Delegate with "Add [X] connected to [Y]" template | Confirmation + changes made |
| **Create diagram** | Delegate with "Create showing [description]" template | File location + summary |
| **Compare diagrams** | Delegate with "Compare [A] vs [B]" template | Key differences (not raw JSON) |

## Token Analysis (Why This Matters)

Real data from baseline testing:

| Scenario | Without Delegation | With Delegation | Savings |
|----------|-------------------|-----------------|---------|
| Single large file | 22k tokens (45% budget) | ~500 tokens (subagent summary) | 98% |
| Two-file comparison | 18k tokens (9% budget) | ~800 tokens (diff summary) | 96% |
| Modification task | 14k tokens (7% budget) | ~300 tokens (confirmation) | 98% |

**Context pollution impact:**
- Reading all 7 project diagrams: 67k tokens (33% of 200k budget)
- With delegation: ~2k tokens (isolated in subagents)
- **Savings: 97% context budget preserved**

## Implementation Example

**❌ BAD (Direct Read):**
```
User: "What architecture is shown in detailed-architecture.excalidraw.json?"
Agent: Let me read that file... [reads 22k tokens into main context]
```

**✅ GOOD (Subagent Delegation):**
```
User: "What architecture is shown in detailed-architecture.excalidraw.json?"
Agent: I'll use a subagent to extract the architecture details.

[Dispatches Task tool with general-purpose subagent]
Task: Extract and explain components in .ryanquinn3/ticketing/detailed-architecture.excalidraw.json

[Receives ~500 token summary with component list and relationships]
[Responds to user with architecture explanation, main context preserved]
```

## Why "Straightforward JSON" Doesn't Matter

Agents often rationalize: "The format is simple, I can just read it."

**The problem isn't complexity - it's verbosity:**
- Simple structure with 20+ properties per element
- Repetitive metadata (seed, version, nonce, roughness)
- Positioning data (x, y, width, height) not semantically useful
- Visual styling (strokeColor, opacity, fillStyle) irrelevant to content

**Token cost comes from volume, not complexity.**

Even "straightforward" JSON consumes 4k-22k tokens because:
- 79 elements × ~280 tokens/element = 22k tokens
- Most tokens are metadata noise
- Only text labels and relationships matter (~10% of content)

## The Iron Law

**Main agents NEVER read Excalidraw files. No exceptions.**

Not for:
- "Quick checks"
- "Small files"
- "Understanding format"
- "One-time analysis"
- "Optimal efficiency"

**Always delegate. Isolation is free via subagents.**
