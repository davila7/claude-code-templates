---
allowed-tools: Read, Write, Edit, Bash
argument-hint: [api-version] | --v1 | --v2 | --graphql-hybrid | --openapi
description: Design RESTful API architecture with comprehensive endpoints, authentication, and documentation
model: sonnet
---

# Design REST API

Design comprehensive RESTful API architecture: **$ARGUMENTS**

## Current Application State

- Framework detection: @package.json or @requirements.txt (Express, FastAPI, Spring Boot, etc.)
- Existing API: !`grep -r "route\|endpoint\|@app\\.route" src/ 2>/dev/null | wc -l` routes found
- Authentication: !`grep -r "auth\|jwt\|session" src/ 2>/dev/null | wc -l` auth components
- Documentation: @swagger.yaml or @openapi.json (if exists)

## Task

Design complete RESTful API with industry best practices and comprehensive functionality:

**API Version**: Use $ARGUMENTS to specify API version, GraphQL hybrid approach, or OpenAPI specification

**API Architecture**:
1. **Resource Design** - RESTful endpoints, HTTP methods, URL structure, resource relationships
2. **Request/Response Models** - Data validation, serialization, error handling, status codes
3. **Authentication & Authorization** - JWT, OAuth, RBAC, API keys, rate limiting
4. **API Documentation** - OpenAPI/Swagger specs, interactive documentation, code examples
5. **Versioning Strategy** - URL, header, or content-type based versioning
6. **Performance & Security** - Caching, pagination, CORS, input validation, SQL injection prevention

**Advanced Features**: Real-time capabilities, file uploads, batch operations, webhooks, and monitoring integration.

**Standards Compliance**: Follow REST principles, HTTP specifications, and API design best practices.

**Output**: Complete API specification with endpoints, authentication, validation, documentation, and client SDKs.