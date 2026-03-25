# Neon CLI

The Neon CLI is a command-line interface for managing Neon Serverless Postgres directly from your terminal. It provides the same capabilities as the Neon Platform API and is ideal for scripting, CI/CD pipelines, and developers who prefer terminal workflows.

## Installation

**macOS (Homebrew):**

```bash
brew install neonctl
```

**npm (cross-platform):**

```bash
npm install -g neonctl
```

**Direct download:**

```bash
curl -fsSL https://neon.tech/install.sh | bash
```

## Authentication

Authenticate with your Neon account:

```bash
neonctl auth
```

This opens a browser for OAuth authentication and stores credentials locally.

For CI/CD or non-interactive environments, use an API key:

```bash
export NEON_API_KEY=your-api-key
```

Get your API key from: https://console.neon.tech/app/settings/api-keys

## Common Commands

### Project Management

```bash
# List all projects
neonctl projects list

# Create a new project
neonctl projects create --name my-project

# Get project details
neonctl projects get <project-id>

# Delete a project
neonctl projects delete <project-id>
```

### Branch Operations

```bash
# List branches
neonctl branches list --project-id <project-id>

# Create a branch
neonctl branches create --project-id <project-id> --name dev

# Delete a branch
neonctl branches delete <branch-id> --project-id <project-id>
```

### Connection Strings

```bash
# Get connection string
neonctl connection-string --project-id <project-id>

# Get connection string for specific branch
neonctl connection-string --project-id <project-id> --branch-id <branch-id>

# Get pooled connection string
neonctl connection-string --project-id <project-id> --pooled
```

### SQL Execution

```bash
# Run SQL query
neonctl sql "SELECT * FROM users LIMIT 10" --project-id <project-id>

# Run SQL from file
neonctl sql --file schema.sql --project-id <project-id>
```

### Database Management

```bash
# List databases
neonctl databases list --project-id <project-id> --branch-id <branch-id>

# Create database
neonctl databases create --project-id <project-id> --name mydb

# List roles
neonctl roles list --project-id <project-id> --branch-id <branch-id>
```

## Output Formats

The CLI supports multiple output formats:

```bash
# JSON output (default for scripting)
neonctl projects list --output json

# Table output (human-readable)
neonctl projects list --output table

# YAML output
neonctl projects list --output yaml
```

## CI/CD Integration

Example GitHub Actions workflow:

```yaml
- name: Create preview branch
  env:
    NEON_API_KEY: ${{ secrets.NEON_API_KEY }}
  run: |
    neonctl branches create \
      --project-id ${{ vars.NEON_PROJECT_ID }} \
      --name preview-${{ github.event.pull_request.number }}
```

## CLI vs MCP Server vs SDKs

| Tool           | Best For                                          |
| -------------- | ------------------------------------------------- |
| Neon CLI       | Terminal workflows, scripts, CI/CD pipelines      |
| MCP Server     | AI-assisted development with Claude, Cursor, etc. |
| TypeScript SDK | Programmatic access in Node.js/TypeScript apps    |
| Python SDK     | Programmatic access in Python applications        |
| REST API       | Direct HTTP integration in any language           |

## Documentation Resources

| Topic          | URL                                                    |
| -------------- | ------------------------------------------------------ |
| CLI Reference  | https://neon.tech/docs/reference/neon-cli              |
| CLI Install    | https://neon.tech/docs/reference/cli-install           |
| CLI Auth       | https://neon.tech/docs/reference/cli-auth              |
| CLI Projects   | https://neon.tech/docs/reference/cli-projects          |
| CLI Branches   | https://neon.tech/docs/reference/cli-branches          |
| CLI Connection | https://neon.tech/docs/reference/cli-connection-string |

Fetch CLI documentation:

```bash
curl -H "Accept: text/markdown" https://neon.tech/docs/reference/neon-cli
```
