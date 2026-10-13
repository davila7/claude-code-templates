# API Documentation Generator

Generate, validate, and export OpenAPI/Swagger documentation for your APIs.

## Purpose

This command helps you create and maintain comprehensive API documentation using OpenAPI 3.0 specifications. It supports multiple frameworks and can generate interactive documentation, client SDKs, and validate specs against your implementation.

## Usage

```
/api-docs                    # Auto-detect framework and generate docs
/api-docs generate           # Generate OpenAPI spec from code
/api-docs validate           # Validate spec against implementation
/api-docs export             # Export to various formats
/api-docs sdk                # Generate client SDKs
```

## What this command does

1. **Auto-detects your API framework** (Express, FastAPI, Flask, Django, Rails)
2. **Generates OpenAPI 3.0 specifications** from code annotations and routes
3. **Validates existing specs** against your actual implementation
4. **Exports documentation** in multiple formats (Swagger UI, Redoc, HTML)
5. **Generates client SDKs** for TypeScript, Python, and other languages

## Supported Frameworks

| Framework | Auto-Generate | Annotations | Validation |
|-----------|---------------|-------------|------------|
| **Express.js** | ✅ swagger-jsdoc | JSDoc comments | ✅ |
| **FastAPI** | ✅ Built-in | Pydantic models | ✅ |
| **Flask** | ✅ flask-openapi3 | Decorators | ✅ |
| **Django REST** | ✅ drf-spectacular | Serializers | ✅ |
| **Rails API** | ✅ rswag | RSpec specs | ✅ |
| **NestJS** | ✅ @nestjs/swagger | Decorators | ✅ |

## Generation Examples

### Express.js with swagger-jsdoc

```javascript
/**
 * @openapi
 * /api/users:
 *   get:
 *     summary: Get all users
 *     tags: [Users]
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *         description: Number of users to return
 *     responses:
 *       200:
 *         description: List of users
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/User'
 */
app.get('/api/users', getUsersHandler);
```

### FastAPI (Auto-generated)

```python
from fastapi import FastAPI
from pydantic import BaseModel

class User(BaseModel):
    id: int
    name: str
    email: str

@app.get("/users", response_model=list[User], tags=["Users"])
async def get_users(limit: int = 10):
    """Get all users with optional limit."""
    return users[:limit]
```

### Flask with flask-openapi3

```python
from flask_openapi3 import OpenAPI, Info

info = Info(title="My API", version="1.0.0")
app = OpenAPI(__name__, info=info)

@app.get("/users", tags=[{"name": "Users"}])
def get_users(query: UserQuery):
    """Get all users."""
    return users
```

## Export Formats

### Swagger UI (Interactive)
```bash
# Generate Swagger UI static files
/api-docs export --format swagger-ui --output ./docs/api

# Serve locally
npx serve ./docs/api
```

### Redoc (Clean Documentation)
```bash
# Generate Redoc HTML
/api-docs export --format redoc --output ./docs/api.html
```

### OpenAPI JSON/YAML
```bash
# Export raw spec
/api-docs export --format yaml --output ./openapi.yaml
/api-docs export --format json --output ./openapi.json
```

## SDK Generation

Generate type-safe client SDKs from your OpenAPI spec:

```bash
# TypeScript/JavaScript
/api-docs sdk --language typescript --output ./sdk/ts

# Python
/api-docs sdk --language python --output ./sdk/python

# Go
/api-docs sdk --language go --output ./sdk/go
```

### Generated SDK Example (TypeScript)
```typescript
// Auto-generated from OpenAPI spec
import { UsersApi, Configuration } from './generated';

const api = new UsersApi(new Configuration({
  basePath: 'https://api.example.com'
}));

// Type-safe API calls
const users = await api.getUsers({ limit: 10 });
```

## Validation

Validate your OpenAPI spec against your actual API implementation:

```bash
# Check for mismatches
/api-docs validate

# Output example:
# ✓ GET /api/users - matches spec
# ✓ POST /api/users - matches spec
# ✗ GET /api/users/:id - missing in spec
# ✗ DELETE /api/users/:id - response schema mismatch
```

## CI/CD Integration

### GitHub Actions
```yaml
name: API Documentation
on:
  push:
    paths: ['src/api/**', 'openapi.yaml']

jobs:
  docs:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Validate OpenAPI Spec
        run: npx @redocly/cli lint openapi.yaml

      - name: Generate Documentation
        run: npx @redocly/cli build-docs openapi.yaml -o docs/index.html

      - name: Deploy to GitHub Pages
        uses: peaceiris/actions-gh-pages@v3
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: ./docs
```

## Best Practices

### Documentation Quality
- Include descriptions for all endpoints, parameters, and schemas
- Provide realistic examples for request/response bodies
- Document error responses with appropriate status codes
- Use tags to organize endpoints by resource or feature
- Include authentication requirements in security schemes

### Schema Design
- Use `$ref` for reusable components
- Define common error response schemas
- Include validation constraints (min, max, pattern)
- Document nullable fields explicitly
- Use enums for finite value sets

### Versioning
- Include API version in the spec info
- Use URL path versioning (/v1/, /v2/)
- Document breaking changes in changelog
- Maintain specs for supported versions

## Troubleshooting

### Common Issues

**Spec not generating:**
- Ensure annotations/decorators are properly formatted
- Check that all referenced schemas exist
- Verify framework-specific configuration

**Validation failures:**
- Compare route definitions with spec paths
- Check for schema mismatches in responses
- Verify required fields match implementation

**SDK generation errors:**
- Validate spec with `openapi-generator validate`
- Check for unsupported OpenAPI features
- Ensure all `$ref` references resolve

## Related Commands

- `/test` - Run API tests
- `/lint` - Check code quality
- `/security-audit` - Scan for API security issues
