# CLAUDE.md - Node.js API

This file provides guidance to Claude Code when working with Node.js API applications using TypeScript.

## Project Type

This is a Node.js API application with TypeScript and Express.js support.

## Development Commands

### API Development
- **`/route`** - Create API routes and endpoints
- **`/middleware`** - Create and manage Express middleware
- **`/api-endpoint`** - Generate complete API endpoints
- **`/database`** - Set up database operations and models

### Testing and Quality
- **`/test`** - Run tests and create test files
- **`/lint`** - Run linting and fix code style issues
- **`/typescript-migrate`** - Migrate JavaScript files to TypeScript

### Development Workflow
- **`/npm-scripts`** - Run npm scripts and package management
- **`/debug`** - Debug Node.js applications
- **`/refactor`** - Refactor and optimize code

## Framework-Specific Guidelines

### Express.js Best Practices
- Use middleware for cross-cutting concerns
- Implement proper error handling
- Follow RESTful API design principles
- Use proper HTTP status codes

### Database Integration
- Use TypeORM, Prisma, or Mongoose for database operations
- Implement proper connection pooling
- Use migrations for database schema changes
- Follow repository pattern for data access

### Security Considerations
- Implement authentication and authorization
- Use HTTPS in production
- Validate and sanitize input data
- Implement rate limiting and CORS

### Error Handling
- Use centralized error handling middleware
- Implement proper logging
- Return consistent error responses
- Handle async errors properly

## TypeScript Configuration

The project uses strict TypeScript configuration:
- Strict type checking enabled
- Proper interface definitions for requests/responses
- Generic type support for database models
- Integration with Express types

## API Design Patterns

### RESTful Routes
```
GET    /api/users      - Get all users
GET    /api/users/:id  - Get user by ID
POST   /api/users      - Create new user
PUT    /api/users/:id  - Update user
DELETE /api/users/:id  - Delete user
```

### Request/Response Structure
- Use consistent JSON response format
- Implement proper status codes
- Include metadata in responses
- Handle pagination properly

## Testing Strategy

- Unit tests with Jest
- Integration tests for API endpoints
- Database testing with test databases
- Load testing for performance validation

## File Naming Conventions

- Routes: `routeName.routes.ts` (e.g., `user.routes.ts`)
- Controllers: `ControllerName.controller.ts`
- Models: `ModelName.model.ts`
- Middleware: `middlewareName.middleware.ts`
- Services: `ServiceName.service.ts`
- Tests: `fileName.test.ts`

## Recommended Libraries

- **Framework**: Express.js, Fastify, Koa.js
- **Database**: Prisma, TypeORM, Mongoose
- **Authentication**: Passport.js, JWT, Auth0
- **Validation**: Joi, Yup, Zod
- **Testing**: Jest, Supertest, Artillery
- **Documentation**: Swagger/OpenAPI, Postman
- **Monitoring**: Winston, Morgan, Prometheus