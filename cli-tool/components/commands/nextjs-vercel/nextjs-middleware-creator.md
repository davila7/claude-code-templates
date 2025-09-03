---
allowed-tools: Read, Write, Edit
argument-hint: [middleware-type] [--auth] [--rate-limit] [--redirect] [--rewrite]
description: Create optimized Next.js middleware with authentication, rate limiting, and routing logic
model: sonnet
---

## Next.js Middleware Creator

**Middleware Type**: $ARGUMENTS

## Current Project Analysis

### Project Structure
- Next.js config: @next.config.js
- Existing middleware: @middleware.ts or @middleware.js (if exists)
- App directory: @app/ (if App Router)
- Auth configuration: @auth.config.ts or @lib/auth/ (if exists)

### Framework Detection
- Package.json: @package.json
- TypeScript config: @tsconfig.json (if exists)
- Authentication libraries: Detect NextAuth.js, Auth0, or custom auth

## Middleware Implementation Strategy

### 1. Middleware File Structure
Create comprehensive middleware at project root:
```
middleware.ts                 # Main middleware file
lib/middleware/              # Middleware utilities
├── auth.ts                  # Authentication middleware
├── rateLimit.ts            # Rate limiting logic
├── redirects.ts            # Redirect rules
├── rewrites.ts             # URL rewriting
├── cors.ts                 # CORS handling
├── security.ts             # Security headers
└── types.ts               # TypeScript types
```

### 2. Base Middleware Template
```typescript
// middleware.ts
import { NextRequest, NextResponse } from 'next/server';
import { authMiddleware } from './lib/middleware/auth';
import { rateLimitMiddleware } from './lib/middleware/rateLimit';
import { securityMiddleware } from './lib/middleware/security';
import { redirectMiddleware } from './lib/middleware/redirects';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // Apply security headers first
  let response = await securityMiddleware(request);
  
  // Apply rate limiting
  const rateLimitResult = await rateLimitMiddleware(request);
  if (rateLimitResult) return rateLimitResult;
  
  // Handle authentication for protected routes
  if (isProtectedRoute(pathname)) {
    const authResult = await authMiddleware(request);
    if (authResult) return authResult;
  }
  
  // Handle redirects
  const redirectResult = await redirectMiddleware(request);
  if (redirectResult) return redirectResult;
  
  // Apply additional headers to response
  if (response) {
    return response;
  }
  
  return NextResponse.next();
}

function isProtectedRoute(pathname: string): boolean {
  const protectedPaths = ['/dashboard', '/admin', '/api/protected'];
  return protectedPaths.some(path => pathname.startsWith(path));
}

export const config = {
  matcher: [
    // Match all request paths except static files and images
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
```

## Middleware Components

### 1. Authentication Middleware
```typescript
// lib/middleware/auth.ts
import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'your-secret-key'
);

export async function authMiddleware(request: NextRequest) {
  try {
    // Get token from cookies or Authorization header
    const token = request.cookies.get('auth-token')?.value ||
      request.headers.get('authorization')?.replace('Bearer ', '');

    if (!token) {
      return redirectToLogin(request);
    }

    // Verify JWT token
    const { payload } = await jwtVerify(token, JWT_SECRET);
    
    // Add user info to headers for downstream use
    const response = NextResponse.next();
    response.headers.set('x-user-id', payload.sub as string);
    response.headers.set('x-user-role', payload.role as string);
    
    return response;
    
  } catch (error) {
    console.error('Auth middleware error:', error);
    return redirectToLogin(request);
  }
}

function redirectToLogin(request: NextRequest) {
  const loginUrl = new URL('/login', request.url);
  loginUrl.searchParams.set('callbackUrl', request.url);
  return NextResponse.redirect(loginUrl);
}

// Role-based access control
export function requireRole(allowedRoles: string[]) {
  return async function roleMiddleware(request: NextRequest) {
    const userRole = request.headers.get('x-user-role');
    
    if (!userRole || !allowedRoles.includes(userRole)) {
      return new NextResponse('Forbidden', { status: 403 });
    }
    
    return NextResponse.next();
  };
}
```

### 2. Rate Limiting Middleware
```typescript
// lib/middleware/rateLimit.ts
import { NextRequest, NextResponse } from 'next/server';

// Simple in-memory store (use Redis in production)
const requestCounts = new Map<string, { count: number; resetTime: number }>();

interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Max requests per window
  keyGenerator?: (request: NextRequest) => string;
}

const defaultConfig: RateLimitConfig = {
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 100, // 100 requests per 15 minutes
};

export async function rateLimitMiddleware(
  request: NextRequest,
  config: RateLimitConfig = defaultConfig
) {
  const key = config.keyGenerator 
    ? config.keyGenerator(request)
    : getClientIP(request);
  
  const now = Date.now();
  const clientData = requestCounts.get(key);
  
  // Reset window if expired
  if (!clientData || now > clientData.resetTime) {
    requestCounts.set(key, {
      count: 1,
      resetTime: now + config.windowMs
    });
    return null; // Allow request
  }
  
  // Increment counter
  clientData.count++;
  
  // Check if limit exceeded
  if (clientData.count > config.maxRequests) {
    const resetTime = Math.ceil((clientData.resetTime - now) / 1000);
    
    return new NextResponse('Rate limit exceeded', {
      status: 429,
      headers: {
        'X-RateLimit-Limit': config.maxRequests.toString(),
        'X-RateLimit-Remaining': '0',
        'X-RateLimit-Reset': resetTime.toString(),
        'Retry-After': resetTime.toString(),
      },
    });
  }
  
  return null; // Allow request
}

function getClientIP(request: NextRequest): string {
  return request.headers.get('x-forwarded-for') ||
    request.headers.get('x-real-ip') ||
    request.ip ||
    'unknown';
}

// API-specific rate limiting
export const apiRateLimit = (request: NextRequest) =>
  rateLimitMiddleware(request, {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 60, // 60 requests per minute
    keyGenerator: (req) => `api:${getClientIP(req)}`,
  });
```

### 3. Security Headers Middleware
```typescript
// lib/middleware/security.ts
import { NextRequest, NextResponse } from 'next/server';

export async function securityMiddleware(request: NextRequest) {
  const response = NextResponse.next();
  
  // Security headers
  const securityHeaders = {
    // XSS Protection
    'X-XSS-Protection': '1; mode=block',
    
    // Content Type Options
    'X-Content-Type-Options': 'nosniff',
    
    // Frame Options
    'X-Frame-Options': 'DENY',
    
    // HSTS
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
    
    // Referrer Policy
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    
    // Permissions Policy
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
    
    // Content Security Policy
    'Content-Security-Policy': generateCSP(),
  };
  
  // Apply security headers
  Object.entries(securityHeaders).forEach(([key, value]) => {
    response.headers.set(key, value);
  });
  
  return response;
}

function generateCSP(): string {
  const csp = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-eval' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https:",
    "font-src 'self' data:",
    "connect-src 'self'",
    "frame-ancestors 'none'",
  ];
  
  return csp.join('; ');
}
```

### 4. CORS Middleware
```typescript
// lib/middleware/cors.ts
import { NextRequest, NextResponse } from 'next/server';

interface CorsOptions {
  origin: string | string[] | boolean;
  methods: string[];
  allowedHeaders: string[];
  credentials: boolean;
}

const defaultCorsOptions: CorsOptions = {
  origin: true, // Allow all origins in development
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  credentials: true,
};

export function corsMiddleware(options: Partial<CorsOptions> = {}) {
  const config = { ...defaultCorsOptions, ...options };
  
  return function cors(request: NextRequest) {
    const response = NextResponse.next();
    const origin = request.headers.get('origin');
    
    // Handle preflight requests
    if (request.method === 'OPTIONS') {
      return handlePreflight(request, config);
    }
    
    // Set CORS headers
    if (shouldAllowOrigin(origin, config.origin)) {
      response.headers.set('Access-Control-Allow-Origin', origin || '*');
    }
    
    if (config.credentials) {
      response.headers.set('Access-Control-Allow-Credentials', 'true');
    }
    
    response.headers.set(
      'Access-Control-Allow-Methods',
      config.methods.join(', ')
    );
    
    response.headers.set(
      'Access-Control-Allow-Headers',
      config.allowedHeaders.join(', ')
    );
    
    return response;
  };
}

function handlePreflight(request: NextRequest, config: CorsOptions) {
  const headers = new Headers();
  const origin = request.headers.get('origin');
  
  if (shouldAllowOrigin(origin, config.origin)) {
    headers.set('Access-Control-Allow-Origin', origin || '*');
  }
  
  if (config.credentials) {
    headers.set('Access-Control-Allow-Credentials', 'true');
  }
  
  headers.set('Access-Control-Allow-Methods', config.methods.join(', '));
  headers.set('Access-Control-Allow-Headers', config.allowedHeaders.join(', '));
  headers.set('Access-Control-Max-Age', '86400'); // 24 hours
  
  return new NextResponse(null, { status: 200, headers });
}

function shouldAllowOrigin(
  origin: string | null,
  allowedOrigin: string | string[] | boolean
): boolean {
  if (allowedOrigin === true) return true;
  if (allowedOrigin === false) return false;
  if (typeof allowedOrigin === 'string') return origin === allowedOrigin;
  if (Array.isArray(allowedOrigin)) return allowedOrigin.includes(origin || '');
  return false;
}
```

### 5. Redirect and Rewrite Middleware
```typescript
// lib/middleware/redirects.ts
import { NextRequest, NextResponse } from 'next/server';

interface RedirectRule {
  source: string | RegExp;
  destination: string;
  permanent?: boolean;
  conditions?: (request: NextRequest) => boolean;
}

const redirectRules: RedirectRule[] = [
  // Legacy URL redirects
  {
    source: '/old-page',
    destination: '/new-page',
    permanent: true,
  },
  
  // Dynamic redirects
  {
    source: /^\/user\/(.+)$/,
    destination: '/profile/$1',
    permanent: false,
  },
  
  // Conditional redirects
  {
    source: '/admin',
    destination: '/admin/dashboard',
    conditions: (request) => {
      const userRole = request.headers.get('x-user-role');
      return userRole === 'admin';
    },
  },
  
  // Maintenance mode
  {
    source: /.*/,
    destination: '/maintenance',
    conditions: (request) => {
      return process.env.MAINTENANCE_MODE === 'true' &&
        !request.nextUrl.pathname.startsWith('/maintenance');
    },
  },
];

export async function redirectMiddleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  for (const rule of redirectRules) {
    if (shouldApplyRule(rule, pathname, request)) {
      const destination = resolveDestination(rule.destination, pathname);
      const url = new URL(destination, request.url);
      
      return NextResponse.redirect(url, {
        status: rule.permanent ? 301 : 302,
      });
    }
  }
  
  return null; // No redirect needed
}

function shouldApplyRule(
  rule: RedirectRule,
  pathname: string,
  request: NextRequest
): boolean {
  // Check pattern match
  const matches = typeof rule.source === 'string'
    ? pathname === rule.source
    : rule.source.test(pathname);
  
  if (!matches) return false;
  
  // Check additional conditions
  if (rule.conditions) {
    return rule.conditions(request);
  }
  
  return true;
}

function resolveDestination(destination: string, pathname: string): string {
  // Handle dynamic replacements
  return destination.replace(/\$(\d+)/g, (match, num) => {
    // Extract from regex matches
    return pathname; // Simplified - would need actual regex matching
  });
}
```

### 6. A/B Testing Middleware
```typescript
// lib/middleware/abTest.ts
import { NextRequest, NextResponse } from 'next/server';

interface ABTest {
  name: string;
  variants: string[];
  traffic: number; // Percentage of traffic to include (0-100)
  condition?: (request: NextRequest) => boolean;
}

const activeTests: ABTest[] = [
  {
    name: 'homepage-design',
    variants: ['control', 'variant-a', 'variant-b'],
    traffic: 50,
  },
  {
    name: 'checkout-flow',
    variants: ['old-checkout', 'new-checkout'],
    traffic: 100,
    condition: (req) => req.nextUrl.pathname.startsWith('/checkout'),
  },
];

export function abTestMiddleware(request: NextRequest) {
  const response = NextResponse.next();
  
  for (const test of activeTests) {
    // Check if user should be included in test
    if (test.condition && !test.condition(request)) continue;
    
    // Check traffic allocation
    const userId = getUserId(request);
    const hash = hashString(userId + test.name);
    const bucket = hash % 100;
    
    if (bucket >= test.traffic) continue;
    
    // Assign variant
    const variantIndex = hash % test.variants.length;
    const variant = test.variants[variantIndex];
    
    // Set cookie for consistent experience
    response.cookies.set(`ab_${test.name}`, variant, {
      maxAge: 30 * 24 * 60 * 60, // 30 days
      httpOnly: false, // Allow client-side access
    });
    
    // Set header for server-side use
    response.headers.set(`x-ab-${test.name}`, variant);
  }
  
  return response;
}

function getUserId(request: NextRequest): string {
  // Get user ID from cookie, or generate anonymous ID
  return request.cookies.get('user-id')?.value ||
    request.headers.get('x-forwarded-for') ||
    'anonymous';
}

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash);
}
```

## Advanced Middleware Patterns

### 1. Middleware Composition
```typescript
// lib/middleware/compose.ts
import { NextRequest, NextResponse } from 'next/server';

type MiddlewareFunction = (
  request: NextRequest,
  response?: NextResponse
) => NextResponse | Promise<NextResponse> | null;

export function composeMiddleware(...middlewares: MiddlewareFunction[]) {
  return async function composedMiddleware(request: NextRequest) {
    let response: NextResponse | null = null;
    
    for (const middleware of middlewares) {
      const result = await middleware(request, response || undefined);
      
      if (result && result.status >= 300 && result.status < 400) {
        // Handle redirects immediately
        return result;
      }
      
      if (result && result.status >= 400) {
        // Handle errors immediately  
        return result;
      }
      
      if (result) {
        response = result;
      }
    }
    
    return response || NextResponse.next();
  };
}
```

### 2. Feature Flag Middleware
```typescript
// lib/middleware/featureFlags.ts
import { NextRequest, NextResponse } from 'next/server';

interface FeatureFlag {
  name: string;
  enabled: boolean;
  percentage?: number;
  userGroups?: string[];
  geoRegions?: string[];
}

const featureFlags: FeatureFlag[] = [
  {
    name: 'new-dashboard',
    enabled: true,
    percentage: 25,
  },
  {
    name: 'premium-features',
    enabled: true,
    userGroups: ['premium', 'admin'],
  },
];

export function featureFlagMiddleware(request: NextRequest) {
  const response = NextResponse.next();
  const activeFlags: Record<string, boolean> = {};
  
  for (const flag of featureFlags) {
    if (!flag.enabled) {
      activeFlags[flag.name] = false;
      continue;
    }
    
    // Check percentage rollout
    if (flag.percentage) {
      const userId = getUserId(request);
      const hash = hashString(userId + flag.name) % 100;
      if (hash >= flag.percentage) {
        activeFlags[flag.name] = false;
        continue;
      }
    }
    
    // Check user groups
    if (flag.userGroups) {
      const userRole = request.headers.get('x-user-role');
      if (!userRole || !flag.userGroups.includes(userRole)) {
        activeFlags[flag.name] = false;
        continue;
      }
    }
    
    activeFlags[flag.name] = true;
  }
  
  // Set feature flags in headers
  response.headers.set('x-feature-flags', JSON.stringify(activeFlags));
  
  return response;
}
```

## Middleware Testing

### 1. Unit Tests
```typescript
// __tests__/middleware.test.ts
import { NextRequest } from 'next/server';
import { middleware } from '../middleware';

describe('Middleware', () => {
  it('should add security headers', async () => {
    const request = new NextRequest('http://localhost:3000/');
    const response = await middleware(request);
    
    expect(response.headers.get('X-Frame-Options')).toBe('DENY');
    expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
  });

  it('should redirect unauthenticated users from protected routes', async () => {
    const request = new NextRequest('http://localhost:3000/dashboard');
    const response = await middleware(request);
    
    expect(response.status).toBe(302);
    expect(response.headers.get('location')).toContain('/login');
  });
});
```

### 2. Integration Tests
```typescript
// __tests__/middleware.integration.test.ts
describe('Middleware Integration', () => {
  it('should handle complete authentication flow', async () => {
    // Test login -> dashboard -> logout flow
  });
  
  it('should respect rate limiting', async () => {
    // Test multiple requests hitting rate limit
  });
});
```

## Deployment and Monitoring

### 1. Performance Monitoring
```typescript
// lib/middleware/monitoring.ts
export function monitoringMiddleware(request: NextRequest) {
  const start = Date.now();
  
  return new Response(JSON.stringify({}), {
    status: 200,
    headers: {
      'x-response-time': `${Date.now() - start}ms`,
    },
  });
}
```

### 2. Error Handling
```typescript
// lib/middleware/errorHandler.ts
export function errorHandlerMiddleware(
  error: Error,
  request: NextRequest
): NextResponse {
  console.error('Middleware error:', error);
  
  // Log to monitoring service
  // logError(error, request);
  
  return new NextResponse('Internal Server Error', { status: 500 });
}
```

Generate comprehensive middleware implementation with all requested features, proper TypeScript types, and production-ready patterns.