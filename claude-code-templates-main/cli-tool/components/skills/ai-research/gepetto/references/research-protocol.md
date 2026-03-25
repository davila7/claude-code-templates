# Research Protocol

This document defines the research decision and execution flow.

## Overview

```
┌─────────────────────────────────────────────────────────────┐
│  RESEARCH FLOW                                              │
│                                                             │
│  Step 4: Decide what to research                            │
│    - Codebase research? (existing patterns/conventions)     │
│    - Web research? (best practices, SOTA approaches)        │
│                                                             │
│  Step 5: Execute research (parallel if both selected)       │
│    - Subagents return results                               │
│    - Main Claude combines and writes claude-research.md     │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Step 4: Research Decision

### 4.1 Read and Analyze the Spec File

Read the spec file and extract potential research topics by identifying:

- **Technologies mentioned** (React, Python, PostgreSQL, Redis, etc.)
- **Feature types** (authentication, file upload, real-time sync, caching, etc.)
- **Architecture patterns** (microservices, event-driven, serverless, etc.)
- **Integration points** (third-party APIs, OAuth providers, payment gateways, etc.)

Generate 3-5 research topic suggestions based on what you find. Format them as searchable queries with year for recency:
- "React authentication patterns 2025"
- "PostgreSQL full-text search best practices"
- "Redis session storage patterns"

If the spec is vague, fall back to generic options:
- "General best practices for {detected_language/framework}"
- "Security considerations for {feature_type}"

### 4.2 Ask About Codebase Research

Use AskUserQuestion:

```
question: "Is there existing code I should research first?"
header: "Codebase"
options:
  - label: "Yes, research the codebase"
    description: "Analyze existing patterns, conventions, dependencies"
  - label: "No existing code"
    description: "This is a new project or standalone feature"
```

### 4.3 Ask About Web Research

Present the derived topics as multi-select options:

```
question: "Should I research current best practices for any of these topics?"
header: "Web Research"
multiSelect: true
options:
  - label: "{derived_topic_1}"
    description: "Based on spec mention of {X}"
  - label: "{derived_topic_2}"
    description: "Based on spec mention of {Y}"
  - label: "{derived_topic_3}"
    description: "Based on spec mention of {Z}"
```

If user selects "Other", follow up to get custom topics.

### 4.4 Handle "No Research" Case

If user selects no codebase AND no web research, skip step 5 entirely.

---

## Step 5: Execute Research

### Critical Pattern: Subagents Return Results, Parent Writes Files

**DO NOT** have subagents write to files directly. This avoids race conditions and keeps control with the main context.

```
┌─────────────────────────────────────────────────────────────┐
│  PARALLEL RESEARCH EXECUTION                                │
│                                                             │
│  Task 1: Explore ──────────┐                                │
│    (returns codebase       │                                │
│     findings as markdown)  ├──→ Main Claude combines       │
│                            │    and writes single          │
│  Task 2: Explore ──────────┘    claude-research.md         │
│    (returns best practices                                  │
│     findings as markdown)                                   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 5.1 Codebase Research (if selected)

Launch Task tool with `subagent_type=Explore`:

```
Task tool:
  subagent_type: Explore
  description: "Research codebase patterns"
  prompt: |
    Research this codebase to understand:
    - Project structure and architecture
    - Existing patterns and conventions
    - Dependencies and how they're used
    - Testing setup (framework, patterns, how tests are run)

    Focus areas from user: {user_specified_areas_if_any}

    Return your findings as markdown.
    DO NOT write to any files. Return findings in your response.
```

### 5.2 Web Research (if topics selected)

Launch Task tool with `subagent_type=Explore`:

```
Task tool:
  subagent_type: Explore
  description: "Research best practices"
  prompt: |
    Research current best practices for the following topics:
    {selected_topics_list}

    For each topic:
    1. Use WebSearch to find authoritative sources
    2. Use WebFetch on promising results to extract recommendations
    3. Cross-validate information across sources
    4. Synthesize findings with clear recommendations

    Return your findings as markdown. Always cite sources with URLs.
    DO NOT write to any files. Return findings in your response.
```

### 5.3 Parallel Execution

If both codebase and web research are needed, launch **both Task tools in a single message**.

```
# Single message with multiple tool calls:
[Task tool call 1: Explore subagent for codebase]
[Task tool call 2: Explore subagent for web research]
```

Wait for both to complete, then combine results.

### 5.4 Combine Results and Write File

After collecting results from all subagents, combine them into `<planning_dir>/claude-research.md`.

Structure the file however makes sense for the findings.

---

## Edge Cases

| Case | Handling |
|------|----------|
| Spec file is vague | Present generic options based on detected language/framework |
| User selects no research | Skip step 5, proceed to step 6 (interview) |
| One subagent fails | Log warning, write file with only successful research |
| Both subagents fail | Log error, ask user if they want to retry or proceed |
| Only one research type | Run single subagent, write file with just that content |
