# Frontend to Backend Requirements

A Claude Code skill for frontend developers to document data needs and API requirements for backend developers in a collaborative, non-prescriptive way.

## Purpose

This skill helps frontend developers communicate **what data they need** without dictating **how backend should implement it**. It creates a structured requirements document that describes UI needs, user actions, states to handle, and business rules—leaving implementation details to the backend team.

## When to Use This Skill

Use this skill when:
- You need to communicate API requirements from frontend to backend
- You're planning a new feature that requires backend support
- You want to document what data your UI needs to display
- You're describing user actions that require backend operations
- The user says phrases like:
  - "backend requirements"
  - "what data do I need"
  - "API requirements"
  - "what should the backend provide"
  - Describing data needs for a UI component

## How It Works

The skill guides you through documenting your requirements in a structured format that:

1. **Describes the feature** - What screen/component you're building and its purpose
2. **Lists data needs** - What information needs to be displayed (without specifying field names)
3. **Identifies actions** - What users can do and expected outcomes
4. **Defines states** - Loading, empty, error, and edge cases to handle
5. **Surfaces uncertainties** - Questions and assumptions that need clarification
6. **Invites collaboration** - Opens discussion for backend input and pushback

All output goes to `.claude/docs/ai/<feature-name>/backend-requirements.md` - no chat output.

## Key Features

### Frontend Owns
- What data is needed
- What actions exist
- UI states to handle
- User-facing validation
- Display requirements

### Backend Owns
- How data is structured
- Endpoint design
- Field names and types
- API conventions
- Performance and caching strategies

### Collaboration Principles
- **Describe, don't prescribe** - Say what you need, not how to provide it
- **Include context** - Why you need it helps backend make better decisions
- **Surface unknowns** - Don't hide confusion, invite clarification
- **Invite pushback** - Explicitly ask for backend's input
- **Stay humble** - You're requesting, not demanding

## Output Format

The skill creates a markdown document with this structure:

```markdown
# Backend Requirements: <Feature Name>

## Context
[What we're building, who it's for, what problem it solves]

## Screens/Components

### <Screen/Component Name>
**Purpose**: What this screen does

**Data I need to display**:
- [Description of data piece, not field name]
- [Relationships between pieces]

**Actions**:
- [Action description] → [Expected outcome]

**States to handle**:
- **Empty**: [When/why this happens]
- **Loading**: [What's being fetched]
- **Error**: [What can go wrong, what user sees]

**Business rules affecting UI**:
- [Rule that changes what's visible/enabled]

## Uncertainties
- [ ] Not sure if [X] should show when [Y]

## Questions for Backend
- Would it make sense to combine [X] and [Y]?

## Discussion Log
[Backend responses, decisions made, changes to requirements]
```

## Usage Examples

### Good Request (Describing Needs)
> "I need to show a list of contracts. Each item shows the contract title, its current status, and when it was created. User should be able to filter by status."

### Bad Request (Dictating Implementation)
> "I need a GET /api/contracts endpoint that returns an array with fields: id, title, status, created_at"

### Good Request (Describing Relationship)
> "For each contract, I need to show who the provider is (their name and maybe logo)"

### Bad Request (Assuming Structure)
> "The provider object should be nested inside the contract response"

## Workflow

1. **Describe the feature** - What is it, who uses it, what's the goal
2. **List data needs** - Information to display, actions to perform, states to handle
3. **Surface uncertainties** - Business rules you don't understand, edge cases, guesses
4. **Leave room for discussion** - Open questions for backend team
5. **Update after feedback** - Add backend responses to Discussion Log

## Rules

- NO implementation details (endpoints, methods, field names)
- DESCRIBE, DON'T PRESCRIBE (what you need, not how to provide it)
- INCLUDE CONTEXT (why you need it)
- SURFACE UNKNOWNS (don't hide confusion)
- INVITE PUSHBACK (ask for backend's input)
- UPDATE THE DOC (add backend responses)
- STAY HUMBLE (asking, not demanding)

## Encouraging Collaboration

Include phrases like:
- "Let me know if this doesn't make sense for how the data is structured"
- "Open to suggestions on a better approach"
- "Not sure if this is the right way to think about it"
- "Push back if this complicates things unnecessarily"

Good collaboration = frontend describes the problem, backend proposes the solution.

## After Backend Responds

1. Add responses to Discussion Log
2. Adjust requirements based on feedback
3. Mark resolved uncertainties
4. Note any decisions made

The document becomes the source of truth for what was agreed.
