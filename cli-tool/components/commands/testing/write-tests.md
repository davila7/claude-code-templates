---
allowed-tools: Read, Write, Edit, Bash
argument-hint: [target-file] | [test-type] | --unit | --integration | --e2e | --component
description: Write comprehensive unit and integration tests with proper mocking and coverage
model: sonnet
---

# Write Tests

Write comprehensive unit and integration tests with framework-specific best practices: **$ARGUMENTS**

## Current Testing Context

- Test framework: !`find . -name "jest.config.*" -o -name "*.test.*" | head -1 && echo "Jest/Vitest detected" || echo "Detect framework"`
- Target file: Analysis of $ARGUMENTS for test requirements and complexity
- Project patterns: !`find . -name "*.test.*" -o -name "*.spec.*" | head -3` existing test patterns
- Coverage setup: !`grep -l "coverage" package.json jest.config.* 2>/dev/null | head -1 || echo "Setup needed"`

## Task

Execute comprehensive test writing with framework-specific optimizations and best practices:

**Test Focus**: Use $ARGUMENTS to specify target file, unit tests, integration tests, e2e tests, or component tests

**Test Writing Framework**:
1. **Code Analysis** - Analyze target code structure, identify testable functions, assess dependency complexity, evaluate edge cases
2. **Test Strategy Design** - Plan test organization, design test hierarchies, identify mock requirements, optimize test isolation
3. **Framework Integration** - Setup framework-specific patterns, configure test utilities, implement proper assertions, optimize test performance
4. **Mock Implementation** - Design dependency mocks, implement test doubles, create factory functions, setup async handling
5. **Test Case Generation** - Write unit tests, integration tests, edge cases, error scenarios, performance tests, snapshot tests
6. **Quality Assurance** - Ensure test maintainability, optimize execution speed, validate coverage, implement proper cleanup

**Advanced Features**: Property-based testing, contract testing, visual regression testing, accessibility testing, performance benchmarking.

**Framework Support**: Jest/Vitest, React Testing Library, Vue Test Utils, Angular TestBed, Cypress, Playwright integration.

**Output**: Comprehensive test suite with unit tests, integration tests, proper mocking, test utilities, and coverage optimization.