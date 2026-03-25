---
name: requirements-clarity
description: Clarify ambiguous requirements through focused dialogue before implementation. Use when requirements are unclear, features are complex (>2 days), or involve cross-team coordination. Ask two core questions - Why? (YAGNI check) and Simpler? (KISS check) - to ensure clarity before coding.
---

# Requirements Clarity Skill

## Description

Automatically transforms vague requirements into actionable PRDs through systematic clarification with a 100-point scoring system.


## Instructions

When invoked, detect vague requirements:

1. **Vague Feature Requests**
   - User says: "add login feature", "implement payment", "create dashboard"
   - Missing: How, with what technology, what constraints?

2. **Missing Technical Context**
   - No technology stack mentioned
   - No integration points identified
   - No performance/security constraints

3. **Incomplete Specifications**
   - No acceptance criteria
   - No success metrics
   - No edge cases considered
   - No error handling mentioned

4. **Ambiguous Scope**
   - Unclear boundaries ("user management" - what exactly?)
   - No distinction between MVP and future enhancements
   - Missing "what's NOT included"

**Do NOT activate when**:
- Specific file paths mentioned (e.g., "auth.go:45")
- Code snippets included
- Existing functions/classes referenced
- Bug fixes with clear reproduction steps

## Core Principles

1. **Systematic Questioning**
   - Ask focused, specific questions
   - One category at a time (2-3 questions per round)
   - Build on previous answers
   - Avoid overwhelming users

2. **Quality-Driven Iteration**
   - Continuously assess clarity score (0-100)
   - Identify gaps systematically
   - Iterate until ≥ 90 points
   - Document all clarification rounds

3. **Actionable Output**
   - Generate concrete specifications
   - Include measurable acceptance criteria
   - Provide executable phases
   - Enable direct implementation

## Clarification Process

### Step 1: Initial Requirement Analysis

**Input**: User's requirement description

**Tasks**:
1. Parse and understand core requirement
2. Generate feature name (kebab-case format)
3. Determine document version (default `1.0` unless user specifies otherwise)
4. Ensure `./docs/prds/` exists for PRD output
5. Perform initial clarity assessment (0-100)

**Assessment Rubric**:
```
Functional Clarity: /30 points
- Clear inputs/outputs: 10 pts
- User interaction defined: 10 pts
- Success criteria stated: 10 pts

Technical Specificity: /25 points
- Technology stack mentioned: 8 pts
- Integration points identified: 8 pts
- Constraints specified: 9 pts

Implementation Completeness: /25 points
- Edge cases considered: 8 pts
- Error handling mentioned: 9 pts
- Data validation specified: 8 pts

Business Context: /20 points
- Problem statement clear: 7 pts
- Target users identified: 7 pts
- Success metrics defined: 6 pts
```

**Initial Response Format**:
```markdown
I understand your requirement. Let me help you refine this specification.

**Current Clarity Score**: X/100

**Clear Aspects**:
- [List what's clear]

**Needs Clarification**:
- [List gaps]

Let me systematically clarify these points...
```

### Step 2: Gap Analysis

Identify missing information across four dimensions:

**1. Functional Scope**
- What is the core functionality?
- What are the boundaries?
- What is out of scope?
- What are edge cases?

**2. User Interaction**
- How do users interact?
- What are the inputs?
- What are the outputs?
- What are success/failure scenarios?

**3. Technical Constraints**
- Performance requirements?
- Compatibility requirements?
- Security considerations?
- Scalability needs?

**4. Business Value**
- What problem does this solve?
- Who are the target users?
- What are success metrics?
- What is the priority?

### Step 3: Interactive Clarification

**Question Strategy**:
1. Start with highest-impact gaps
2. Ask 2-3 questions per round
3. Build context progressively
4. Use user's language
5. Provide examples when helpful

**Question Format**:
```markdown
I need to clarify the following points to complete the requirements document:

1. **[Category]**: [Specific question]?
   - For example: [Example if helpful]

2. **[Category]**: [Specific question]?

3. **[Category]**: [Specific question]?

Please provide your answers, and I'll continue refining the PRD.
```

**After Each User Response**:
1. Update clarity score
2. Capture new information in the working PRD outline
3. Identify remaining gaps
4. If score < 90: Continue with next round of questions
5. If score ≥ 90: Proceed to PRD generation

**Score Update Format**:
```markdown
Thank you for the additional information!

**Clarity Score Update**: X/100 → Y/100

**New Clarified Content**:
- [Summarize new information]

**Remaining Points to Clarify**:
- [List remaining gaps if score < 90]

[If score < 90: Continue with next round of questions]
[If score ≥ 90: "Perfect! I will now generate the complete PRD document..."]
```

### Step 4: PRD Generation

Once clarity score ≥ 90, generate comprehensive PRD.

**Output File**:

1. **Final PRD**: `./docs/prds/{feature_name}-v{version}-prd.md`

Use the `Write` tool to create or update this file. Derive `{version}` from the document version recorded in the PRD (default `1.0`).

## PRD Document Structure

```markdown
# {Feature Name} - Product Requirements Document (PRD)

## Requirements Description

### Background
- **Business Problem**: [Describe the business problem to solve]
- **Target Users**: [Target user groups]
- **Value Proposition**: [Value this feature brings]

### Feature Overview
- **Core Features**: [List of main features]
- **Feature Boundaries**: [What is and isn't included]
- **User Scenarios**: [Typical usage scenarios]

### Detailed Requirements
- **Input/Output**: [Specific input/output specifications]
- **User Interaction**: [User operation flow]
- **Data Requirements**: [Data structures and validation rules]
- **Edge Cases**: [Edge case handling]

## Design Decisions

### Technical Approach
- **Architecture Choice**: [Technical architecture decisions and rationale]
- **Key Components**: [List of main technical components]
- **Data Storage**: [Data models and storage solutions]
- **Interface Design**: [API/interface specifications]

### Constraints
- **Performance Requirements**: [Response time, throughput, etc.]
- **Compatibility**: [System compatibility requirements]
- **Security**: [Security considerations]
- **Scalability**: [Future expansion considerations]

### Risk Assessment
- **Technical Risks**: [Potential technical risks and mitigation plans]
- **Dependency Risks**: [External dependencies and alternatives]
- **Schedule Risks**: [Timeline risks and response strategies]

## Acceptance Criteria

### Functional Acceptance
- [ ] Feature 1: [Specific acceptance conditions]
- [ ] Feature 2: [Specific acceptance conditions]
- [ ] Feature 3: [Specific acceptance conditions]

### Quality Standards
- [ ] Code Quality: [Code standards and review requirements]
- [ ] Test Coverage: [Testing requirements and coverage]
- [ ] Performance Metrics: [Performance test pass criteria]
- [ ] Security Review: [Security review requirements]

### User Acceptance
- [ ] User Experience: [UX acceptance criteria]
- [ ] Documentation: [Documentation delivery requirements]
- [ ] Training Materials: [If needed, training material requirements]

## Execution Phases

### Phase 1: Preparation
**Goal**: Environment preparation and technical validation
- [ ] Task 1: [Specific task description]
- [ ] Task 2: [Specific task description]
- **Deliverables**: [Phase deliverables]
- **Time**: [Estimated time]

### Phase 2: Core Development
**Goal**: Implement core functionality
- [ ] Task 1: [Specific task description]
- [ ] Task 2: [Specific task description]
- **Deliverables**: [Phase deliverables]
- **Time**: [Estimated time]

### Phase 3: Integration & Testing
**Goal**: Integration and quality assurance
- [ ] Task 1: [Specific task description]
- [ ] Task 2: [Specific task description]
- **Deliverables**: [Phase deliverables]
- **Time**: [Estimated time]

### Phase 4: Deployment
**Goal**: Release and monitoring
- [ ] Task 1: [Specific task description]
- [ ] Task 2: [Specific task description]
- **Deliverables**: [Phase deliverables]
- **Time**: [Estimated time]

---

**Document Version**: 1.0
**Created**: {timestamp}
**Clarification Rounds**: {clarification_rounds}
**Quality Score**: {quality_score}/100
```

## Behavioral Guidelines

### DO
- Ask specific, targeted questions
- Build on previous answers
- Provide examples to guide users
- Maintain conversational tone
- Summarize clarification rounds within the PRD
- Use clear, professional English
- Generate concrete specifications
- Stay in clarification mode until score ≥ 90

### DON'T
- Ask all questions at once
- Make assumptions without confirmation
- Generate PRD before 90+ score
- Skip any required sections
- Use vague or abstract language
- Proceed without user responses
- Exit skill mode prematurely

## Success Criteria

- Clarity score ≥ 90/100
- All PRD sections complete with substance
- Acceptance criteria checklistable (using `- [ ]` format)
- Execution phases actionable with concrete tasks
- User approves final PRD
- Ready for development handoff
