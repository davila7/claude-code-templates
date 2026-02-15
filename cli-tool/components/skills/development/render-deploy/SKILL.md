---
name: render-deploy
description: Deploy applications to Render by analyzing codebases, generating render.yaml Blueprints, and providing Dashboard deeplinks. Use when the user wants to deploy, host, publish, or set up their application on Render's cloud platform.
author: openai
---

# Deploy to Render

Render supports **Git-backed** services and **prebuilt Docker image** services.

This skill covers **Git-backed** flows:
1. **Blueprint Method** - Generate render.yaml for Infrastructure-as-Code deployments
2. **Direct Creation** - Create services instantly via MCP tools

Blueprints can also run a **prebuilt Docker image** by using `runtime: image`, but the `render.yaml` still must live in a Git repo.

If there is no Git remote, stop and ask the user to either:
- Create/push a Git remote (can be minimal if only the Blueprint is needed), or
- Use the Render Dashboard/API to deploy a prebuilt Docker image (MCP cannot create image-backed services).

## Prerequisites

- When sandboxing blocks the deployment network calls, rerun with `sandbox_permissions=require_escalated`.
- The deployment might take a few minutes. Use appropriate timeout values.

## When to Use This Skill

Activate this skill when users want to:
- Deploy an application to Render
- Create a render.yaml Blueprint file
- Set up Render deployment for their project
- Host or publish their application on Render's cloud platform
- Create databases, cron jobs, or other Render resources

## Happy Path (New Users)

Use this short prompt sequence before deep analysis to reduce friction:
1. Ask whether they want to deploy from a Git repo or a prebuilt Docker image.
2. Ask whether Render should provision everything the app needs (based on what seems likely from the user's description) or only the app while they bring their own infra. If dependencies are unclear, ask a short follow-up to confirm whether they need a database, workers, cron, or other services.

Then proceed with the appropriate method below.

## Choose Your Source Path

**Git Repo Path:** Required for both Blueprint and Direct Creation. The repo must be pushed to GitHub, GitLab, or Bitbucket.

**Prebuilt Docker Image Path:** Supported by Render via image-backed services. This is **not** supported by MCP; use the Dashboard/API. Ask for:
- Image URL (registry + tag)
- Registry auth (if private)
- Service type (web/worker) and port

If the user chooses a Docker image, guide them to the Render Dashboard image deploy flow or ask them to add a Git remote (so you can use a Blueprint with `runtime: image`).

## Choose Your Deployment Method (Git Repo)

Both methods require a Git repository pushed to GitHub, GitLab, or Bitbucket. (If using `runtime: image`, the repo can be minimal and only contain `render.yaml`.)

| Method | Best For | Pros |
|--------|----------|------|
| **Blueprint** | Multi-service apps, IaC workflows | Version controlled, reproducible, supports complex setups |
| **Direct Creation** | Single services, quick deployments | Instant creation, no render.yaml file needed |

### Method Selection Heuristic

Use this decision rule by default unless the user requests a specific method. Analyze the codebase first; only ask if deployment intent is unclear (e.g., DB, workers, cron).

**Use Direct Creation (MCP) when ALL are true:**
- Single service (one web app or one static site)
- No separate worker/cron services
- No attached databases or Key Value
- Simple env vars only (no shared env groups)
If this path fits and MCP isn't configured yet, stop and guide MCP setup before proceeding.

**Use Blueprint when ANY are true:**
- Multiple services (web + worker, API + frontend, etc.)
- Databases, Redis/Key Value, or other datastores are required
- Cron jobs, background workers, or private services
- You want reproducible IaC or a render.yaml committed to the repo
- Monorepo or multi-env setup that needs consistent configuration

If unsure, ask a quick clarifying question, but default to Blueprint for safety. For a single service, strongly prefer Direct Creation via MCP and guide MCP setup if needed.

## Prerequisites Check

When starting a deployment, verify these requirements in order:

**1. Confirm Source Path (Git vs Docker)**

If using Git-based methods (Blueprint or Direct Creation), the repo must be pushed to GitHub/GitLab/Bitbucket. Blueprints that reference a prebuilt image still require a Git repo with `render.yaml`.

```bash
git remote -v
```

- If no remote exists, stop and ask the user to create/push a remote **or** switch to Docker image deploy.

**2. Check MCP Tools Availability (Preferred for Single-Service)**

MCP tools provide the best experience. Check if available by attempting:
```
list_services()
```

If MCP tools are available, you can skip CLI installation for most operations.

**3. Check Render CLI Installation (for Blueprint validation)**
```bash
render --version
```
If not installed, offer to install:
- macOS: `brew install render`
- Linux/macOS: `curl -fsSL https://raw.githubusercontent.com/render-oss/cli/main/bin/install.sh | sh`

**4. MCP Setup (if MCP isn't configured)**

If `list_services()` fails because MCP isn't configured, ask whether they want to set up MCP (preferred) or continue with the CLI fallback. If they choose MCP, ask which AI tool they're using, then provide the matching instructions below. Always use their API key.

### Cursor

Walk the user through these steps:

1) Get a Render API key:
```
https://dashboard.render.com/u/*/settings#api-keys
```

2) Add this to `~/.cursor/mcp.json` (replace `<YOUR_API_KEY>`):
```json
{
  "mcpServers": {
    "render": {
      "url": "https://mcp.render.com/mcp",
      "headers": {
        "Authorization": "Bearer <YOUR_API_KEY>"
      }
    }
  }
}
```

3) Restart Cursor, then retry `list_services()`.

### Claude Code

Walk the user through these steps:

1) Get a Render API key:
```
https://dashboard.render.com/u/*/settings#api-keys
```

2) Add the MCP server with Claude Code (replace `<YOUR_API_KEY>`):
```bash
claude mcp add --transport http render https://mcp.render.com/mcp --header "Authorization: Bearer <YOUR_API_KEY>"
```

3) Restart Claude Code, then retry `list_services()`.

### Codex

Walk the user through these steps:

1) Get a Render API key:
```
https://dashboard.render.com/u/*/settings#api-keys
```

2) Set it in their shell:
```bash
export RENDER_API_KEY="<YOUR_API_KEY>"
```

3) Add the MCP server with the Codex CLI:
```bash
codex mcp add render --url https://mcp.render.com/mcp --bearer-token-env-var RENDER_API_KEY
```

4) Restart Codex, then retry `list_services()`.

### Other Tools

If the user is on another AI app, direct them to the Render MCP docs for that tool's setup steps and install method.

### Workspace Selection

After MCP is configured, have the user set the active Render workspace with a prompt like:

```
Set my Render workspace to [WORKSPACE_NAME]
```

**5. Check Authentication (CLI fallback only)**

If MCP isn't available, use the CLI instead and verify you can access your account:
```bash
# Check if user is logged in (use -o json for non-interactive mode)
render whoami -o json
```

If `render whoami` fails or returns empty data, the CLI is not authenticated. The CLI won't always prompt automatically, so explicitly prompt the user to authenticate:

If neither is configured, ask user which method they prefer:
- **API Key (CLI)**: `export RENDER_API_KEY="rnd_xxxxx"` (Get from https://dashboard.render.com/u/*/settings#api-keys)
- **Login**: `render login` (Opens browser for OAuth)

**6. Check Workspace Context**

Verify the active workspace:
```
get_selected_workspace()
```

Or via CLI:
```bash
render workspace current -o json
```

To list available workspaces:
```
list_workspaces()
```

If user needs to switch workspaces, they must do so via Dashboard or CLI (`render workspace set`).

Once prerequisites are met, proceed with deployment workflow.

---

# Method 1: Blueprint Deployment (Recommended for Complex Apps)

## Blueprint Workflow

### Step 1: Analyze Codebase

Analyze the codebase to determine framework/runtime, build and start commands, required env vars, datastores, and port binding. Use the detailed checklists in [references/codebase-analysis.md](references/codebase-analysis.md).

### Step 2: Generate render.yaml

Create a `render.yaml` Blueprint file following the Blueprint specification.

Complete specification: [references/blueprint-spec.md](references/blueprint-spec.md)

**Key Points:**
- Always use `plan: free` unless user specifies otherwise
- Include ALL environment variables the app needs
- Mark secrets with `sync: false` (user fills these in Dashboard)
- Use appropriate service type: `web`, `worker`, `cron`, `static`, or `pserv`
- Use appropriate runtime: [references/runtimes.md](references/runtimes.md)

**Basic Structure:**
```yaml
services:
  - type: web
    name: my-app
    runtime: node
    plan: free
    buildCommand: npm ci
    startCommand: npm start
    envVars:
      - key: DATABASE_URL
        fromDatabase:
          name: postgres
          property: connectionString
      - key: JWT_SECRET
        sync: false  # User fills in Dashboard

databases:
  - name: postgres
    databaseName: myapp_db
    plan: free
```

**Service Types:**
- `web`: HTTP services, APIs, web applications (publicly accessible)
- `worker`: Background job processors (not publicly accessible)
- `cron`: Scheduled tasks that run on a cron schedule
- `static`: Static sites (HTML/CSS/JS served via CDN)
- `pserv`: Private services (internal only, within same account)

Service type details: [references/service-types.md](references/service-types.md)
Runtime options: [references/runtimes.md](references/runtimes.md)
Template examples: [assets/](assets/)

### Step 2.5: Immediate Next Steps (Always Provide)

After creating `render.yaml`, always give the user a short, explicit checklist and run validation immediately when the CLI is available:
1. **Authenticate (CLI)**: run `render whoami -o json` (if not logged in, run `render login` or set `RENDER_API_KEY`)
2. **Validate (recommended)**: run `render blueprints validate`
   - If the CLI isn't installed, offer to install it and provide the command.
3. **Commit + push**: `git add render.yaml && git commit -m "Add Render deployment configuration" && git push origin main`
4. **Open Dashboard**: Use the Blueprint deeplink and complete Git OAuth if prompted
5. **Fill secrets**: Set env vars marked `sync: false`
6. **Deploy**: Click "Apply" and monitor the deploy

### Step 3: Validate Configuration

Validate the render.yaml file to catch errors before deployment. If the CLI is installed, run the commands directly; only prompt the user if the CLI is missing:

```bash
render whoami -o json  # Ensure CLI is authenticated (won't always prompt)
render blueprints validate
```

Fix any validation errors before proceeding. Common issues:
- Missing required fields (`name`, `type`, `runtime`)
- Invalid runtime values
- Incorrect YAML syntax
- Invalid environment variable references

Configuration guide: [references/configuration-guide.md](references/configuration-guide.md)

### Step 4: Commit and Push

**IMPORTANT:** You must merge the `render.yaml` file into your repository before deploying.

Ensure the `render.yaml` file is committed and pushed to your Git remote:

```bash
git add render.yaml
git commit -m "Add Render deployment configuration"
git push origin main
```

If there is no Git remote yet, stop here and guide the user to create a GitHub/GitLab/Bitbucket repo, add it as `origin`, and push before continuing.

**Why this matters:** The Dashboard deeplink will read the render.yaml from your repository. If the file isn't merged and pushed, Render won't find the configuration and deployment will fail.

Verify the file is in your remote repository before proceeding to the next step.

### Step 5: Generate Deeplink

Get the Git repository URL:

```bash
git remote get-url origin
```

This will return a URL from your Git provider. **If the URL is SSH format, convert it to HTTPS:**

| SSH Format | HTTPS Format |
|------------|--------------|
| `git@github.com:user/repo.git` | `https://github.com/user/repo` |
| `git@gitlab.com:user/repo.git` | `https://gitlab.com/user/repo` |
| `git@bitbucket.org:user/repo.git` | `https://bitbucket.org/user/repo` |

**Conversion pattern:** Replace `git@<host>:` with `https://<host>/` and remove `.git` suffix.

Format the Dashboard deeplink using the HTTPS repository URL:
```
https://dashboard.render.com/blueprint/new?repo=<REPOSITORY_URL>
```

Example:
```
https://dashboard.render.com/blueprint/new?repo=https://github.com/username/repo-name
```

### Step 6: Guide User

**CRITICAL:** Ensure the user has merged and pushed the render.yaml file to their repository before clicking the deeplink. If the file isn't in the repository, Render cannot read the Blueprint configuration and deployment will fail.

Provide the deeplink to the user with these instructions:

1. **Verify render.yaml is merged** - Confirm the file exists in your repository on GitHub/GitLab/Bitbucket
2. Click the deeplink to open Render Dashboard
3. Complete Git provider OAuth if prompted
4. Name the Blueprint (or use default from render.yaml)
5. Fill in secret environment variables (marked with `sync: false`)
6. Review services and databases configuration
7. Click "Apply" to deploy

The deployment will begin automatically. Users can monitor progress in the Render Dashboard.

### Step 7: Verify Deployment

After the user deploys via Dashboard, verify everything is working.

**Check deployment status via MCP:**
```
list_deploys(serviceId: "<service-id>", limit: 1)
```
Look for `status: "live"` to confirm successful deployment.

**Check for runtime errors (wait 2-3 minutes after deploy):**
```
list_logs(resource: ["<service-id>"], level: ["error"], limit: 20)
```

**Check service health metrics:**
```
get_metrics(
  resourceId: "<service-id>",
  metricTypes: ["http_request_count", "cpu_usage", "memory_usage"]
)
```

If errors are found, proceed to the **Post-deploy verification and basic triage** section below.

---

# Method 2: Direct Service Creation (Quick Single-Service Deployments)

For simple deployments without Infrastructure-as-Code, create services directly via MCP tools.

## When to Use Direct Creation

- Single web service or static site
- Quick prototypes or demos
- When you don't need a render.yaml file in your repo
- Adding databases or cron jobs to existing projects

## Prerequisites for Direct Creation

**Repository must be pushed to a Git provider.** Render clones your repository to build and deploy services.

```bash
git remote -v  # Verify remote exists
git push origin main  # Ensure code is pushed
```

Supported providers: GitHub, GitLab, Bitbucket

If no remote exists, stop and ask the user to create/push a remote or switch to Docker image deploy.

**Note:** MCP does not support creating image-backed services. Use the Dashboard/API for prebuilt Docker image deploys.

## Direct Creation Workflow

Use the concise steps below, and refer to [references/direct-creation.md](references/direct-creation.md) for full MCP command examples and follow-on configuration.

### Step 1: Analyze Codebase
Use [references/codebase-analysis.md](references/codebase-analysis.md) to determine runtime, build/start commands, env vars, and datastores.

### Step 2: Create Resources via MCP
Create the service (web or static) and any required databases or key-value stores. See [references/direct-creation.md](references/direct-creation.md).

If MCP returns an error about missing Git credentials or repo access, stop and guide the user to connect their Git provider in the Render Dashboard, then retry.

### Step 3: Configure Environment Variables
Add required env vars via MCP after creation. See [references/direct-creation.md](references/direct-creation.md).

Remind the user that secrets can be set in the Dashboard if they prefer not to pass them via MCP.

### Step 4: Verify Deployment
Check deploy status, logs, and metrics. See [references/direct-creation.md](references/direct-creation.md).

---

For service discovery, configuration details, quick commands, and common issues, see [references/deployment-details.md](references/deployment-details.md).

---

# Post-deploy verification and basic triage (All Methods)

Keep this short and repeatable. If any check fails, fix it before redeploying.

1. Confirm the latest deploy is `live` and serving traffic
2. Hit the health endpoint (or root) and verify a 200 response
3. Scan recent error logs for a clear failure signature
4. Verify required env vars and port binding (`0.0.0.0:$PORT`)

Detailed checklist and commands: [references/post-deploy-checks.md](references/post-deploy-checks.md)

If the service fails to start or health checks time out, use the basic triage guide:
[references/troubleshooting-basics.md](references/troubleshooting-basics.md)

## Troubleshooting

### Escalated Network Access

If deployment fails due to network issues (timeouts, DNS errors, connection resets), rerun the deploy with escalated permissions (use `sandbox_permissions=require_escalated`). The deploy requires escalated network access when sandbox networking blocks outbound requests.

Example guidance to the user:

```
The deploy needs escalated network access to deploy to Render. I can rerun the command with escalated permissions—want me to proceed?
```

Optional: If you need deeper diagnostics (metrics/DB checks/error catalog), suggest installing the
`render-debug` skill. It is not required for the core deploy flow.
