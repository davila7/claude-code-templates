---
allowed-tools: Read, Write, Edit, Bash
argument-hint: [orchestration-type] | --parallel | --sequential | --conditional | --pipeline-optimization
description: Orchestrate comprehensive test automation with intelligent execution and optimization
---

# Test Automation Orchestrator

Orchestrate intelligent test automation with execution optimization and resource management: **$ARGUMENTS**

## Current Orchestration Context

- Test suites: !`find . -name "*.test.*" -o -name "*.spec.*" | wc -l` test files across project
- Test frameworks: !`find . -name "jest.config.*" -o -name "cypress.config.*" -o -name "playwright.config.*" | wc -l` configured frameworks
- CI system: !`find . -name ".github" -o -name ".gitlab-ci.yml" | head -1 || echo "No CI detected"`
- Resource usage: Analysis of current test execution patterns and performance

## Task

Implement intelligent test orchestration with execution optimization and resource management:

**Orchestration Type**: Use $ARGUMENTS to focus on parallel execution, sequential execution, conditional testing, or pipeline optimization

**Test Orchestration Framework**:

1. **Test Discovery & Classification** - Analyze test suites, classify test types, assess execution requirements, optimize categorization
2. **Execution Strategy Design** - Design parallel execution strategies, implement intelligent batching, optimize resource allocation, configure conditional execution
3. **Dependency Management** - Analyze test dependencies, implement execution ordering, configure prerequisite validation, optimize dependency resolution
4. **Resource Optimization** - Configure parallel execution, implement resource pooling, optimize memory usage, design scalable execution
5. **Pipeline Integration** - Design CI/CD integration, implement stage orchestration, configure failure handling, optimize feedback loops
6. **Monitoring & Analytics** - Implement execution monitoring, configure performance tracking, design failure analysis, optimize reporting

**Advanced Features**: AI-driven test selection, predictive execution optimization, dynamic resource allocation, intelligent failure recovery, cost optimization.

**Quality Assurance**: Execution reliability, performance consistency, resource efficiency, maintainability optimization.

**Output**: Complete test orchestration system with optimized execution, intelligent resource management, comprehensive monitoring, and performance analytics.
