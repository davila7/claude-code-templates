# Performance Profiler

Profile and optimize application performance across frontend, backend, and database layers.

## Purpose

This command helps you identify and resolve performance bottlenecks in your application. It provides tools for bundle analysis, runtime profiling, memory leak detection, database query optimization, and web performance auditing.

## Usage

```
/perf-profile                    # Interactive mode - detect project type
/perf-profile bundle             # Analyze JavaScript bundle size
/perf-profile memory             # Check for memory leaks
/perf-profile queries            # Profile database queries
/perf-profile lighthouse         # Run Lighthouse audit
/perf-profile flamegraph         # Generate CPU flamegraph
/perf-profile runtime            # Runtime performance analysis
```

## What this command does

1. **Detects your stack** (Node.js, Python, frontend framework)
2. **Runs appropriate profiling tools** for your environment
3. **Identifies bottlenecks** with actionable recommendations
4. **Generates visual reports** (flamegraphs, bundle maps)
5. **Suggests optimizations** based on findings

## Frontend Performance

### Bundle Analysis

Analyze JavaScript bundle size and composition:

```bash
# Webpack
npx webpack-bundle-analyzer stats.json

# Vite
npx vite-bundle-visualizer

# Next.js
ANALYZE=true npm run build

# Create React App
npm run build -- --stats
npx webpack-bundle-analyzer build/bundle-stats.json
```

**What to look for:**
- Large dependencies that could be replaced or tree-shaken
- Duplicate packages across chunks
- Unintended inclusions (dev dependencies, polyfills)
- Opportunities for code splitting

### Lighthouse Audit

```bash
# Run Lighthouse CLI
npx lighthouse https://yoursite.com --output html --output-path ./lighthouse-report.html

# With specific categories
npx lighthouse https://yoursite.com --only-categories=performance,accessibility

# Compare before/after
npx lighthouse https://yoursite.com --budget-path=budget.json
```

**Key metrics:**
| Metric | Good | Needs Work | Poor |
|--------|------|------------|------|
| LCP (Largest Contentful Paint) | < 2.5s | 2.5-4s | > 4s |
| FID (First Input Delay) | < 100ms | 100-300ms | > 300ms |
| CLS (Cumulative Layout Shift) | < 0.1 | 0.1-0.25 | > 0.25 |
| TTI (Time to Interactive) | < 3.8s | 3.8-7.3s | > 7.3s |

### React Performance

```tsx
// 1. React DevTools Profiler
// Install React DevTools browser extension
// Open Profiler tab, record interactions

// 2. why-did-you-render
import React from 'react';

if (process.env.NODE_ENV === 'development') {
  const whyDidYouRender = require('@welldone-software/why-did-you-render');
  whyDidYouRender(React, {
    trackAllPureComponents: true,
  });
}

// 3. Add to components you want to track
MyComponent.whyDidYouRender = true;
```

**Common React optimizations:**
```tsx
// Memoize expensive computations
const expensiveValue = useMemo(() => computeExpensive(data), [data]);

// Memoize callbacks
const handleClick = useCallback(() => onClick(id), [id, onClick]);

// Memoize components
const MemoizedComponent = React.memo(ExpensiveComponent);

// Virtualize long lists
import { FixedSizeList } from 'react-window';
```

## Backend Performance

### Node.js Profiling

```bash
# CPU Profiling with 0x (flamegraph)
npx 0x app.js
# Opens flamegraph in browser after stopping

# Clinic.js suite
npx clinic doctor -- node app.js
npx clinic flame -- node app.js
npx clinic bubbleprof -- node app.js

# Built-in profiler
node --prof app.js
node --prof-process isolate-*.log > processed.txt
```

### Memory Leak Detection (Node.js)

```javascript
// 1. Track heap usage
const v8 = require('v8');
const heapStats = v8.getHeapStatistics();
console.log(`Heap used: ${heapStats.used_heap_size / 1024 / 1024} MB`);

// 2. Heap snapshots
const inspector = require('inspector');
const fs = require('fs');

const session = new inspector.Session();
session.connect();

session.post('HeapProfiler.takeHeapSnapshot', null, (err, r) => {
  // Analyze in Chrome DevTools
});

// 3. Memory tracking middleware (Express)
app.use((req, res, next) => {
  const startMem = process.memoryUsage().heapUsed;
  res.on('finish', () => {
    const endMem = process.memoryUsage().heapUsed;
    const diff = (endMem - startMem) / 1024 / 1024;
    if (diff > 10) { // > 10MB
      console.warn(`Memory spike: ${diff.toFixed(2)}MB on ${req.path}`);
    }
  });
  next();
});
```

### Python Profiling

```bash
# CPU profiling with cProfile
python -m cProfile -o output.prof script.py
# Visualize with snakeviz
pip install snakeviz
snakeviz output.prof

# Line-by-line profiling
pip install line_profiler
kernprof -l -v script.py

# Memory profiling
pip install memory_profiler
python -m memory_profiler script.py

# py-spy for production profiling (no code changes)
pip install py-spy
py-spy record -o profile.svg -- python script.py
```

```python
# Memory profiler decorator
from memory_profiler import profile

@profile
def my_function():
    # Your code here
    pass

# Line profiler decorator
@profile  # from line_profiler
def slow_function():
    pass
```

## Database Performance

### Query Profiling

#### PostgreSQL
```sql
-- Enable query logging
ALTER SYSTEM SET log_min_duration_statement = 100;  -- Log queries > 100ms
SELECT pg_reload_conf();

-- Analyze query plan
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT * FROM users WHERE email LIKE '%@example.com';

-- Find slow queries
SELECT query, mean_exec_time, calls
FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 10;

-- Check index usage
SELECT relname, indexrelname, idx_scan, idx_tup_read
FROM pg_stat_user_indexes
ORDER BY idx_scan ASC;
```

#### MySQL
```sql
-- Enable slow query log
SET GLOBAL slow_query_log = 'ON';
SET GLOBAL long_query_time = 0.1;  -- 100ms

-- Analyze query
EXPLAIN ANALYZE
SELECT * FROM users WHERE email LIKE '%@example.com';

-- Show process list
SHOW FULL PROCESSLIST;

-- Check index usage
SHOW INDEX FROM users;
```

#### MongoDB
```javascript
// Enable profiling
db.setProfilingLevel(1, { slowms: 100 });

// Find slow queries
db.system.profile.find().sort({ ts: -1 }).limit(10);

// Explain query
db.users.find({ email: /@example.com$/ }).explain("executionStats");
```

### ORM Query Optimization

```typescript
// Prisma - Avoid N+1
// Bad
const users = await prisma.user.findMany();
for (const user of users) {
  const posts = await prisma.post.findMany({ where: { authorId: user.id } });
}

// Good
const users = await prisma.user.findMany({
  include: { posts: true }
});

// TypeORM - Use query builder for complex queries
const users = await userRepository
  .createQueryBuilder('user')
  .leftJoinAndSelect('user.posts', 'post')
  .where('user.isActive = :active', { active: true })
  .getMany();

// SQLAlchemy - Eager loading
from sqlalchemy.orm import joinedload

users = session.query(User).options(joinedload(User.posts)).all()
```

## Performance Monitoring

### Application Performance Monitoring (APM)

```typescript
// Sentry Performance
import * as Sentry from '@sentry/node';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  tracesSampleRate: 0.1,  // 10% of transactions
  profilesSampleRate: 0.1,
});

// Custom transaction
const transaction = Sentry.startTransaction({ name: 'processOrder' });
Sentry.getCurrentHub().configureScope(scope => scope.setSpan(transaction));

// ... your code ...

transaction.finish();
```

```python
# OpenTelemetry for Python
from opentelemetry import trace
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor
from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter

provider = TracerProvider()
processor = BatchSpanProcessor(OTLPSpanExporter())
provider.add_span_processor(processor)
trace.set_tracer_provider(provider)

tracer = trace.get_tracer(__name__)

with tracer.start_as_current_span("my-operation"):
    # Your code here
    pass
```

### Custom Metrics

```typescript
// prom-client for Prometheus metrics
import { Counter, Histogram, Registry } from 'prom-client';

const register = new Registry();

const httpRequestDuration = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status'],
  buckets: [0.1, 0.5, 1, 2, 5],
});
register.registerMetric(httpRequestDuration);

// Middleware
app.use((req, res, next) => {
  const end = httpRequestDuration.startTimer();
  res.on('finish', () => {
    end({ method: req.method, route: req.route?.path, status: res.statusCode });
  });
  next();
});

// Expose metrics endpoint
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});
```

## Optimization Checklist

### Frontend
- [ ] Enable gzip/brotli compression
- [ ] Implement code splitting and lazy loading
- [ ] Optimize images (WebP, responsive sizes, lazy loading)
- [ ] Use CDN for static assets
- [ ] Minimize main thread work
- [ ] Implement efficient caching strategies
- [ ] Remove unused CSS/JS
- [ ] Preload critical resources

### Backend
- [ ] Implement response caching (Redis, in-memory)
- [ ] Use connection pooling for databases
- [ ] Optimize database queries (indexes, explain plans)
- [ ] Implement pagination for large datasets
- [ ] Use async/await properly (avoid blocking)
- [ ] Profile and optimize hot paths
- [ ] Consider horizontal scaling

### Database
- [ ] Add appropriate indexes
- [ ] Optimize query patterns (avoid N+1)
- [ ] Use query caching
- [ ] Implement read replicas for read-heavy workloads
- [ ] Consider denormalization for read performance
- [ ] Archive old data
- [ ] Monitor and tune connection pools

## Related Commands

- `/lint` - Code quality checks
- `/test` - Run test suites
- `/security-audit` - Security scanning
- `/api-docs` - API documentation
