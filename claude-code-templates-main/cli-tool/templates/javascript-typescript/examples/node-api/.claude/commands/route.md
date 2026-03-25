# Route Creator

Create API routes for $ARGUMENTS following project conventions.

## Task

Create or optimize API routes based on the requirements:

1. **Analyze project structure**: Check existing route patterns, folder organization, and framework setup
2. **Examine framework**: Identify if using Express, Fastify, NestJS, or other Node.js framework
3. **Review existing routes**: Understand current routing patterns, validation, and error handling
4. **Check authentication**: Review existing auth middleware and protection patterns
5. **Define route structure**: Determine HTTP methods, path parameters, and request/response schemas
6. **Implement routes**: Create route handlers with proper validation and error handling
7. **Add middleware**: Include authentication, validation, and logging middleware as needed
8. **Create tests**: Write route tests following project testing patterns
9. **Update route registration**: Integrate new routes into main router configuration

## Implementation Requirements

- Follow project's routing architecture and naming conventions
- Use existing validation libraries (Joi, Zod, class-validator, etc.)
- Include proper TypeScript types for request/response objects
- Add comprehensive error handling with appropriate HTTP status codes
- Implement proper authentication/authorization if required
- Follow RESTful conventions unless project uses different patterns
- Add proper logging and monitoring integration

## Route Patterns to Consider

Based on the request:
- **CRUD operations**: Create, Read, Update, Delete for resources
- **RESTful endpoints**: GET, POST, PUT, PATCH, DELETE with proper semantics
- **Nested resources**: Parent/child resource relationships
- **Batch operations**: Bulk create, update, delete operations
- **Search/filtering**: Query parameters for filtering and pagination
- **File uploads**: Multipart form handling for file operations
- **Webhook endpoints**: External service integration points

## Framework-Specific Implementation

Adapt to your project's framework:
- **Express**: Router instances, middleware chains, route handlers
- **Fastify**: Route plugins, schema validation, hooks
- **NestJS**: Controllers, decorators, DTOs, guards, interceptors
- **Koa**: Router middleware, context handling
- **Next.js API**: API route handlers with proper HTTP methods

## Important Notes

- ALWAYS examine existing routes first to understand project patterns
- Use the same validation and error handling patterns as existing routes
- Follow project's folder structure for routes (usually /routes or /controllers)
- Don't install new dependencies without asking
- Consider route performance and database query optimization
- Add proper OpenAPI/Swagger documentation if project uses it
- Include rate limiting for public endpoints where appropriate