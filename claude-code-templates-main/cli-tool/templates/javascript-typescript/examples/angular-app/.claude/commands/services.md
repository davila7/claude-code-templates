# Angular Services

Create Angular services for $ARGUMENTS following project conventions.

## Task

Create or optimize Angular services based on the requirements:

1. **Analyze existing services**: Check current service patterns, naming conventions, and folder organization
2. **Examine Angular setup**: Review project structure, dependency injection patterns, and TypeScript configuration
3. **Identify service type**: Determine the service category:
   - Data services (HTTP API calls, state management)
   - Utility services (validation, formatting, helpers)
   - Business logic services (calculations, workflows)
   - Infrastructure services (logging, authentication, error handling)
   - Feature services (component-specific logic)
4. **Check dependencies**: Review existing services and shared modules to avoid duplication
5. **Implement service**: Create service with proper dependency injection and TypeScript types
6. **Add error handling**: Include comprehensive error handling with RxJS operators
7. **Create tests**: Write unit tests with proper mocking following project patterns
8. **Update module registration**: Register service in appropriate Angular modules

## Implementation Requirements

- Follow project's Angular architecture and naming conventions (usually .service.ts)
- Use proper dependency injection with @Injectable decorator
- Include comprehensive TypeScript interfaces and types
- Implement proper RxJS patterns (observables, operators, error handling)
- Add proper error handling and logging integration
- Follow single responsibility principle for service design
- Consider service lifecycle and singleton patterns

## Service Patterns to Consider

Based on the request:
- **HTTP Data Services**: API calls with proper error handling and caching
- **State Management**: Services for sharing data between components
- **Authentication**: User authentication, token management, guards
- **Business Logic**: Complex calculations, workflows, validations
- **Utility Services**: Reusable functions, formatters, validators
- **Feature Services**: Component-specific logic extraction
- **Infrastructure**: Logging, monitoring, configuration services

## Angular-Specific Implementation

- **Dependency Injection**: Proper use of @Injectable and providedIn
- **RxJS Integration**: Observables, subjects, operators for reactive programming
- **HTTP Client**: Angular HttpClient for API communication
- **Error Handling**: Global error handling and user-friendly error messages
- **Testing**: TestBed, jasmine, karma for comprehensive unit testing
- **Module Organization**: Feature modules, shared modules, core modules

## Important Notes

- ALWAYS examine existing services first to understand project patterns
- Use the same error handling and response patterns as existing services
- Follow project's folder structure for services (usually /services or /core)
- Don't install new dependencies without asking
- Consider service performance and memory management
- Add proper RxJS subscription management to prevent memory leaks
- Use Angular's built-in services (HttpClient, Router) rather than external libraries
- Include proper TypeScript types for all service methods and properties