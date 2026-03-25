# Render Blueprint Specification

Complete reference for render.yaml Blueprint files. Blueprints define your infrastructure as code for reproducible deployments on Render.

## Overview

A Blueprint is a YAML file (typically `render.yaml`) placed in your repository root that describes:
- Services (web, worker, cron, static, private)
- Databases (PostgreSQL, Redis)
- Environment variables and secrets
- Scaling and resource configuration
- Project organization

## Root-Level Structure

```yaml
# Top-level fields
services: []         # Array of service definitions
databases: []        # Array of PostgreSQL databases
envVarGroups: []     # Reusable environment variable groups (optional)
projects: []         # Project organization (optional)
ungrouped: []        # Resources outside projects (optional)
previews:            # Preview environment configuration (optional)
  generation: auto_preview | manual | none
```

## Service Types

### Web Services (`type: web`)

HTTP services, APIs, and web applications. Publicly accessible via HTTPS.

**Required fields:**
- `name`: Unique service identifier
- `type`: Must be `web`
- `runtime`: Language/environment (see Runtimes section)
- `buildCommand`: Command to build the application
- `startCommand`: Command to start the server

**Common optional fields:**
- `plan`: Instance type (default: `free`)
- `region`: Deployment region (default: `oregon`)
- `branch`: Git branch to deploy (default: `main`)
- `autoDeploy`: Auto-deploy on push (default: `true`)
- `envVars`: Environment variables array
- `healthCheckPath`: Health check endpoint (default: `/`)
- `numInstances`: Number of instances (manual scaling)
- `scaling`: Autoscaling configuration

**Example:**
```yaml
services:
  - type: web
    name: api-server
    runtime: node
    plan: free
    buildCommand: npm ci
    startCommand: npm start
    branch: main
    autoDeploy: true
    envVars:
      - key: NODE_ENV
        value: production
      - key: PORT
        value: 10000
```

### Worker Services (`type: worker`)

Background job processors, queue consumers. Not publicly accessible.

**Required fields:**
- `name`: Unique service identifier
- `type`: Must be `worker`
- `runtime`: Language/environment
- `buildCommand`: Command to build
- `startCommand`: Command to start worker process

**Key differences from web services:**
- No public URL
- No health checks
- No port binding required

**Example:**
```yaml
services:
  - type: worker
    name: job-processor
    runtime: python
    plan: free
    buildCommand: pip install -r requirements.txt
    startCommand: celery -A tasks worker --loglevel=info
    envVars:
      - key: REDIS_URL
        fromDatabase:
          name: redis
          property: connectionString
```

### Cron Jobs (`type: cron`)

Scheduled tasks that run on a cron schedule.

**Required fields:**
- `name`: Unique service identifier
- `type`: Must be `cron`
- `runtime`: Language/environment
- `schedule`: Cron expression
- `buildCommand`: Command to build
- `startCommand`: Command to execute on schedule

**Schedule format:** Standard cron syntax (minute hour day month weekday)

**Examples:**
- `0 0 * * *` - Daily at midnight UTC
- `*/15 * * * *` - Every 15 minutes
- `0 9 * * 1` - Every Monday at 9 AM UTC

**Example:**
```yaml
services:
  - type: cron
    name: daily-backup
    runtime: node
    schedule: "0 2 * * *"
    buildCommand: npm ci
    startCommand: node scripts/backup.js
    envVars:
      - key: DATABASE_URL
        fromDatabase:
          name: postgres
          property: connectionString
```

### Static Sites (`type: static` or `type: web` with `runtime: static`)

Serve static HTML/CSS/JS files via CDN.

**Required fields:**
- `name`: Unique service identifier
- `type`: `web`
- `runtime`: `static`
- `buildCommand`: Command to build static assets
- `staticPublishPath`: Path to built files (e.g., `./build`, `./dist`)

**Optional configuration:**
- `routes`: Routing rules for SPAs
- `headers`: Custom HTTP headers
- `buildFilter`: Path filters for build triggers

**Example:**
```yaml
services:
  - type: web
    name: react-app
    runtime: static
    buildCommand: npm ci && npm run build
    staticPublishPath: ./dist
    routes:
      - type: rewrite
        source: /*
        destination: /index.html
    headers:
      - path: /*
        name: Cache-Control
        value: public, max-age=31536000, immutable
```

### Private Services (`type: pserv`)

Internal services accessible only within your Render account.

**Required fields:**
- `name`: Unique service identifier
- `type`: Must be `pserv`
- `runtime`: Language/environment
- `buildCommand`: Command to build
- `startCommand`: Command to start

**Use cases:**
- Internal APIs
- Database proxies
- Microservices not exposed to internet

**Example:**
```yaml
services:
  - type: pserv
    name: internal-api
    runtime: go
    plan: free
    buildCommand: go build -o bin/app
    startCommand: ./bin/app
```

## Runtimes

### Native Runtimes

**Node.js (`runtime: node`):**
- Versions: 14, 16, 18, 20, 21
- Default version: 20
- Specify version in `package.json` engines field

**Python (`runtime: python`):**
- Versions: 3.8, 3.9, 3.10, 3.11, 3.12
- Default version: 3.11
- Specify version in `runtime.txt` or `Pipfile`

**Go (`runtime: go`):**
- Versions: 1.20, 1.21, 1.22, 1.23
- Uses go modules
- Version from `go.mod`

**Ruby (`runtime: ruby`):**
- Versions: 3.0, 3.1, 3.2, 3.3
- Uses Bundler
- Version from `.ruby-version` or `Gemfile`

**Rust (`runtime: rust`):**
- Latest stable version
- Uses Cargo

**Elixir (`runtime: elixir`):**
- Latest stable version
- Uses Mix

### Docker Runtime

**Docker (`runtime: docker`):**
Build from a Dockerfile in your repository.

**Additional fields:**
- `dockerfilePath`: Path to Dockerfile (default: `./Dockerfile`)
- `dockerContext`: Build context directory (default: `.`)

**Example:**
```yaml
services:
  - type: web
    name: docker-app
    runtime: docker
    dockerfilePath: ./docker/Dockerfile
    dockerContext: .
    plan: free
```

**Image (`runtime: image`):**
Deploy pre-built Docker images from a registry.

**Additional fields:**
- `image`: Image URL (e.g., `registry.com/image:tag`)
- `registryCredential`: Credentials for private registries

**Example:**
```yaml
services:
  - type: web
    name: prebuilt-app
    runtime: image
    image: myregistry.com/app:v1.2.3
    plan: free
```

## Service Plans

Available instance types:

| Plan | RAM | CPU | Price |
|------|-----|-----|-------|
| `free` | 512 MB | 0.5 | Free (750 hrs/mo) |
| `starter` | 512 MB | 0.5 | $7/month |
| `standard` | 2 GB | 1 | $25/month |
| `pro` | 4 GB | 2 | $85/month |
| `pro_plus` | 8 GB | 4 | $175/month |

**Always default to `plan: free` unless user specifies otherwise.**

## Regions

Available deployment regions:

- `oregon` (US West) - Default
- `ohio` (US East)
- `virginia` (US East)
- `frankfurt` (EU)
- `singapore` (Asia)

**Example:**
```yaml
services:
  - type: web
    name: my-app
    runtime: node
    region: frankfurt
```

## Environment Variables

Three patterns for defining environment variables:

### 1. Hardcoded Values

For non-sensitive configuration:

```yaml
envVars:
  - key: NODE_ENV
    value: production
  - key: API_URL
    value: https://api.example.com
  - key: LOG_LEVEL
    value: info
```

### 2. Generated Secrets

Render generates a base64-encoded 256-bit random value:

```yaml
envVars:
  - key: SESSION_SECRET
    generateValue: true
  - key: ENCRYPTION_KEY
    generateValue: true
```

### 3. User-Provided Secrets

Prompt user for values during Blueprint creation:

```yaml
envVars:
  - key: STRIPE_SECRET_KEY
    sync: false
  - key: JWT_SECRET
    sync: false
  - key: API_KEY
    sync: false
```

**The `sync: false` flag means "user will fill this in the Dashboard".**

### 4. Database References

Link to database connection strings:

```yaml
envVars:
  - key: DATABASE_URL
    fromDatabase:
      name: postgres
      property: connectionString
  - key: REDIS_URL
    fromDatabase:
      name: redis
      property: connectionString
```

**Available properties:**
- `connectionString`: Full connection URL
- `host`: Database host
- `port`: Database port
- `user`: Database username
- `password`: Database password
- `database`: Database name
- `hostport`: Combined `host:port`

### 5. Service References

Link to other services:

```yaml
envVars:
  - key: API_URL
    fromService:
      name: api-server
      type: web
      property: host
```

### 6. Environment Variable Groups

Reusable groups shared across services:

```yaml
envVarGroups:
  - name: shared-config
    envVars:
      - key: LOG_LEVEL
        value: info
      - key: ENVIRONMENT
        value: production

services:
  - type: web
    name: web-app
    runtime: node
    envVars:
      - fromGroup: shared-config
      - key: PORT
        value: 10000
```

## Databases

### PostgreSQL

```yaml
databases:
  - name: postgres
    databaseName: myapp_prod
    user: myapp_user
    plan: free
    postgresMajorVersion: "15"
    ipAllowList: []
```

**Plans:**
- `free`: 1 GB storage, 97 MB RAM, 0.1 CPU
- `basic-256mb`, `basic-512mb`, `basic-1gb`, `basic-4gb`
- `pro-4gb`, `pro-8gb`, `pro-16gb`, etc.
- `accelerated-4gb`, `accelerated-8gb`, etc. (SSD-backed)

**Key fields:**
- `name`: Identifier for references
- `databaseName`: Actual PostgreSQL database name
- `user`: Database username
- `postgresMajorVersion`: PostgreSQL version (11-16)
- `ipAllowList`: Array of CIDR blocks (empty = internal only)
- `diskSizeGB`: Storage size (paid plans only)

**High Availability (paid plans):**
```yaml
databases:
  - name: postgres
    databaseName: myapp_prod
    plan: pro-4gb
    highAvailabilityEnabled: true
```

**Read Replicas (paid plans):**
```yaml
databases:
  - name: postgres
    databaseName: myapp_prod
    plan: pro-4gb
    readReplicas:
      - name: read-replica-1
        region: ohio
      - name: read-replica-2
        region: frankfurt
```

### Redis (Key-Value Store)

```yaml
databases:
  - name: redis
    plan: free
    maxmemoryPolicy: allkeys-lru
    ipAllowList: []
```

**Plans:** Same as PostgreSQL

**maxmemoryPolicy options:**
- `allkeys-lru`: Evict least recently used keys
- `volatile-lru`: Evict LRU keys with TTL
- `allkeys-random`: Evict random keys
- `volatile-random`: Evict random keys with TTL
- `volatile-ttl`: Evict keys with soonest TTL
- `noeviction`: Return errors when memory full

## Scaling

### Manual Scaling

Fixed number of instances:

```yaml
services:
  - type: web
    name: my-app
    runtime: node
    plan: standard
    numInstances: 3
```

### Autoscaling

Dynamic scaling based on CPU/memory (Professional workspace required):

```yaml
services:
  - type: web
    name: my-app
    runtime: node
    plan: standard
    scaling:
      minInstances: 1
      maxInstances: 5
      targetCPUPercent: 60
      targetMemoryPercent: 70
```

**Notes:**
- Autoscaling disabled in preview environments
- Preview environments run `minInstances` count
- Requires Professional or higher workspace

## Health Checks

Configure health check endpoints:

```yaml
services:
  - type: web
    name: my-app
    runtime: node
    healthCheckPath: /health
```

**Default:** `/` (root path)

**Recommended:** Add a dedicated `/health` endpoint that returns `200 OK`.

## Build Filters

Control when builds are triggered based on changed files:

```yaml
services:
  - type: web
    name: frontend
    runtime: static
    buildFilter:
      paths:
        - frontend/**
      ignoredPaths:
        - frontend/README.md
        - frontend/**/*.test.js
```

**Behavior:**
- If `paths` specified: Build only when files in those paths change
- If `ignoredPaths` specified: Don't build when only ignored files change

## Projects and Environments

Organize services into projects with multiple environments:

```yaml
projects:
  - name: my-application
    environments:
      - name: production
        services:
          - type: web
            name: prod-api
            runtime: node
            plan: pro
            buildCommand: npm ci
            startCommand: npm start
        databases:
          - name: prod-postgres
            plan: pro-4gb
        networking:
          isolation: enabled
        permissions:
          protection: enabled

      - name: staging
        services:
          - type: web
            name: staging-api
            runtime: node
            plan: starter
            buildCommand: npm ci
            startCommand: npm start
        databases:
          - name: staging-postgres
            plan: free
```

**Environment features:**
- `networking.isolation`: Enable network isolation between environments
- `permissions.protection`: Require approval for environment changes

## Preview Environments

Configure automatic preview environments for pull requests:

```yaml
previews:
  generation: auto_preview  # auto_preview | manual | none
```

**Options:**
- `auto_preview`: Create preview environment for each PR automatically
- `manual`: User manually triggers preview creation
- `none`: Disable preview environments

## Complete Example

Full-featured Blueprint with multiple services and databases:

```yaml
services:
  # Web service
  - type: web
    name: web-app
    runtime: node
    plan: free
    region: oregon
    buildCommand: npm ci && npm run build
    startCommand: npm start
    branch: main
    autoDeploy: true
    healthCheckPath: /health
    envVars:
      - key: NODE_ENV
        value: production
      - key: DATABASE_URL
        fromDatabase:
          name: postgres
          property: connectionString
      - key: REDIS_URL
        fromDatabase:
          name: redis
          property: connectionString
      - key: JWT_SECRET
        sync: false

  # Background worker
  - type: worker
    name: queue-worker
    runtime: node
    plan: free
    buildCommand: npm ci
    startCommand: node worker.js
    envVars:
      - key: REDIS_URL
        fromDatabase:
          name: redis
          property: connectionString

  # Cron job
  - type: cron
    name: daily-cleanup
    runtime: node
    schedule: "0 3 * * *"
    buildCommand: npm ci
    startCommand: node scripts/cleanup.js
    envVars:
      - key: DATABASE_URL
        fromDatabase:
          name: postgres
          property: connectionString

  # Static frontend
  - type: web
    name: frontend
    runtime: static
    buildCommand: npm ci && npm run build
    staticPublishPath: ./dist
    routes:
      - type: rewrite
        source: /*
        destination: /index.html

databases:
  - name: postgres
    databaseName: app_production
    user: app_user
    plan: free
    postgresMajorVersion: "15"
    ipAllowList: []

  - name: redis
    plan: free
    maxmemoryPolicy: allkeys-lru
    ipAllowList: []
```

## Validation

Validate your Blueprint before deploying (when CLI command is available):

```bash
render blueprint validate
```

**Common validation errors:**
- Missing required fields
- Invalid runtime values
- Incorrect environment variable references
- Invalid cron expressions
- Invalid YAML syntax

## Best Practices

1. **Always use `plan: free` by default** - Let users upgrade if needed
2. **Mark all secrets with `sync: false`** - Never hardcode sensitive values
3. **Use `fromDatabase` for database URLs** - Automatic internal connection strings
4. **Add health check endpoints** - Faster deployment detection
5. **Use non-interactive build commands** - Prevents build hangs
6. **Bind to `0.0.0.0:$PORT`** - Required for web services
7. **Use environment variable groups** - Share config across services
8. **Enable autoDeploy: true** - Deploy automatically on push
9. **Set appropriate regions** - Choose closest to your users
10. **Use build filters** - Optimize build triggers in monorepos

## Additional Resources

- Official Blueprint Specification: https://render.com/docs/blueprint-spec
- Render CLI Documentation: https://render.com/docs/cli
- Environment Variables Guide: https://render.com/docs/environment-variables
