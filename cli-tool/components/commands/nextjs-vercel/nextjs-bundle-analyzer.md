---
allowed-tools: Read, Edit, Bash
argument-hint: [--build] [--analyze] [--report]
description: Analyze and optimize Next.js bundle size with detailed recommendations
model: sonnet
---

## Next.js Bundle Analyzer

**Analysis Mode**: $ARGUMENTS

## Current Project Analysis

### Build Configuration
- Next.js config: @next.config.js
- Package.json: @package.json
- TypeScript config: @tsconfig.json (if exists)
- Build output: !`ls -la .next/ 2>/dev/null || echo "No build found"`

### Dependencies Analysis
- Production dependencies: !`npm list --prod --depth=0 2>/dev/null || echo "Run npm install first"`
- Development dependencies: !`npm list --dev --depth=0 2>/dev/null || echo "Run npm install first"`
- Package vulnerabilities: !`npm audit --audit-level=moderate 2>/dev/null || echo "No audit available"`

## Bundle Analysis Setup

### 1. Install Bundle Analyzer
```bash
# Install webpack-bundle-analyzer
npm install --save-dev @next/bundle-analyzer

# Or use built-in Next.js analyzer
npm install --save-dev cross-env
```

### 2. Configure Next.js Bundle Analyzer
```javascript
// next.config.js
const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Your existing config
  experimental: {
    optimizePackageImports: [
      'lucide-react',
      '@heroicons/react',
      'date-fns',
      'lodash',
    ],
  },
  webpack: (config, { buildId, dev, isServer, defaultLoaders, webpack }) => {
    // Bundle analysis optimizations
    if (!dev && !isServer) {
      config.optimization.splitChunks = {
        chunks: 'all',
        cacheGroups: {
          default: false,
          vendors: false,
          // Vendor chunk for common libraries
          vendor: {
            name: 'vendors',
            chunks: 'all',
            test: /node_modules/,
            priority: 20,
          },
          // Common chunk for shared code
          common: {
            name: 'commons',
            minChunks: 2,
            chunks: 'all',
            priority: 10,
            reuseExistingChunk: true,
            enforce: true,
          },
          // UI libraries chunk
          ui: {
            name: 'ui-libs',
            chunks: 'all',
            test: /node_modules\/(react|react-dom|@radix-ui|@headlessui)/,
            priority: 15,
          },
          // Utility libraries chunk
          utils: {
            name: 'utils',
            chunks: 'all',
            test: /node_modules\/(lodash|date-fns|clsx|classnames)/,
            priority: 15,
          },
        },
      };
    }

    return config;
  },
};

module.exports = withBundleAnalyzer(nextConfig);
```

### 3. Package.json Scripts
```json
{
  "scripts": {
    "analyze": "cross-env ANALYZE=true next build",
    "analyze:server": "cross-env BUNDLE_ANALYZE=server next build",
    "analyze:browser": "cross-env BUNDLE_ANALYZE=browser next build",
    "build:analyze": "npm run build && npm run analyze"
  }
}
```

## Bundle Analysis Execution

### 1. Generate Analysis Report
```bash
# Full bundle analysis
ANALYZE=true npm run build

# Server-side bundle analysis
BUNDLE_ANALYZE=server npm run build

# Client-side bundle analysis  
BUNDLE_ANALYZE=browser npm run build

# Production build with analysis
npm run analyze
```

### 2. Bundle Size Check
```bash
# Check current bundle size
ls -lah .next/static/chunks/ | head -20

# Check bundle sizes with details
find .next/static/chunks -name "*.js" -exec ls -lah {} \; | sort -k5 -hr

# Gzipped size analysis
find .next/static/chunks -name "*.js" -exec gzip -c {} \; | wc -c
```

## Bundle Analysis Results

### 1. Bundle Size Breakdown
Analyze the generated webpack-bundle-analyzer report for:

#### Client Bundles
- **Main bundle**: Core application code
- **Framework bundle**: Next.js runtime and React
- **Vendor bundles**: Third-party libraries
- **Page bundles**: Individual page chunks
- **Shared bundles**: Common code between pages

#### Server Bundles
- **API routes**: Server-side API handlers  
- **Middleware**: Edge and server middleware
- **Server components**: RSC bundles

### 2. Size Thresholds and Recommendations
```javascript
// Bundle size thresholds
const bundleThresholds = {
  // First Load JS (critical)
  firstLoadJS: {
    warning: 200 * 1024, // 200KB
    error: 300 * 1024,   // 300KB
  },
  // Individual chunks
  chunk: {
    warning: 150 * 1024, // 150KB
    error: 250 * 1024,   // 250KB
  },
  // Total bundle size
  total: {
    warning: 1024 * 1024, // 1MB
    error: 2048 * 1024,   // 2MB
  }
};
```

## Bundle Optimization Strategies

### 1. Code Splitting Optimization
```typescript
// Dynamic imports for large components
import dynamic from 'next/dynamic';

const HeavyComponent = dynamic(() => import('./HeavyComponent'), {
  loading: () => <p>Loading...</p>,
  ssr: false, // Disable SSR for client-only components
});

// Route-based code splitting
const AdminDashboard = dynamic(() => import('./AdminDashboard'), {
  loading: () => <DashboardSkeleton />,
});

// Conditional loading
const ChartComponent = dynamic(
  () => import('./ChartComponent'),
  { 
    ssr: false,
    loading: () => <ChartSkeleton />
  }
);
```

### 2. Library Optimization
```javascript
// Optimize lodash imports
// ❌ Imports entire lodash library
import _ from 'lodash';

// ✅ Import only needed functions
import { debounce, throttle } from 'lodash';

// ✅ Even better - use tree-shaking friendly alternatives
import debounce from 'lodash/debounce';
import throttle from 'lodash/throttle';
```

```javascript
// Date library optimization
// ❌ Moment.js (large bundle)
import moment from 'moment';

// ✅ date-fns (tree-shakable)
import { format, parseISO } from 'date-fns';

// ✅ Day.js (smaller alternative)
import dayjs from 'dayjs';
```

### 3. Next.js Specific Optimizations
```javascript
// next.config.js optimizations
const nextConfig = {
  // Optimize package imports
  experimental: {
    optimizePackageImports: [
      'react-icons',
      '@heroicons/react',
      'lucide-react',
      'date-fns',
      'lodash',
    ],
  },
  
  // Tree shaking for CSS
  experimental: {
    optimizeCss: true,
  },
  
  // Minimize client-side JavaScript
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production',
  },
  
  // Webpack optimizations
  webpack: (config, { dev, isServer }) => {
    if (!dev && !isServer) {
      // Analyze bundle size
      config.optimization.concatenateModules = true;
      
      // Enable compression
      config.plugins.push(
        new (require('compression-webpack-plugin'))({
          algorithm: 'gzip',
          test: /\.(js|css|html|svg)$/,
          threshold: 8192,
          minRatio: 0.8,
        })
      );
    }
    return config;
  },
};
```

### 4. Image Optimization
```typescript
// Next.js Image component with optimization
import Image from 'next/image';

// Optimize images with proper sizing
<Image
  src="/hero-image.jpg"
  alt="Hero"
  width={1200}
  height={600}
  priority={isAboveFold}
  placeholder="blur"
  blurDataURL="data:image/jpeg;base64,..."
  sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
/>
```

## Performance Impact Analysis

### 1. Core Web Vitals Impact
Analyze bundle size impact on:
- **Largest Contentful Paint (LCP)**: Large bundles delay content rendering
- **First Input Delay (FID)**: JavaScript blocking main thread
- **Cumulative Layout Shift (CLS)**: Dynamic imports causing layout shifts

### 2. Network Performance
```javascript
// Simulate network conditions for testing
const networkConditions = {
  'Fast 3G': { downloadThroughput: 1500, uploadThroughput: 750, latency: 562.5 },
  'Slow 3G': { downloadThroughput: 500, uploadThroughput: 500, latency: 2000 },
  'Offline': { downloadThroughput: 0, uploadThroughput: 0, latency: 0 }
};
```

### 3. Bundle Loading Strategies
```typescript
// Preload critical chunks
useEffect(() => {
  // Preload likely next page
  router.prefetch('/dashboard');
  
  // Preload critical components
  import('./CriticalComponent');
}, []);

// Lazy load non-critical features
const LazyFeature = lazy(() => 
  import('./LazyFeature').then(module => ({
    default: module.LazyFeature
  }))
);
```

## Optimization Recommendations

### 1. Immediate Actions
- **Remove unused dependencies**: Audit and remove packages not in use
- **Optimize imports**: Use tree-shaking friendly import patterns
- **Enable compression**: Configure gzip/brotli compression
- **Minimize polyfills**: Use modern JavaScript features with targeted polyfills

### 2. Medium-term Improvements
- **Code splitting strategy**: Implement route and component-based splitting
- **Library replacements**: Replace large libraries with smaller alternatives
- **Bundle caching**: Implement long-term caching strategies
- **Performance monitoring**: Set up bundle size monitoring in CI/CD

### 3. Long-term Optimization
- **Micro-frontends**: Consider architecture changes for large applications
- **Edge computing**: Move computation closer to users
- **Progressive enhancement**: Implement progressive loading strategies
- **Performance budgets**: Establish and enforce bundle size budgets

## Monitoring and Maintenance

### 1. Automated Bundle Monitoring
```yaml
# GitHub Action for bundle monitoring
name: Bundle Size Check
on: [pull_request]

jobs:
  bundle-analysis:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm ci
      - run: npm run build
      - uses: nextjs-bundle-analysis/bundle-analyzer@v1
        with:
          token: ${{ secrets.GITHUB_TOKEN }}
```

### 2. Performance Budgets
```javascript
// webpack.config.js performance budgets
module.exports = {
  performance: {
    maxAssetSize: 250000, // 250KB
    maxEntrypointSize: 350000, // 350KB
    hints: 'error',
  },
};
```

### 3. Regular Audit Schedule
- **Weekly**: Dependency updates and security audit
- **Monthly**: Full bundle analysis and optimization review  
- **Quarterly**: Architecture review and major optimizations

## Analysis Report Generation

Generate comprehensive report including:
1. **Current Bundle Sizes**: Detailed breakdown by chunk type
2. **Optimization Opportunities**: Specific recommendations with size impact
3. **Performance Metrics**: Core Web Vitals impact analysis
4. **Implementation Roadmap**: Prioritized optimization tasks
5. **Monitoring Setup**: Tools and processes for ongoing monitoring

Provide specific, actionable recommendations for immediate and long-term bundle optimization.