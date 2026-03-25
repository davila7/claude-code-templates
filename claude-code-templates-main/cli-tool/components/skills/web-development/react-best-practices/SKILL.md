---
name: react-best-practices
description: Comprehensive React and Next.js performance optimization guide with 40+ rules for eliminating waterfalls, optimizing bundles, and improving rendering. Use when optimizing React apps, reviewing performance, or refactoring components.
version: 1.0.0
author: Vercel Engineering
license: MIT
tags: [React, Next.js, Performance, Optimization, Best Practices, Bundle Size, Rendering, Server Components]
dependencies: []
---

# React Best Practices - Performance Optimization

Comprehensive performance optimization guide for React and Next.js applications with 40+ rules organized by impact level. Designed to help developers eliminate performance bottlenecks and follow best practices.

## When to use this skill

**Use React Best Practices when:**
- Optimizing React or Next.js application performance
- Reviewing code for performance improvements
- Refactoring existing components for better performance
- Implementing new features with performance in mind
- Debugging slow rendering or loading issues
- Reducing bundle size
- Eliminating request waterfalls

**Key areas covered:**
- **Eliminating Waterfalls** (CRITICAL): Prevent sequential async operations
- **Bundle Size Optimization** (CRITICAL): Reduce initial JavaScript payload
- **Server-Side Performance** (HIGH): Optimize RSC and data fetching
- **Client-Side Data Fetching** (MEDIUM-HIGH): Implement efficient caching
- **Re-render Optimization** (MEDIUM): Minimize unnecessary re-renders
- **Rendering Performance** (MEDIUM): Optimize browser rendering
- **JavaScript Performance** (LOW-MEDIUM): Micro-optimizations for hot paths
- **Advanced Patterns** (LOW): Specialized techniques for edge cases

## Quick reference

### Critical priorities

1. **Defer await until needed** - Move awaits into branches where they're used
2. **Use Promise.all()** - Parallelize independent async operations
3. **Avoid barrel imports** - Import directly from source files
4. **Dynamic imports** - Lazy-load heavy components
5. **Strategic Suspense** - Stream content while showing layout

### Common patterns

**Parallel data fetching:**
```typescript
const [user, posts, comments] = await Promise.all([
  fetchUser(),
  fetchPosts(),
  fetchComments()
])
```

**Direct imports:**
```tsx
// ❌ Loads entire library
import { Check } from 'lucide-react'

// ✅ Loads only what you need
import Check from 'lucide-react/dist/esm/icons/check'
```

**Dynamic components:**
```tsx
import dynamic from 'next/dynamic'

const MonacoEditor = dynamic(
  () => import('./monaco-editor'),
  { ssr: false }
)
```

## Using the guidelines

The complete performance guidelines are available in the references folder:

- **react-performance-guidelines.md**: Complete guide with all 40+ rules, code examples, and impact analysis

Each rule includes:
- Incorrect/correct code comparisons
- Specific impact metrics
- When to apply the optimization
- Real-world examples

## Categories overview

### 1. Eliminating Waterfalls (CRITICAL)
Waterfalls are the #1 performance killer. Each sequential await adds full network latency.
- Defer await until needed
- Dependency-based parallelization
- Prevent waterfall chains in API routes
- Promise.all() for independent operations
- Strategic Suspense boundaries

### 2. Bundle Size Optimization (CRITICAL)
Reducing initial bundle size improves Time to Interactive and Largest Contentful Paint.
- Avoid barrel file imports
- Conditional module loading
- Defer non-critical third-party libraries
- Dynamic imports for heavy components
- Preload based on user intent

### 3. Server-Side Performance (HIGH)
Optimize server-side rendering and data fetching.
- Cross-request LRU caching
- Minimize serialization at RSC boundaries
- Parallel data fetching with component composition
- Per-request deduplication with React.cache()

### 4. Client-Side Data Fetching (MEDIUM-HIGH)
Automatic deduplication and efficient data fetching patterns.
- Deduplicate global event listeners
- Use SWR for automatic deduplication

### 5. Re-render Optimization (MEDIUM)
Reduce unnecessary re-renders to minimize wasted computation.
- Defer state reads to usage point
- Extract to memoized components
- Narrow effect dependencies
- Subscribe to derived state
- Use lazy state initialization
- Use transitions for non-urgent updates

### 6. Rendering Performance (MEDIUM)
Optimize the browser rendering process.
- Animate SVG wrapper instead of SVG element
- CSS content-visibility for long lists
- Hoist static JSX elements
- Optimize SVG precision
- Prevent hydration mismatch without flickering
- Use Activity component for show/hide
- Use explicit conditional rendering

### 7. JavaScript Performance (LOW-MEDIUM)
Micro-optimizations for hot paths.
- Batch DOM CSS changes
- Build index maps for repeated lookups
- Cache property access in loops
- Cache repeated function calls
- Cache storage API calls
- Combine multiple array iterations
- Early length check for array comparisons
- Early return from functions
- Hoist RegExp creation
- Use loop for min/max instead of sort
- Use Set/Map for O(1) lookups
- Use toSorted() instead of sort()

### 8. Advanced Patterns (LOW)
Specialized techniques for edge cases.
- Store event handlers in refs
- useLatest for stable callback refs

## Implementation approach

When optimizing a React application:

1. **Profile first**: Use React DevTools Profiler and browser performance tools to identify bottlenecks
2. **Focus on critical paths**: Start with eliminating waterfalls and reducing bundle size
3. **Measure impact**: Verify improvements with metrics (LCP, TTI, FID)
4. **Apply incrementally**: Don't over-optimize prematurely
5. **Test thoroughly**: Ensure optimizations don't break functionality

## Key metrics to track

- **Time to Interactive (TTI)**: When page becomes fully interactive
- **Largest Contentful Paint (LCP)**: When main content is visible
- **First Input Delay (FID)**: Responsiveness to user interactions
- **Cumulative Layout Shift (CLS)**: Visual stability
- **Bundle size**: Initial JavaScript payload
- **Server response time**: TTFB for server-rendered content

## Common pitfalls to avoid

❌ **Don't:**
- Use barrel imports from large libraries
- Block parallel operations with sequential awaits
- Re-render entire trees when only part needs updating
- Load analytics/tracking in the critical path
- Mutate arrays with .sort() instead of .toSorted()
- Create RegExp or heavy objects inside render

✅ **Do:**
- Import directly from source files
- Use Promise.all() for independent operations
- Memoize expensive components
- Lazy-load non-critical code
- Use immutable array methods
- Hoist static objects outside components

## Resources

- [React Documentation](https://react.dev)
- [Next.js Documentation](https://nextjs.org)
- [SWR Documentation](https://swr.vercel.app)
- [Vercel Bundle Optimization](https://vercel.com/blog/how-we-optimized-package-imports-in-next-js)
- [Vercel Dashboard Performance](https://vercel.com/blog/how-we-made-the-vercel-dashboard-twice-as-fast)
- [better-all Library](https://github.com/shuding/better-all)
- [node-lru-cache](https://github.com/isaacs/node-lru-cache)

## Version history

**v0.1.0** (January 2026)
- Initial release from Vercel Engineering
- 40+ performance rules across 8 categories
- Comprehensive code examples and impact analysis
