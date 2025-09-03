---
allowed-tools: Read, Write, Edit
argument-hint: [function-name] [--auth] [--geo] [--transform] [--proxy]
description: Generate optimized Vercel Edge Functions with geolocation, authentication, and data transformation
model: sonnet
---

## Vercel Edge Function Generator

**Function Name**: $ARGUMENTS

## Current Project Analysis

### Project Structure
- Vercel config: @vercel.json (if exists)
- Next.js config: @next.config.js
- API routes: @app/api/ or @pages/api/
- Middleware: @middleware.ts (if exists)

### Framework Detection
- Package.json: @package.json
- TypeScript config: @tsconfig.json (if exists)
- Environment variables: @.env.local (if exists)

## Edge Function Implementation Strategy

### 1. File Structure Creation
Generate comprehensive edge function structure:
```
api/edge/[function-name]/
├── index.ts                    # Main edge function
├── types.ts                   # TypeScript types
├── utils.ts                   # Utility functions
├── config.ts                  # Configuration
└── __tests__/
    └── [function-name].test.ts # Unit tests
```

### 2. Base Edge Function Template
```typescript
// api/edge/[function-name]/index.ts
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';

export async function GET(request: NextRequest) {
  try {
    // Get geolocation data
    const country = request.geo?.country || 'Unknown';
    const city = request.geo?.city || 'Unknown';
    const region = request.geo?.region || 'Unknown';
    
    // Get request metadata
    const ip = request.headers.get('x-forwarded-for') || 'Unknown';
    const userAgent = request.headers.get('user-agent') || 'Unknown';
    const referer = request.headers.get('referer') || 'Unknown';
    
    // Process request
    const result = await processRequest({
      geo: { country, city, region },
      ip,
      userAgent,
      referer,
      url: request.url,
    });
    
    return NextResponse.json(result, {
      status: 200,
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
        'Content-Type': 'application/json',
        'X-Edge-Location': region,
      },
    });
    
  } catch (error) {
    console.error('Edge function error:', error);
    
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validate request body
    const validationResult = validateRequestBody(body);
    if (!validationResult.valid) {
      return NextResponse.json(
        { error: 'Invalid request body', details: validationResult.errors },
        { status: 400 }
      );
    }
    
    // Process POST request
    const result = await processPostRequest(body, request);
    
    return NextResponse.json(result, {
      status: 201,
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
  } catch (error) {
    console.error('Edge function POST error:', error);
    
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

async function processRequest(metadata: RequestMetadata): Promise<any> {
  // Implement your edge function logic here
  return {
    message: 'Edge function executed successfully',
    metadata,
    timestamp: new Date().toISOString(),
  };
}

async function processPostRequest(body: any, request: NextRequest): Promise<any> {
  // Implement POST logic here
  return {
    message: 'POST processed successfully',
    data: body,
    timestamp: new Date().toISOString(),
  };
}

function validateRequestBody(body: any): ValidationResult {
  // Implement validation logic
  return { valid: true, errors: [] };
}

interface RequestMetadata {
  geo: {
    country: string;
    city: string;
    region: string;
  };
  ip: string;
  userAgent: string;
  referer: string;
  url: string;
}

interface ValidationResult {
  valid: boolean;
  errors: string[];
}
```

## Specialized Edge Function Types

### 1. Geolocation-Based Content Delivery
```typescript
// api/edge/geo-content/index.ts
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';

interface ContentConfig {
  [country: string]: {
    currency: string;
    language: string;
    content: string;
    pricing: number;
  };
}

const contentConfig: ContentConfig = {
  'US': {
    currency: 'USD',
    language: 'en-US',
    content: 'Welcome to our US store!',
    pricing: 99.99,
  },
  'GB': {
    currency: 'GBP',
    language: 'en-GB',
    content: 'Welcome to our UK store!',
    pricing: 79.99,
  },
  'DE': {
    currency: 'EUR',
    language: 'de-DE',
    content: 'Willkommen in unserem deutschen Shop!',
    pricing: 89.99,
  },
};

export async function GET(request: NextRequest) {
  const country = request.geo?.country || 'US';
  const config = contentConfig[country] || contentConfig['US'];
  
  // Add region-specific headers
  const response = NextResponse.json({
    country,
    ...config,
    edgeLocation: request.geo?.region,
    timestamp: new Date().toISOString(),
  });
  
  response.headers.set('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');
  response.headers.set('Vary', 'Accept-Language, CloudFront-Viewer-Country');
  response.headers.set('Content-Language', config.language);
  
  return response;
}
```

### 2. Authentication Edge Function
```typescript
// api/edge/auth-check/index.ts
import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

export const runtime = 'edge';

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'your-secret-key'
);

export async function GET(request: NextRequest) {
  try {
    // Extract token from header or cookie
    const authHeader = request.headers.get('authorization');
    const cookieToken = request.cookies.get('auth-token')?.value;
    
    const token = authHeader?.replace('Bearer ', '') || cookieToken;
    
    if (!token) {
      return NextResponse.json(
        { error: 'No token provided', authenticated: false },
        { status: 401 }
      );
    }
    
    // Verify JWT token
    const { payload } = await jwtVerify(token, JWT_SECRET);
    
    // Return user info
    return NextResponse.json({
      authenticated: true,
      user: {
        id: payload.sub,
        email: payload.email,
        role: payload.role,
        exp: payload.exp,
      },
      location: {
        country: request.geo?.country,
        city: request.geo?.city,
      },
    });
    
  } catch (error) {
    console.error('Auth verification failed:', error);
    
    return NextResponse.json(
      { error: 'Invalid token', authenticated: false },
      { status: 401 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { username, password } = await request.json();
    
    // Validate credentials (implement your logic)
    const user = await validateCredentials(username, password);
    
    if (!user) {
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      );
    }
    
    // Generate JWT token
    const token = await generateJWT(user);
    
    const response = NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
      },
    });
    
    // Set secure cookie
    response.cookies.set('auth-token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 24 * 60 * 60, // 24 hours
    });
    
    return response;
    
  } catch (error) {
    console.error('Authentication error:', error);
    
    return NextResponse.json(
      { error: 'Authentication failed' },
      { status: 500 }
    );
  }
}

async function validateCredentials(username: string, password: string) {
  // Implement credential validation
  // This would typically involve database lookup
  return null; // Placeholder
}

async function generateJWT(user: any): Promise<string> {
  // Implement JWT generation
  // This would use a proper JWT library
  return 'jwt-token'; // Placeholder
}
```

### 3. Data Transformation Edge Function
```typescript
// api/edge/transform/index.ts
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';

interface TransformConfig {
  format: 'json' | 'xml' | 'csv';
  fields?: string[];
  transforms?: Record<string, (value: any) => any>;
}

const transformers = {
  // Currency conversion
  currency: (value: number, targetCurrency: string = 'USD') => {
    const rates = { USD: 1, EUR: 0.85, GBP: 0.73 };
    return value * (rates[targetCurrency as keyof typeof rates] || 1);
  },
  
  // Date formatting
  date: (value: string, format: string = 'ISO') => {
    const date = new Date(value);
    if (format === 'ISO') return date.toISOString();
    if (format === 'US') return date.toLocaleDateString('en-US');
    return date.toString();
  },
  
  // Text formatting
  text: (value: string, caseType: string = 'lower') => {
    if (caseType === 'upper') return value.toUpperCase();
    if (caseType === 'title') return value.replace(/\w\S*/g, txt => 
      txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase()
    );
    return value.toLowerCase();
  },
};

export async function POST(request: NextRequest) {
  try {
    const { data, config }: { data: any; config: TransformConfig } = await request.json();
    
    if (!data || !config) {
      return NextResponse.json(
        { error: 'Missing data or config' },
        { status: 400 }
      );
    }
    
    // Apply transformations
    const transformedData = await transformData(data, config, request);
    
    // Format output based on requested format
    const output = await formatOutput(transformedData, config.format);
    
    const response = new NextResponse(output, {
      status: 200,
      headers: {
        'Content-Type': getContentType(config.format),
        'Cache-Control': 'public, s-maxage=300',
      },
    });
    
    return response;
    
  } catch (error) {
    console.error('Transform error:', error);
    
    return NextResponse.json(
      { error: 'Transformation failed' },
      { status: 500 }
    );
  }
}

async function transformData(data: any, config: TransformConfig, request: NextRequest) {
  const country = request.geo?.country || 'US';
  
  // Apply field filtering if specified
  if (config.fields && Array.isArray(data)) {
    data = data.map(item => {
      const filtered: any = {};
      config.fields!.forEach(field => {
        if (item.hasOwnProperty(field)) {
          filtered[field] = item[field];
        }
      });
      return filtered;
    });
  }
  
  // Apply custom transforms
  if (config.transforms) {
    Object.entries(config.transforms).forEach(([field, transformFunc]) => {
      if (Array.isArray(data)) {
        data = data.map(item => ({
          ...item,
          [field]: transformFunc(item[field]),
        }));
      } else if (data.hasOwnProperty(field)) {
        data[field] = transformFunc(data[field]);
      }
    });
  }
  
  // Add geo context
  return {
    ...data,
    _meta: {
      transformedAt: new Date().toISOString(),
      location: country,
      edgeRegion: request.geo?.region,
    },
  };
}

async function formatOutput(data: any, format: string): Promise<string> {
  switch (format) {
    case 'xml':
      return jsonToXml(data);
    case 'csv':
      return jsonToCsv(data);
    case 'json':
    default:
      return JSON.stringify(data, null, 2);
  }
}

function getContentType(format: string): string {
  switch (format) {
    case 'xml': return 'application/xml';
    case 'csv': return 'text/csv';
    case 'json':
    default: return 'application/json';
  }
}

function jsonToXml(data: any): string {
  // Simple XML conversion (implement proper XML library for production)
  return `<?xml version="1.0" encoding="UTF-8"?><root>${JSON.stringify(data)}</root>`;
}

function jsonToCsv(data: any): string {
  // Simple CSV conversion (implement proper CSV library for production)
  if (Array.isArray(data) && data.length > 0) {
    const headers = Object.keys(data[0]);
    const rows = data.map(row => headers.map(header => row[header] || '').join(','));
    return [headers.join(','), ...rows].join('\n');
  }
  return '';
}
```

### 4. Proxy and Cache Edge Function
```typescript
// api/edge/proxy/index.ts
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';

interface ProxyConfig {
  targetUrl: string;
  cacheTime: number;
  headers?: Record<string, string>;
  transformResponse?: boolean;
}

const proxyConfigs: Record<string, ProxyConfig> = {
  'api': {
    targetUrl: 'https://jsonplaceholder.typicode.com',
    cacheTime: 300, // 5 minutes
    headers: {
      'User-Agent': 'Vercel-Edge-Proxy/1.0',
    },
  },
  'cdn': {
    targetUrl: 'https://cdn.example.com',
    cacheTime: 3600, // 1 hour
    transformResponse: false,
  },
};

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const proxyType = url.searchParams.get('type') || 'api';
    const targetPath = url.searchParams.get('path') || '';
    
    const config = proxyConfigs[proxyType];
    if (!config) {
      return NextResponse.json(
        { error: 'Invalid proxy type' },
        { status: 400 }
      );
    }
    
    // Build target URL
    const targetUrl = `${config.targetUrl}${targetPath}`;
    
    // Check cache first (simplified - use proper cache in production)
    const cacheKey = `proxy:${targetUrl}`;
    
    // Make request to target
    const response = await fetch(targetUrl, {
      headers: {
        ...config.headers,
        'X-Forwarded-For': request.headers.get('x-forwarded-for') || '',
        'X-Real-IP': request.headers.get('x-real-ip') || '',
      },
    });
    
    if (!response.ok) {
      return NextResponse.json(
        { error: 'Upstream server error' },
        { status: response.status }
      );
    }
    
    let data;
    const contentType = response.headers.get('content-type') || '';
    
    if (contentType.includes('application/json')) {
      data = await response.json();
      
      // Transform response if configured
      if (config.transformResponse) {
        data = await transformProxyResponse(data, request);
      }
      
      return NextResponse.json(data, {
        status: 200,
        headers: {
          'Cache-Control': `public, s-maxage=${config.cacheTime}, stale-while-revalidate=${config.cacheTime * 2}`,
          'X-Proxy-Cache': 'MISS',
          'X-Edge-Location': request.geo?.region || 'unknown',
        },
      });
    } else {
      // For non-JSON responses, pass through
      const blob = await response.blob();
      
      return new NextResponse(blob, {
        status: 200,
        headers: {
          'Content-Type': contentType,
          'Cache-Control': `public, s-maxage=${config.cacheTime}`,
        },
      });
    }
    
  } catch (error) {
    console.error('Proxy error:', error);
    
    return NextResponse.json(
      { error: 'Proxy request failed' },
      { status: 502 }
    );
  }
}

async function transformProxyResponse(data: any, request: NextRequest) {
  // Add geo context to proxied data
  return {
    ...data,
    _proxy: {
      timestamp: new Date().toISOString(),
      location: request.geo?.country,
      region: request.geo?.region,
    },
  };
}
```

## Edge Function Utilities

### 1. Configuration Management
```typescript
// api/edge/[function-name]/config.ts
export interface EdgeFunctionConfig {
  cacheTime: number;
  rateLimit: {
    requests: number;
    windowMs: number;
  };
  geo: {
    enabled: boolean;
    restrictedCountries?: string[];
  };
  security: {
    corsOrigins: string[];
    requireAuth: boolean;
  };
}

export const defaultConfig: EdgeFunctionConfig = {
  cacheTime: 300, // 5 minutes
  rateLimit: {
    requests: 100,
    windowMs: 60000, // 1 minute
  },
  geo: {
    enabled: true,
  },
  security: {
    corsOrigins: ['*'],
    requireAuth: false,
  },
};
```

### 2. Utility Functions
```typescript
// api/edge/[function-name]/utils.ts
export function getClientIP(request: NextRequest): string {
  return request.headers.get('x-forwarded-for') ||
    request.headers.get('x-real-ip') ||
    request.ip ||
    'unknown';
}

export function generateCacheKey(request: NextRequest, suffix?: string): string {
  const url = new URL(request.url);
  const baseKey = `${url.pathname}${url.search}`;
  return suffix ? `${baseKey}:${suffix}` : baseKey;
}

export function createCorsResponse(
  data: any,
  origins: string[] = ['*']
): NextResponse {
  const response = NextResponse.json(data);
  
  response.headers.set('Access-Control-Allow-Origin', origins.join(', '));
  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  return response;
}

export function validateGeoRestrictions(
  request: NextRequest,
  restrictedCountries: string[] = []
): boolean {
  const country = request.geo?.country;
  return !country || !restrictedCountries.includes(country);
}
```

### 3. Testing Framework
```typescript
// api/edge/[function-name]/__tests__/[function-name].test.ts
import { NextRequest } from 'next/server';
import { GET, POST } from '../index';

// Mock geo data
const createMockRequest = (url: string, options: any = {}) => {
  const request = new NextRequest(url, options);
  
  // Mock geo property
  Object.defineProperty(request, 'geo', {
    value: {
      country: 'US',
      city: 'New York',
      region: 'us-east-1',
    },
  });
  
  return request;
};

describe('Edge Function', () => {
  describe('GET requests', () => {
    it('should return geo-based content', async () => {
      const request = createMockRequest('http://localhost:3000/api/edge/test');
      const response = await GET(request);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data.metadata.geo.country).toBe('US');
    });
    
    it('should handle missing geo data', async () => {
      const request = new NextRequest('http://localhost:3000/api/edge/test');
      const response = await GET(request);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data.metadata.geo.country).toBe('Unknown');
    });
  });
  
  describe('POST requests', () => {
    it('should validate request body', async () => {
      const request = createMockRequest('http://localhost:3000/api/edge/test', {
        method: 'POST',
        body: JSON.stringify({ invalid: 'data' }),
        headers: { 'Content-Type': 'application/json' },
      });
      
      const response = await POST(request);
      const data = await response.json();
      
      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid request body');
    });
  });
});
```

## Performance and Optimization

### 1. Response Optimization
```typescript
// Optimize responses for edge performance
export function optimizeResponse(data: any, request: NextRequest): NextResponse {
  const response = NextResponse.json(data);
  
  // Set appropriate cache headers
  const cacheTime = getCacheTime(request.url);
  response.headers.set(
    'Cache-Control',
    `public, s-maxage=${cacheTime}, stale-while-revalidate=${cacheTime * 2}`
  );
  
  // Add compression hints
  response.headers.set('Content-Encoding', 'gzip');
  
  // Add performance headers
  response.headers.set('X-Edge-Location', request.geo?.region || 'unknown');
  
  return response;
}

function getCacheTime(url: string): number {
  // Dynamic cache time based on URL patterns
  if (url.includes('/static/')) return 3600; // 1 hour
  if (url.includes('/api/')) return 60; // 1 minute
  return 300; // 5 minutes default
}
```

### 2. Error Handling
```typescript
export function createErrorResponse(
  error: unknown,
  request: NextRequest
): NextResponse {
  console.error('Edge function error:', error);
  
  // Log error with context
  const errorContext = {
    url: request.url,
    method: request.method,
    country: request.geo?.country,
    timestamp: new Date().toISOString(),
  };
  
  // Return appropriate error response
  return NextResponse.json(
    {
      error: 'Internal server error',
      requestId: generateRequestId(),
    },
    {
      status: 500,
      headers: {
        'X-Error-Context': JSON.stringify(errorContext),
      },
    }
  );
}

function generateRequestId(): string {
  return Math.random().toString(36).substr(2, 9);
}
```

Generate comprehensive edge function implementation with the requested features, proper TypeScript types, error handling, and optimization patterns.