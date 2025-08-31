---
allowed-tools: Read, Write, Edit, Bash
argument-hint: [target] | [scope] | --unit | --integration | --edge-cases | --automatic
description: Generate comprehensive test cases with automatic analysis and coverage optimization
model: sonnet
---

# Generate Test Cases

Generate comprehensive test cases with automatic analysis and intelligent coverage: **$ARGUMENTS**

## Current Test Generation Context

- Target code: Analysis of $ARGUMENTS for test case generation requirements
- Test framework: !`find . -name "jest.config.*" -o -name "*.test.*" | head -1 && echo "Jest/Vitest detected" || echo "Detect framework"`
- Code complexity: !`find . -name "*.js" -o -name "*.ts" -o -name "*.py" | xargs wc -l 2>/dev/null | tail -1 | awk '{print $1}' || echo "0"` lines of code
- Existing patterns: !`find . -name "*.test.*" -o -name "*.spec.*" | head -3` test file patterns

## Task

Execute intelligent test case generation with comprehensive coverage and optimization:

**Generation Scope**: Use $ARGUMENTS to specify target file, unit tests, integration tests, edge cases, or automatic comprehensive generation

**Test Case Generation Framework**:
1. **Code Structure Analysis** - Parse function signatures, analyze control flow, identify branching paths, assess complexity metrics
2. **Test Pattern Recognition** - Analyze existing test patterns, identify testing conventions, extract reusable patterns, optimize consistency
3. **Input Space Analysis** - Identify parameter domains, analyze boundary conditions, discover edge cases, evaluate error conditions
4. **Test Case Design** - Generate positive test cases, negative test cases, boundary value tests, equivalence class tests
5. **Mock Strategy Planning** - Identify external dependencies, design mock implementations, create test data factories, optimize test isolation
6. **Coverage Optimization** - Ensure path coverage, optimize test efficiency, eliminate redundancy, maximize testing value

**Advanced Features**: Automatic edge case discovery, intelligent input generation, test data synthesis, coverage gap analysis, performance test generation.

**Quality Assurance**: Test maintainability, execution performance, assertion quality, debugging effectiveness.

**Output**: Comprehensive test case suite with optimized coverage, intelligent mocking, proper assertions, and maintenance guidelines.