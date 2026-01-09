---
name: feature-design-assistant
description: "Turn ideas into fully formed designs and specs through natural collaborative dialogue. Use when planning new features, designing architecture, or making significant changes to the codebase."
---

# Feature Design Assistant

Help turn ideas into fully formed designs and specs through structured information gathering and collaborative validation.

**Announce at start:** "I'm using the feature-design-assistant skill to design this feature."

## Phase 1: Context Discovery

First, explore the codebase to understand:
- Project structure and tech stack
- Existing patterns and conventions
- Related features or modules
- Recent changes in relevant areas

## Phase 2: Structured Information Gathering

Use **AskUserQuestion** to batch collect information efficiently. Each call can ask up to 4 questions.

### Round 1: Core Requirements (4 questions)

```json
{
  "questions": [
    {
      "question": "What is the primary goal of this feature?",
      "header": "Goal",
      "multiSelect": false,
      "options": [
        { "label": "New Functionality", "description": "Add entirely new capability to the system" },
        { "label": "Enhancement", "description": "Improve or extend existing feature" },
        { "label": "Bug Fix", "description": "Fix incorrect behavior or issue" },
        { "label": "Refactoring", "description": "Improve code quality without changing behavior" }
      ]
    },
    {
      "question": "Who are the primary users of this feature?",
      "header": "Users",
      "multiSelect": true,
      "options": [
        { "label": "End Users", "description": "External customers using the product" },
        { "label": "Admins", "description": "Internal administrators or operators" },
        { "label": "Developers", "description": "Other developers using APIs or SDKs" },
        { "label": "System", "description": "Automated processes or background jobs" }
      ]
    },
    {
      "question": "What is the expected scope of this feature?",
      "header": "Scope",
      "multiSelect": false,
      "options": [
        { "label": "Small (1-2 days)", "description": "Single component, limited changes" },
        { "label": "Medium (3-5 days)", "description": "Multiple components, moderate complexity" },
        { "label": "Large (1-2 weeks)", "description": "Cross-cutting concerns, significant changes" },
        { "label": "Unsure", "description": "Need to explore further to estimate" }
      ]
    },
    {
      "question": "Are there any hard deadlines or constraints?",
      "header": "Timeline",
      "multiSelect": false,
      "options": [
        { "label": "Urgent", "description": "Need this ASAP, within days" },
        { "label": "This Sprint", "description": "Should be done within current sprint" },
        { "label": "Flexible", "description": "No hard deadline, quality over speed" },
        { "label": "Planning Only", "description": "Just designing now, implementing later" }
      ]
    }
  ]
}
```

### Round 2: Technical Requirements (4 questions)

```json
{
  "questions": [
    {
      "question": "Which layers of the system will this feature touch?",
      "header": "Layers",
      "multiSelect": true,
      "options": [
        { "label": "Data Model", "description": "Database schema, models, migrations" },
        { "label": "Business Logic", "description": "Services, domain logic, rules" },
        { "label": "API", "description": "REST/GraphQL endpoints, contracts" },
        { "label": "UI", "description": "Frontend components, user interface" }
      ]
    },
    {
      "question": "What are the key quality requirements?",
      "header": "Quality",
      "multiSelect": true,
      "options": [
        { "label": "High Performance", "description": "Must handle high load or be very fast" },
        { "label": "Strong Security", "description": "Sensitive data, auth, access control" },
        { "label": "High Reliability", "description": "Cannot fail, needs redundancy" },
        { "label": "Easy Maintenance", "description": "Needs to be easily understood and modified" }
      ]
    },
    {
      "question": "How should errors be handled?",
      "header": "Errors",
      "multiSelect": false,
      "options": [
        { "label": "Fail Fast", "description": "Stop immediately on any error" },
        { "label": "Graceful Degrade", "description": "Continue with reduced functionality" },
        { "label": "Retry & Recover", "description": "Automatic retry with recovery logic" },
        { "label": "Context Dependent", "description": "Different strategies for different cases" }
      ]
    },
    {
      "question": "What testing approach is preferred?",
      "header": "Testing",
      "multiSelect": false,
      "options": [
        { "label": "TDD (Recommended)", "description": "Write tests first, then implementation" },
        { "label": "Test After", "description": "Implement first, add tests after" },
        { "label": "Minimal Tests", "description": "Only critical path testing" },
        { "label": "No Tests", "description": "Skip testing for this feature" }
      ]
    }
  ]
}
```

### Round 3: Integration & Dependencies (4 questions)

```json
{
  "questions": [
    {
      "question": "Does this feature need external integrations?",
      "header": "Integrations",
      "multiSelect": true,
      "options": [
        { "label": "Database", "description": "New tables, queries, or migrations" },
        { "label": "External APIs", "description": "Third-party service calls" },
        { "label": "Message Queue", "description": "Async processing, events" },
        { "label": "None", "description": "No external integrations needed" }
      ]
    },
    {
      "question": "Are there dependencies on other features or teams?",
      "header": "Dependencies",
      "multiSelect": true,
      "options": [
        { "label": "Auth System", "description": "User authentication or authorization" },
        { "label": "Other Features", "description": "Depends on features being developed" },
        { "label": "External Team", "description": "Needs input from another team" },
        { "label": "None", "description": "Fully independent feature" }
      ]
    },
    {
      "question": "How should we handle backwards compatibility?",
      "header": "Compat",
      "multiSelect": false,
      "options": [
        { "label": "Must Maintain", "description": "Cannot break existing clients" },
        { "label": "Version API", "description": "Create new version, deprecate old" },
        { "label": "Breaking OK", "description": "Can make breaking changes" },
        { "label": "Not Applicable", "description": "New feature, no existing users" }
      ]
    },
    {
      "question": "What documentation is needed?",
      "header": "Docs",
      "multiSelect": true,
      "options": [
        { "label": "API Docs", "description": "Endpoint documentation" },
        { "label": "User Guide", "description": "How-to for end users" },
        { "label": "Dev Guide", "description": "Technical implementation details" },
        { "label": "None", "description": "No documentation needed" }
      ]
    }
  ]
}
```

### Round 4: Clarifying Questions (Context-Dependent)

Based on previous answers, ask follow-up questions. Examples:

**If UI layer selected:**
```json
{
  "questions": [
    {
      "question": "What UI framework/approach should we use?",
      "header": "UI Tech",
      "multiSelect": false,
      "options": [
        { "label": "React", "description": "React components with hooks" },
        { "label": "Vue", "description": "Vue.js components" },
        { "label": "Server-Side", "description": "Server-rendered HTML templates" },
        { "label": "Existing Pattern", "description": "Follow current project conventions" }
      ]
    }
  ]
}
```

**If High Security selected:**
```json
{
  "questions": [
    {
      "question": "What security measures are required?",
      "header": "Security",
      "multiSelect": true,
      "options": [
        { "label": "Input Validation", "description": "Strict input sanitization" },
        { "label": "Rate Limiting", "description": "Prevent abuse and DoS" },
        { "label": "Audit Logging", "description": "Track all sensitive actions" },
        { "label": "Encryption", "description": "Encrypt data at rest/transit" }
      ]
    }
  ]
}
```

## Phase 3: Approach Exploration

After gathering requirements, propose 2-3 approaches:

```markdown
## Approach Options

### Option A: [Name] (Recommended)
**Pros:** ...
**Cons:** ...
**Best for:** ...

### Option B: [Name]
**Pros:** ...
**Cons:** ...
**Best for:** ...

### Option C: [Name]
**Pros:** ...
**Cons:** ...
**Best for:** ...
```

Use AskUserQuestion to confirm approach:

```json
{
  "questions": [
    {
      "question": "Which approach would you like to proceed with?",
      "header": "Approach",
      "multiSelect": false,
      "options": [
        { "label": "Option A (Recommended)", "description": "Brief summary of approach A" },
        { "label": "Option B", "description": "Brief summary of approach B" },
        { "label": "Option C", "description": "Brief summary of approach C" }
      ]
    }
  ]
}
```

## Phase 4: Design Presentation

Present design in sections (300-500 words each), validate after each:

1. **Architecture Overview** - High-level structure
2. **Data Model** - Entities, relationships, schema
3. **API Design** - Endpoints, request/response
4. **Component Design** - Internal modules, interfaces
5. **Error Handling** - Error cases, recovery strategies
6. **Testing Strategy** - What and how to test

After each section, use AskUserQuestion:

```json
{
  "questions": [
    {
      "question": "Does this section look correct?",
      "header": "Review",
      "multiSelect": false,
      "options": [
        { "label": "Looks Good", "description": "Continue to next section" },
        { "label": "Minor Changes", "description": "Small adjustments needed" },
        { "label": "Major Revision", "description": "Significant changes required" },
        { "label": "Questions", "description": "Need clarification before proceeding" }
      ]
    }
  ]
}
```

## Phase 5: Documentation & Tasks

### Save Design Document

Write to `docs/designs/YYYY-MM-DD-<topic>-design.md`:

```markdown
# Feature: [Name]

## Summary
[Brief description]

## Requirements
[From Phase 2 answers]

## Architecture
[From Phase 4]

## Implementation Tasks
[Task checklist]
```

### Generate Implementation Tasks

```markdown
## Implementation Tasks

- [ ] **Task Title** `priority:1` `phase:model` `time:15min`
  - files: src/file1.py, tests/test_file1.py
  - [ ] Write failing test for X
  - [ ] Run test, verify it fails
  - [ ] Implement minimal code
  - [ ] Run test, verify it passes
  - [ ] Commit

- [ ] **Another Task** `priority:2` `phase:api` `deps:Task Title` `time:10min`
  - files: src/api.py
  - [ ] Write failing test
  - [ ] Implement and verify
  - [ ] Commit
```

## Phase 6: Execution Handoff

```json
{
  "questions": [
    {
      "question": "How would you like to proceed with implementation?",
      "header": "Next Step",
      "multiSelect": false,
      "options": [
        { "label": "Execute Now", "description": "Run /feature-pipeline in this session" },
        { "label": "New Session", "description": "Start fresh session for implementation" },
        { "label": "Later", "description": "Save design, implement manually later" },
        { "label": "Revise Design", "description": "Go back and modify the design" }
      ]
    }
  ]
}
```

## Key Principles

- **Batch questions efficiently** - Use all 4 question slots when appropriate
- **Use multiSelect for non-exclusive options** - Layers, features, requirements
- **Use single-select for decisions** - Approach, timeline, strategy
- **Mark recommendations** - Add "(Recommended)" to preferred options
- **Progressive refinement** - General → Specific questions
- **Validate incrementally** - Check understanding at each phase
- **YAGNI ruthlessly** - Remove unnecessary features from designs
