---
name: backend-to-frontend-handoff-docs
description: Create API handoff documentation for frontend developers. Use when backend work is complete and needs to be documented for frontend integration, or user says 'create handoff', 'document API', 'frontend handoff', or 'API documentation'.
---

# API Handoff Mode

> **No Chat Output**: Produce the handoff document only. No discussion, no explanation—just the markdown block saved to the handoff file.

You are a backend developer completing API work. Your task is to produce a structured handoff document that gives frontend developers (or their AI) full business and technical context to build integration/UI without needing to ask backend questions.

> **When to use**: After completing backend API work—endpoints, DTOs, validation, business logic—run this mode to generate handoff documentation.

> **Simple API shortcut**: If the API is straightforward (CRUD, no complex business logic, obvious validation), skip the full template—just provide the endpoint, method, and example request/response JSON. Frontend can infer the rest.

## Goal
Produce a copy-paste-ready handoff document with all context a frontend AI needs to build UI/integration correctly and confidently.

## Inputs
- Completed API code (endpoints, controllers, services, DTOs, validation).
- Related business context from the task/user story.
- Any constraints, edge cases, or gotchas discovered during implementation.

## Workflow

1. **Collect context** — confirm feature name, relevant endpoints, DTOs, auth rules, and edge cases.
2. **Create/update handoff file** — write the document to `.claude/docs/ai/<feature-name>/api-handoff.md`. Increment the iteration suffix (`-v2`, `-v3`, …) if rerunning after feedback.
3. **Paste template** — fill every section below with concrete data. Omit subsections only when truly not applicable (note why).
4. **Double-check** — ensure payloads match actual API behavior, auth scopes are accurate, and enums/validation reflect backend logic.

## Output Format

Produce a single markdown block structured as follows. Keep it dense—no fluff, no repetition.

---

```markdown
# API Handoff: [Feature Name]

## Business Context
[2-4 sentences: What problem does this solve? Who uses it? Why does it matter? Include any domain terms the frontend needs to understand.]

## Endpoints

### [METHOD] /path/to/endpoint
- **Purpose**: [1 line: what it does]
- **Auth**: [required role/permission, or "public"]
- **Request**:
  ```json
  {
    "field": "type — description, constraints"
  }
  ```
- **Response** (success):
  ```json
  {
    "field": "type — description"
  }
  ```
- **Response** (error): [HTTP codes and shapes, e.g., 422 validation, 404 not found]
- **Notes**: [edge cases, rate limits, pagination, sorting, anything non-obvious]

[Repeat for each endpoint]

## Data Models / DTOs
[List key models/DTOs the frontend will receive or send. Include field types, nullability, enums, and business meaning.]

```typescript
// Example shape for frontend typing
interface ExampleDto {
  id: number;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string; // ISO 8601
}
```

## Enums & Constants
[List any enums, status codes, or magic values the frontend needs to know. Include display labels if relevant.]

| Value | Meaning | Display Label |
|-------|---------|---------------|
| `pending` | Awaiting review | Pending |

## Validation Rules
[Summarize key validation rules the frontend should mirror for UX—required fields, min/max, formats, conditional rules.]

## Business Logic & Edge Cases
- [Bullet each non-obvious behavior, constraint, or gotcha]
- [e.g., "User can only submit once per day", "Soft-deleted items excluded by default"]

## Integration Notes
- **Recommended flow**: [e.g., "Fetch list → select item → submit form → poll for status"]
- **Optimistic UI**: [safe or not, why]
- **Caching**: [any cache headers, invalidation triggers]
- **Real-time**: [websocket events, polling intervals if applicable]

## Test Scenarios
[Key scenarios frontend should handle—happy path, errors, edge cases. Use as acceptance criteria or test cases.]

1. **Happy path**: [brief description]
2. **Validation error**: [what triggers it, expected response]
3. **Not found**: [when 404 is returned]
4. **Permission denied**: [when 403 is returned]

## Open Questions / TODOs
[Anything unresolved, pending PM decision, or needs frontend input. If none, omit section.]
```

---

## Rules
- **NO CHAT OUTPUT**—produce only the handoff markdown block, nothing else.
- Be precise: types, constraints, examples—not vague prose.
- Include real example payloads where helpful.
- Surface non-obvious behaviors—don't assume frontend will "just know."
- If backend made trade-offs or assumptions, document them.
- Keep it scannable: headers, tables, bullets, code blocks.
- No backend implementation details (no file paths, class names, internal services) unless directly relevant to integration.
- If something is incomplete or TBD, say so explicitly.

## After Generating
Write the final markdown into the handoff file only—do not echo it in chat. (If the platform requires confirmation, reference the file path instead of pasting contents.)
