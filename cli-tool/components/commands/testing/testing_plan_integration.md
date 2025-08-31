---
allowed-tools: Read, Write, Edit, Bash
argument-hint: [target-code] | [test-type] | --rust | --inline | --refactoring-suggestions
description: Create comprehensive integration testing plan with inline tests and refactoring recommendations
model: sonnet
---

# Testing Plan Integration

Create integration testing plan with inline test strategy and refactoring suggestions: **$ARGUMENTS**

## Current Testing Context

- Project type: !`[ -f Cargo.toml ] && echo "Rust project" || [ -f package.json ] && echo "Node.js project" || echo "Multi-language project"`
- Test framework: !`find . -name "*.test.*" -o -name "*.spec.*" | head -3` existing tests
- Target code: Analysis of $ARGUMENTS for testability assessment
- Integration complexity: Assessment of component interactions and dependencies

## Task

Execute comprehensive integration testing plan with testability analysis:

**Planning Focus**: Use $ARGUMENTS to specify target code, test type requirements, Rust inline testing, or refactoring suggestions

**Integration Testing Framework**:
1. **Code Testability Analysis** - Analyze target code structure, identify testing challenges, assess coupling levels, evaluate dependency injection
2. **Test Strategy Design** - Design integration test approach, plan inline vs separate test files, identify test boundaries, optimize test isolation
3. **Refactoring Assessment** - Identify testability improvements, suggest dependency injection, recommend interface abstractions, optimize component boundaries
4. **Test Case Planning** - Design integration scenarios, identify critical paths, plan data flow testing, assess error handling coverage
5. **Mock Strategy** - Plan external dependency mocking, design test doubles, identify integration boundaries, optimize test performance
6. **Execution Planning** - Design test execution order, plan test data management, optimize test environment setup, ensure test isolation

**Advanced Features**: Rust-style inline testing, property-based integration tests, contract testing, service virtualization, chaos engineering integration.

**Quality Assurance**: Test maintainability, execution performance, coverage optimization, feedback loop efficiency.

**Output**: Comprehensive integration test plan with test case specifications, refactoring recommendations, implementation strategy, and quality metrics.