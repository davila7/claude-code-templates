---
allowed-tools: Read, Edit, Bash
argument-hint: [--lighthouse] [--bundle] [--runtime] [--all]
description: Comprehensive Next.js performance audit with actionable optimization recommendations
model: sonnet
---

## Next.js Performance Audit

**Audit Type**: $ARGUMENTS

## Current Application Analysis

### Application State
- Build status: !`ls -la .next/ 2>/dev/null || echo "No build found - run 'npm run build' first"`
- Application running: !`curl -s http://localhost:3000 > /dev/null && echo "App is running" || echo "App not running - start with 'npm run dev'"`
- Bundle analysis: !`ls -la .next/analyze/ 2>/dev/null || echo "No bundle analysis found"`

### Project Configuration
- Next.js config: @next.config.js
- Package.json: @package.json
- TypeScript config: @tsconfig.json (if exists)
- Vercel config: @vercel.json (if exists)

### Performance Monitoring Setup
- Web Vitals: Check for @next/web-vitals or similar
- Analytics: Check for Vercel Analytics or Google Analytics
- Monitoring tools: Check for Sentry, DataDog, or other APM tools

## Performance Audit Framework

### 1. Lighthouse Audit
```bash
# Install Lighthouse CLI if not available
npm install -g lighthouse

# Run Lighthouse audit
lighthouse http://localhost:3000 \
  --output=json \
  --output=html \
  --output-path=./performance-audit \
  --chrome-flags="--headless" \
  --preset=perf

# Mobile performance audit
lighthouse http://localhost:3000 \
  --output=json \
  --output-path=./performance-audit-mobile \
  --preset=perf \
  --form-factor=mobile \
  --throttling-method=devtools \
  --chrome-flags="--headless"

# Generate detailed report
lighthouse http://localhost:3000 \
  --output=html \
  --output-path=./lighthouse-report.html \
  --view
```

### 2. Bundle Analysis
```javascript
// next.config.js - Enable bundle analysis
const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
});

module.exports = withBundleAnalyzer({
  // ... your config
  webpack: (config, { buildId, dev, isServer, defaultLoaders, webpack }) => {
    // Bundle analysis optimizations
    if (!dev && !isServer) {
      config.optimization.splitChunks = {
        chunks: 'all',
        cacheGroups: {
          vendor: {
            test: /[\\/]node_modules[\\/]/,
            name: 'vendors',
            chunks: 'all',
          },
        },
      };
    }
    return config;
  },
});
```

### 3. Runtime Performance Analysis
```bash
# Build and analyze bundle
ANALYZE=true npm run build

# Check bundle sizes
ls -lah .next/static/chunks/ | grep -E "\\.js$" | sort -k5 -hr | head -10

# Analyze dependencies
npm ls --depth=0 --prod | grep -v "deduped"

# Check for duplicate dependencies
npm ls --depth=0 | grep -E "UNMET|invalid"
```

## Performance Metrics Collection

### 1. Core Web Vitals Implementation
```typescript
// lib/analytics.ts
export function reportWebVitals({ id, name, label, value }: any) {
  // Send to analytics service
  if (typeof window !== 'undefined') {
    // Client-side reporting
    fetch('/api/analytics/web-vitals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id,
        name,
        label,
        value,
        url: window.location.href,
        timestamp: Date.now(),
      }),
    }).catch(console.error);
  }
}

// Track specific metrics
export function trackMetric(name: string, value: number, labels?: Record<string, string>) {
  reportWebVitals({
    id: `${name}-${Date.now()}`,
    name,
    label: 'custom',
    value,
    ...labels,
  });
}

// Performance observer for custom metrics
export function initPerformanceObserver() {
  if (typeof window === 'undefined') return;
  
  // Largest Contentful Paint
  new PerformanceObserver((entryList) => {
    for (const entry of entryList.getEntries()) {
      trackMetric('LCP', entry.startTime);
    }
  }).observe({ entryTypes: ['largest-contentful-paint'] });
  
  // First Input Delay
  new PerformanceObserver((entryList) => {
    for (const entry of entryList.getEntries()) {
      trackMetric('FID', entry.processingStart - entry.startTime);
    }
  }).observe({ entryTypes: ['first-input'] });
  
  // Cumulative Layout Shift
  new PerformanceObserver((entryList) => {
    let clsValue = 0;
    for (const entry of entryList.getEntries()) {
      if (!entry.hadRecentInput) {
        clsValue += entry.value;
      }
    }
    trackMetric('CLS', clsValue);
  }).observe({ entryTypes: ['layout-shift'] });
}
```

### 2. Server-Side Performance Monitoring
```typescript
// middleware.ts - Performance monitoring
import { NextRequest, NextResponse } from 'next/server';

export function middleware(request: NextRequest) {
  const start = Date.now();
  
  const response = NextResponse.next();
  
  // Add performance headers
  response.headers.set('X-Response-Time', `${Date.now() - start}ms`);
  response.headers.set('X-Timestamp', new Date().toISOString());
  
  return response;
}
```

## Performance Analysis Areas

### 1. Loading Performance
```typescript
// Analyze loading performance
const loadingPerformanceAudit = {
  // First Contentful Paint (FCP)
  fcp: {
    target: '< 1.8s',
    current: '?', // From Lighthouse
    optimizations: [
      'Optimize critical rendering path',
      'Inline critical CSS',
      'Preload key resources',
      'Minimize render-blocking resources',
    ],
  },
  
  // Largest Contentful Paint (LCP)
  lcp: {
    target: '< 2.5s',
    current: '?', // From Lighthouse
    optimizations: [
      'Optimize images (Next.js Image component)',
      'Preload LCP element',
      'Optimize server response time',
      'Use CDN for static assets',
    ],
  },
  
  // Time to Interactive (TTI)
  tti: {
    target: '< 3.8s',
    current: '?', // From Lighthouse
    optimizations: [
      'Reduce JavaScript bundle size',
      'Code splitting',
      'Remove unused code',
      'Optimize third-party scripts',
    ],
  },
  
  // Speed Index
  speedIndex: {
    target: '< 3.4s',
    current: '?', // From Lighthouse
    optimizations: [
      'Optimize above-the-fold content',
      'Progressive image loading',
      'Critical resource prioritization',
    ],
  },
};
```

### 2. Runtime Performance
```typescript
// Runtime performance analysis
const runtimePerformanceAudit = {
  // First Input Delay (FID)
  fid: {
    target: '< 100ms',
    current: '?',
    optimizations: [
      'Reduce JavaScript execution time',
      'Break up long tasks',
      'Use web workers for heavy computation',
      'Optimize event handlers',
    ],
  },
  
  // Cumulative Layout Shift (CLS)
  cls: {
    target: '< 0.1',
    current: '?',
    optimizations: [
      'Set dimensions for media elements',
      'Reserve space for ads/embeds',
      'Avoid dynamic content insertion',
      'Use CSS transforms for animations',
    ],
  },
  
  // Total Blocking Time (TBT)
  tbt: {
    target: '< 200ms',
    current: '?',
    optimizations: [
      'Code splitting',
      'Remove unused polyfills',
      'Optimize third-party code',
      'Use setTimeout for heavy operations',
    ],
  },
};
```

### 3. Bundle Performance
```javascript
// Bundle analysis report
const bundleAnalysis = {
  totalSize: '?', // From webpack-bundle-analyzer
  firstLoadJS: '?', // Critical for performance
  chunks: {
    main: '?',
    framework: '?',
    vendor: '?',
    pages: '?',
  },
  
  recommendations: [
    // Dynamic imports for code splitting
    {
      type: 'Dynamic Import',
      description: 'Use dynamic imports for non-critical components',
      example: `
        const HeavyComponent = dynamic(() => import('./HeavyComponent'), {
          loading: () => <Loading />,
          ssr: false
        });
      `,
    },
    
    // Tree shaking optimization
    {
      type: 'Tree Shaking',
      description: 'Import only needed functions from libraries',
      example: `
        // ❌ Imports entire library
        import * as _ from 'lodash';
        
        // ✅ Import only needed functions
        import { debounce, throttle } from 'lodash';
      `,
    },
    
    // Bundle splitting
    {
      type: 'Bundle Splitting',
      description: 'Optimize webpack chunk splitting',
      example: `
        module.exports = {
          webpack: (config, { isServer }) => {
            if (!isServer) {
              config.optimization.splitChunks.cacheGroups = {
                vendor: {
                  test: /[\\/]node_modules[\\/]/,
                  name: 'vendors',
                  chunks: 'all',
                },
              };
            }
            return config;
          },
        };
      `,
    },
  ],
};
```

## Optimization Recommendations

### 1. Image Optimization
```typescript
// Image optimization analysis
const imageOptimization = {
  // Next.js Image component usage
  nextImageUsage: 'Analyze usage of next/image vs <img>',
  
  recommendations: [
    {
      priority: 'High',
      description: 'Replace <img> tags with Next.js Image component',
      implementation: `
        import Image from 'next/image';
        
        // ❌ Regular img tag
        <img src="/hero.jpg" alt="Hero" />
        
        // ✅ Next.js Image component
        <Image
          src="/hero.jpg"
          alt="Hero"
          width={1200}
          height={600}
          priority={true} // For above-the-fold images
          placeholder="blur"
          blurDataURL="data:image/jpeg;base64,..."
        />
      `,
    },
    {
      priority: 'Medium',
      description: 'Implement responsive images with sizes prop',
      implementation: `
        <Image
          src="/hero.jpg"
          alt="Hero"
          width={1200}
          height={600}
          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
        />
      `,
    },
    {
      priority: 'Low',
      description: 'Configure custom image loader for CDN',
      implementation: `
        // next.config.js
        module.exports = {
          images: {
            loader: 'cloudinary',
            path: 'https://res.cloudinary.com/demo/image/fetch/',
          },
        };
      `,
    },
  ],
};
```

### 2. CSS Optimization
```css
/* Critical CSS analysis */
.critical-css-audit {
  /* Above-the-fold styles that should be inlined */
}

/* Non-critical CSS that can be loaded asynchronously */
.non-critical-css {
  /* Styles for below-the-fold content */
}
```

```typescript
// CSS optimization recommendations
const cssOptimization = {
  recommendations: [
    {
      type: 'Critical CSS',
      description: 'Inline critical CSS for faster initial render',
      implementation: 'Use styled-jsx or CSS-in-JS for critical styles',
    },
    {
      type: 'CSS Modules',
      description: 'Use CSS Modules to avoid global namespace pollution',
      implementation: 'Import styles as modules: import styles from "./Component.module.css"',
    },
    {
      type: 'Tailwind Purging',
      description: 'Ensure unused Tailwind classes are purged',
      implementation: 'Configure purge in tailwind.config.js',
    },
  ],
};
```

### 3. JavaScript Optimization
```typescript
// JavaScript optimization analysis
const jsOptimization = {
  recommendations: [
    {
      priority: 'High',
      type: 'Code Splitting',
      description: 'Implement route-based and component-based code splitting',
      example: `
        // Route-based splitting (automatic with Next.js pages)
        
        // Component-based splitting
        const LazyComponent = dynamic(() => import('./LazyComponent'));
        
        // Conditional loading
        const AdminPanel = dynamic(() => import('./AdminPanel'), {
          ssr: false,
          loading: () => <AdminSkeleton />,
        });
      `,
    },
    {
      priority: 'Medium',
      type: 'Tree Shaking',
      description: 'Ensure unused code is eliminated',
      example: `
        // ❌ Imports entire library
        import moment from 'moment';
        
        // ✅ Use tree-shakable alternative
        import { format } from 'date-fns';
        
        // ✅ Or import specific functions
        import debounce from 'lodash/debounce';
      `,
    },
    {
      priority: 'Medium',
      type: 'Polyfill Optimization',
      description: 'Reduce polyfill size by targeting modern browsers',
      example: `
        // next.config.js
        module.exports = {
          experimental: {
            browsersListForSwc: true,
          },
        };
      `,
    },
  ],
};
```

## Performance Monitoring Setup

### 1. Real User Monitoring (RUM)
```typescript
// pages/_app.tsx
import { reportWebVitals } from '../lib/analytics';

export { reportWebVitals };

export default function MyApp({ Component, pageProps }) {
  return (
    <>
      <Component {...pageProps} />
      {process.env.NODE_ENV === 'production' && (
        <script
          dangerouslySetInnerHTML={{
            __html: `
              // Custom RUM implementation
              window.addEventListener('load', () => {
                // Track page load time
                const loadTime = performance.timing.loadEventEnd - performance.timing.navigationStart;
                fetch('/api/analytics/performance', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    metric: 'page_load_time',
                    value: loadTime,
                    url: window.location.href,
                  }),
                });
              });
            `,
          }}
        />
      )}
    </>
  );
}
```

### 2. Performance Budget
```javascript
// webpack.config.js - Performance budgets
module.exports = {
  performance: {
    maxAssetSize: 250000, // 250KB
    maxEntrypointSize: 400000, // 400KB
    hints: process.env.NODE_ENV === 'production' ? 'error' : 'warning',
  },
};
```

### 3. Continuous Performance Monitoring
```yaml
# .github/workflows/performance.yml
name: Performance Audit
on: 
  pull_request:
    branches: [main]

jobs:
  lighthouse:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Build Next.js
        run: npm run build
      
      - name: Start Next.js
        run: npm start &
        
      - name: Wait for server
        run: npx wait-on http://localhost:3000
      
      - name: Run Lighthouse CI
        run: |
          npm install -g @lhci/cli@0.12.x
          lhci autorun
        env:
          LHCI_GITHUB_APP_TOKEN: ${{ secrets.LHCI_GITHUB_APP_TOKEN }}
```

## Performance Report Generation

### 1. Comprehensive Audit Report
Generate detailed performance report including:

#### Executive Summary
- Overall performance score (0-100)
- Core Web Vitals status
- Key performance issues
- Impact on user experience

#### Detailed Analysis
- Loading performance breakdown
- Runtime performance metrics  
- Bundle analysis and recommendations
- Image optimization opportunities
- CSS and JavaScript optimization

#### Action Plan
- High priority fixes (immediate impact)
- Medium priority improvements (moderate impact)
- Long-term optimization strategy
- Performance monitoring setup

#### Implementation Roadmap
1. **Week 1**: Critical performance fixes
2. **Week 2-3**: Image and asset optimization  
3. **Week 4**: Bundle optimization and code splitting
4. **Ongoing**: Performance monitoring and regression prevention

### 2. Performance Tracking Dashboard
```typescript
// Create performance dashboard component
const PerformanceDashboard = () => {
  return (
    <div className="performance-dashboard">
      <h2>Performance Metrics</h2>
      
      {/* Core Web Vitals */}
      <section>
        <h3>Core Web Vitals</h3>
        <div className="metrics-grid">
          <MetricCard title="LCP" value="2.1s" target="< 2.5s" status="good" />
          <MetricCard title="FID" value="89ms" target="< 100ms" status="good" />
          <MetricCard title="CLS" value="0.08" target="< 0.1" status="good" />
        </div>
      </section>
      
      {/* Bundle Analysis */}
      <section>
        <h3>Bundle Analysis</h3>
        <BundleChart data={bundleData} />
      </section>
      
      {/* Performance Trends */}
      <section>
        <h3>Performance Trends</h3>
        <TrendChart metrics={performanceHistory} />
      </section>
    </div>
  );
};
```

Provide comprehensive performance audit with specific, measurable recommendations and implementation guidance for immediate and long-term optimization.