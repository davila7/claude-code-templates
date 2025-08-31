---
allowed-tools: Read, Bash, Glob, Grep
argument-hint: [analysis-period] | --sprint | --monthly | --quarterly | --trend-analysis
description: Track and analyze team velocity with predictive forecasting and performance optimization recommendations
model: sonnet
---

# Team Velocity Tracker

Track team velocity patterns with predictive forecasting and performance optimization: **$ARGUMENTS**

## Current Velocity Context

- Sprint velocity: !`git log --oneline --since='2 weeks ago' | wc -l` commits per current sprint
- Team consistency: Analysis of velocity stability across recent sprints
- Linear tracking: Sprint point completion rates and story delivery metrics
- Capacity factors: Team size changes, availability, and skill development impact

## Task

Execute comprehensive velocity tracking with predictive analytics and optimization recommendations:

**Analysis Period**: Use $ARGUMENTS to focus on sprint velocity, monthly trends, quarterly patterns, or comprehensive trend analysis

**Velocity Tracking Framework**:
1. **Historical Velocity Analysis** - Extract sprint completion data, analyze story point delivery, calculate team throughput, identify performance patterns
2. **Consistency Assessment** - Measure velocity stability, identify variance patterns, assess predictability factors, evaluate planning accuracy
3. **Capacity Correlation** - Analyze team size impact, assess skill level effects, evaluate availability constraints, measure external factor influence
4. **Predictive Forecasting** - Generate velocity projections, predict sprint outcomes, estimate delivery timelines, calculate confidence intervals
5. **Performance Optimization** - Identify improvement opportunities, recommend capacity adjustments, suggest process enhancements, optimize team composition
6. **Quality Integration** - Correlate velocity with quality metrics, assess technical debt impact, evaluate sustainable pace, measure team satisfaction

**Advanced Features**: Monte Carlo forecasting, velocity trend decomposition, capacity planning optimization, performance anomaly detection, sustainable pace analysis.

**Predictive Analytics**: Sprint outcome predictions, delivery timeline forecasting, capacity requirement planning, performance trend analysis.

**Output**: Comprehensive velocity analysis with predictive forecasts, optimization recommendations, capacity planning insights, and sustainable performance strategies.