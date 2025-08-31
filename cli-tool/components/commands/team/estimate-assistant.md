---
allowed-tools: Read, Bash, Glob, Grep
argument-hint: [task-description] | --historical | --complexity-analysis | --team-velocity | --confidence-intervals
description: Generate accurate task estimates using historical data, complexity analysis, and team velocity metrics
model: sonnet
---

# Estimate Assistant

Generate data-driven task estimates with confidence intervals and accuracy tracking: **$ARGUMENTS**

## Current Estimation Context

- Team velocity: !`git log --oneline --since='1 month ago' | wc -l` commits in last month
- Historical data: Git history analysis for similar task completion patterns
- Code complexity: !`find . -name "*.js" -o -name "*.ts" -o -name "*.py" | head -5 | xargs wc -l 2>/dev/null | tail -1 || echo "No code files"`
- Sprint tracking: Linear task completion times and estimate accuracy

## Task

Execute comprehensive task estimation with historical analysis and confidence modeling:

**Estimation Focus**: Use $ARGUMENTS for task description analysis, historical pattern matching, complexity assessment, or team velocity calculation

**Estimation Framework**:
1. **Historical Pattern Analysis** - Analyze similar past tasks, extract completion time patterns, identify velocity trends, calculate accuracy metrics
2. **Complexity Assessment** - Evaluate technical complexity, assess scope uncertainty, identify risk factors, estimate effort distribution
3. **Team Velocity Integration** - Calculate sprint velocity, analyze individual capacity, assess team expertise, factor in availability constraints
4. **Confidence Modeling** - Generate confidence intervals, assess estimation uncertainty, identify risk factors, provide accuracy ranges
5. **Calibration Analysis** - Compare past estimates vs actuals, identify systematic biases, calculate estimation accuracy, improve prediction models
6. **Context Integration** - Factor in current sprint load, assess team familiarity, evaluate external dependencies, integrate deadline pressure

**Advanced Features**: Multi-point estimation, Monte Carlo simulation, reference class forecasting, estimation accuracy tracking, bias correction algorithms.

**Quality Metrics**: Estimation confidence levels, accuracy historical trends, velocity stability, complexity correlation analysis.

**Output**: Data-driven estimates with confidence intervals, historical accuracy metrics, risk assessment, and calibration recommendations.