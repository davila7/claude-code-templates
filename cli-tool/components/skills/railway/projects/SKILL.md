---
name: railway-projects
description: List, switch, and configure Railway projects. Use when user wants to list all projects, switch projects, rename a project, enable/disable PR deploys, make a project public/private, or modify project settings.
version: 1.0.0
author: Railway
license: MIT
tags: [Railway, Projects, Workspace, Management, Settings, Infrastructure]
dependencies: [railway-cli]
allowed-tools: Bash(railway:*)
---

# Railway Project Management

List, switch, and configure Railway projects.

## When to Use

- User asks "show me all my projects" or "what projects do I have"
- User asks about projects across workspaces
- User asks "what workspaces do I have"
- User wants to switch to a different project
- User asks to rename a project
- User wants to enable/disable PR deploys
- User wants to make a project public or private
- User asks about project settings

## List Projects

The `railway list --json` output can be very large. Run in a subagent and return only essential fields:

- Project: `id`, `name`
- Workspace: `id`, `name`
- Services: `name` (optional, if user needs service context)

```bash
railway list --json
```

Extract and return a simplified summary, not the full JSON.

## List Workspaces

```bash
railway whoami --json
```

Returns user info including all workspaces the user belongs to.

## Switch Project

Link a different project to the current directory:

```bash
railway link -p <project-id-or-name>
```

Or interactively:

```bash
railway link
```

After switching, use railway-status skill to see project details.

## Update Project

Modify project settings via GraphQL API.

### Get Project ID

```bash
railway status --json
```

Extract `project.id` from the response.

### Update Mutation

```bash
bash <<'SCRIPT'
${CLAUDE_PLUGIN_ROOT}/skills/lib/railway-api.sh \
  'mutation updateProject($id: String!, $input: ProjectUpdateInput!) {
    projectUpdate(id: $id, input: $input) { name prDeploys isPublic botPrEnvironments }
  }' \
  '{"id": "PROJECT_ID", "input": {"name": "new-name"}}'
SCRIPT
```

### ProjectUpdateInput Fields

| Field | Type | Description |
|-------|------|-------------|
| `name` | String | Project name |
| `description` | String | Project description |
| `isPublic` | Boolean | Make project public/private |
| `prDeploys` | Boolean | Enable/disable PR deploys |
| `botPrEnvironments` | Boolean | Enable Dependabot/Renovate PR environments |

### Examples

**Rename project:**
```bash
${CLAUDE_PLUGIN_ROOT}/skills/lib/railway-api.sh '<mutation>' '{"id": "uuid", "input": {"name": "new-name"}}'
```

**Enable PR deploys:**
```bash
${CLAUDE_PLUGIN_ROOT}/skills/lib/railway-api.sh '<mutation>' '{"id": "uuid", "input": {"prDeploys": true}}'
```

**Make project public:**
```bash
${CLAUDE_PLUGIN_ROOT}/skills/lib/railway-api.sh '<mutation>' '{"id": "uuid", "input": {"isPublic": true}}'
```

**Multiple fields:**
```bash
${CLAUDE_PLUGIN_ROOT}/skills/lib/railway-api.sh '<mutation>' '{"id": "uuid", "input": {"name": "new-name", "prDeploys": true}}'
```

## Composability

- **View project details**: Use railway-status skill
- **Create new project**: Use railway-new skill
- **Manage environments**: Use railway-environment skill

## Error Handling

### Not Authenticated
```
Not authenticated. Run `railway login` first.
```

### No Projects
```
No projects found. Create one with `railway init`.
```

### Permission Denied
```
You don't have permission to modify this project. Check your Railway role.
```

### Project Not Found
```
Project "foo" not found. Run `railway list` to see available projects.
```
