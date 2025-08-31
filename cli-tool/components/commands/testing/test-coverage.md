---
allowed-tools: Read, Write, Edit, Bash
argument-hint: [coverage-type] | --line | --branch | --function | --statement | --report
description: Analyze and improve test coverage with comprehensive reporting and gap identification
model: sonnet
---

# Test Coverage

Analyze and improve test coverage with detailed reporting and gap analysis: **$ARGUMENTS**

## Current Coverage Context

- Test framework: !`find . -name "jest.config.*" -o -name ".nycrc*" -o -name "coverage.xml" | head -1 || echo "Detect framework"`
- Coverage tools: !`npm ls nyc jest @jest/core 2>/dev/null | grep -E "nyc|jest" | head -2 || echo "No JS coverage tools"`
- Existing coverage: !`find . -name "coverage" -type d | head -1 && echo "Coverage data exists" || echo "No coverage data"`
- Test files: !`find . -name "*.test.*" -o -name "*.spec.*" | wc -l` test files

## Task

Execute comprehensive coverage analysis with improvement recommendations and reporting:

**Coverage Type**: Use $ARGUMENTS to focus on line coverage, branch coverage, function coverage, statement coverage, or comprehensive reporting

**Coverage Analysis Framework**:
1. **Coverage Tool Setup** - Configure appropriate tools (Jest, NYC, Istanbul, Coverage.py, JaCoCo), setup collection settings, optimize performance, enable reporting
2. **Coverage Measurement** - Generate line coverage, branch coverage, function coverage, statement coverage reports, identify uncovered code paths
3. **Gap Analysis** - Identify critical uncovered paths, analyze coverage quality, assess business logic coverage, evaluate edge case handling
4. **Threshold Management** - Configure coverage thresholds, implement quality gates, setup trend monitoring, enforce minimum standards
5. **Reporting & Visualization** - Generate detailed reports, create coverage dashboards, implement trend analysis, setup automated notifications
6. **Improvement Planning** - Prioritize coverage gaps, recommend test additions, identify refactoring opportunities, plan coverage enhancement

**Advanced Features**: Differential coverage analysis, coverage trend monitoring, integration with code review, automated coverage alerts, performance impact assessment.

**Quality Insights**: Coverage quality assessment, test effectiveness analysis, maintainability correlation, risk area identification.

**Output**: Comprehensive coverage analysis with detailed reports, gap identification, improvement recommendations, and quality metrics tracking.