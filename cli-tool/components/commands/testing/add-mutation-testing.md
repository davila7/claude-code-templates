---
allowed-tools: Read, Write, Edit, Bash
argument-hint: [language] | --javascript | --java | --python | --rust | --go | --csharp
description: Setup comprehensive mutation testing with framework selection and CI integration
model: sonnet
---

# Add Mutation Testing

Setup mutation testing framework with quality metrics and CI integration: **$ARGUMENTS**

## Current Testing Context

- Language: !`find . -name "*.js" -o -name "*.ts" | head -1 >/dev/null && echo "JavaScript/TypeScript" || find . -name "*.py" | head -1 >/dev/null && echo "Python" || find . -name "*.java" | head -1 >/dev/null && echo "Java" || echo "Multi-language"`
- Test coverage: !`find . -name "coverage" -o -name ".nyc_output" | head -1 || echo "No coverage data"`
- Test framework: !`grep -l "jest\\|mocha\\|pytest\\|junit" package.json pom.xml setup.py 2>/dev/null | head -1 || echo "Detect from tests"`
- CI system: !`find . -name ".github" -o -name ".gitlab-ci.yml" -o -name "Jenkinsfile" | head -1 || echo "No CI detected"`

## Task

Implement comprehensive mutation testing with framework optimization and quality gates:

**Language Focus**: Use $ARGUMENTS to specify JavaScript, Java, Python, Rust, Go, C#, or auto-detect from codebase

**Mutation Testing Framework**:
1. **Tool Selection & Setup** - Choose framework (Stryker, PIT, mutmut, cargo-mutants), install dependencies, configure basic settings, validate installation
2. **Mutation Operator Configuration** - Configure arithmetic operators, relational operators, logical operators, conditional boundaries, statement mutations
3. **Performance Optimization** - Setup parallel execution, configure incremental testing, optimize file filtering, implement caching strategies
4. **Quality Metrics** - Configure mutation score calculation, setup survival analysis, implement threshold enforcement, track effectiveness trends
5. **CI/CD Integration** - Automate execution triggers, configure performance monitoring, setup result reporting, implement deployment gates
6. **Result Analysis** - Setup visualization dashboards, configure surviving mutant analysis, implement remediation workflows, track regression patterns

**Advanced Features**: Selective mutation testing, performance profiling, automated test improvement suggestions, mutation trend analysis, quality gate integration.

**Framework Support**: Language-specific optimizations, tool ecosystem integration, performance tuning, reporting customization.

**Output**: Complete mutation testing setup with configured framework, CI integration, quality thresholds, and analysis workflows.