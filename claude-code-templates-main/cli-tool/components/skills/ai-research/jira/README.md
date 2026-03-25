# Jira Skill

Natural language interaction with Jira for managing issues, sprints, and workflows. This skill enables Claude to view, create, update, and transition Jira tickets using conversational commands.

## Purpose

The Jira skill bridges the gap between natural language requests and Jira operations. Instead of remembering specific CLI commands or API calls, you can simply tell Claude what you want to do with your Jira tickets, and the skill handles the technical details.

Key benefits:
- **Conversational interface**: Ask questions like "What are my open tickets?" or "Move PROJ-123 to Done"
- **Dual backend support**: Works with either the jira CLI or Atlassian MCP
- **Safety-first approach**: Always fetches current state before modifications and requires approval for changes
- **Context-aware**: Detects issue keys (e.g., PROJ-123) in conversation and offers relevant actions

## When to Use

This skill activates when you:

- Mention Jira issue keys (e.g., "Show me PROJ-123", "What's the status of ABC-456?")
- Ask about tickets ("List my open tickets", "What's assigned to me?")
- Want to create issues ("Create a bug ticket for the login issue")
- Need to update tickets ("Move this to In Progress", "Assign PROJ-123 to me")
- Check sprint status ("What's in the current sprint?", "Show sprint backlog")
- Manage workflow ("Close this ticket", "Add a comment to PROJ-123")

**Trigger phrases include:**
- "create a jira ticket"
- "show me PROJ-123"
- "list my tickets"
- "move ticket to done"
- "what's in the current sprint"
- Any mention of "jira", "issue", "ticket", "sprint", or "backlog"

## How It Works

### 1. Backend Detection

When activated, the skill first determines which backend is available:

1. **CLI backend**: Checks if the `jira` command is installed
2. **MCP backend**: Looks for Atlassian MCP tools (`mcp__atlassian__*`)
3. **No backend**: Guides you to install one of the above

### 2. Operation Execution

Once a backend is detected:

1. **Read operations** (viewing, listing): Execute immediately and display results
2. **Write operations** (create, update, transition):
   - Fetch current issue state first
   - Show proposed changes
   - Request user approval
   - Execute the operation
   - Verify the result

### 3. Safety Checks

Before any modification, the skill:

- Fetches current issue state (never assumes status or assignee)
- Checks who else might be affected (watchers, linked issues)
- Verifies the operation is reversible or warns if not
- Confirms correct identifiers (transition IDs, account IDs)

## Key Features

### Issue Management
- **View issues**: See full details including description, status, assignee, and comments
- **List issues**: Filter by assignee, status, type, priority, labels, or custom JQL
- **Create issues**: Create tickets with full field support including multi-line descriptions
- **Update issues**: Modify summary, description, priority, labels, and custom fields
- **Assign issues**: Assign to yourself, others, or unassign

### Workflow Operations
- **Transition issues**: Move tickets through workflow states (To Do, In Progress, Done)
- **Add comments**: Document progress or decisions on tickets
- **Link issues**: Create relationships between tickets (blocks, relates to, duplicates)

### Sprint Management
- **List sprints**: View active, future, or closed sprints
- **Sprint issues**: See what's in the current sprint
- **Add to sprint**: Move issues into a sprint

### Search and Query
- **Natural language search**: Find issues matching text queries
- **JQL support**: Use full Jira Query Language for complex searches
- **Filter combinations**: Combine assignee, status, type, and date filters

## Usage Examples

### Viewing Issues

```
"Show me PROJ-123"
"What's the status of ABC-456?"
"Display the details of that bug ticket"
```

### Listing Issues

```
"List my open tickets"
"What issues are in progress?"
"Show me high priority bugs"
"Find all tickets updated this week"
"What's assigned to john@example.com?"
```

### Creating Issues

```
"Create a bug ticket for the login timeout issue"
"Make a new task for updating the documentation"
"Create a story for implementing the export feature with acceptance criteria"
```

### Updating Issues

```
"Move PROJ-123 to In Progress"
"Assign this ticket to me"
"Mark the bug as done"
"Add a comment saying the fix is deployed"
"Change the priority to high"
```

### Sprint Operations

```
"What's in the current sprint?"
"Show me the active sprint"
"List sprint backlog items"
```

### Advanced JQL Queries

```
"Find all bugs created this week"
"Show unassigned high-priority issues"
"List tickets I updated recently"
"Find issues blocked by PROJ-100"
```

## Prerequisites

You need one of the following backends configured:

### Option 1: jira CLI (Recommended)

The jira CLI provides fast, local access to Jira.

**Installation:**
```bash
# macOS
brew install ankitpokhrel/jira-cli/jira-cli

# Linux
# Download from https://github.com/ankitpokhrel/jira-cli/releases
```

**Setup:**
```bash
jira init
```

Follow the prompts to configure your Jira server URL and authentication.

### Option 2: Atlassian MCP

The Atlassian MCP provides Jira access through Model Context Protocol.

Configure the Atlassian MCP in your Claude settings with your Atlassian credentials. This enables access to `mcp__atlassian__*` tools.

## Output

### Issue View
When viewing an issue, you'll see:
- Issue key and summary
- Status, priority, and type
- Assignee and reporter
- Description
- Recent comments
- Linked issues

### Issue Lists
Lists display in a table format showing:
- Issue key
- Summary
- Status
- Assignee
- Priority

### Operation Results
After modifications, the skill:
- Confirms the action was successful
- Shows the updated state
- Reports any errors with resolution guidance

## Best Practices

### Before Creating Issues
1. Check if a similar issue already exists
2. Understand the project's required fields
3. Use clear, descriptive summaries
4. Include acceptance criteria for stories

### Before Transitioning
1. Let the skill fetch available transitions (they vary by project)
2. Some workflows require intermediate states
3. Add comments explaining why you're making the transition

### For Assignments
1. With MCP, always use account IDs (not display names)
2. Verify the user exists in the project
3. Consider notifying the assignee separately

### For Bulk Operations
1. Request explicit approval before bulk changes
2. Each change notifies watchers
3. Consider timing to avoid notification storms

### General Tips
- Always let the skill fetch current state before modifications
- Preserve original information when editing descriptions
- Use the "open in browser" feature for complex editing
- Check linked issues before making major changes

## Safety Guidelines

The skill follows strict safety protocols:

**Always:**
- Shows commands/tool calls before executing
- Requests approval before modifications
- Preserves original content when editing
- Verifies updates after applying
- Surfaces authentication issues clearly

**Never:**
- Transitions without fetching current status first
- Assigns using display names with MCP (only account IDs work)
- Edits descriptions without showing the original
- Uses `--no-input` without all required fields
- Assumes transition names are universal across projects
- Bulk-modifies without explicit approval

## Troubleshooting

### Authentication Issues

**CLI:**
```bash
# Reinitialize
jira init

# Verify connection
jira me
```

**MCP:**
- Check MCP connection status
- Reconnect the Atlassian service
- Verify API token permissions

### Common Errors

| Error | Cause | Solution |
|-------|-------|----------|
| "Issue not found" | Invalid key | Verify the issue key is correct |
| "Transition not available" | Workflow constraint | Check available transitions first |
| "Permission denied" | Project access | Verify your Jira permissions |
| "Invalid assignee" | Wrong ID format | Use account ID, not display name |
| "Required field missing" | Project config | Check project's required fields |

### Backend Not Available

If neither CLI nor MCP is available:

1. **Install jira CLI** (recommended):
   ```bash
   brew install ankitpokhrel/jira-cli/jira-cli
   jira init
   ```

2. **Or configure Atlassian MCP** in your Claude settings

## Reference Files

For advanced usage, the skill includes detailed reference documentation:

- `references/commands.md`: Complete CLI command reference with examples
- `references/mcp.md`: Full MCP tool reference with JQL query guide

These are loaded on-demand when handling complex operations like:
- Multi-line descriptions
- Complex JQL queries
- Transition workflows
- Issue linking
