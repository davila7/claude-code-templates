---
allowed-tools: Read, Write, Edit, Bash
argument-hint: [route-path] [--method=GET] [--data='{}'] [--headers='{}']
description: Test and validate Next.js API routes with comprehensive test scenarios
model: sonnet
---

## Next.js API Route Tester

**API Route**: $ARGUMENTS

## Current Project Analysis

### API Routes Detection
- App Router API: @app/api/
- Pages Router API: @pages/api/
- API configuration: @next.config.js
- Environment variables: @.env.local

### Project Context
- Next.js version: !`grep '"next"' package.json | head -1`
- TypeScript config: @tsconfig.json (if exists)
- Testing framework: @jest.config.js or @vitest.config.js (if exists)

## API Route Analysis

### Route Discovery
Based on the provided route path, analyze:
- **Route File**: Locate the actual route file
- **HTTP Methods**: Supported methods (GET, POST, PUT, DELETE, PATCH)
- **Route Parameters**: Dynamic segments and query parameters
- **Middleware**: Applied middleware functions
- **Authentication**: Required authentication/authorization

### Route Implementation Review
- Route handler implementation: @app/api/[route-path]/route.ts or @pages/api/[route-path].ts
- Type definitions: @types/ or inline types
- Validation schemas: @lib/validations/ or inline validation
- Database models: @lib/models/ or @models/

## Test Generation Strategy

### 1. Basic Functionality Tests
```javascript
// Basic API route test template
describe('API Route: /api/[route-path]', () => {
  describe('GET requests', () => {
    test('should return 200 for valid request', async () => {
      const response = await fetch('/api/[route-path]');
      expect(response.status).toBe(200);
    });

    test('should return valid JSON response', async () => {
      const response = await fetch('/api/[route-path]');
      const data = await response.json();
      expect(data).toBeDefined();
      expect(typeof data).toBe('object');
    });
  });

  describe('POST requests', () => {
    test('should create resource with valid data', async () => {
      const testData = { name: 'Test', email: 'test@example.com' };
      const response = await fetch('/api/[route-path]', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(testData)
      });
      
      expect(response.status).toBe(201);
      const result = await response.json();
      expect(result.name).toBe(testData.name);
    });

    test('should reject invalid data', async () => {
      const invalidData = { invalid: 'field' };
      const response = await fetch('/api/[route-path]', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(invalidData)
      });
      
      expect(response.status).toBe(400);
    });
  });
});
```

### 2. Authentication Tests
```javascript
describe('Authentication', () => {
  test('should require authentication for protected routes', async () => {
    const response = await fetch('/api/protected-route');
    expect(response.status).toBe(401);
  });

  test('should allow authenticated requests', async () => {
    const token = 'valid-jwt-token';
    const response = await fetch('/api/protected-route', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    expect(response.status).not.toBe(401);
  });

  test('should validate JWT token format', async () => {
    const invalidToken = 'invalid-token';
    const response = await fetch('/api/protected-route', {
      headers: { 'Authorization': `Bearer ${invalidToken}` }
    });
    expect(response.status).toBe(403);
  });
});
```

### 3. Input Validation Tests
```javascript
describe('Input Validation', () => {
  const validationTests = [
    { field: 'email', invalid: 'not-an-email', valid: 'test@example.com' },
    { field: 'phone', invalid: '123', valid: '+1234567890' },
    { field: 'age', invalid: -1, valid: 25 },
    { field: 'name', invalid: '', valid: 'John Doe' }
  ];

  validationTests.forEach(({ field, invalid, valid }) => {
    test(`should validate ${field} field`, async () => {
      const invalidData = { [field]: invalid };
      const validData = { [field]: valid };

      // Test invalid data
      const invalidResponse = await fetch('/api/[route-path]', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(invalidData)
      });
      expect(invalidResponse.status).toBe(400);

      // Test valid data
      const validResponse = await fetch('/api/[route-path]', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validData)
      });
      expect(validResponse.status).not.toBe(400);
    });
  });
});
```

### 4. Error Handling Tests
```javascript
describe('Error Handling', () => {
  test('should handle malformed JSON', async () => {
    const response = await fetch('/api/[route-path]', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'invalid-json'
    });
    expect(response.status).toBe(400);
  });

  test('should handle missing Content-Type header', async () => {
    const response = await fetch('/api/[route-path]', {
      method: 'POST',
      body: JSON.stringify({ test: 'data' })
    });
    expect(response.status).toBe(400);
  });

  test('should handle request timeout', async () => {
    // Mock slow endpoint
    jest.setTimeout(5000);
    const response = await fetch('/api/slow-endpoint');
    // Test appropriate timeout handling
  }, 5000);

  test('should handle database connection errors', async () => {
    // Mock database failure
    const mockDbError = jest.spyOn(db, 'connect').mockRejectedValue(new Error('DB Error'));
    
    const response = await fetch('/api/[route-path]');
    expect(response.status).toBe(500);
    
    mockDbError.mockRestore();
  });
});
```

### 5. Performance Tests
```javascript
describe('Performance', () => {
  test('should respond within acceptable time', async () => {
    const startTime = Date.now();
    const response = await fetch('/api/[route-path]');
    const endTime = Date.now();
    
    expect(response.status).toBe(200);
    expect(endTime - startTime).toBeLessThan(1000); // 1 second
  });

  test('should handle concurrent requests', async () => {
    const promises = Array.from({ length: 10 }, () =>
      fetch('/api/[route-path]')
    );
    
    const responses = await Promise.all(promises);
    responses.forEach(response => {
      expect(response.status).toBe(200);
    });
  });

  test('should implement rate limiting', async () => {
    const requests = Array.from({ length: 100 }, () =>
      fetch('/api/[route-path]')
    );
    
    const responses = await Promise.all(requests);
    const rateLimitedResponses = responses.filter(r => r.status === 429);
    expect(rateLimitedResponses.length).toBeGreaterThan(0);
  });
});
```

## Manual Testing Commands

### cURL Commands Generation
```bash
# GET request
curl -X GET "http://localhost:3000/api/[route-path]" \
  -H "Accept: application/json"

# POST request with data
curl -X POST "http://localhost:3000/api/[route-path]" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -d '{"key": "value"}'

# Authenticated request
curl -X GET "http://localhost:3000/api/protected-route" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -H "Accept: application/json"

# Upload file
curl -X POST "http://localhost:3000/api/upload" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -F "file=@path/to/file.jpg"
```

### HTTPie Commands
```bash
# GET request
http GET localhost:3000/api/[route-path]

# POST request with JSON
http POST localhost:3000/api/[route-path] key=value

# Authenticated request
http GET localhost:3000/api/protected-route Authorization:"Bearer TOKEN"

# Custom headers
http GET localhost:3000/api/[route-path] X-Custom-Header:value
```

## Interactive Testing Tools

### Postman Collection Generation
```json
{
  "info": {
    "name": "Next.js API Tests",
    "description": "Generated API tests for [route-path]"
  },
  "item": [
    {
      "name": "GET [route-path]",
      "request": {
        "method": "GET",
        "header": [],
        "url": {
          "raw": "{{baseUrl}}/api/[route-path]",
          "host": ["{{baseUrl}}"],
          "path": ["api", "[route-path]"]
        }
      }
    },
    {
      "name": "POST [route-path]",
      "request": {
        "method": "POST",
        "header": [
          {
            "key": "Content-Type",
            "value": "application/json"
          }
        ],
        "body": {
          "mode": "raw",
          "raw": "{\n  \"key\": \"value\"\n}"
        },
        "url": {
          "raw": "{{baseUrl}}/api/[route-path]",
          "host": ["{{baseUrl}}"],
          "path": ["api", "[route-path]"]
        }
      }
    }
  ]
}
```

### Thunder Client Collection
```json
{
  "client": "Thunder Client",
  "collectionName": "Next.js API Tests",
  "dateExported": "2024-01-01",
  "version": "1.1",
  "folders": [],
  "requests": [
    {
      "name": "Test API Route",
      "url": "localhost:3000/api/[route-path]",
      "method": "GET",
      "headers": [
        {
          "name": "Accept",
          "value": "application/json"
        }
      ]
    }
  ]
}
```

## Test Data Management

### Test Fixtures
```typescript
// test/fixtures/apiTestData.ts
export const validUserData = {
  name: 'John Doe',
  email: 'john@example.com',
  age: 30,
  role: 'user'
};

export const invalidUserData = {
  name: '',
  email: 'invalid-email',
  age: -1,
  role: 'invalid-role'
};

export const testHeaders = {
  'Content-Type': 'application/json',
  'Accept': 'application/json',
  'User-Agent': 'API-Test-Suite/1.0'
};
```

### Mock Data Generation
```typescript
// test/utils/mockData.ts
export function generateMockUser() {
  return {
    id: Math.random().toString(36).substr(2, 9),
    name: `User ${Math.floor(Math.random() * 1000)}`,
    email: `user${Date.now()}@example.com`,
    createdAt: new Date().toISOString()
  };
}

export function generateBulkTestData(count: number) {
  return Array.from({ length: count }, generateMockUser);
}
```

## Test Environment Setup

### Jest Configuration
```javascript
// jest.config.js for API testing
module.exports = {
  testEnvironment: 'node',
  setupFilesAfterEnv: ['<rootDir>/test/setup.js'],
  testMatch: ['**/__tests__/**/*.test.js', '**/?(*.)+(spec|test).js'],
  collectCoverageFrom: [
    'pages/api/**/*.{js,ts}',
    'app/api/**/*.{js,ts}',
    '!**/*.d.ts',
  ],
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70
    }
  }
};
```

### Test Setup
```javascript
// test/setup.js
import { createMocks } from 'node-mocks-http';
import { testDb } from './testDatabase';

// Global test setup
beforeAll(async () => {
  // Setup test database
  await testDb.connect();
});

afterAll(async () => {
  // Cleanup test database
  await testDb.disconnect();
});

beforeEach(async () => {
  // Reset database state
  await testDb.reset();
});

// Helper function for API testing
global.createAPITest = (handler) => {
  return (method, url, options = {}) => {
    const { req, res } = createMocks({
      method,
      url,
      ...options
    });
    return handler(req, res);
  };
};
```

## Automated Testing Integration

### GitHub Actions Workflow
```yaml
name: API Tests
on: [push, pull_request]

jobs:
  test-api:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm ci
      - run: npm run test:api
      - name: Upload coverage
        uses: codecov/codecov-action@v3
```

### Continuous Testing
```bash
# Watch mode for development
npm run test:api -- --watch

# Coverage reporting
npm run test:api -- --coverage

# Specific route testing
npm run test:api -- --testNamePattern="api/users"
```

## Test Results Analysis

Generate comprehensive test report including:
1. **Test Coverage**: Line, branch, function coverage percentages
2. **Performance Metrics**: Response times, throughput
3. **Security Analysis**: Authentication, authorization, input validation
4. **Error Handling**: Exception scenarios and error responses
5. **Compatibility**: Cross-environment testing results

Provide actionable recommendations for improving API reliability, performance, and security.