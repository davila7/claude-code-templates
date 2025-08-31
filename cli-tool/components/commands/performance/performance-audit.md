---
allowed-tools: Read, Bash, Grep, Glob
argument-hint: [target-area] | --frontend | --backend | --full
description: Comprehensive performance audit with metrics, bottleneck identification, and optimization recommendations
model: sonnet
---

# Performance Audit

Conduct comprehensive performance audit: $ARGUMENTS

## Current Performance Context

- Bundle analysis: !`npm run build -- --analyze 2>/dev/null || echo "No build analyzer"`
- Dependencies: !`npm list --depth=0 --prod 2>/dev/null | head -10`
- Build time: !`time npm run build >/dev/null 2>&1 || echo "No build script"`
- Performance config: @webpack.config.js or @vite.config.js or @next.config.js (if exists)

## Task

Conduct comprehensive performance audit following these steps:

1. **Technology Stack Analysis**
   - Identify the primary language, framework, and runtime environment
   - Review build tools and optimization configurations
   - Check for performance monitoring tools already in place

2. **Code Performance Analysis**
   - Identify inefficient algorithms and data structures
   - Look for nested loops and O(n²) operations
   - Check for unnecessary computations and redundant operations
   - Review memory allocation patterns and potential leaks

3. **Database Performance**
   - Analyze database queries for efficiency
   - Check for missing indexes and slow queries
   - Review connection pooling and database configuration
   - Identify N+1 query problems and excessive database calls

4. **Frontend Performance (if applicable)**
   - Analyze bundle size and chunk optimization
   - Check for unused code and dependencies
   - Review image optimization and lazy loading
   - Examine render performance and re-render cycles
   - Check for memory leaks in UI components

5. **Network Performance**
   - Review API call patterns and caching strategies
   - Check for unnecessary network requests
   - Analyze payload sizes and compression
   - Examine CDN usage and static asset optimization

6. **Asynchronous Operations**
   - Review async/await usage and promise handling
   - Check for blocking operations and race conditions
   - Analyze task queuing and background processing
   - Identify opportunities for parallel execution

7. **Memory Usage**
   - Check for memory leaks and excessive memory consumption
   - Review garbage collection patterns
   - Analyze object lifecycle and cleanup
   - Identify large objects and unnecessary data retention

8. **Build & Deployment Performance**
   - Analyze build times and optimization opportunities
   - Review dependency bundling and tree shaking
   - Check for development vs production optimizations
   - Examine deployment pipeline efficiency

9. **Performance Monitoring**
   - Check existing performance metrics and monitoring
   - Identify key performance indicators (KPIs) to track
   - Review alerting and performance thresholds
   - Suggest performance testing strategies

10. **Benchmarking & Profiling**
    - Run performance profiling tools appropriate for the stack
    - Create benchmarks for critical code paths
    - Measure before and after optimization impact
    - Document performance baselines

11. **Optimization Recommendations**
    - Prioritize optimizations by impact and effort
    - Provide specific code examples and alternatives
    - Suggest architectural improvements for scalability
    - Recommend appropriate performance tools and libraries

Include specific file paths, line numbers, and measurable metrics where possible. Focus on high-impact, low-effort optimizations first.