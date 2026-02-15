---
name: railway-deployment
description: Manage Railway deployments - view logs, redeploy, restart, or remove deployments. Use for deployment lifecycle (remove, stop, redeploy, restart), deployment visibility (list, status, history), and troubleshooting (logs, errors, failures, crashes). NOT for deleting services - use railway-environment skill with isDeleted for that.
version: 1.0.0
author: Railway
license: MIT
tags: [Railway, Deployment, Logs, Debug, Troubleshooting, Redeploy, Infrastructure]
dependencies: [railway-cli]
allowed-tools: Bash(railway:*)
---

# Railway Deployment Management

Manage existing Railway deployments: list, view logs, redeploy, or remove.

**Important:** "Remove deployment" (`railway down`) stops the current deployment but keeps the service. To delete a service entirely, use the railway-environment skill with `isDeleted: true`.

## When to Use

- User says "remove deploy", "take down service", "stop deployment", "railway down"
- User wants to "redeploy", "restart the service", "restart deployment"
- User asks to "list deployments", "show deployment history", "deployment status"
- User asks to "see logs", "show logs", "check errors", "debug issues"

## List Deployments

```bash
railway deployment list --limit 10 --json
```

Shows deployment IDs, statuses, and metadata. Use to find specific deployment IDs for logs or debugging.

### Specify Service

```bash
railway deployment list --service backend --limit 10 --json
```

## View Logs

### Deploy Logs

```bash
railway logs --lines 100 --json
```

In non-interactive mode, streaming is auto-disabled and CLI fetches logs then exits.

### Build Logs

```bash
railway logs --build --lines 100 --json
```

For debugging build failures or viewing build output.

### Logs for Failed/In-Progress Deployments

By default `railway logs` shows the last successful deployment. Use `--latest` for current:

```bash
railway logs --latest --lines 100 --json
```

### Filter Logs

```bash
# Errors only
railway logs --lines 50 --filter "@level:error" --json

# Text search
railway logs --lines 50 --filter "connection refused" --json

# Combined
railway logs --lines 50 --filter "@level:error AND timeout" --json
```

### Time-Based Filtering

```bash
# Logs from last hour
railway logs --since 1h --lines 100 --json

# Logs between 30 and 10 minutes ago
railway logs --since 30m --until 10m --lines 100 --json

# Logs from specific timestamp
railway logs --since 2024-01-15T10:00:00Z --lines 100 --json
```

Formats: relative (`30s`, `5m`, `2h`, `1d`, `1w`) or ISO 8601 timestamps.

### Logs from Specific Deployment

Deploy logs:
```bash
railway logs <deployment-id> --lines 100 --json
```

Build logs:
```bash
railway logs --build <deployment-id> --lines 100 --json
```

Get deployment ID from `railway deployment list`.

**Note:** The deployment ID is a positional argument, NOT `--deployment <id>`. The `--deployment` flag is a boolean that selects deploy logs (vs `--build` for build logs).

## Redeploy

Redeploy the most recent deployment:

```bash
railway redeploy --service <name> -y
```

The `-y` flag skips confirmation. Useful when:
- Config changed via railway-environment skill
- Need to restart without new code
- Previous deploy succeeded but service misbehaving

### Restart Container Only

Restart without rebuilding (picks up external resource changes):

```bash
railway restart --service <name> -y
```

Use when external resources (S3 files, config maps) changed but code didn't.

## Remove Deployment

Takes down the current deployment. The service remains but has no running deployment.

```bash
# Remove deployment for linked service
railway down -y

# Remove deployment for specific service
railway down --service web -y
railway down --service api -y
```

This is what users mean when they say "remove deploy", "take down", or "stop the deployment".

**Note:** This does NOT delete the service. To delete a service entirely, use the railway-environment skill with `isDeleted: true`.

## CLI Options

### deployment list

| Flag | Description |
|------|-------------|
| `-s, --service <NAME>` | Service name or ID |
| `-e, --environment <NAME>` | Environment name or ID |
| `--limit <N>` | Max deployments (default 20, max 1000) |
| `--json` | JSON output |

### logs

| Flag | Description |
|------|-------------|
| `-s, --service <NAME>` | Service name or ID |
| `-e, --environment <NAME>` | Environment name or ID |
| `-d, --deployment` | Show deploy logs (default, boolean flag) |
| `-b, --build` | Show build logs (boolean flag) |
| `-n, --lines <N>` | Number of lines (required) |
| `-f, --filter <QUERY>` | Filter using query syntax |
| `--since <TIME>` | Start time (relative or ISO 8601) |
| `--until <TIME>` | End time (relative or ISO 8601) |
| `--latest` | Most recent deployment (even if failed) |
| `--json` | JSON output |
| `[DEPLOYMENT_ID]` | Specific deployment (optional) |

### redeploy

| Flag | Description |
|------|-------------|
| `-s, --service <NAME>` | Service name or ID |
| `-y, --yes` | Skip confirmation |

### restart

| Flag | Description |
|------|-------------|
| `-s, --service <NAME>` | Service name or ID |
| `-y, --yes` | Skip confirmation |

### down

| Flag | Description |
|------|-------------|
| `-s, --service <NAME>` | Service name or ID |
| `-e, --environment <NAME>` | Environment name or ID |
| `-y, --yes` | Skip confirmation |

## Presenting Logs

When showing logs:
- Include timestamps
- Highlight errors and warnings
- For build failures: show error and suggest fixes
- For runtime crashes: show stack trace context
- Summarize patterns (e.g., "15 timeout errors in last 100 logs")

## Composability

- **Push new code**: Use railway-deploy skill
- **Check service status**: Use railway-status skill
- **Fix config issues**: Use railway-environment skill
- **Create new service**: Use railway-new skill

## Error Handling

### No Service Linked
```
No service linked. Run `railway service` to select one.
```

### No Deployments Found
```
No deployments found. Deploy first with `railway up`.
```

### No Logs Found
Deployment may be too old (log retention limits) or service hasn't produced output.
