# Neon Platform API

The Neon Platform API allows you to manage Neon projects, branches, databases, and resources programmatically. You can use the REST API directly or through official SDKs.

## Options

| Method         | Package/URL                         | Best For                        |
| -------------- | ----------------------------------- | ------------------------------- |
| REST API       | `https://console.neon.tech/api/v2/` | Any language, direct HTTP calls |
| TypeScript SDK | `@neondatabase/api-client`          | Node.js, TypeScript projects    |
| Python SDK     | `neon-api`                          | Python scripts and applications |
| CLI            | `neonctl`                           | Terminal-based management       |

## Documentation

```bash
# REST API documentation
curl -H "Accept: text/markdown" https://neon.tech/docs/reference/api-reference

# TypeScript SDK
curl -H "Accept: text/markdown" https://neon.tech/docs/reference/typescript-sdk

# Python SDK
curl -H "Accept: text/markdown" https://neon.tech/docs/reference/python-sdk

# CLI
curl -H "Accept: text/markdown" https://neon.tech/docs/reference/neon-cli
```

For the interactive API reference: https://api-docs.neon.tech/reference/getting-started-with-neon-api

## Sub-Resources

For detailed information, reference the appropriate sub-resource:

### REST API Details

| Topic                         | Resource                         |
| ----------------------------- | -------------------------------- |
| Guidelines, Auth, Rate Limits | `neon-rest-api/guidelines.md`    |
| Projects                      | `neon-rest-api/projects.md`      |
| Branches, Databases, Roles    | `neon-rest-api/branches.md`      |
| Compute Endpoints             | `neon-rest-api/endpoints.md`     |
| API Keys                      | `neon-rest-api/keys.md`          |
| Operations                    | `neon-rest-api/operations.md`    |
| Organizations                 | `neon-rest-api/organizations.md` |

### SDKs

| Language   | Resource                 |
| ---------- | ------------------------ |
| TypeScript | `neon-typescript-sdk.md` |
| Python     | `neon-python-sdk.md`     |

## Quick Start

### Authentication

All API requests require a Neon API key:

```bash
Authorization: Bearer $NEON_API_KEY
```

### API Key Types

| Type           | Scope                           | Best For                      |
| -------------- | ------------------------------- | ----------------------------- |
| Personal       | All projects user has access to | Individual use, scripting     |
| Organization   | Entire organization             | CI/CD, org-wide automation    |
| Project-scoped | Single project only             | Project-specific integrations |

### Rate Limits

- 700 requests per minute (~11 per second)
- Bursts up to 40 requests per second per route
- Handle `429 Too Many Requests` with retry/backoff

## Common Operations Quick Reference

| Operation          | REST API                                   | TypeScript SDK              | Python SDK            |
| ------------------ | ------------------------------------------ | --------------------------- | --------------------- |
| List Projects      | `GET /projects`                            | `listProjects({})`          | `projects()`          |
| Create Project     | `POST /projects`                           | `createProject({...})`      | `project_create(...)` |
| Get Connection URI | `GET /projects/{id}/connection_uri`        | `getConnectionUri({...})`   | `connection_uri(...)` |
| Create Branch      | `POST /projects/{id}/branches`             | `createProjectBranch(...)`  | `branch_create(...)`  |
| Start Endpoint     | `POST /projects/{id}/endpoints/{id}/start` | `startProjectEndpoint(...)` | `endpoint_start(...)` |

## Error Handling

| Status | Meaning      | Action                       |
| ------ | ------------ | ---------------------------- |
| 401    | Unauthorized | Check API key                |
| 404    | Not Found    | Verify resource ID           |
| 429    | Rate Limited | Implement retry with backoff |
| 500    | Server Error | Retry or contact support     |
