---
allowed-tools: Read, Bash, Grep, Glob
argument-hint: [evaluation-period] | --30-days | --sprint | --quarter
description: Analyze overall project health and generate comprehensive metrics report
model: sonnet
---

# Project Health Check

Analyze overall project health and metrics: **$ARGUMENTS**

## Current Project State

- Git activity: !`git log --oneline --since="30 days ago" | wc -l`
- Contributors: !`git shortlog -sn --since="30 days ago" | head -5`
- Branch status: !`git branch -r | wc -l` remote branches
- Code changes: !`git diff --stat HEAD~30 2>/dev/null || echo "Not enough history"`
- Dependencies: @package.json or @requirements.txt or @Cargo.toml (if exists)

## Task

Generate a comprehensive project health report analyzing:

**Evaluation Period**: Use $ARGUMENTS or default to last 30 days

**Health Dimensions**:
1. **Code Quality Metrics**
   - Test coverage and trends
   - Code complexity analysis
   - Security vulnerabilities (run npm audit or equivalent)
   - Technical debt indicators

2. **Delivery Performance**
   - Sprint velocity trends (if task management tools available)
   - Cycle time analysis
   - Bug vs feature ratio
   - On-time delivery metrics

3. **Team Health Indicators**
   - PR review turnaround time
   - Commit frequency distribution
   - Work distribution balance
   - Knowledge concentration risk

4. **Dependency Health**
   - Outdated packages assessment
   - Security audit results
   - License compliance check
   - External service dependencies

**Health Report Format**:
- Overall health score (0-100) with color-coded status
- Executive summary with key findings
- Detailed metrics tables with current vs target values
- Trend analysis and risk assessment
- Actionable recommendations prioritized by impact

**Output**: Generate markdown report with charts, metrics tables, and specific action items for improving project health.