# Performance Review Rules

## Database Optimization

### N+1 Query Problem
**Pattern**: Query inside loop
**Impact**: Exponential database load
**Fix**: Use JOIN or IN clause

```javascript
// ❌ N+1 queries (1 + N)
const users = await db.query('SELECT * FROM users');
for (const user of users) {
  user.posts = await db.query('SELECT * FROM posts WHERE user_id = ?', [user.id]);
}

// ✅ 2 queries
const users = await db.query('SELECT * FROM users');
const posts = await db.query('SELECT * FROM posts WHERE user_id IN (?)', [userIds]);
```

### Missing Indexes
**Check for**: Queries on unindexed columns
**Impact**: Full table scans, slow queries
**Fix**: Add indexes on frequently queried columns

### Inefficient Queries
**Rules**:
- SELECT specific columns (not SELECT *)
- Use LIMIT for pagination
- Avoid OR in WHERE (use UNION)
- Use EXPLAIN to analyze queries

## Algorithm Complexity

### Time Complexity
**Check for**:
- Nested loops (O(n²))
- Inefficient sorting
- Linear search in loops
- Recursive without memoization

**Rules**:
- Prefer O(n log n) over O(n²)
- Use hash maps for lookups (O(1))
- Binary search for sorted data
- Memoize expensive recursion

```javascript
// ❌ O(n²)
function findDuplicates(items) {
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      if (items[i] === items[j]) return true;
    }
  }
}

// ✅ O(n)
function findDuplicates(items) {
  const seen = new Set();
  for (const item of items) {
    if (seen.has(item)) return true;
    seen.add(item);
  }
}
```

### Space Complexity
**Check for**:
- Unnecessary data copying
- Memory leaks
- Large in-memory structures
- Unbounded caching

## Caching Strategies

### When to Cache
- Expensive computations
- Frequent database queries
- External API calls
- Static content

### Cache Levels
1. **Memory** (fastest, limited size)
2. **Redis** (fast, distributed)
3. **CDN** (static assets)
4. **Browser** (client-side)

### Cache Invalidation
**Rules**:
- Set appropriate TTL
- Invalidate on updates
- Use cache keys wisely
- Monitor hit rates

## Network Optimization

### API Calls
**Rules**:
- Batch requests when possible
- Use pagination
- Implement request debouncing
- Add timeouts

### Payload Size
**Rules**:
- Compress responses (gzip)
- Minimize JSON payload
- Use pagination
- Lazy load data

## Frontend Performance

### React Optimization
```javascript
// ❌ Unnecessary re-renders
function Component({ items }) {
  return items.map(item => <Item key={item.id} data={item} />);
}

// ✅ Memoized
const Item = React.memo(({ data }) => <div>{data.name}</div>);
```

### Bundle Size
**Rules**:
- Code splitting
- Tree shaking
- Lazy loading
- Remove unused dependencies

## Async Operations

### Parallel vs Sequential
```javascript
// ❌ Sequential (slow)
const user = await fetchUser();
const posts = await fetchPosts();
const comments = await fetchComments();

// ✅ Parallel (fast)
const [user, posts, comments] = await Promise.all([
  fetchUser(),
  fetchPosts(),
  fetchComments()
]);
```

### Debouncing/Throttling
**Use for**:
- Search input
- Scroll events
- Resize events
- API calls

## Performance Checklist

**Database**:
- [ ] No N+1 queries
- [ ] Indexes on queried columns
- [ ] Connection pooling
- [ ] Query optimization

**Algorithms**:
- [ ] Time complexity ≤ O(n log n)
- [ ] Space complexity reasonable
- [ ] No unnecessary loops
- [ ] Efficient data structures

**Caching**:
- [ ] Expensive operations cached
- [ ] Appropriate TTL set
- [ ] Cache invalidation strategy
- [ ] Hit rate monitored

**Network**:
- [ ] Requests batched
- [ ] Responses compressed
- [ ] Pagination implemented
- [ ] Timeouts configured

**Frontend**:
- [ ] Code splitting
- [ ] Lazy loading
- [ ] Memoization used
- [ ] Bundle size optimized

## Performance Targets

**API Response Time**:
- p50: <100ms
- p95: <500ms
- p99: <1000ms

**Database Queries**:
- Simple: <10ms
- Complex: <100ms
- Avoid: >1000ms

**Bundle Size**:
- Initial: <200KB (gzipped)
- Total: <1MB
- Per route: <100KB

## Profiling Tools

**Backend**:
- Node.js profiler
- Database EXPLAIN
- APM tools (DataDog, New Relic)

**Frontend**:
- Chrome DevTools
- Lighthouse
- Web Vitals
- Bundle analyzer
