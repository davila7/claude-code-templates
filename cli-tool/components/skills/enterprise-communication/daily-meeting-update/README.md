# Daily Meeting Update

Generate polished daily standup updates through an interactive interview process, optionally enriched with data from GitHub, Git, and Jira integrations.

## Purpose

The Daily Meeting Update skill helps developers prepare for daily standups or scrum meetings by:

1. **Gathering context automatically** - Detects and optionally pulls recent activity from GitHub, Git, and Jira
2. **Conducting a structured interview** - Asks the right questions to capture what matters
3. **Generating a clean update** - Produces a well-formatted Markdown summary ready to share

This skill bridges the gap between raw activity data (commits, PRs, tickets) and the human context that makes standups valuable (blockers, priorities, discussion topics).

## When to Use

Trigger this skill when you:

- Say **"daily"**, **"standup"**, **"scrum update"**, or **"status update"**
- Want to **prepare for a daily meeting**
- Need to **summarize your recent work** for the team
- Want to **generate a meeting update** with GitHub/Jira context

**Example triggers:**

```
"Help me with my daily"
"Prepare my standup update"
"Generate a scrum update"
"What's my status for today's meeting?"
```

## How It Works

The skill operates in three phases:

### Phase 1: Detect and Offer Integrations

The skill silently checks for available integrations:

| Integration | Detection Method |
|-------------|------------------|
| Claude Code History | `~/.claude/projects` directory exists with `.jsonl` files |
| GitHub CLI | `gh auth status` succeeds |
| Git | Current directory is a git repository |
| Jira CLI | `jira` command exists |
| Atlassian MCP | `mcp__atlassian__*` tools available |

If integrations are detected, you'll be asked whether to pull data and which repositories/projects to include. **Consent is always required** before accessing any data.

### Phase 2: Interview (with Insights)

The skill asks four key questions:

1. **Yesterday** - What did you work on since the last standup?
2. **Today** - What will you work on today?
3. **Blockers** - Any impediments or blockers?
4. **Topics for Discussion** - Anything to bring up at the end of the meeting?

If data was pulled in Phase 1, it's shown as context during the interview to help trigger your memory ("I see you merged PR #123, anything else?").

### Phase 3: Generate Update

All information is combined into a clean Markdown update, including:

- Yesterday's accomplishments
- Today's planned work
- Blockers (if any)
- PRs and reviews (if pulled from GitHub)
- Jira tickets (if pulled)
- Topics for discussion
- Relevant links

## Key Features

- **Interview-first approach** - Tools supplement human context, they don't replace it
- **Smart context awareness** - Shows pulled data during questions to trigger memory
- **Consent-based data access** - Always asks before pulling from any integration
- **Multi-repo support** - Can pull activity from multiple repositories
- **Clean output** - Generates concise, readable Markdown ready for sharing
- **Discussion topics** - Captures the valuable non-technical items that tools can't detect

## Usage Examples

### Basic Usage (No Integrations)

```
User: "Help me prepare my daily"

Claude: "What did you work on yesterday?"
User: "Fixed the authentication bug and reviewed a PR"

Claude: "What will you work on today?"
User: "Continue the payment integration"

Claude: "Any blockers?"
User: "Waiting on API credentials from the backend team"

Claude: "Any topic for the end of the daily?"
User: "No"

[Claude generates update]
```

### With GitHub Integration

```
User: "Daily standup"

Claude: "I detected GitHub configured. Want me to pull your recent activity?"
User: "Yes"

Claude: "Which repos should I check?"
User: "my-app and api-service"

Claude: "Here's what I found:
- Merged PR #120: fix login timeout
- Opened PR #125: feat: add OAuth flow
- 5 commits in my-app

Anything else you worked on yesterday?"
User: "Also did research on payment providers"

[Interview continues...]
```

### With Claude Code History

```
Claude: "I can also pull your Claude Code session history from yesterday.
This can help recall work that isn't in git/Jira. Want me to check?"
User: "Yes"

Claude: "Here are your Claude Code sessions from yesterday.
Select the ones relevant to your standup:"
  ☑ Fix authentication timeout bug (backend-api)
  ☑ Implement OAuth flow (backend-api)
  ☐ Update personal blog (blog) - [user unchecks personal project]
  ☑ Research payment providers (docs)

User: [selects 3 relevant items]

Claude: "Here's what I found from your activity:
- [From Claude Code] Fix authentication timeout bug
- [From Claude Code] Implement OAuth flow
- [From Claude Code] Research payment providers

Anything else you worked on yesterday that I missed?"
```

### With Jira Integration

```
Claude: "I see you have these tickets assigned:
- PROJ-123: Implement OAuth flow (In Progress)
- PROJ-456: Fix payment bug (To Do)

Will you work on any of these today?"
User: "Yes, continuing PROJ-123 and starting PROJ-456"
```

## Prerequisites

**Required:**
- None - the skill works with manual input alone

**Optional (for enhanced functionality):**
- **Claude Code** - For pulling session history (research, debugging, planning work not in git)
- **GitHub CLI** (`gh`) - For pulling commits, PRs, and reviews
- **Git** - For local commit history
- **Jira CLI** or **Atlassian MCP** - For pulling ticket information

## Output

The skill generates a Markdown document like this:

```markdown
# Daily Update - 2026-01-22

## Yesterday
- Worked on authentication feature
- Research on payment providers
- Merged PR #120 (fix: login timeout)
- Opened PR #125 (feat: add OAuth flow)

## Today
- Continue OAuth feature
- Deploy to staging

## Blockers
- No blockers

## PRs & Reviews
- **Opened:** PR #125 - feat: add OAuth flow
- **Merged:** PR #120 - fix: login timeout
- **Reviews:** PR #123 (approved), PR #456 (changes requested)

## Topics for Discussion
- Architecture of the new payments module

---
*Links:*
- https://github.com/org/repo/pull/125
- https://github.com/org/repo/pull/120
```

## Best Practices

### Do

- **Be specific in your answers** - "Fixed auth bug" is less useful than "Fixed session timeout causing users to lose work"
- **Mention cross-team dependencies** - These often become discussion topics
- **Include non-coding work** - Research, documentation, and planning count too
- **Use discussion topics** - This is often the most valuable part of standup

### Avoid

- **Skipping the interview** - Even with tool data, your context is essential
- **Overly long updates** - Keep to 15 bullets or less; standups should be under 2 minutes to read
- **Raw ticket/PR numbers** - Always include titles or summaries for context
- **Assuming one repo** - If you work on multiple projects, specify which ones to pull from

## Privacy and Security

- **Consent required** - The skill never pulls data without explicit approval
- **Repository boundaries** - Only pulls from repos you explicitly approve
- **No assumptions** - Never assumes tools are configured or authenticated
- **Selective sharing** - You control what goes into the final update

## Related Information

| Item | Description |
|------|-------------|
| Trigger phrases | "daily", "standup", "scrum update", "status update" |
| Interview questions | Yesterday, Today, Blockers, Discussion Topics |
| Supported integrations | Claude Code History, GitHub CLI, Git, Jira CLI, Atlassian MCP |
| Output format | Markdown |
