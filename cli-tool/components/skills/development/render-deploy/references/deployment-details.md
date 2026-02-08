# Deployment Details

Use this reference for service discovery, configuration patterns, quick commands, and common issues.

## Service Discovery

**List all services:**
```
list_services()
```
Returns all services with IDs, names, types, and status.

**Get specific service details:**
```
get_service(serviceId: "<id>")
```
Returns full configuration including environment variables and build/start commands.

**List PostgreSQL databases:**
```
list_postgres_instances()
```

**List Key-Value stores:**
```
list_key_value()
```

## Configuration Details

### Environment Variables

**All environment variables must be declared in render.yaml.**

**Three patterns for environment variables:**

1. **Hardcoded values** (non-sensitive configuration):
```yaml
envVars:
  - key: NODE_ENV
    value: production
  - key: API_URL
    value: https://api.example.com
```

2. **Database connections** (auto-generated):
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

3. **Secrets** (user fills in Dashboard):
```yaml
envVars:
  - key: JWT_SECRET
    sync: false
  - key: API_KEY
    sync: false
  - key: STRIPE_SECRET_KEY
    sync: false
```

Complete environment variable guide: [configuration-guide.md](configuration-guide.md)

### Port Binding

**CRITICAL:** Web services must bind to `0.0.0.0:$PORT` (NOT `localhost`). Render sets the `PORT` environment variable.

**Node.js Example:**
```javascript
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});
```

**Python Example:**
```python
import os

port = int(os.environ.get('PORT', 5000))
app.run(host='0.0.0.0', port=port)
```

**Go Example:**
```go
port := os.Getenv("PORT")
if port == "" {
    port = "3000"
}
http.ListenAndServe(":"+port, handler)
```

### Plan Defaults

**Use `plan: free` unless the user specifies otherwise.** Refer to Render pricing for current limits and capacity.

### Build Commands

**Use non-interactive flags to prevent build hangs:**
- npm: `npm ci`
- yarn: `yarn install --frozen-lockfile`
- pnpm: `pnpm install --frozen-lockfile`
- bun: `bun install --frozen-lockfile`
- pip: `pip install -r requirements.txt`
- uv: `uv sync`
- apt: `apt-get install -y <package>`
- bundler: `bundle install --jobs=4 --retry=3`

### Database Connections

When services connect to databases in the same Render account, use `fromDatabase` references for internal URLs.

### Health Checks

Optional but recommended: add a `/health` endpoint for faster deployment detection.

## Quick Reference

### MCP Tools (Preferred)
```
# Service Discovery
list_services()
get_service(serviceId: "<id>")
list_postgres_instances()
list_key_value()

# Service Creation
create_web_service(name, runtime, buildCommand, startCommand, ...)
create_static_site(name, buildCommand, publishPath, ...)
create_cron_job(name, runtime, schedule, buildCommand, startCommand, ...)
create_postgres(name, plan, region)
create_key_value(name, plan, region)

# Environment Variables
update_environment_variables(serviceId, envVars: [{key, value}, ...])

# Deployment & Monitoring
list_deploys(serviceId, limit)
list_logs(resource: ["<id>"], level: ["error"])
get_metrics(resourceId, metricTypes: [...])

# Workspace
get_selected_workspace()
list_workspaces()
```

### CLI Commands
```bash
# Validate Blueprint
render blueprints validate

# Check workspace
render workspace current -o json
render workspace set

# List services
render services -o json

# View deployment logs
render logs -r <service-id> -o json

# Create deployment
render deploys create <service-id> --wait
```

### Templates by Framework
- Node.js Express: [../assets/node-express.yaml](../assets/node-express.yaml)
- Next.js + Postgres: [../assets/nextjs-postgres.yaml](../assets/nextjs-postgres.yaml)
- Django + Worker: [../assets/python-django.yaml](../assets/python-django.yaml)
- Static Site: [../assets/static-site.yaml](../assets/static-site.yaml)
- Go API: [../assets/go-api.yaml](../assets/go-api.yaml)
- Docker: [../assets/docker.yaml](../assets/docker.yaml)

### Documentation
- Full Blueprint specification: [blueprint-spec.md](blueprint-spec.md)
- Service types explained: [service-types.md](service-types.md)
- Runtime options: [runtimes.md](runtimes.md)
- Configuration guide: [configuration-guide.md](configuration-guide.md)

## Common Issues

**Issue:** Deployment fails with port binding error

**Solution:** Ensure app binds to `0.0.0.0:$PORT` (see Port Binding section above)

---

**Issue:** Build hangs or times out

**Solution:** Use non-interactive build commands (see Build Commands section above)

---

**Issue:** Missing environment variables in Dashboard

**Solution:** All env vars must be declared in render.yaml. Add missing vars with `sync: false` for secrets.

---

**Issue:** Database connection fails

**Solution:** Use `fromDatabase` references for internal connection strings.

---

**Issue:** Static site shows 404 for routes

**Solution:** Add rewrite rules to render.yaml for SPA routing:
```yaml
routes:
  - type: rewrite
    source: /*
    destination: /index.html
```

For more detailed troubleshooting, see the debug skill or [configuration-guide.md](configuration-guide.md).
