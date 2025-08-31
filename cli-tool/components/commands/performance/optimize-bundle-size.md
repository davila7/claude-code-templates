---
allowed-tools: Read, Bash, Grep, Glob
argument-hint: [build-tool] | --webpack | --vite | --rollup
description: Reduce and optimize bundle sizes through analysis, configuration, and code splitting strategies
model: sonnet
---

# Optimize Bundle Size

Reduce and optimize bundle sizes: **$ARGUMENTS**

## Instructions

1. **Bundle Analysis and Assessment**
   - Analyze current bundle size and composition using webpack-bundle-analyzer or similar tools
   - Identify large dependencies and unused code across all bundles
   - Assess current build configuration and optimization settings
   - Create baseline measurements for optimization tracking
   - Document current performance metrics and loading times

2. **Build Tool Configuration**
   - Configure build tool optimization settings for production builds
   - Enable code splitting and chunk optimization features
   - Configure tree shaking and dead code elimination
   - Set up bundle analyzers and visualization tools
   - Optimize build performance and output sizes

3. **Code Splitting and Lazy Loading**
   - Implement route-based code splitting for single-page applications
   - Set up dynamic imports for components and modules
   - Configure lazy loading for non-critical resources
   - Optimize chunk sizes and loading strategies
   - Implement progressive loading patterns

4. **Tree Shaking and Dead Code Elimination**
   - Configure build tools for optimal tree shaking
   - Mark packages as side-effect free where appropriate
   - Optimize import statements for better tree shaking
   - Use ES6 modules and avoid CommonJS where possible
   - Implement babel plugins for automatic import optimization

5. **Dependency Optimization**
   - Analyze and audit package dependencies for size impact
   - Replace large libraries with smaller alternatives
   - Use specific imports instead of importing entire libraries
   - Implement dependency deduplication strategies
   - Configure external dependencies and CDN usage

6. **Asset Optimization**
   - Optimize images through compression and format conversion
   - Implement responsive image loading strategies
   - Configure asset minification and compression
   - Set up efficient file loaders and processors
   - Optimize font loading and subsetting

7. **Module Federation and Micro-frontends**
   - Implement module federation for large applications
   - Configure shared dependencies and runtime optimization
   - Set up micro-frontend architecture for code sharing
   - Optimize remote module loading and caching
   - Implement federation performance monitoring

8. **Performance Monitoring and Measurement**
   - Set up bundle size monitoring and tracking
   - Configure automated bundle analysis in CI/CD
   - Monitor bundle size changes over time
   - Set up performance budgets and alerts
   - Track loading performance metrics

9. **Progressive Loading Strategies**
   - Implement resource hints (preload, prefetch, dns-prefetch)
   - Configure service workers for caching strategies
   - Set up intersection observer for lazy loading
   - Optimize critical resource loading priorities
   - Implement adaptive loading based on connection speed

10. **Validation and Continuous Monitoring**
    - Set up automated bundle size validation in CI/CD
    - Configure bundle size thresholds and alerts
    - Implement bundle size regression testing
    - Monitor real-world loading performance
    - Set up automated optimization recommendations

Focus on optimizations that provide the most significant bundle size reductions while maintaining application functionality. Always measure the impact of changes on both bundle size and runtime performance.