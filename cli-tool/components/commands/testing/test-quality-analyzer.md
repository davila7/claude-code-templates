---
allowed-tools: Read, Write, Edit, Bash
argument-hint: [analysis-type] | --coverage-quality | --test-effectiveness | --maintainability | --performance-analysis
description: Analyze test suite quality with comprehensive metrics and improvement recommendations
model: sonnet
---

# Test Quality Analyzer

Analyze test suite quality with comprehensive metrics and actionable improvement insights: **$ARGUMENTS**

## Current Quality Context

- Test coverage: !`find . -name "coverage" -type d | head -1 && echo "Coverage data available" || echo "No coverage data"`
- Test files: !`find . -name "*.test.*" -o -name "*.spec.*" | wc -l` test files
- Test complexity: Analysis of test suite maintainability and effectiveness patterns
- Performance metrics: Current test execution times and resource utilization

## Task

Execute comprehensive test quality analysis with improvement recommendations and optimization strategies:

**Analysis Type**: Use $ARGUMENTS to focus on coverage quality, test effectiveness, maintainability analysis, or performance analysis

**Test Quality Analysis Framework**:
1. **Coverage Quality Assessment** - Analyze coverage depth, evaluate coverage quality, assess edge case handling, identify coverage gaps
2. **Test Effectiveness Evaluation** - Measure defect detection capability, analyze test reliability, assess assertion quality, evaluate test value
3. **Maintainability Analysis** - Evaluate test code quality, analyze test organization, assess refactoring needs, optimize test structure
4. **Performance Assessment** - Analyze execution performance, identify bottlenecks, optimize test speed, reduce resource consumption
5. **Anti-Pattern Detection** - Identify testing anti-patterns, detect flaky tests, analyze test smells, recommend corrections
6. **Quality Metrics Tracking** - Implement quality scoring, track improvement trends, configure quality gates, optimize quality processes

**Advanced Features**: AI-powered quality assessment, predictive quality modeling, automated improvement suggestions, quality trend analysis, benchmark comparison.

**Quality Insights**: Test ROI analysis, quality correlation analysis, maintenance cost assessment, effectiveness benchmarking.

**Output**: Comprehensive quality analysis with detailed metrics, improvement recommendations, optimization strategies, and quality tracking framework.