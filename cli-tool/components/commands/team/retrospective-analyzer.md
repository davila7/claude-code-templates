---
allowed-tools: Read, Write, Bash, Glob
argument-hint: [sprint-identifier] | --metrics | --insights | --action-items | --trends
description: Analyze team retrospectives with quantitative metrics and actionable insights generation
model: sonnet
---

# Retrospective Analyzer

Analyze team retrospectives with comprehensive metrics and actionable improvement insights: **$ARGUMENTS**

## Current Retrospective Context

- Sprint period: !`git log --oneline --since='2 weeks ago' | wc -l` commits in recent sprint
- Team activity: Analysis of recent collaboration patterns and productivity metrics
- Linear sprint: Current sprint data and completion metrics from Linear MCP
- Previous retrospectives: Historical retrospective data and improvement tracking

## Task

Execute comprehensive retrospective analysis with quantitative insights and improvement recommendations:

**Analysis Focus**: Use $ARGUMENTS to specify sprint identifier, quantitative metrics, insight generation, action item tracking, or trend analysis

**Retrospective Analysis Framework**:
1. **Sprint Performance Analysis** - Analyze velocity trends, completion rates, cycle time metrics, quality indicators
2. **Team Collaboration Assessment** - Evaluate communication patterns, code review effectiveness, knowledge sharing, pair programming impact
3. **Process Effectiveness** - Assess meeting efficiency, planning accuracy, impediment resolution, workflow optimization
4. **Quality Metrics** - Analyze bug rates, technical debt accumulation, code review quality, testing effectiveness
5. **Individual Contribution** - Evaluate workload distribution, skill development, mentorship activities, cross-training progress
6. **Actionable Insights Generation** - Identify improvement opportunities, prioritize action items, track progress, measure impact

**Advanced Features**: Trend analysis across multiple sprints, predictive performance modeling, team satisfaction correlation, continuous improvement tracking.

**Insight Quality**: Data-driven recommendations, quantified improvement potential, implementation feasibility, success measurement criteria.

**Output**: Comprehensive retrospective analysis with quantitative metrics, actionable insights, prioritized improvements, and progress tracking framework.