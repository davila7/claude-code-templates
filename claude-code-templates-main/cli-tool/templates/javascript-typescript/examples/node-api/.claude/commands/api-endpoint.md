# API Endpoint Generator

Generate a complete API endpoint for $ARGUMENTS following project conventions.

## Task

Create a new API endpoint with all necessary components:

1. **Analyze project architecture**: Examine existing API structure, patterns, and conventions
2. **Identify framework**: Determine if using Express, Fastify, NestJS, Next.js API routes, or other framework
3. **Check authentication**: Review existing auth patterns and middleware usage
4. **Examine data layer**: Identify database/ORM patterns (Prisma, TypeORM, Mongoose, etc.)
5. **Create endpoint structure**: Generate route, controller, validation, and service layers
6. **Implement business logic**: Add core functionality with proper error handling
7. **Add validation**: Include input validation using project's validation library
8. **Create tests**: Write unit and integration tests following project patterns
9. **Update documentation**: Add endpoint documentation (OpenAPI/Swagger if used)

## Implementation Requirements

- Follow project's TypeScript conventions and interfaces
- Use existing middleware patterns for auth, validation, logging
- Include proper HTTP status codes and error responses
- Add comprehensive input validation and sanitization
- Implement proper logging and monitoring
- Consider rate limiting and security headers
- Follow project's database transaction patterns

## Framework-Specific Patterns

I'll adapt to your project's framework:
- **Express**: Routes, controllers, middleware
- **Fastify**: Routes, handlers, schemas, plugins
- **NestJS**: Controllers, services, DTOs, guards
- **Next.js**: API routes with proper HTTP methods
- **tRPC**: Procedures with input/output validation
- **GraphQL**: Resolvers with proper type definitions

## Important Notes

- ALWAYS examine existing endpoints first to understand project patterns
- Use the same error handling and response format as existing endpoints
- Follow project's folder structure and naming conventions
- Don't install new dependencies without asking
- Consider backward compatibility if modifying existing endpoints
- Add proper database migrations if schema changes are needed