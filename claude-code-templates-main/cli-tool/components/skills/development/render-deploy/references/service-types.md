# Render Service Types

Detailed explanation of each service type available on Render. Choose the right service type based on your application's needs.

## Web Services (`type: web`)

### Purpose

Web services are HTTP servers that handle incoming requests from the internet. They're publicly accessible via HTTPS URLs.

### Use Cases

- **REST APIs**: JSON APIs for mobile apps or frontend applications
- **GraphQL servers**: GraphQL endpoints for client queries
- **Web applications**: Server-rendered websites (Django, Rails, Express)
- **Full-stack frameworks**: Next.js, Nuxt.js, Remix, SvelteKit
- **WebSocket servers**: Real-time communication servers
- **SSR applications**: Server-side rendered React, Vue, or Angular apps

### Key Characteristics

- **Public URL**: Automatically assigned `https://[service-name].onrender.com`
- **Port binding required**: Must bind to `0.0.0.0:$PORT`
- **Health checks**: Render pings your service to verify it's running
- **HTTPS**: Automatic SSL/TLS certificates
- **Load balancing**: Traffic distributed across multiple instances
- **Custom domains**: Support for your own domain names

### Required Configuration

```yaml
type: web
name: my-api
runtime: node
buildCommand: npm ci
startCommand: npm start
```

### Best Practices

1. **Bind to environment PORT**:
```javascript
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0');
```

2. **Add health check endpoint**:
```javascript
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});
```

3. **Use appropriate timeouts**: Web requests should complete within 30 seconds

4. **Implement graceful shutdown**: Handle SIGTERM signals properly

---

## Worker Services (`type: worker`)

### Purpose

Worker services run background tasks without handling HTTP requests. They're not publicly accessible.

### Use Cases

- **Queue processors**: Redis queue, BullMQ, Celery, Sidekiq
- **Background jobs**: Email sending, image processing, data exports
- **Event consumers**: Message queue consumers (Kafka, RabbitMQ, etc.)
- **Data pipeline workers**: ETL processes, data transformation
- **Scheduled background tasks**: Continuous processes (not cron)
- **WebSocket backend**: Dedicated WebSocket handler services

### Key Characteristics

- **No public URL**: Not accessible from internet
- **No port binding**: Doesn't need to listen on a port
- **No health checks**: Render monitors process health differently
- **Long-running**: Can run indefinitely
- **Private communication**: Access via internal networking
- **Restart on crash**: Automatically restarted if process dies

### Required Configuration

```yaml
type: worker
name: queue-processor
runtime: python
buildCommand: pip install -r requirements.txt
startCommand: celery -A tasks worker --loglevel=info
```

### Best Practices

1. **Connect to message queue**:
```python
import redis
r = redis.from_url(os.environ['REDIS_URL'])
```

2. **Implement retry logic**: Handle failures gracefully

3. **Monitor queue depth**: Track pending jobs

4. **Log processing status**: Make debugging easier

5. **Graceful shutdown**: Finish current jobs before exiting

### Common Patterns

**Node.js with BullMQ:**
```yaml
type: worker
name: job-processor
runtime: node
buildCommand: npm ci
startCommand: node worker.js
envVars:
  - key: REDIS_URL
    fromDatabase:
      name: redis
      property: connectionString
```

**Python with Celery:**
```yaml
type: worker
name: celery-worker
runtime: python
buildCommand: pip install -r requirements.txt
startCommand: celery -A app.celery worker
envVars:
  - key: REDIS_URL
    fromDatabase:
      name: redis
      property: connectionString
```

---

## Cron Jobs (`type: cron`)

### Purpose

Cron jobs run scheduled tasks on a repeating schedule. They execute, complete, and shut down.

### Use Cases

- **Database backups**: Regular automated backups
- **Report generation**: Daily/weekly reports
- **Data cleanup**: Delete old records periodically
- **Cache warming**: Pre-populate caches
- **Email digests**: Send scheduled email summaries
- **Data synchronization**: Sync between systems
- **Batch processing**: Process accumulated data

### Key Characteristics

- **Scheduled execution**: Runs on cron schedule
- **Automatic shutdown**: Shuts down after completing
- **No persistent port**: Doesn't maintain listening port
- **No health checks**: Task either completes or fails
- **UTC timezone**: All schedules in UTC
- **Maximum runtime**: Jobs timeout after configured limit

### Required Configuration

```yaml
type: cron
name: daily-backup
runtime: node
schedule: "0 2 * * *"  # Daily at 2 AM UTC
buildCommand: npm ci
startCommand: node scripts/backup.js
```

### Schedule Format

Standard cron syntax: `minute hour day month weekday`

**Common schedules:**

| Schedule | Description |
|----------|-------------|
| `*/5 * * * *` | Every 5 minutes |
| `0 * * * *` | Every hour |
| `0 0 * * *` | Daily at midnight UTC |
| `0 9 * * 1-5` | Weekdays at 9 AM UTC |
| `0 0 1 * *` | First day of each month |
| `0 9 * * 1` | Every Monday at 9 AM UTC |

### Best Practices

1. **Handle failures gracefully**: Jobs should be idempotent

2. **Log completion status**: Track success/failure

3. **Set appropriate timeouts**: Match expected job duration

4. **Use UTC times**: All schedules are UTC-based

5. **Test thoroughly**: Test with different data scenarios

### Example Use Cases

**Daily Database Backup:**
```yaml
type: cron
name: db-backup
runtime: python
schedule: "0 1 * * *"  # 1 AM UTC daily
buildCommand: pip install -r requirements.txt
startCommand: python scripts/backup.py
envVars:
  - key: DATABASE_URL
    fromDatabase:
      name: postgres
      property: connectionString
  - key: S3_BUCKET
    value: my-backups
```

**Hourly Cache Refresh:**
```yaml
type: cron
name: cache-refresh
runtime: node
schedule: "0 * * * *"  # Top of every hour
buildCommand: npm ci
startCommand: node scripts/refresh-cache.js
```

---

## Static Sites (`type: web` + `runtime: static`)

### Purpose

Serve static HTML, CSS, and JavaScript files via CDN. No backend runtime.

### Use Cases

- **Single Page Applications (SPAs)**: React, Vue, Angular apps
- **Static site generators**: Gatsby, Next.js (static export), Hugo
- **Documentation sites**: MkDocs, Docusaurus, VitePress
- **Landing pages**: Marketing sites
- **Portfolio sites**: Personal websites
- **JAMstack sites**: Static sites with API integration

### Key Characteristics

- **CDN delivery**: Global edge caching
- **No backend runtime**: Only serves built files
- **Build output only**: Serves contents of build directory
- **Routing support**: Rewrite rules for SPA routing
- **Custom headers**: Cache control, security headers
- **Fast deployment**: Quick to build and deploy

### Required Configuration

```yaml
type: web
name: frontend
runtime: static
buildCommand: npm ci && npm run build
staticPublishPath: ./dist  # or ./build, ./out, ./public
```

### Routing for SPAs

Single Page Applications need rewrite rules to handle client-side routing:

```yaml
type: web
name: react-app
runtime: static
buildCommand: npm ci && npm run build
staticPublishPath: ./build
routes:
  - type: rewrite
    source: /*
    destination: /index.html
```

### Custom Headers

Add cache control and security headers:

```yaml
type: web
name: static-site
runtime: static
buildCommand: npm ci && npm run build
staticPublishPath: ./dist
headers:
  # Cache static assets
  - path: /static/*
    name: Cache-Control
    value: public, max-age=31536000, immutable

  # Security headers
  - path: /*
    name: X-Frame-Options
    value: DENY
  - path: /*
    name: X-Content-Type-Options
    value: nosniff
```

### Build Filters

For monorepos, only build when frontend files change:

```yaml
type: web
name: frontend
runtime: static
buildCommand: npm ci && npm run build
staticPublishPath: ./dist
buildFilter:
  paths:
    - frontend/**
  ignoredPaths:
    - frontend/**/*.test.js
    - frontend/README.md
```

### Best Practices

1. **Optimize build output**: Minify, compress, tree-shake

2. **Use proper cache headers**: Long cache for hashed assets

3. **Add security headers**: Protect against common attacks

4. **Configure SPA routing**: Add rewrite rules for client routing

5. **Handle 404s**: Create custom 404.html page

---

## Private Services (`type: pserv`)

### Purpose

Internal services accessible only within your Render account. Not exposed to the internet.

### Use Cases

- **Internal APIs**: Services accessed only by other services
- **Database proxies**: Connection pools, read replicas
- **Microservices**: Service mesh architectures
- **Admin tools**: Internal dashboards
- **Cache layers**: Internal caching services
- **Message brokers**: Internal message queues

### Key Characteristics

- **No public URL**: Only accessible via internal DNS
- **Internal networking**: Fast, low-latency connections
- **Port binding required**: Must bind to `0.0.0.0:$PORT`
- **Private DNS**: `[service-name].render-internal.com`
- **Same-account only**: Only accessible from same account
- **No internet access**: Traffic stays within Render network

### Required Configuration

```yaml
type: pserv
name: internal-api
runtime: node
buildCommand: npm ci
startCommand: npm start
```

### Accessing Private Services

From other services in the same account:

```javascript
// Use .render-internal.com domain
const API_URL = 'http://internal-api.render-internal.com:10000';
```

Or use service references:

```yaml
services:
  - type: web
    name: frontend
    runtime: node
    envVars:
      - key: INTERNAL_API_URL
        fromService:
          name: internal-api
          type: pserv
          property: hostport
```

### Best Practices

1. **Use internal DNS**: Always use `.render-internal.com` domains

2. **No authentication needed**: Already isolated to account

3. **Fast communication**: Low latency between services

4. **Simplify architecture**: No need for external load balancers

---

## Comparison Table

| Feature | Web | Worker | Cron | Static | Private |
|---------|-----|--------|------|--------|---------|
| Public URL | ✅ Yes | ❌ No | ❌ No | ✅ Yes | ❌ No |
| Port Binding | ✅ Required | ❌ Not needed | ❌ Not needed | ❌ N/A | ✅ Required |
| Health Checks | ✅ Yes | ❌ No | ❌ No | ❌ N/A | ✅ Yes |
| Runtime | ✅ Yes | ✅ Yes | ✅ Yes | ❌ No | ✅ Yes |
| Persistent | ✅ Yes | ✅ Yes | ❌ No | ✅ Yes | ✅ Yes |
| Scaling | ✅ Yes | ✅ Yes | ❌ No | ✅ Yes | ✅ Yes |
| Use Case | HTTP servers | Background jobs | Scheduled tasks | Static files | Internal services |

## Choosing the Right Service Type

**Use Web Service when:**
- Your app handles HTTP requests
- Users need to access it via URL
- You need load balancing and scaling

**Use Worker Service when:**
- Processing background jobs
- Consuming from message queues
- Running long-lived processes without HTTP

**Use Cron Job when:**
- Running scheduled tasks
- Processing doesn't need to be always-on
- Tasks run periodically (hourly, daily, weekly)

**Use Static Site when:**
- Serving pre-built HTML/CSS/JS
- No backend processing needed
- Want CDN caching and fast delivery

**Use Private Service when:**
- Service only accessed by other services
- Want internal-only communication
- Building microservice architectures
