# Agent Teams: Multi-Agent Orchestration Templates

Pre-configured teams of specialized agents that work together on complex tasks.
Requires the experimental agent teams feature:

```bash
CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1 claude
```

## Teams

### Code Review Team
Runs three agents in parallel for comprehensive code review:

| Agent | File | Focus |
|-------|------|-------|
| Security Reviewer | `security-reviewer.md` | OWASP top 10, injection, auth bypass |
| Performance Reviewer | `performance-reviewer.md` | N+1 queries, complexity, memory leaks |
| Test Coverage Analyst | `test-coverage-analyst.md` | Missing tests, edge cases, assertion quality |

**Usage**: "Review the changes on this branch from security, performance, and testing perspectives"

### Feature Development Team
Architect designs first, then implementer and test-writer run in parallel:

| Agent | File | Focus |
|-------|------|-------|
| Architect | `architect.md` | File structure, interfaces, data flow |
| Implementer | `implementer.md` | Production code following the plan |
| Test Writer | `test-writer.md` | Unit, integration, regression tests |

**Usage**: "Design and implement [feature] with full test coverage"

### Debugging Team
Three competing investigation approaches in parallel:

| Agent | File | Approach |
|-------|------|----------|
| Log Analyst | `log-analyst.md` | Work backwards from symptoms |
| Code Tracer | `code-tracer.md` | Follow execution from entry to failure |
| Hypothesis Tester | `hypothesis-tester.md` | Write experiments to confirm theories |

**Usage**: "Debug this error: [paste error]. Use competing hypotheses."

## Installation

Copy the agent files you want into `.claude/agents/` in your project:

```bash
cp security-reviewer.md performance-reviewer.md test-coverage-analyst.md .claude/agents/
```

## Tips

- Agents run in parallel for faster results
- Each agent has isolated context (no cross-contamination)
- The main Claude session synthesizes all agent outputs
- Use `sonnet` model for reviewers (good balance of speed and quality)
- Add a fourth agent to any team for your specific needs

Source: https://github.com/CodeWithBehnam/cc-docs
