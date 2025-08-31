---
allowed-tools: Bash, Read, Grep, Glob
argument-hint: [time-period] | --sprint | --quarter | --all
description: Track and analyze project milestone progress with predictive analytics
model: sonnet
---

# Milestone Tracker

Track and monitor project milestone progress with comprehensive analytics: **$ARGUMENTS**

## Current Project Context

- Project activity: !`git log --oneline --since="30 days ago" | wc -l` commits
- Active branches: !`git branch -r | wc -l` remote branches
- Recent releases: !`git tag -l --sort=-creatordate | head -5`
- Milestone data: @.github/milestones/ or Linear integration

## Task

Generate comprehensive milestone tracking report analyzing project delivery progress:

**Time Period**: Use $ARGUMENTS or default to current sprint/quarter

**Analysis Dimensions**:
1. **Milestone Progress Tracking**
   - Current milestone completion rates
   - Velocity trends and burn-down analysis
   - Critical path identification
   - Dependency mapping and risk assessment

2. **Predictive Analytics**
   - Completion date predictions with confidence intervals
   - Risk-adjusted timeline recommendations
   - Resource allocation optimization
   - Scenario planning (what-if analysis)

3. **Health Indicators**
   - Schedule adherence metrics
   - Team capacity utilization
   - Blocker identification and impact
   - Quality vs delivery balance

**Output**: Interactive milestone dashboard with visual progress indicators, predictive analytics, risk assessments, and actionable recommendations for milestone delivery optimization.