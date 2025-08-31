# Optimize Build Command

Optimize build processes and speed

## Instructions

Follow this systematic approach to optimize build performance: **$ARGUMENTS**

1. **Build System Analysis**
   - Identify the build system in use (Webpack, Vite, Rollup, Gradle, Maven, Cargo, etc.)
   - Review build configuration files and settings
   - Analyze current build times and output sizes
   - Map the complete build pipeline and dependencies

2. **Performance Baseline**
   - Measure current build times for different scenarios:
     - Clean build (from scratch)
     - Incremental build (with cache)
     - Development vs production builds
   - Document bundle sizes and asset sizes
   - Identify the slowest parts of the build process

3. **Dependency Optimization**
   - Analyze build dependencies and their impact
   - Remove unused dependencies from build process
   - Update build tools to latest stable versions
   - Consider alternative, faster build tools

4. **Caching Strategy**
   - Enable and optimize build caching
   - Configure persistent cache for CI/CD
   - Set up shared cache for team development
   - Implement incremental compilation where possible

5. **Bundle Analysis**
   - Analyze bundle composition and sizes
   - Identify large dependencies and duplicates
   - Use bundle analyzers specific to your build tool
   - Look for opportunities to split bundles

6. **Code Splitting and Lazy Loading**
   - Implement dynamic imports and code splitting
   - Set up route-based splitting for SPAs
   - Configure vendor chunk separation
   - Optimize chunk sizes and loading strategies

7. **Asset Optimization**
   - Optimize images (compression, format conversion, lazy loading)
   - Minify CSS and JavaScript
   - Configure tree shaking to remove dead code
   - Implement asset compression (gzip, brotli)

8. **Development Build Optimization**
   - Enable fast refresh/hot reloading
   - Use development-specific optimizations
   - Configure source maps for better debugging
   - Optimize development server settings

9. **Production Build Optimization**
   - Enable all production optimizations
   - Configure dead code elimination
   - Set up proper minification and compression
   - Optimize for smaller bundle sizes

10. **Parallel Processing**
    - Enable parallel processing where supported
    - Configure worker threads for build tasks
    - Optimize for multi-core systems
    - Use parallel compilation for TypeScript/Babel

11. **File System Optimization**
    - Optimize file watching and polling
    - Configure proper include/exclude patterns
    - Use efficient file loaders and processors
    - Minimize file I/O operations

12. **CI/CD Build Optimization**
    - Optimize CI build environments and resources
    - Implement proper caching strategies for CI
    - Use build matrices efficiently
    - Configure parallel CI jobs where beneficial

13. **Memory Usage Optimization**
    - Monitor and optimize memory usage during builds
    - Configure heap sizes for build tools
    - Identify and fix memory leaks in build process
    - Use memory-efficient compilation options

14. **Output Optimization**
    - Configure compression and encoding
    - Optimize file naming and hashing strategies
    - Set up proper asset manifests
    - Implement efficient asset serving

15. **Monitoring and Profiling**
    - Set up build time monitoring
    - Use build profiling tools to identify bottlenecks
    - Track bundle size changes over time
    - Monitor build performance regressions

16. **Tool-Specific Optimizations**
    
    **For Webpack:**
    - Configure optimization.splitChunks
    - Use thread-loader for parallel processing
    - Enable optimization.usedExports for tree shaking
    - Configure resolve.modules and resolve.extensions

    **For Vite:**
    - Configure build.rollupOptions
    - Use esbuild for faster transpilation
    - Optimize dependency pre-bundling
    - Configure build.chunkSizeWarningLimit

    **For TypeScript:**
    - Use incremental compilation
    - Configure project references
    - Optimize tsconfig.json settings
    - Use skipLibCheck when appropriate

17. **Environment-Specific Configuration**
    - Separate development and production configurations
    - Use environment variables for build optimization
    - Configure feature flags for conditional builds
    - Optimize for target environments

18. **Testing Build Optimizations**
    - Test build outputs for correctness
    - Verify all optimizations work in target environments
    - Check for any breaking changes from optimizations
    - Measure and document performance improvements

19. **Documentation and Maintenance**
    - Document all optimization changes and their impact
    - Create build performance monitoring dashboard
    - Set up alerts for build performance regressions
    - Regular review and updates of build configuration

Focus on the optimizations that provide the biggest impact for your specific project and team workflow. Always measure before and after to quantify improvements.