---
name: railway-deploy
description: Deploy code to Railway using "railway up". Use when user wants to push code, says "railway up", "deploy", "ship", or "push". For initial setup or creating services, use railway-new skill. For Docker images, use railway-environment skill.
version: 1.0.0
author: Railway
license: MIT
tags: [Railway, Deploy, CI/CD, Push, Ship, Infrastructure, Deployment]
dependencies: [railway-cli]
allowed-tools: Bash(railway:*)
---

# Railway Deploy

Deploy code from the current directory to Railway using `railway up`.

## When to Use

- User asks to "deploy", "ship", "push code"
- User says "railway up" or "deploy to Railway"
- User wants to deploy local code changes
- User says "deploy and fix any issues" (use --ci mode)

## Modes

### Detach Mode (default)
Starts deploy and returns immediately. Use for most deploys.

```bash
railway up --detach
```

### CI Mode
Streams build logs until complete. Use when user wants to watch the build or needs to debug issues.

```bash
railway up --ci
```

**When to use CI mode:**
- User says "deploy and watch", "deploy and fix issues"
- User is debugging build failures
- User wants to see build output

## Deploy Specific Service

Default is linked service. To deploy to a different service:

```bash
railway up --detach --service backend
```

## Deploy to Unlinked Project

Deploy to a project without linking first:

```bash
railway up --project <project-id> --environment production --detach
```

Requires both `--project` and `--environment` flags.

## CLI Options

| Flag | Description |
|------|-------------|
| `-d, --detach` | Don't attach to logs (default) |
| `-c, --ci` | Stream build logs, exit when done |
| `-s, --service <NAME>` | Target service (defaults to linked) |
| `-e, --environment <NAME>` | Target environment (defaults to linked) |
| `-p, --project <ID>` | Target project (requires --environment) |
| `[PATH]` | Path to deploy (defaults to current directory) |

## Directory Linking

Railway CLI walks UP the directory tree to find a linked project. If you're in a subdirectory of a linked project, you don't need to relink.

For subdirectory deployments, prefer setting `rootDirectory` via the railway-environment skill, then deploy normally with `railway up`.

## After Deploy

### Detach mode
```
Deploying to <service>...
```
Use railway-deployment skill to check build status (with `--lines` flag).

### CI mode
Build logs stream inline. If build fails, the error will be in the output.

**Do NOT run `railway logs --build` after CI mode** - the logs already streamed. If you need
more context, use railway-deployment skill with `--lines` flag (never stream).

## Composability

- **Check status after deploy**: Use railway-service skill
- **View logs**: Use railway-deployment skill
- **Fix config issues**: Use railway-environment skill
- **Redeploy after config fix**: Use railway-environment skill

## Error Handling

### No Project Linked
```
No Railway project linked. Run `railway link` first.
```

### No Service Linked
```
No service linked. Use --service flag or run `railway service` to select one.
```

### Build Failure (CI mode)
The build logs already streamed - analyze them directly from the `railway up --ci` output.
Do NOT run `railway logs` after CI mode (it streams forever without `--lines`).

Common issues:
- Missing dependencies → check package.json/requirements.txt
- Build command wrong → use railway-environment skill to fix
- Dockerfile issues → check dockerfile path
