---
allowed-tools: Read, WebSearch
argument-hint: [sprint-duration] | [start-date] [duration]
description: Plan and organize sprint workflows with Linear integration and capacity analysis
model: sonnet
---

# Sprint Planning

Plan and organize sprint: $ARGUMENTS

## Current Sprint Context

- Current sprint: Check Linear or GitHub milestones
- Team velocity: Analyze recent sprint performance
- Open issues: !`gh issue list --limit 10 --state open` (if GitHub CLI available)
- Project structure: @README.md or @.github/ (if exists)

## Instructions

1. **Check Linear Integration**
First, verify if the Linear MCP server is connected:
- If connected: Proceed with full integration
- If not connected: Ask user to install Linear MCP server from https://github.com/modelcontextprotocol/servers
- Fallback: Use GitHub issues and manual input

2. **Gather Sprint Context**
Collect the following information:
- Sprint duration (e.g., 2 weeks)
- Sprint start date
- Team members involved
- Sprint goals/themes
- Previous sprint velocity (if available)

3. **Analyze Current State**

#### With Linear Connected:
```
1. Fetch all backlog items from Linear
2. Get in-progress tasks and their status
3. Analyze task priorities and dependencies
4. Check team member assignments and capacity
5. Review blocked tasks and impediments
```

#### Without Linear (Fallback):
```
1. Analyze GitHub issues by labels and milestones
2. Review open pull requests and their status
3. Check recent commit activity
4. Ask user for additional context about tasks
```

4. **Sprint Planning Analysis**

Generate a comprehensive sprint plan including:

```markdown
# Sprint Planning Report - [Sprint Name]

## Sprint Overview
- Duration: [Start Date] to [End Date]
- Team Members: [List]
- Sprint Goal: [Description]

## Capacity Analysis
- Total Available Hours: [Calculation]
- Previous Sprint Velocity: [Points/Hours]
- Recommended Capacity: [80-85% of total]

## Proposed Sprint Backlog

### High Priority Tasks
1. [Task ID] - [Title]
   - Estimate: [Points/Hours]
   - Assignee: [Name]
   - Dependencies: [List]
   - Acceptance Criteria: [Details]

### Medium Priority Tasks
[Similar format]

### Nice-to-Have Tasks
[Similar format]

## Risk Assessment
- Technical Risks: [List]
- Resource Risks: [List]
- Dependency Risks: [List]

## Recommendations
1. [Specific recommendations based on analysis]
2. [Resource allocation suggestions]
3. [Risk mitigation strategies]

## Metrics to Track
- Velocity
- Burndown rate
- Blocked time
- Cycle time
```

5. **Interactive Planning Session**

Offer to help with:
1. Task breakdown and estimation
2. Dependency mapping
3. Resource balancing
4. Risk mitigation planning
5. Sprint backlog finalization

## Error Handling

### Linear Connection Issues
```
"I notice the Linear MCP server is not connected. To get the most value from sprint planning:

1. Install the Linear MCP server:
   npm install -g @modelcontextprotocol/server-linear

2. Configure with your Linear API key
3. Restart this session with Linear connected

For now, I'll proceed using GitHub data and manual input."
```

### Missing Data
```
"I need more information to create an effective sprint plan:
- [List specific missing data]
- [Provide templates for manual input]
```

## Example Usage

### User Input:
"Help me plan our next 2-week sprint starting Monday"

### Assistant Response:
```
I'll help you plan your sprint. Let me first check your Linear integration...

[If connected]: Great! I can see your Linear workspace. Let me analyze your backlog...

[Analysis results]

Based on my analysis, here's your proposed sprint plan:

**Sprint 24-01 (Jan 8-19)**

**Recommended Scope (32 story points):**
1. ENG-123: Implement user authentication (8 pts) - John
2. ENG-124: Database migration scripts (5 pts) - Sarah
3. ENG-125: API rate limiting (5 pts) - Mike
...

**Key Risks:**
- ENG-123 blocks 3 other tasks
- Sarah has 20% allocation to support

Would you like me to:
1. Adjust the scope based on different priorities?
2. Create a dependency visualization?
3. Generate sprint planning meeting agenda?
```

## Best Practices

1. **Always verify capacity**: Don't overcommit the team
2. **Include buffer time**: Plan for 80-85% capacity
3. **Consider dependencies**: Map task relationships
4. **Balance workload**: Distribute tasks evenly
5. **Define clear goals**: Ensure sprint has focused objectives
6. **Plan for unknowns**: Include spike/investigation time

## Integration Points

- Linear: Task management and tracking
- GitHub: Code repository and PRs
- Slack: Team communication (if MCP available)
- Calendar: Team availability (if accessible)

## Output Formats

Offer multiple output options:
1. Markdown report (default)
2. CSV for spreadsheet import
3. JSON for automation tools
4. Linear-compatible format for direct import