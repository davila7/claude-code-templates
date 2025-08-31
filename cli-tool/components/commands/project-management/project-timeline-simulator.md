---
allowed-tools: Read, Bash, Grep, Glob
argument-hint: [project-type] | --duration | --team-size | --risk-level
description: Simulate project outcomes with variable modeling, risk assessment, and resource optimization
model: sonnet
---

# Project Timeline Simulator

Simulate project outcomes with comprehensive variable modeling and risk assessment: **$ARGUMENTS**

## Current Project Context

- Project type: Based on $ARGUMENTS or codebase analysis
- Team capacity: !`git shortlog -sn --since="90 days ago" | wc -l` contributors
- Velocity data: !`git log --oneline --since="30 days ago" | wc -l` commits/month
- Risk indicators: @RISKS.md or project documentation

## Task

Generate comprehensive project timeline simulations with multiple scenarios:

**Simulation Framework**:
1. **Variable Modeling** - Team capacity, skill levels, external dependencies, technical complexity
2. **Scenario Generation** - Baseline, optimistic, pessimistic, and disruption scenarios
3. **Risk Assessment** - Technical, resource, business, and external risk factors
4. **Resource Optimization** - Team allocation, budget distribution, timeline buffers
5. **Decision Points** - Milestone gates, adaptation triggers, contingency activation

**Output Deliverables**:
- Timeline prediction ranges with confidence intervals
- Critical path analysis and dependency mapping
- Risk-adjusted resource allocation recommendations
- Early warning indicators and decision triggers
- Monte Carlo simulation results with probability distributions

**Success Optimization**: Multi-objective optimization for time, quality, and resource efficiency.