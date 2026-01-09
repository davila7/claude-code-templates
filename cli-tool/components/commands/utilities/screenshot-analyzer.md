---
description: "Analyze product screenshots to extract features and generate development task lists."
argument-hint: Screenshot path or description
allowed-tools: Read, Write, Grep, Glob, TodoWrite, Task
---

# Screenshot Analysis Command

This command uses a multi-agent pipeline for comprehensive screenshot analysis.

## Phase 1: Discovery

**Goal**: Understand what screenshots to analyze

Initial request: $ARGUMENTS

**Actions**:
1. If no screenshot path provided, ask user:
   - What screenshots do you want me to analyze?
   - What product/app are these from?
   - Is this for competitive analysis or internal product planning?
2. Read and verify the screenshot files exist
3. Confirm scope with user (single screen, full app, specific feature)

---

## Phase 2: Multi-Agent Analysis

For each screenshot, launch THREE analysis agents IN PARALLEL using Task tool:

### Parallel Agent Calls

Launch all three in a SINGLE message with multiple Task tool calls:

**Task 1: UI Analysis**
- subagent_type: "general-purpose"
- prompt: Include screenshot path, ask for UI components, layout, design patterns analysis in JSON format

**Task 2: Interaction Analysis**
- subagent_type: "general-purpose"
- prompt: Include screenshot path, ask for user flows, clickable elements, state transitions in JSON format

**Task 3: Business Analysis**
- subagent_type: "general-purpose"
- prompt: Include screenshot path, ask for business functions, data entities, domain logic in JSON format

Each agent should:
1. Read the screenshot using the Read tool
2. Analyze according to their specialty
3. Return structured JSON analysis

---

## Phase 3: Synthesis

After parallel analyses complete, launch synthesizer agent:

**Task 4: Synthesis**
- subagent_type: "general-purpose"
- prompt: Provide all three analysis results, ask to combine into unified task list

The synthesizer should:
1. Cross-reference all analyses
2. Deduplicate features
3. Generate hierarchical task list
4. Output markdown format

---

## Phase 4: Review

Launch reviewer agent to validate:

**Task 5: Review**
- subagent_type: "general-purpose"
- prompt: Provide screenshot path and synthesized task list, ask for completeness review

The reviewer should:
1. Compare against original screenshot
2. Check for missing features
3. Validate task quality
4. Suggest corrections if needed

---

## Phase 5: Output

1. Write final task list to `docs/plans/YYYY-MM-DD-<product>-features.md`
2. Create the docs/plans directory if it doesn't exist
3. Present summary to user with:
   - Total modules identified
   - Total features extracted
   - Total tasks generated
   - Link to output file

---

## Example Parallel Analysis Call

When you reach Phase 2, your response should include THREE Task tool calls like:

```
[Task 1: UI Analysis for screenshot.png]
[Task 2: Interaction Analysis for screenshot.png]
[Task 3: Business Analysis for screenshot.png]
```

All launched simultaneously for maximum efficiency.
