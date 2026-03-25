# Angular Components

Create Angular components for $ARGUMENTS following project conventions.

## Task

Create or optimize Angular components based on the requirements:

1. **Analyze existing components**: Check current component patterns, naming conventions, and folder organization
2. **Examine Angular setup**: Review project structure, module organization, and TypeScript configuration
3. **Identify component type**: Determine the component category:
   - Presentation components (dumb/pure components)
   - Container components (smart components with state)
   - Feature components (business logic components)
   - Shared/UI components (reusable across features)
   - Layout components (structural components)
4. **Check dependencies**: Review existing components and shared modules to avoid duplication
5. **Implement component**: Create component with proper TypeScript types and lifecycle hooks
6. **Add inputs/outputs**: Define @Input and @Output properties with proper typing
7. **Create template**: Build HTML template with proper Angular directives and bindings
8. **Add styles**: Implement component styles following project's styling approach
9. **Create tests**: Write comprehensive unit tests with TestBed and proper mocking
10. **Update module**: Register component in appropriate Angular module

## Implementation Requirements

- Follow project's Angular architecture and naming conventions
- Use proper component lifecycle hooks (OnInit, OnDestroy, etc.)
- Include comprehensive TypeScript interfaces for inputs and outputs
- Implement proper change detection strategy (OnPush when possible)
- Add proper subscription management with takeUntil or async pipe
- Follow Angular style guide and project coding standards
- Consider component performance and memory management

## Component Patterns to Consider

Based on the request:
- **Smart Components**: Container components that manage state and services
- **Dumb Components**: Presentation components that only receive inputs
- **Feature Components**: Components specific to business features
- **Shared Components**: Reusable UI components across the application
- **Form Components**: Reactive forms with validation and custom controls
- **Data Display**: Components for tables, lists, cards with proper data binding

## Angular-Specific Implementation

- **Template Syntax**: Proper use of Angular directives (*ngFor, *ngIf, etc.)
- **Data Binding**: Property binding, event binding, two-way binding
- **Change Detection**: OnPush strategy for performance optimization
- **Lifecycle Management**: Proper use of lifecycle hooks
- **Dependency Injection**: Service injection in component constructors
- **Testing**: TestBed configuration with proper mocking and spies

## Important Notes

- ALWAYS examine existing components first to understand project patterns
- Use the same styling approach and class naming as existing components
- Follow project's folder structure for components (usually feature-based)
- Don't install new dependencies without asking
- Consider component reusability and single responsibility principle
- Add proper TypeScript types for all component properties and methods
- Use trackBy functions for performance in *ngFor loops
- Implement proper unsubscription patterns to prevent memory leaks