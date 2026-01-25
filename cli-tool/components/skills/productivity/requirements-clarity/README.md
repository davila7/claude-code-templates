# Requirements Clarity

A systematic skill for transforming vague requirements into actionable Product Requirements Documents (PRDs) through focused dialogue and iterative clarification.

## Purpose

This skill helps you avoid costly misunderstandings and rework by ensuring requirements are crystal clear before implementation begins. It uses a 100-point scoring system to systematically identify gaps and guide you through targeted questions until your requirements are development-ready.

## When to Use This Skill

### Use When
- Requirements are vague or ambiguous (e.g., "add login feature", "implement payment")
- Features are complex and estimated to take more than 2 days
- Cross-team coordination is required
- Missing technical context (no tech stack, integration points, or constraints mentioned)
- Incomplete specifications (no acceptance criteria, success metrics, edge cases)
- Unclear scope boundaries ("what exactly does 'user management' include?")

### Don't Use When
- Specific file paths are mentioned (e.g., "fix auth.go:45")
- Code snippets are already included in the request
- Working with existing functions/classes (use code review instead)
- Bug fixes with clear reproduction steps

## How It Works

### The Clarification Process

1. **Initial Analysis** (Step 1)
   - Parses your requirement description
   - Generates a clarity score (0-100) using a detailed rubric
   - Identifies what's clear and what needs clarification
   - Creates a feature name and prepares for PRD generation

2. **Gap Analysis** (Step 2)
   - Systematically identifies missing information across four dimensions:
     - **Functional Scope**: Core functionality, boundaries, edge cases
     - **User Interaction**: Inputs, outputs, success/failure scenarios
     - **Technical Constraints**: Performance, compatibility, security, scalability
     - **Business Value**: Problem statement, target users, success metrics

3. **Interactive Clarification** (Step 3)
   - Asks 2-3 focused questions per round (avoids overwhelming you)
   - Builds context progressively
   - Updates clarity score after each response
   - Continues until score reaches ≥ 90/100

4. **PRD Generation** (Step 4)
   - Once clarity score ≥ 90, generates comprehensive PRD
   - Saves to `./docs/prds/{feature-name}-v{version}-prd.md`
   - Includes all clarified information in structured format

### Clarity Scoring Rubric

The 100-point scoring system evaluates:

- **Functional Clarity** (30 points): Clear inputs/outputs, user interaction, success criteria
- **Technical Specificity** (25 points): Technology stack, integration points, constraints
- **Implementation Completeness** (25 points): Edge cases, error handling, data validation
- **Business Context** (20 points): Problem statement, target users, success metrics

## Key Features

### Systematic Questioning
- Focused, specific questions (not overwhelming)
- One category at a time
- Builds on previous answers
- Uses your language and provides examples

### Quality-Driven Iteration
- Continuous clarity assessment
- Transparent score updates
- Iterates until ≥ 90 points achieved
- Documents all clarification rounds

### Actionable Output
- Concrete specifications ready for development
- Measurable acceptance criteria (checklistable format)
- Executable implementation phases with specific tasks
- Complete PRD with all necessary sections

### Core Principles
- **Why?** (YAGNI check) - Ensures features are truly needed
- **Simpler?** (KISS check) - Explores simpler alternatives before complex solutions

## Usage Examples

### Example 1: Vague Feature Request

**User Input:**
```
I need a login feature for my app.
```

**Skill Response:**
```
I understand your requirement. Let me help you refine this specification.

Current Clarity Score: 25/100

Clear Aspects:
- Need authentication functionality

Needs Clarification:
- Authentication method (email/password, OAuth, SSO?)
- User types and permissions
- Security requirements
- Integration with existing systems
- Success metrics

Let me systematically clarify these points...

1. Authentication Method: What authentication method do you prefer?
   - For example: Email/password, social login (Google/GitHub),
     magic links, or SSO?

2. User Management: Do you need different user roles or permissions?
   - For example: Admin vs. regular users, or all users have same access?

3. Technology Stack: What's your current tech stack?
   - For example: React frontend, Node.js backend, PostgreSQL database?
```

### Example 2: After Clarification Round

**After User Response:**
```
Thank you for the additional information!

Clarity Score Update: 25/100 → 65/100

New Clarified Content:
- Authentication: Email/password with optional Google OAuth
- User roles: Admin and regular users with different permissions
- Tech stack: Next.js 14, PostgreSQL, using NextAuth.js

Remaining Points to Clarify:
- Password requirements and security constraints
- Session management (duration, refresh tokens?)
- Edge cases (account lockout, password reset)
- Success metrics (MAU, conversion rate?)

Let me continue with the next round of questions...

1. Security Requirements: What are your password requirements?
   - For example: Minimum length, special characters, 2FA?

2. Session Management: How long should user sessions last?
   - For example: 24 hours, 7 days, remember me option?

3. Edge Cases: How should we handle failed login attempts?
   - For example: Rate limiting, account lockout after X attempts?
```

### Example 3: Final PRD Generation

**When Clarity Score ≥ 90:**
```
Perfect! I will now generate the complete PRD document...

[Generates PRD at ./docs/prds/user-authentication-v1.0-prd.md]

Your Product Requirements Document is ready!

File: ./docs/prds/user-authentication-v1.0-prd.md
Quality Score: 92/100
Clarification Rounds: 3

The PRD includes:
✓ Complete requirements description with background and value proposition
✓ Technical approach with architecture decisions
✓ Measurable acceptance criteria (functional, quality, user acceptance)
✓ 4 execution phases with specific tasks and deliverables
✓ Risk assessment and mitigation strategies

You can now hand this off to your development team for implementation.
```

## Generated PRD Structure

The final PRD includes:

1. **Requirements Description**
   - Background (business problem, target users, value proposition)
   - Feature overview (core features, boundaries, user scenarios)
   - Detailed requirements (I/O, user interaction, data, edge cases)

2. **Design Decisions**
   - Technical approach (architecture, components, data storage, interfaces)
   - Constraints (performance, compatibility, security, scalability)
   - Risk assessment (technical, dependency, schedule risks)

3. **Acceptance Criteria**
   - Functional acceptance (feature-specific conditions)
   - Quality standards (code quality, test coverage, performance, security)
   - User acceptance (UX, documentation, training)

4. **Execution Phases**
   - Phase 1: Preparation (environment setup, technical validation)
   - Phase 2: Core Development (implement core functionality)
   - Phase 3: Integration & Testing (quality assurance)
   - Phase 4: Deployment (release and monitoring)

Each phase includes specific tasks, deliverables, and time estimates.

## Output Location

PRDs are saved to:
```
./docs/prds/{feature-name}-v{version}-prd.md
```

Where:
- `{feature-name}`: Auto-generated in kebab-case format
- `{version}`: Document version (default 1.0, or user-specified)

## Best Practices

### DO
- Answer questions thoroughly but concisely
- Provide examples when you have specific preferences
- Ask for clarification if questions aren't clear
- Review the final PRD and provide feedback
- Share constraints and non-negotiables upfront

### DON'T
- Rush through clarification rounds
- Assume the skill knows your technical context
- Skip questions that seem "obvious"
- Approve PRD before reviewing thoroughly
- Provide contradictory information across rounds

## Success Criteria

A successful requirements clarification session results in:
- Clarity score ≥ 90/100
- All PRD sections complete with substantial content
- Acceptance criteria in checklistable format
- Execution phases with actionable, concrete tasks
- Development team can start implementation immediately
- No major questions or ambiguities remain

## Tips for Better Results

1. **Be Specific**: Instead of "fast", say "< 200ms response time"
2. **Think End-to-End**: Consider the full user journey
3. **Share Constraints Early**: Technical limitations, budget, timeline
4. **Provide Context**: Explain the "why" behind your requirement
5. **Reference Examples**: "Like Stripe's payment flow" is clearer than abstract descriptions

## Related Skills

- **feature-planning**: For breaking down features after PRD is complete
- **implementation-blueprint**: For detailed implementation planning
- **dev-spec**: For complete design and planning sessions
- **critical-brainstorm**: For exploring and stress-testing ideas before clarification

---

**Need help clarifying requirements?** Invoke this skill and provide your initial requirement description. The skill will guide you through systematic clarification until you have a development-ready PRD.
