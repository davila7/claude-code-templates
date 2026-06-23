# /sugar-task

Create comprehensive Sugar tasks with rich business and technical context for autonomous development.

## Purpose

The `/sugar-task` command helps you create well-structured, context-rich tasks for Sugar's autonomous development system. Unlike simple todo items, Sugar tasks include business context, technical requirements, agent assignments, and measurable success criteria - enabling truly autonomous execution.

## Usage

### Basic Usage
```
/sugar-task "Task title"
```

### With Options
```
/sugar-task "Implement user authentication" --type feature --priority 4
/sugar-task "Fix critical security bug" --type bug_fix --urgent
/sugar-task "Add comprehensive API tests" --type test --priority 3
```

### Task Types
- `feature` - New functionality
- `bug_fix` - Bug fixes and hotfixes
- `test` - Testing and QA work
- `refactor` - Code refactoring
- `documentation` - Documentation updates
- Custom types via Sugar configuration

### Priority Levels
- `1` - Low priority, nice to have
- `2` - Normal priority
- `3` - Medium priority, should do soon
- `4` - High priority, important
- `5` - Urgent, critical, needs immediate attention

Use `--urgent` flag as shortcut for priority 5.

## Implementation

When invoked, the agent will:

1. **Understand the Request:** Ask clarifying questions if the task description is vague or lacks context.

2. **Assess Complexity:** Determine if this is a simple task or requires rich context with multiple agents.

3. **Recommend Configuration:** Suggest appropriate task type, priority, and whether to add detailed context.

4. **Gather Context (for complex tasks):**
   - Business context: Why is this work important?
   - Technical requirements: Specific implementation constraints
   - Success criteria: Measurable outcomes that define "done"
   - Agent assignments: Which specialized agents should work on this

5. **Execute Creation:** Generate the appropriate Sugar CLI command and execute it.

6. **Confirm and Guide:** Show the created task ID and suggest next steps like viewing status or starting execution.

### Simple Task Creation
For straightforward work:
```bash
sugar add "Fix typo in user guide" --type documentation --priority 2
```

### Rich Task with JSON Context
For complex work requiring multiple agents:
```bash
sugar add "Build customer analytics dashboard" --json --description '{
  "priority": 4,
  "type": "feature",
  "context": "Marketing team needs visibility into customer behavior patterns for campaign optimization",
  "business_context": "Increase conversion rate by 15% through data-driven decisions",
  "technical_requirements": [
    "Real-time data pipeline from events database",
    "Interactive charts with drill-down capability",
    "Role-based access for marketing team",
    "Export to CSV/PDF functionality"
  ],
  "agent_assignments": {
    "task_planner": "Break down requirements and create technical design",
    "backend_developer": "Build data pipeline and API endpoints",
    "frontend_developer": "Implement dashboard UI with charts",
    "qa_test_engineer": "Comprehensive testing including data accuracy"
  },
  "success_criteria": [
    "Dashboard loads in <2 seconds with 10K data points",
    "All marketing team members can access appropriate data",
    "Charts accurately reflect event data (verified against source)",
    "Export functionality works for datasets up to 100K rows"
  ]
}'
```

### After Task Creation

The agent should:
1. Confirm task creation with task ID
2. Display a summary of the created task
3. Suggest viewing queue with `/sugar-status`
4. Mention dry-run testing with `/sugar-run --dry-run --once`
5. Provide task ID for future reference

## Examples

### Example 1: Simple Bug Fix
**User:** `/sugar-task Fix login timeout after 5 minutes`

**Agent Response:**
"I'll create a bug fix task for the login timeout issue. This seems straightforward - I'll set priority to 4 (high) since it affects user experience."

```bash
sugar add "Fix login timeout after 5 minutes" --type bug_fix --priority 4
```

"✅ Task created: task-abc123

This task is now in your queue. You can:
- View status: /sugar-status
- Start execution: /sugar-run --dry-run --once (test first)
- View details: sugar view task-abc123"

### Example 2: Complex Feature
**User:** `/sugar-task Build real-time notification system`

**Agent Response:**
"This is a substantial feature. Let me ask a few questions to build comprehensive context:

1. What types of notifications do you need? (email, push, in-app, SMS?)
2. What should trigger notifications?
3. Are there volume/scalability requirements?
4. Any specific delivery time requirements (real-time vs eventual)?

Based on your answers, I'll create a rich task with appropriate agent assignments for backend development, frontend UI, and testing."

[After gathering context...]

```bash
sugar add "Build real-time notification system" --json --description '{
  "priority": 4,
  "type": "feature",
  "context": "Users need immediate notifications for order updates, messages, and system alerts",
  "business_context": "Improve user engagement and reduce support tickets by 30%",
  "technical_requirements": [
    "WebSocket-based real-time delivery",
    "Support email, push, and in-app notifications",
    "Notification preferences per user",
    "Delivery tracking and analytics",
    "Handle 10K concurrent connections"
  ],
  "agent_assignments": {
    "task_planner": "Design notification architecture and data model",
    "backend_developer": "Implement notification service and WebSocket server",
    "frontend_developer": "Build in-app notification UI and preferences",
    "qa_test_engineer": "Test real-time delivery, scaling, and edge cases"
  },
  "success_criteria": [
    "Notifications delivered in <500ms",
    "99.9% delivery success rate",
    "User can manage preferences",
    "System handles 10K concurrent users",
    "Comprehensive delivery analytics available"
  ]
}'
```

"✅ Task created: task-def456

This complex task has been structured with full context for autonomous execution. The task planner will create a detailed implementation plan, and specialized agents will handle their respective areas.

Next steps:
- Review the task: sugar view task-def456
- Check queue: /sugar-status
- Test execution: /sugar-run --dry-run --once"

### Example 3: Urgent Security Issue
**User:** `/sugar-task Critical SQL injection in user search --urgent`

**Agent Response:**
"🚨 Creating urgent security task with priority 5. This will be prioritized for immediate execution."

```bash
sugar add "Critical SQL injection vulnerability in user search" --type bug_fix --urgent --description '{
  "context": "SQL injection vulnerability discovered in user search endpoint",
  "technical_requirements": [
    "Replace string concatenation with parameterized queries",
    "Add input sanitization",
    "Security audit of similar endpoints"
  ],
  "agent_assignments": {
    "tech_lead": "Security assessment and approach",
    "backend_developer": "Implement fix with parameterized queries",
    "qa_test_engineer": "Security testing and penetration test attempts"
  },
  "success_criteria": [
    "All SQL queries use parameterized statements",
    "Input validation prevents injection attempts",
    "Security audit completed for all similar code",
    "Penetration testing confirms vulnerability fixed"
  ]
}'
```

"✅ Urgent task created: task-ghi789

⚠️ This task is marked URGENT (priority 5) and will be executed as soon as autonomous mode runs.

Immediate actions:
1. Consider running immediately: /sugar-run --once
2. Monitor execution: tail -f .sugar/sugar.log
3. Review when complete: sugar view task-ghi789

Security issues require immediate attention!"

## Integration with Claude Code

The command creates a conversational experience:
- Uses natural language to gather requirements
- Asks clarifying questions when needed
- Provides clear feedback on task creation
- Suggests appropriate next steps
- Formats output for readability

This enables users to quickly create well-structured tasks that Sugar's autonomous system can execute with minimal supervision.
