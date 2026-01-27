# MCP Reference

Complete reference for Atlassian Jira operations via MCP.

## MCP Tool Reference

### Search Operations

#### `mcp__atlassian__searchJiraIssuesUsingJql`
Search Jira using JQL (Jira Query Language).

**Parameters:**
- `jql` (required): JQL query string
- `maxResults`: Maximum results (default: 50)
- `startAt`: Pagination offset
- `fields`: Comma-separated fields to return

**Example:**
```
mcp__atlassian__searchJiraIssuesUsingJql(jql: "project = PROJ AND status = 'In Progress'")
```

### Issue Operations

#### `mcp__atlassian__getJiraIssue`
Retrieve full issue details by key.

**Parameters:**
- `issueKey` (required): Issue key (e.g., "PROJ-123")
- `expand`: Additional data (changelog, transitions, renderedFields)

**Example:**
```
mcp__atlassian__getJiraIssue(issueKey: "PROJ-123")
```

#### `mcp__atlassian__createJiraIssue`
Create a new issue.

**Parameters:**
- `projectKey` (required): Target project
- `issueType` (required): Issue type (Story, Bug, Task, Epic, etc.)
- `summary` (required): Issue title
- `description`: Detailed description
- `assignee`: Account ID (use lookupJiraAccountId first)
- `priority`: Priority name (Highest, High, Medium, Low, Lowest)
- `labels`: Array of labels
- `components`: Array of component names
- Custom fields as needed

**Example:**
```
mcp__atlassian__createJiraIssue(
  projectKey: "PROJ",
  issueType: "Story",
  summary: "Implement user authentication",
  description: "Add OAuth2 authentication flow...",
  labels: ["backend", "security"]
)
```

#### `mcp__atlassian__editJiraIssue`
Update an existing issue.

**Parameters:**
- `issueKey` (required): Issue to update
- Any field to update (summary, description, assignee, etc.)

**Example:**
```
mcp__atlassian__editJiraIssue(
  issueKey: "PROJ-123",
  description: "Updated description with more details..."
)
```

### Transition Operations

#### `mcp__atlassian__getTransitionsForJiraIssue`
Get available status transitions for an issue.

**Parameters:**
- `issueKey` (required): Issue key

**Returns:** List of available transitions with IDs and names.

#### `mcp__atlassian__transitionJiraIssue`
Change issue status.

**Parameters:**
- `issueKey` (required): Issue key
- `transitionId` (required): Transition ID from getTransitions
- `comment`: Optional comment for the transition

**Workflow:**
1. Get transitions: `getTransitionsForJiraIssue("PROJ-123")`
2. Find desired transition ID from results
3. Execute: `transitionJiraIssue(issueKey: "PROJ-123", transitionId: "31")`

### Comment Operations

#### `mcp__atlassian__addCommentToJiraIssue`
Add a comment to an issue.

**Parameters:**
- `issueKey` (required): Issue key
- `body` (required): Comment text (supports Jira markdown)

### User Operations

#### `mcp__atlassian__lookupJiraAccountId`
Find user account ID for assignments.

**Parameters:**
- `query` (required): Search by display name, email, or username

**Example:**
```
mcp__atlassian__lookupJiraAccountId(query: "user@example.com")
```

**Usage:** Always look up account IDs before assigning issues.

### Project Operations

#### `mcp__atlassian__getVisibleJiraProjects`
List available Jira projects.

**Parameters:**
- `maxResults`: Maximum results

#### `mcp__atlassian__getJiraProjectIssueTypesMetadata`
Get issue types and required fields for a project.

**Parameters:**
- `projectKey` (required): Project key

**Usage:** Call before creating issues to understand required fields.

#### `mcp__atlassian__getJiraIssueTypeMetaWithFields`
Get detailed field metadata for an issue type.

**Parameters:**
- `projectKey` (required): Project key
- `issueTypeId` (required): Issue type ID

---

## JQL (Jira Query Language) Reference

### Basic Syntax

```
field operator value [AND|OR field operator value]
```

### Common Fields

| Field | Description | Example |
|-------|-------------|---------|
| `project` | Project key | `project = "PROJ"` |
| `issuetype` | Issue type | `issuetype = Bug` |
| `status` | Issue status | `status = "In Progress"` |
| `assignee` | Assigned user | `assignee = currentUser()` |
| `reporter` | Issue creator | `reporter = "jobarksdale"` |
| `priority` | Priority level | `priority = High` |
| `labels` | Issue labels | `labels = "backend"` |
| `component` | Components | `component = "API"` |
| `created` | Creation date | `created >= -30d` |
| `updated` | Last update | `updated >= -7d` |
| `resolved` | Resolution date | `resolved >= startOfMonth()` |
| `sprint` | Sprint name/ID | `sprint in openSprints()` |
| `epic` | Parent epic | `"Epic Link" = PROJ-100` |
| `parent` | Parent issue | `parent = PROJ-50` |
| `text` | Full-text search | `text ~ "authentication"` |
| `summary` | Title search | `summary ~ "login"` |
| `description` | Description search | `description ~ "OAuth"` |

### Operators

| Operator | Meaning | Example |
|----------|---------|---------|
| `=` | Exact match | `status = Done` |
| `!=` | Not equal | `status != Closed` |
| `~` | Contains (text) | `summary ~ "auth*"` |
| `!~` | Does not contain | `summary !~ "test"` |
| `>` `>=` `<` `<=` | Comparisons | `priority >= High` |
| `IN` | Multiple values | `status IN (Open, "In Progress")` |
| `NOT IN` | Exclude values | `status NOT IN (Done, Closed)` |
| `IS` | Null check | `assignee IS EMPTY` |
| `IS NOT` | Not null | `assignee IS NOT EMPTY` |
| `WAS` | Historical value | `status WAS "In Progress"` |
| `CHANGED` | Field changed | `status CHANGED` |

### Functions

| Function | Description | Example |
|----------|-------------|---------|
| `currentUser()` | Logged-in user | `assignee = currentUser()` |
| `now()` | Current timestamp | `created <= now()` |
| `startOfDay()` | Midnight today | `updated >= startOfDay()` |
| `startOfWeek()` | Start of week | `created >= startOfWeek()` |
| `startOfMonth()` | Start of month | `created >= startOfMonth()` |
| `endOfDay()` | End of today | `due <= endOfDay()` |
| `openSprints()` | Active sprints | `sprint in openSprints()` |
| `closedSprints()` | Completed sprints | `sprint in closedSprints()` |
| `linkedIssues()` | Linked issues | `issue in linkedIssues("PROJ-123")` |

### Relative Dates

```jql
# Days
created >= -7d    # Last 7 days
updated >= -30d   # Last 30 days

# Weeks
created >= -2w    # Last 2 weeks

# Months
created >= -1M    # Last month

# Specific date
created >= "2024-01-01"
```

### Ordering

```jql
# Order by priority, highest first
project = PROJ ORDER BY priority DESC

# Multiple sort fields
project = PROJ ORDER BY status ASC, created DESC
```

### Complex Query Examples

```jql
# My open issues, high priority
assignee = currentUser() AND status NOT IN (Done, Closed) AND priority >= High

# Bugs created this week
issuetype = Bug AND created >= startOfWeek() ORDER BY priority DESC

# Epics in progress with stories
issuetype = Epic AND status = "In Progress" AND issueFunction in hasLinks("is parent of")

# Issues updated by me recently
updatedBy = currentUser() AND updated >= -7d ORDER BY updated DESC

# Blocked issues
status = Blocked OR "Flagged" = "Impediment"

# Issues linked to specific epic
"Epic Link" = PROJ-100 AND status != Done

# Sprint backlog items
sprint in openSprints() AND status = "To Do" ORDER BY rank ASC

# Unassigned high-priority bugs
issuetype = Bug AND assignee IS EMPTY AND priority >= High

# Issues I'm watching
watcher = currentUser()

# Recently resolved by team
resolved >= -7d AND project = PROJ ORDER BY resolved DESC
```

---

## Issue Linking

### Limitation
The Atlassian MCP does not currently support creating issue links. Use the bundled `jira-link-issues` script instead.

### Link Types

| Link Type | Inward | Outward | Use Case |
|-----------|--------|---------|----------|
| Depends On | is dependency of | depends on | Task dependencies |
| Blocks | is blocked by | blocks | Blocking relationships |
| Relates To | relates to | relates to | General relationships |
| Clones | is cloned by | clones | Cloned issues |
| Duplicates | is duplicated by | duplicates | Duplicate issues |

### Script Usage

```bash
# Link PROJ-123 depends on PROJ-456
~/.claude/skills/jira/jira-link-issues PROJ-123 PROJ-456 "Depends On"

# PROJ-100 blocks PROJ-200
~/.claude/skills/jira/jira-link-issues PROJ-100 PROJ-200 "Blocks"

# General relationship
~/.claude/skills/jira/jira-link-issues PROJ-50 PROJ-75 "Relates To"
```

### Finding Link Types
Query the Jira API to get available link types:
```bash
curl -s -u "$JIRA_USER:$JIRA_API_TOKEN" \
  "$JIRA_BASE_URL/rest/api/3/issueLinkType" | jq '.issueLinkTypes[].name'
```

Required environment variables:
- `JIRA_BASE_URL`: Your Atlassian instance (e.g., `https://yourcompany.atlassian.net`)
- `JIRA_USER`: Your email address
- `JIRA_API_TOKEN`: API token from Atlassian account settings

---

## Description Formatting

### Jira Markup (Wiki Style)

```
h1. Heading 1
h2. Heading 2
h3. Heading 3

*bold text*
_italic text_
-strikethrough-
+underline+

{code:java}
public class Example {
    // code here
}
{code}

{quote}
Quoted text here
{quote}

* Bullet list
** Nested bullet
# Numbered list
## Nested number

[Link text|https://example.com]
[Issue link|PROJ-123]

||Header 1||Header 2||
|Cell 1|Cell 2|

{panel:title=Panel Title}
Panel content here
{panel}
```

### Atlassian Document Format (ADF)

For createJiraIssue, descriptions may use ADF format:
```json
{
  "type": "doc",
  "version": 1,
  "content": [
    {
      "type": "paragraph",
      "content": [
        {"type": "text", "text": "Description text"}
      ]
    }
  ]
}
```

---

## Error Handling

### Common Errors

| HTTP Code | Error | Cause | Resolution |
|-----------|-------|-------|------------|
| 400 | Bad Request | Invalid field values | Check required fields for issue type |
| 401 | Unauthorized | Invalid credentials | Run `/mcp` to reconnect |
| 403 | Forbidden | Insufficient permissions | Check project permissions |
| 404 | Not Found | Issue/project doesn't exist | Verify key is correct |
| 422 | Unprocessable | Validation failed | Check field constraints |

### Authentication Issues

If MCP tools return authentication errors:
1. Run `/mcp` to check connection status
2. Reconnect the Atlassian MCP service if disconnected
3. Verify API token permissions in Atlassian settings

### Field Validation

Before creating issues:
1. Get project metadata: `getJiraProjectIssueTypesMetadata`
2. Check required fields for the issue type
3. Look up user account IDs for assignee fields
4. Verify custom field IDs and valid values

---

## Common Workflows

### Move Ticket to Done

```
1. Get available transitions:
   mcp__atlassian__getTransitionsForJiraIssue(issueKey: "PROJ-123")
   → Returns list with transition IDs

2. Find "Done" transition ID from response

3. Execute transition:
   mcp__atlassian__transitionJiraIssue(
     issueKey: "PROJ-123",
     transitionId: "done_id"
   )

4. Add comment:
   mcp__atlassian__addCommentToJiraIssue(
     issueKey: "PROJ-123",
     body: "Completed and deployed"
   )
```

### Create and Assign Issue

```
1. Look up user account ID:
   mcp__atlassian__lookupJiraAccountId(query: "john@example.com")
   → Returns account ID

2. Create issue with assignment:
   mcp__atlassian__createJiraIssue(
     projectKey: "PROJ",
     issueType: "Task",
     summary: "Implement feature X",
     description: "Details here...",
     assignee: "account_id_from_step_1"
   )
```

### List My In-Progress Issues

```
mcp__atlassian__searchJiraIssuesUsingJql(
  jql: "assignee = currentUser() AND status = 'In Progress' ORDER BY updated DESC"
)
```

### Get Project Info Before Creating

```
1. List available projects:
   mcp__atlassian__getVisibleJiraProjects()

2. Get issue types for project:
   mcp__atlassian__getJiraProjectIssueTypesMetadata(projectKey: "PROJ")

3. Create issue with correct type:
   mcp__atlassian__createJiraIssue(
     projectKey: "PROJ",
     issueType: "Story",
     summary: "...",
     description: "..."
   )
```
