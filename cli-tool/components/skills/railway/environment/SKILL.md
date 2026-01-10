---
name: railway-environment
description: Query, stage, and apply configuration changes for Railway environments. Use for ANY variable or env var operations, service configuration (source, build settings, deploy settings), lifecycle (delete service), and applying changes. Prefer over railway-status skill for any configuration or variable queries.
version: 1.0.0
author: Railway
license: MIT
tags: [Railway, Environment, Configuration, Variables, Build, Deploy, Infrastructure, Settings]
dependencies: [railway-cli]
allowed-tools: Bash(railway:*)
---

# Environment Configuration

Query, stage, and apply configuration changes for Railway environments.

## Shell Escaping

**CRITICAL:** When running GraphQL queries via bash, you MUST wrap in heredoc to prevent shell escaping issues:

```bash
bash <<'SCRIPT'
${CLAUDE_PLUGIN_ROOT}/skills/lib/railway-api.sh 'query ...' '{"var": "value"}'
SCRIPT
```

Without the heredoc wrapper, multi-line commands break and exclamation marks in GraphQL non-null types get escaped, causing query failures.

## When to Use

- User wants to create a new environment
- User wants to duplicate an environment (e.g., "copy production to staging")
- User wants to switch to a different environment
- User asks about current build/deploy settings, variables, replicas, health checks, domains
- User asks to change service source (Docker image, branch, commit, root directory)
- User wants to connect a service to a GitHub repo
- User wants to deploy from a GitHub repo (create empty service first via railway-new skill, then use this)
- User asks to change build or start command
- User wants to add/update/delete environment variables
- User wants to change replica count or configure health checks
- User asks to delete a service, volume, or bucket
- User says "apply changes", "commit changes", "deploy changes"
- Auto-fixing build errors detected in logs

## Create Environment

Create a new environment in the linked project:

```bash
railway environment new <name>
```

Duplicate an existing environment:

```bash
railway environment new staging --duplicate production
```

With service-specific variables:

```bash
railway environment new staging --duplicate production --service-variable api PORT=3001
```

## Switch Environment

Link a different environment to the current directory:

```bash
railway environment <name>
```

Or by ID:

```bash
railway environment <environment-id>
```

## Get Context

```bash
railway status --json
```

Extract:

- `project.id` - for service lookup
- `environment.id` - for the mutations
- `service.id` - default service if user doesn't specify one

### Resolve Service ID

If user specifies a service by name, query project services:

```graphql
query projectServices($projectId: String!) {
  project(id: $projectId) {
    services {
      edges {
        node {
          id
          name
        }
      }
    }
  }
}
```

Match the service name (case-insensitive) to get the service ID.

## Query Configuration

Fetch current environment configuration and staged changes.

```graphql
query environmentConfig($environmentId: String!) {
  environment(id: $environmentId) {
    id
    config(decryptVariables: false)
    serviceInstances {
      edges {
        node {
          id
          serviceId
        }
      }
    }
  }
  environmentStagedChanges(environmentId: $environmentId) {
    id
    patch(decryptVariables: false)
  }
}
```

Example:

```bash
bash <<'SCRIPT'
${CLAUDE_PLUGIN_ROOT}/skills/lib/railway-api.sh \
  'query envConfig($envId: String!) {
    environment(id: $envId) { id config(decryptVariables: false) }
    environmentStagedChanges(environmentId: $envId) { id patch(decryptVariables: false) }
  }' \
  '{"envId": "ENV_ID"}'
SCRIPT
```

### Response Structure

The `config` field contains current configuration:

```json
{
  "services": {
    "<serviceId>": {
      "source": { "repo": "...", "branch": "main" },
      "build": { "buildCommand": "npm run build", "builder": "NIXPACKS" },
      "deploy": {
        "startCommand": "npm start",
        "multiRegionConfig": { "us-west2": { "numReplicas": 1 } }
      },
      "variables": { "NODE_ENV": { "value": "production" } },
      "networking": { "serviceDomains": {}, "customDomains": {} }
    }
  },
  "sharedVariables": { "DATABASE_URL": { "value": "..." } }
}
```

The `patch` field in `environmentStagedChanges` contains pending changes. The effective configuration is the base `config` merged with the staged `patch`.

For complete field reference, see [reference/environment-config.md](../reference/environment-config.md).

For variable syntax and service wiring patterns, see [reference/variables.md](../reference/variables.md).

## Get Rendered Variables

The GraphQL queries above return **unrendered** variables - template syntax like `${{shared.DOMAIN}}` is preserved. This is correct for management/editing.

To see **rendered** (resolved) values as they appear at runtime:

```bash
# Current linked service
railway variables --json

# Specific service
railway variables --service <service-name> --json
```

**When to use:**
- Debugging connection issues (see actual URLs/ports)
- Verifying variable resolution is correct
- Viewing Railway-injected values (RAILWAY_*)

## Stage Changes

Stage configuration changes via the `environmentStageChanges` mutation. Use `merge: true` to automatically merge with existing staged changes.

```graphql
mutation stageEnvironmentChanges(
  $environmentId: String!
  $input: EnvironmentConfig!
  $merge: Boolean
) {
  environmentStageChanges(
    environmentId: $environmentId
    input: $input
    merge: $merge
  ) {
    id
  }
}
```

**Important:** Always use variables (not inline input) because service IDs are UUIDs which can't be used as unquoted GraphQL object keys.

Example:

```bash
bash <<'SCRIPT'
${CLAUDE_PLUGIN_ROOT}/skills/lib/railway-api.sh \
  'mutation stageChanges($environmentId: String!, $input: EnvironmentConfig!, $merge: Boolean) {
    environmentStageChanges(environmentId: $environmentId, input: $input, merge: $merge) { id }
  }' \
  '{"environmentId": "ENV_ID", "input": {"services": {"SERVICE_ID": {"build": {"buildCommand": "npm run build"}}}}, "merge": true}'
SCRIPT
```

### Delete Service

Use `isDeleted: true`:

```bash
bash <<'SCRIPT'
${CLAUDE_PLUGIN_ROOT}/skills/lib/railway-api.sh \
  'mutation stageChanges($environmentId: String!, $input: EnvironmentConfig!, $merge: Boolean) {
    environmentStageChanges(environmentId: $environmentId, input: $input, merge: $merge) { id }
  }' \
  '{"environmentId": "ENV_ID", "input": {"services": {"SERVICE_ID": {"isDeleted": true}}}, "merge": true}'
SCRIPT
```

## Stage and Apply Immediately

For single changes that should deploy right away, use `environmentPatchCommit` to stage and apply in one call.

```graphql
mutation environmentPatchCommit(
  $environmentId: String!
  $patch: EnvironmentConfig
  $commitMessage: String
) {
  environmentPatchCommit(
    environmentId: $environmentId
    patch: $patch
    commitMessage: $commitMessage
  )
}
```

Example:

```bash
bash <<'SCRIPT'
${CLAUDE_PLUGIN_ROOT}/skills/lib/railway-api.sh \
  'mutation patchCommit($environmentId: String!, $patch: EnvironmentConfig, $commitMessage: String) {
    environmentPatchCommit(environmentId: $environmentId, patch: $patch, commitMessage: $commitMessage)
  }' \
  '{"environmentId": "ENV_ID", "patch": {"services": {"SERVICE_ID": {"variables": {"API_KEY": {"value": "secret"}}}}}, "commitMessage": "add API_KEY"}'
SCRIPT
```

**When to use:** Single change, no need to batch, user wants immediate deployment.

**When NOT to use:** Multiple related changes to batch, or user says "stage only" / "don't deploy yet".

## Apply Staged Changes

Commit staged changes and trigger deployments.

**Note:** There is no `railway apply` CLI command. Use the mutation below or direct users to the web UI.

### Apply Mutation

**Mutation name: `environmentPatchCommitStaged`**

```graphql
mutation environmentPatchCommitStaged(
  $environmentId: String!
  $message: String
  $skipDeploys: Boolean
) {
  environmentPatchCommitStaged(
    environmentId: $environmentId
    commitMessage: $message
    skipDeploys: $skipDeploys
  )
}
```

Example:

```bash
bash <<'SCRIPT'
${CLAUDE_PLUGIN_ROOT}/skills/lib/railway-api.sh \
  'mutation commitStaged($environmentId: String!, $message: String) {
    environmentPatchCommitStaged(environmentId: $environmentId, commitMessage: $message)
  }' \
  '{"environmentId": "ENV_ID", "message": "add API_KEY variable"}'
SCRIPT
```

### Parameters

| Field           | Type    | Default | Description                                 |
| --------------- | ------- | ------- | ------------------------------------------- |
| `environmentId` | String! | -       | Environment ID from status                  |
| `message`       | String  | null    | Short description of changes                |
| `skipDeploys`   | Boolean | false   | Skip deploys (only if user explicitly asks) |

### Commit Message

Keep very short - one sentence max. Examples:

- "set build command to fix npm error"
- "add API_KEY variable"
- "increase replicas to 3"

Leave empty if no meaningful description.

### Default Behavior

**Always deploy** unless user explicitly asks to skip. Only set `skipDeploys: true` if user says "apply without deploying", "commit but don't deploy", or "skip deploys".

Returns a workflow ID (string) on success.

## Auto-Apply Behavior

By default, **apply changes immediately**.

### Flow

**Single change:** Use `environmentPatchCommit` to stage and apply in one call.

**Multiple changes or batching:** Use `environmentStageChanges` with `merge: true` for each change, then `environmentPatchCommitStaged` to apply.

### When NOT to Auto-Apply

- User explicitly says "stage only", "don't deploy yet", or similar
- User is making multiple related changes that should deploy together

**When you don't auto-apply, tell the user:**

> Changes staged. Apply them at: https://railway.com/project/{projectId}
> Or ask me to apply them.

Get `projectId` from `railway status --json` → `project.id`

## Error Handling

### Service Not Found

```
Service "foo" not found in project. Available services: api, web, worker
```

### No Staged Changes

```
No patch to apply
```

There are no staged changes to commit. Stage changes first.

### Invalid Configuration

Common issues:

- `buildCommand` and `startCommand` cannot be identical
- `buildCommand` only valid with NIXPACKS builder
- `dockerfilePath` only valid with DOCKERFILE builder

### No Permission

```
You don't have permission to modify this environment. Check your Railway role.
```

### No Linked Project

```
No project linked. Run `railway link` to link a project.
```

## Composability

- **Create service**: Use railway-service skill
- **View logs**: Use railway-deployment skill
- **Add domains**: Use railway-domain skill
- **Deploy local code**: Use railway-deploy skill
