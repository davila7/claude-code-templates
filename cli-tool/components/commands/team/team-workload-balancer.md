---
allowed-tools: Read, Bash, Grep, Glob
argument-hint: [analysis-type] | --current-workload | --skill-matching | --capacity-planning | --assignment-optimization
description: Analyze and optimize team workload distribution with skill matching and capacity planning
model: sonnet
---

# Team Workload Balancer

Analyze and optimize team workload distribution with intelligent assignment recommendations: **$ARGUMENTS**

## Current Team Context

- Team size: !`git log --format='%ae' --since='1 month ago' | sort -u | wc -l` active team members
- Active tasks: Linear MCP query for current sprint tasks and assignments
- Recent activity: !`git log --oneline --since='1 week ago' | wc -l` commits in last week
- Capacity metrics: Analysis of team velocity and individual contribution patterns

## Task

Execute comprehensive workload analysis with intelligent assignment optimization:

**Analysis Type**: Use $ARGUMENTS to focus on current workload assessment, skill matching, capacity planning, or assignment optimization

**Workload Balancing Framework**:
1. **Current Workload Assessment** - Analyze task distribution, evaluate individual capacity, assess deadline pressure, identify overloaded team members
2. **Skill Matching Analysis** - Map team member expertise, identify skill gaps, assess learning opportunities, optimize skill utilization
3. **Capacity Planning** - Calculate available capacity, project future workload, plan skill development, optimize resource allocation
4. **Performance Integration** - Analyze historical performance, identify productivity patterns, assess collaboration effectiveness, factor in availability constraints
5. **Assignment Optimization** - Generate optimal task assignments, balance workload distribution, maximize skill utilization, minimize bottlenecks
6. **Risk Mitigation** - Identify single points of failure, plan cross-training, assess knowledge distribution, ensure backup coverage

**Advanced Features**: Predictive workload modeling, skill gap analysis, burnout prevention, performance-based assignment, dynamic rebalancing recommendations.

**Quality Metrics**: Workload distribution equity, skill utilization efficiency, team satisfaction indicators, delivery predictability measures.

**Output**: Comprehensive workload analysis with optimized assignments, capacity recommendations, skill development plans, and team health insights.