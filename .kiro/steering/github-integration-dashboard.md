---
title: GitHub Integration Dashboard
inclusion: fileMatch
fileMatchPattern: "**/github*.{ts,tsx,astro,sql}"
---

# GitHub Integration Dashboard - Development Guidelines

## Overview
This steering file provides context and guidelines for working with the GitHub Integration Dashboard feature.

## Architecture

### Data Flow
1. User visits `/github` page
2. React component calls `/api/github-stats`
3. API checks Neon database cache (15 min TTL)
4. If cache miss, fetch from GitHub API
5. Process and aggregate data
6. Store in cache and return to frontend
7. Frontend renders dashboard with auto-refresh

### Key Files
- **Types**: `src/types/github.ts`
- **API Client**: `src/lib/github-client.ts`
- **Cache Layer**: `src/lib/github-cache.ts`
- **Data Processor**: `src/lib/github-processor.ts`
- **API Route**: `src/pages/api/github-stats.ts`
- **Components**: `src/components/github/*.tsx`
- **Page**: `src/pages/github.astro`
- **Migration**: `migrations/008_github_integration.sql`

## Database Schema

### Tables
1. **github_stats_cache** - Caches API responses (15 min TTL)
2. **github_rate_limits** - Tracks GitHub API rate limits
3. **github_stats_history** - Daily snapshots for trends
4. **github_components_timeline** - Component addition tracking

### Cache Keys Format
```
{type}:{owner}/{repo}
```

Examples:
- `stats:anthropics/claude-code-templates`
- `contributors:anthropics/claude-code-templates`

## GitHub API Integration

### Endpoints Used
- `/repos/{owner}/{repo}` - Repository info
- `/repos/{owner}/{repo}/contributors` - Contributors list
- `/repos/{owner}/{repo}/issues` - Issues (includes PRs)
- `/repos/{owner}/{repo}/pulls` - Pull requests
- `/repos/{owner}/{repo}/commits` - Commit history
- `/repos/{owner}/{repo}/releases` - Releases

### Rate Limits
- **Without token**: 60 req/hour per IP
- **With token**: 5,000 req/hour
- **Our usage**: ~4 req/hour (with caching)

### Authentication
Optional `GITHUB_TOKEN` environment variable increases rate limits.

## Component Detection

### Patterns
The system detects component additions by parsing commit messages:

```typescript
/add\s+(agent|new\s+agent)[:\s]+([^\n]+)/i  // Agents
/add\s+(command|new\s+command)[:\s]+([^\n]+)/i  // Commands
/add\s+(hook|new\s+hook)[:\s]+([^\n]+)/i  // Hooks
/add\s+(mcp|new\s+mcp)[:\s]+([^\n]+)/i  // MCPs
/add\s+(skill|new\s+skill)[:\s]+([^\n]+)/i  // Skills
```

### Example Commit Messages
- ✅ "add agent: React Expert"
- ✅ "new command: deploy-vercel"
- ✅ "Add hook: security-audit"
- ❌ "update agent" (not detected)

## Caching Strategy

### TTL (Time To Live)
- Default: 15 minutes
- Configurable via query param: `?ttl=600`

### Cache Invalidation
- Time-based (automatic after TTL)
- Manual refresh button
- Force refresh: `/api/github-stats?refresh=true`

### Fallback Strategy
1. Try cache (Neon DB)
2. If expired, try GitHub API
3. If API fails, return stale cache
4. If no cache, return error

## Error Handling

### API Errors
- **429 Rate Limit**: Return cached data + warning
- **403 Forbidden**: Check token validity
- **404 Not Found**: Repository config error
- **500 Server Error**: Retry with exponential backoff

### Frontend Errors
- **Network Error**: Show retry button
- **Timeout**: Show loading skeleton
- **Invalid Data**: Show error message

## Performance Optimization

### Backend
- Parallel API requests with `Promise.all()`
- Efficient data aggregation
- Database connection pooling
- Response compression

### Frontend
- Code splitting for dashboard page
- Lazy loading for charts
- Memoization of calculations
- Auto-refresh every 15 minutes

## Development Guidelines

### Adding New Metrics
1. Update `GitHubStats` type in `src/types/github.ts`
2. Add processing logic in `src/lib/github-processor.ts`
3. Update API route in `src/pages/api/github-stats.ts`
4. Create/update React component
5. Update cache schema if needed

### Adding New Components
1. Create component in `src/components/github/`
2. Import in `GitHubDashboard.tsx`
3. Add to layout grid
4. Ensure responsive design
5. Add loading/error states

### Testing
```bash
# Test API endpoint
curl http://localhost:4321/api/github-stats

# Test with refresh
curl http://localhost:4321/api/github-stats?refresh=true

# Check cache
psql $DATABASE_URL -c "SELECT * FROM github_stats_cache;"

# Check rate limits
psql $DATABASE_URL -c "SELECT * FROM github_rate_limits ORDER BY checked_at DESC LIMIT 5;"
```

## Environment Variables

### Required
```bash
DATABASE_URL=postgresql://...  # Neon PostgreSQL
```

### Optional
```bash
GITHUB_TOKEN=ghp_...  # Increases rate limit
PUBLIC_GITHUB_REPO_OWNER=anthropics
PUBLIC_GITHUB_REPO_NAME=claude-code-templates
```

## Common Tasks

### Update Cache TTL
Edit `CACHE_TTL_SECONDS` in `src/lib/github-cache.ts`

### Change Repository
Update environment variables:
```bash
PUBLIC_GITHUB_REPO_OWNER=your-org
PUBLIC_GITHUB_REPO_NAME=your-repo
```

### Add New GitHub Endpoint
1. Add method to `GitHubClient` class
2. Update `getAllStats()` to include new endpoint
3. Process data in `GitHubProcessor`
4. Update types and components

### Debug Rate Limiting
```bash
# Check current rate limit
curl -H "Authorization: Bearer $GITHUB_TOKEN" \
  https://api.github.com/rate_limit

# View rate limit history
psql $DATABASE_URL -c "SELECT * FROM github_rate_limits ORDER BY checked_at DESC LIMIT 10;"
```

## Best Practices

### Code Style
- Use TypeScript for type safety
- Follow existing naming conventions
- Add JSDoc comments for complex functions
- Keep components small and focused

### Performance
- Always use caching for GitHub API calls
- Batch requests with `Promise.all()`
- Implement loading states
- Optimize database queries

### Security
- Never expose GitHub token in frontend
- Validate all API responses
- Sanitize data before caching
- Use parameterized SQL queries

### Accessibility
- Use semantic HTML
- Add ARIA labels where needed
- Ensure keyboard navigation
- Maintain color contrast ratios

## Troubleshooting

### "Rate limit exceeded"
- Add GitHub token to increase limits
- Check rate limit status
- Increase cache TTL
- Wait for rate limit reset

### "Database connection failed"
- Verify DATABASE_URL is correct
- Check Neon database is running
- Test connection with psql
- Review server logs

### "Failed to fetch GitHub statistics"
- Check internet connection
- Verify repository exists
- Check GitHub API status
- Review browser console

### Cache not working
- Verify migration ran successfully
- Check tables exist
- Review database logs
- Try manual cache clear

## Documentation

### Full Documentation
- [README](../../../docs/github-integration-dashboard/README.md)
- [System Architecture](../../../docs/github-integration-dashboard/SYSTEM_ARCHITECTURE.md)
- [Database Schema](../../../docs/github-integration-dashboard/DATABASE_SCHEMA.md)
- [API Documentation](../../../docs/github-integration-dashboard/API_DOCUMENTATION.md)
- [Environment Setup](../../../docs/github-integration-dashboard/ENVIRONMENT_SETUP.md)
- [UI Design Guidelines](../../../docs/github-integration-dashboard/UI_DESIGN_GUIDELINES.md)

## Future Enhancements

### Phase 2 Features
- Historical trend charts
- Commit activity heatmap
- Language breakdown pie chart
- Contributor geographic map
- Issue labels word cloud
- PR review time metrics
- Dependency graph visualization

### Advanced Features
- Real-time updates via webhooks
- Comparison with similar repos
- Predictive trend analysis
- Custom metric dashboards
- Export data to CSV/JSON
- Email digest notifications
