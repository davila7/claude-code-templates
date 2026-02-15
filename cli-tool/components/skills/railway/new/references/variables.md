# Variables Reference

Variables in Railway support references to other services, shared variables, and Railway-provided values.

## Template Syntax

```
${{NAMESPACE.VAR}}
```

| Namespace | Description |
|-----------|-------------|
| `shared` | Shared variables (project-wide) |
| `<serviceName>` | Variables from another service (case-sensitive) |

## Examples

**Reference shared variable:**
```json
{ "value": "${{shared.DOMAIN}}" }
```

**Reference another service's variable:**
```json
{ "value": "${{api.API_KEY}}" }
```

**Combine with text:**
```json
{ "value": "https://${{shared.DOMAIN}}/api" }
```

## Railway-Provided Variables

Railway injects these into every service automatically.

### Networking
| Variable | Description | Example | Availability |
|----------|-------------|---------|--------------|
| `RAILWAY_PUBLIC_DOMAIN` | Public domain | `myapp.up.railway.app` | Only if service has a domain |
| `RAILWAY_PRIVATE_DOMAIN` | Private DNS (internal only) | `myapp.railway.internal` | Always |
| `RAILWAY_TCP_PROXY_DOMAIN` | TCP proxy domain | `roundhouse.proxy.rlwy.net` | Only if TCP proxy enabled |
| `RAILWAY_TCP_PROXY_PORT` | TCP proxy port | `11105` | Only if TCP proxy enabled |

**Note:** `RAILWAY_PUBLIC_DOMAIN` is only available if the service has a domain configured.
Check the service's environment config to verify a domain exists before referencing it.

### Context
| Variable | Description |
|----------|-------------|
| `RAILWAY_PROJECT_ID` | Project ID |
| `RAILWAY_PROJECT_NAME` | Project name |
| `RAILWAY_ENVIRONMENT_ID` | Environment ID |
| `RAILWAY_ENVIRONMENT_NAME` | Environment name |
| `RAILWAY_SERVICE_ID` | Service ID |
| `RAILWAY_SERVICE_NAME` | Service name |
| `RAILWAY_DEPLOYMENT_ID` | Deployment ID |
| `RAILWAY_REPLICA_ID` | Replica ID |
| `RAILWAY_REPLICA_REGION` | Region (e.g., `us-west2`) |

### Volume (if attached)
| Variable | Description |
|----------|-------------|
| `RAILWAY_VOLUME_NAME` | Volume name |
| `RAILWAY_VOLUME_MOUNT_PATH` | Mount path |

### Git (if deployed from GitHub)
| Variable | Description |
|----------|-------------|
| `RAILWAY_GIT_COMMIT_SHA` | Commit SHA |
| `RAILWAY_GIT_BRANCH` | Branch name |
| `RAILWAY_GIT_REPO_NAME` | Repository name |
| `RAILWAY_GIT_REPO_OWNER` | Repository owner |
| `RAILWAY_GIT_AUTHOR` | Commit author |
| `RAILWAY_GIT_COMMIT_MESSAGE` | Commit message |

## Wiring Services Together

### Frontend → Backend (public network)
Use when: Browser makes requests to API (browser can't access private network)

```json
{
  "services": {
    "<frontendId>": {
      "variables": {
        "API_URL": { "value": "https://${{backend.RAILWAY_PUBLIC_DOMAIN}}" }
      }
    }
  }
}
```

### Service → Database (private network)
Use when: Backend connects to database (faster, no egress cost, more secure)

Railway databases auto-generate connection URL variables. Use the private versions:

| Database | Variable Reference |
|----------|-------------------|
| Postgres | `${{Postgres.DATABASE_URL}}` |
| MySQL | `${{MySQL.DATABASE_URL}}` |
| Redis | `${{Redis.REDIS_URL}}` |
| Mongo | `${{Mongo.MONGO_URL}}` |

**Postgres/MySQL example:**
```json
{
  "services": {
    "<apiId>": {
      "variables": {
        "DATABASE_URL": { "value": "${{Postgres.DATABASE_URL}}" }
      }
    }
  }
}
```

**Redis example:**
```json
{
  "services": {
    "<apiId>": {
      "variables": {
        "REDIS_URL": { "value": "${{Redis.REDIS_URL}}" }
      }
    }
  }
}
```

**Mongo example:**
```json
{
  "services": {
    "<apiId>": {
      "variables": {
        "MONGO_URL": { "value": "${{Mongo.MONGO_URL}}" }
      }
    }
  }
}
```

**Note:** Service names are case-sensitive. Match the exact name from your project (e.g., "Postgres", "Redis").

### Service → Service (private network)
Use when: Microservices communicate internally

```json
{
  "services": {
    "<workerServiceId>": {
      "variables": {
        "API_INTERNAL_URL": { "value": "http://${{api.RAILWAY_PRIVATE_DOMAIN}}:${{api.PORT}}" }
      }
    }
  }
}
```

## When to Use Public vs Private

| Use Case | Domain | Reason |
|----------|--------|--------|
| Browser → API | Public | Browser can't access private network |
| Service → Service | Private | Faster, no egress, more secure |
| Service → Database | Private | Databases should never be public |
| External webhook → Service | Public | External services need public access |
| Cron job → API | Private | Internal communication |
