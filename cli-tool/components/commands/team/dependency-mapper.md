---
allowed-tools: Read, Glob, Grep, Bash
argument-hint: [scope] | --tasks | --code | --circular | --critical-path
description: Map project and task dependencies with critical path analysis and circular dependency detection
model: sonnet
---

# Dependency Mapper

Map and analyze project dependencies with task ordering optimization: **$ARGUMENTS**

## Current Dependency Context

- Repository: !`gh repo view --json nameWithOwner -q .nameWithOwner 2>/dev/null || echo "No repo context"`
- Project files: !`find . -name "*.js" -o -name "*.ts" -o -name "*.py" | wc -l` code files analyzed
- Task tracking: Linear MCP server connectivity and task relationship data
- Import analysis: Code dependency structure and circular dependency detection

## Task

Execute comprehensive dependency analysis with optimization recommendations:

**Analysis Scope**: Use $ARGUMENTS to focus on task dependencies, code dependencies, circular dependency detection, or critical path analysis

**Dependency Analysis Framework**:
1. **Code Dependency Mapping** - Extract import statements, analyze module relationships, identify coupling levels, map file interdependencies
2. **Task Relationship Analysis** - Query Linear task dependencies, extract task mentions, analyze project relationships, map epic structures
3. **Dependency Graph Construction** - Build comprehensive graph structure, identify dependency chains, calculate critical paths, detect bottlenecks
4. **Circular Dependency Detection** - Implement cycle detection algorithms, identify problematic loops, assess impact severity, recommend resolution strategies
5. **Execution Order Optimization** - Calculate topological sort, optimize task sequence, balance team capacity, minimize blocking dependencies
6. **Risk Assessment** - Identify high-risk chains, assess single points of failure, evaluate dependency complexity, recommend mitigation strategies

**Advanced Features**: Visual dependency graphs, ASCII tree representations, impact analysis, sprint planning optimization, real-time dependency tracking.

**Quality Insights**: Dependency health metrics, coupling analysis, maintainability assessment, team workload distribution.

**Output**: Complete dependency analysis with visual representations, execution order recommendations, risk mitigation strategies, and optimization roadmap.