---
allowed-tools: Read, Write, Edit, Bash
argument-hint: [file-path] | [component-name]
description: Create a complete, runnable test suite from scratch for a specified file or component — generates test files with unit tests, integration tests, mocks, and test utilities
---

# Generate Tests

Generate comprehensive test suite for: $ARGUMENTS

## Current Testing Setup

- Test framework: !`cat package.json 2>/dev/null | grep -E '"(jest|vitest|mocha|jasmine|tap)"' | head -3 || find . -maxdepth 2 -name "jest.config.*" -o -name "vitest.config.*" -o -name "pytest.ini" -o -name "go.mod" -o -name "Cargo.toml" | head -5 || echo "No framework detected"`
- Project language: !`[ -f go.mod ] && echo "Go (testing package)" || [ -f Cargo.toml ] && echo "Rust (cargo test)" || [ -f pyproject.toml ] && echo "Python (pytest)" || [ -f requirements.txt ] && echo "Python" || [ -f pom.xml ] && echo "Java (JUnit)" || [ -f build.gradle ] && echo "Java/Kotlin (JUnit)" || echo "JavaScript/TypeScript"`
- Existing tests: !`find . -name "*.test.*" -o -name "*.spec.*" | head -5`
- Test coverage: !`npm run test:coverage 2>/dev/null || echo "No coverage script"`
- Target file: @$ARGUMENTS (if file path provided)

## Task

I'll analyze the target code and create complete test coverage including:

1. Unit tests for individual functions and methods
2. Integration tests for component interactions
3. Edge case and error handling tests
4. Mock implementations for external dependencies
5. Test utilities and helpers as needed
6. Performance and snapshot tests where appropriate

## Test Types

### Unit Tests

- Individual function testing with various inputs
- Component rendering and prop handling
- State management and lifecycle methods
- Utility function edge cases and error conditions

### Integration Tests

- Component interaction testing
- API integration with mocked responses
- Service layer integration
- End-to-end user workflows

### Contract Tests (when API boundaries exist)

- Consumer-driven contract tests using Pact or schemathesis
- Provider verification tests for service boundaries
- OpenAPI schema validation tests

### Accessibility Tests (when UI components detected)

- jest-axe assertions for React/Vue components
- @axe-core/playwright for E2E accessibility flows
- WCAG 2.1 AA compliance checks

### Framework-Specific Tests

- **React**: Component testing with React Testing Library
- **Vue**: Component testing with Vue Test Utils
- **Angular**: Component and service testing with TestBed
- **Node.js**: API endpoint and middleware testing

### Language-Specific Tests

- **Python**: pytest fixtures, parametrize, conftest.py patterns
- **Go**: Table-driven tests, testify assertions, httptest for handlers
- **Rust**: #[cfg(test)] modules, proptest for property-based testing
- **Java**: JUnit 5 parameterized tests, Mockito for mocking

## Testing Best Practices

### Test Structure

- Use descriptive test names that explain the behavior
- Follow AAA pattern (Arrange, Act, Assert)
- Group related tests with describe blocks
- Use proper setup and teardown for test isolation

### Mock Strategy

- Mock external dependencies and API calls
- Use factories for test data generation
- Implement proper cleanup for async operations
- Mock timers and dates for deterministic tests

### Coverage Goals

- Aim for 80%+ code coverage
- Focus on critical business logic paths
- Test both happy path and error scenarios
- Include boundary value testing

I'll adapt to your project's testing framework (Jest, Vitest, Cypress, etc.) and follow established patterns.
