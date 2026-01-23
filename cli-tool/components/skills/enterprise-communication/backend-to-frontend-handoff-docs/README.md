# Backend to Frontend Handoff Documentation

A Claude Code skill that generates comprehensive API handoff documentation for frontend developers after backend work is complete.

## Purpose

This skill automates the creation of structured API handoff documents that provide frontend developers (or their AI assistants) with complete business and technical context needed to build integrations and UI without requiring back-and-forth questions with backend developers.

## When to Use

Use this skill when:

- Backend API work is complete (endpoints, DTOs, validation, business logic implemented)
- You need to document API changes for frontend integration
- A feature requires handoff documentation between backend and frontend teams
- You want to ensure frontend has all context to build integration correctly
- User explicitly requests: "create handoff", "document API", "frontend handoff", or "API documentation"

**Timing**: Run this after completing backend implementation, before frontend development begins.

## How It Works

1. **Analyzes** your completed backend code (endpoints, controllers, services, DTOs, validation)
2. **Extracts** business context, constraints, edge cases, and gotchas
3. **Generates** a structured markdown document with all integration details
4. **Saves** to `.claude/docs/ai/<feature-name>/api-handoff.md`
5. **Versions** subsequent updates (v2, v3, etc.) for iteration tracking

### Workflow

```
Backend Code → Skill Analysis → Handoff Document → Frontend Implementation
```

The skill operates in "no-chat" mode: it produces only the handoff document without discussion or explanation.

## Key Features

### Comprehensive Coverage

- **Business Context**: Problem statement, users, domain terminology
- **Endpoint Details**: Methods, paths, auth requirements, request/response shapes
- **Data Models**: TypeScript interfaces, field types, nullability, enums
- **Validation Rules**: Required fields, constraints, formats for frontend UX
- **Business Logic**: Non-obvious behaviors, edge cases, gotchas
- **Integration Guidance**: Recommended flows, caching, optimistic UI, real-time updates
- **Test Scenarios**: Happy paths, error cases, acceptance criteria

### Smart Shortcuts

For simple CRUD APIs with obvious validation and no complex business logic, the skill can skip the full template and provide just:
- Endpoint + method
- Example request/response JSON

Frontend can infer the rest.

### Version Management

Automatically increments iteration suffixes (`-v2`, `-v3`) when regenerating documentation after feedback or changes.

## Usage Examples

### Example 1: Full Feature Handoff

```
User: "I just completed the expense approval API. Create handoff docs for frontend."

Skill Output: Creates `.claude/docs/ai/expense-approval/api-handoff.md` with:
- Business context about approval workflows
- POST /api/expenses/:id/approve endpoint details
- ExpenseDto and ApprovalDto models
- Status enums (pending, approved, rejected)
- Validation rules (amount limits, required fields)
- Edge cases (can only approve once, manager-only permission)
- Test scenarios for happy/error paths
```

### Example 2: Simple CRUD API

```
User: "Document the user profile GET endpoint for frontend."

Skill Output: Creates minimal handoff with:
- GET /api/users/:id
- Example response JSON with user fields
- 404 for not found case
```

### Example 3: Iteration After Feedback

```
User: "Frontend asked about pagination. Update the handoff."

Skill Output: Creates `.claude/docs/ai/user-list/api-handoff-v2.md` with:
- Updated pagination parameters
- Response shape with page metadata
- Sorting options
```

## Document Structure

The generated handoff follows this structure:

```markdown
# API Handoff: [Feature Name]

## Business Context
[Problem, users, domain terms]

## Endpoints
### [METHOD] /path
- Purpose
- Auth requirements
- Request/Response examples
- Error cases
- Edge case notes

## Data Models / DTOs
[TypeScript interfaces]

## Enums & Constants
[Status codes, magic values, display labels]

## Validation Rules
[Frontend should mirror for UX]

## Business Logic & Edge Cases
[Non-obvious behaviors]

## Integration Notes
- Recommended flow
- Optimistic UI guidance
- Caching strategy
- Real-time considerations

## Test Scenarios
[Key acceptance criteria]

## Open Questions / TODOs
[Unresolved items]
```

## Best Practices

### For Backend Developers

1. **Run after completion**: Generate handoff only when backend work is done
2. **Include context**: Don't assume frontend knows domain logic
3. **Real examples**: Use actual request/response payloads, not placeholders
4. **Surface gotchas**: Document edge cases discovered during implementation
5. **Version updates**: Regenerate when API changes after feedback

### For Frontend Developers

1. **Trust the doc**: All necessary context should be in the handoff
2. **Flag gaps**: If something is unclear, request v2 with specifics
3. **Use test scenarios**: Convert to frontend test cases or acceptance criteria
4. **Validate types**: Use provided TypeScript interfaces for type safety

## Output Location

Documents are saved to:
```
.claude/docs/ai/<feature-name>/api-handoff.md
```

Subsequent versions:
```
.claude/docs/ai/<feature-name>/api-handoff-v2.md
.claude/docs/ai/<feature-name>/api-handoff-v3.md
```

## What's NOT Included

The skill deliberately excludes:
- Backend implementation details (file paths, class names, internal services)
- Database schema or internal data structures
- Deployment or infrastructure details
- Backend testing strategies

Focus is purely on integration contract and business context.

## Example Output

Here's a sample of what the skill generates:

```markdown
# API Handoff: Expense Approval

## Business Context
Employees submit expenses for manager approval. Managers review and approve/reject
with optional comments. Approved expenses move to accounting for reimbursement.
Domain terms: "Submitter" (employee), "Approver" (manager), "Reimbursable" (approved).

## Endpoints

### POST /api/expenses/:id/approve
- **Purpose**: Approve or reject an expense submission
- **Auth**: Manager role required
- **Request**:
  ```json
  {
    "decision": "approved | rejected",
    "comment": "string (optional, max 500 chars)"
  }
  ```
- **Response** (success):
  ```json
  {
    "id": 123,
    "status": "approved",
    "approvedBy": "Jane Smith",
    "approvedAt": "2026-01-18T10:30:00Z"
  }
  ```
- **Response** (error): 403 if not manager, 404 if expense not found, 422 if already approved
- **Notes**: Can only approve once. Action is permanent (no undo).

## Data Models / DTOs

```typescript
interface ExpenseApprovalDto {
  decision: 'approved' | 'rejected';
  comment?: string; // max 500 chars
}

interface ExpenseDto {
  id: number;
  status: 'pending' | 'approved' | 'rejected';
  approvedBy?: string;
  approvedAt?: string; // ISO 8601
}
```

## Validation Rules
- `decision`: Required, must be 'approved' or 'rejected'
- `comment`: Optional, max 500 characters, trimmed
- Frontend should show character counter for comment field

## Business Logic & Edge Cases
- User must have Manager role to approve
- Cannot approve own expenses (enforced by backend)
- Once approved/rejected, decision is final (no re-approval)
- Soft-deleted expenses return 404

## Integration Notes
- **Recommended flow**: Fetch expense → show approval modal → submit decision → refresh list
- **Optimistic UI**: NOT recommended (permission checks may fail)
- **Real-time**: No websocket events; polling or manual refresh after approval

## Test Scenarios
1. **Happy path**: Manager approves pending expense → 200 with updated status
2. **Validation error**: Empty decision → 422 with validation message
3. **Permission denied**: Non-manager attempts approval → 403
4. **Already approved**: Approve same expense twice → 422 conflict
```

## Related Skills

- **frontend-to-backend-requirements**: Documents frontend data needs for backend developers (reverse direction)
- **code-reviewer**: Can review the generated handoff for completeness
- **dev-spec**: Creates full development specs that may include API design

## Tips

1. **Keep it updated**: Regenerate when API contracts change
2. **Link from PRs**: Reference handoff doc in backend PR descriptions
3. **Version control**: Commit handoff docs to git for team visibility
4. **Frontend feedback loop**: If frontend has questions, it means the handoff missed something—update it
5. **Use as spec**: Can also generate handoff BEFORE implementation as API specification

## Invocation

```bash
# As a Claude Code skill
/backend-to-frontend-handoff-docs

# Or via natural language
"Create API handoff documentation for the user profile endpoints"
"Document the new authentication API for frontend"
"Generate frontend handoff for expense approval feature"
```
