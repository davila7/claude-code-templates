# Orchestration Optimize Command

Analyze and optimize task orchestrations to improve efficiency, reduce bottlenecks, and maximize team productivity.

## Usage

```
/orchestration/optimize [options]
```

## Description

Performs comprehensive analysis of active and historical orchestrations to identify optimization opportunities, suggest workflow improvements, and provide actionable insights for better task management.

## Basic Commands

### Analyze Current Orchestration
```
/orchestration/optimize
```
Analyzes the most recently active orchestration for bottlenecks and inefficiencies.

### Optimize Specific Orchestration
```
/orchestration/optimize --date 03_15_2024 --project auth_system
```
Deep analysis of a specific orchestration with detailed recommendations.

### Performance Analysis
```
/orchestration/optimize --performance
```
Focuses on timing, velocity, and resource utilization metrics.

### Dependency Optimization
```
/orchestration/optimize --dependencies
```
Analyzes task dependencies for parallelization opportunities.

## Analysis Areas

### Bottleneck Detection
```
## Identified Bottlenecks

Critical Path Analysis:
- TASK-003 (JWT validation): Blocking 4 downstream tasks
- Duration: 5.5h (150% of estimate)
- Impact: 12h of parallel work delayed

Queue Analysis:
- on_hold queue: 6 tasks (avg 2.3 days waiting)
- QA queue: 3 tasks (avg 8h waiting)
- Recommendation: Add QA capacity or parallel testing

Resource Constraints:
- dev-backend: 3 active tasks (overloaded)
- dev-frontend: 0 active tasks (underutilized)
- Suggestion: Cross-train or reassign suitable tasks
```

### Velocity Metrics
```
## Velocity Analysis

Current Metrics:
- Tasks/day: 2.1 (target: 3.0)
- Avg task duration: 4.2h (vs 3.5h estimate)
- Status transitions: todos→in_progress (2h avg wait)

Historical Comparison:
- Last week: 2.8 tasks/day (33% faster)
- Best week: 3.4 tasks/day (optimal conditions)

Trending Issues:
- Estimate accuracy declining (65% vs 80% last month)
- QA feedback loop increased by 40%
```

### Dependency Analysis
```
## Dependency Optimization

Parallelization Opportunities:
1. TASK-007, TASK-008 can run concurrently with TASK-003
   Potential time saving: 6 hours

2. Frontend tasks independent of current backend work
   Parallelizable: TASK-009, TASK-010, TASK-011

Critical Path Optimization:
- Current: 24 hours (sequential)
- Optimized: 16 hours (parallel execution)
- Savings: 8 hours (33% improvement)

Dependency Simplification:
- Remove false dependency: TASK-012 → TASK-004
- Merge related tasks: TASK-014 + TASK-015
```

## Optimization Strategies

### Resource Reallocation
```
/orchestration/optimize --rebalance
```

Suggests optimal task assignments:
```
## Recommended Resource Changes

Current Load:
┌─────────────────┬────────────┬─────────────┬────────────┐
│ Agent           │ Active     │ Queue       │ Utilization│
├─────────────────┼────────────┼─────────────┼────────────┤
│ dev-backend     │ 3 tasks    │ 2 tasks     │ 180%       │
│ dev-frontend    │ 0 tasks    │ 4 tasks     │ 0%         │
│ qa-engineer     │ 2 tasks    │ 1 task      │ 120%       │
│ test-developer  │ 1 task     │ 0 tasks     │ 60%        │
└─────────────────┴────────────┴─────────────┴────────────┘

Recommendations:
1. Move TASK-007 (API tests) to test-developer
2. Assign TASK-009 (UI components) to dev-frontend
3. Split TASK-003 into backend/frontend components
```

### Task Restructuring
```
/orchestration/optimize --restructure
```

Suggests task modifications:
```
## Task Restructuring Opportunities

Oversized Tasks (>6h estimate):
- TASK-003: JWT validation (8h) 
  → Split: JWT core (4h) + JWT middleware (3h) + Tests (1h)

Undersized Tasks (<1h estimate):
- TASK-011: Update config (0.5h)
- TASK-012: Fix typos (0.25h)
  → Merge into maintenance batch

Mislabeled Dependencies:
- TASK-008 doesn't actually need TASK-003
  → Remove dependency, add to parallel execution
```

### Workflow Improvements
```
/orchestration/optimize --workflow
```

Process optimization suggestions:
```
## Workflow Optimization

Status Transition Delays:
- todos → in_progress: 4.2h avg (target: <2h)
- in_progress → qa: 1.2h avg (good)
- qa → completed: 6.8h avg (target: <4h)

Recommendations:
1. Implement auto-assignment rules
2. Add QA capacity during peak hours
3. Create task preparation checklist

Communication Improvements:
- 23% of blocks due to unclear requirements
- 15% of QA failures from missing context
- Add requirement review gate before in_progress
```

## Historical Analysis

### Trend Analysis
```
/orchestration/optimize --trends --days 30
```

Shows performance trends:
```
## 30-Day Performance Trends

Velocity Trend: ↓ -15%
- Week 1: 3.2 tasks/day
- Week 2: 2.9 tasks/day  
- Week 3: 2.8 tasks/day
- Week 4: 2.7 tasks/day

Quality Trend: ↓ -8%
- QA rejection rate increasing
- Rework time per task up 12%

Efficiency Indicators:
- Estimate accuracy: 68% (down from 78%)
- Parallel execution rate: 45% (up from 40%)
- Blocked task duration: 1.8 days avg (up from 1.2 days)
```

### Pattern Recognition
```
## Identified Patterns

Task Types Performance:
- Features: 3.2h avg (close to estimates)
- Bugfixes: 2.1h avg (underestimated by 40%)
- Tests: 1.8h avg (overestimated by 20%)
- Security: 5.1h avg (significantly underestimated)

Time-of-Day Patterns:
- Morning starts: 25% faster completion
- Post-lunch blocks: 40% more likely
- End-of-day QA: 60% higher failure rate

Agent Specialization:
- dev-backend: 2x faster on API tasks
- dev-frontend: 30% faster on UI tasks
- Cross-functional tasks: 50% slower than specialized
```

## Optimization Actions

### Immediate Actions
```
/orchestration/optimize --execute immediate
```

Applies safe optimizations:
1. Rebalance current task assignments
2. Remove identified false dependencies
3. Update task estimates based on historical data
4. Reschedule blocked tasks

### Structural Changes
```
/orchestration/optimize --execute structural --confirm
```

Requires confirmation for:
1. Task splitting/merging
2. Workflow process changes
3. Agent role modifications
4. Dependency restructuring

### Continuous Optimization
```
/orchestration/optimize --schedule daily
```

Sets up automated optimization:
- Daily velocity monitoring
- Weekly bottleneck analysis
- Monthly trend reporting
- Automated rebalancing suggestions

## Simulation Mode

### What-If Analysis
```
/orchestration/optimize --simulate "add agent:dev-fullstack"
```

Projects impact of changes:
```
## Simulation Results: Adding dev-fullstack

Projected Improvements:
- Velocity: 2.7 → 3.4 tasks/day (+26%)
- Critical path: 24h → 18h (-25%)
- Queue time: 4.2h → 2.1h (-50%)

Resource Utilization:
- Backend overload: 180% → 120% (optimal)
- Frontend underload: 0% → 80% (good)
- Overall efficiency: +35%

ROI Analysis:
- Cost: +1 team member
- Delivery speed: +26%
- Quality impact: Neutral to positive
```

## Integration Features

### Automated Optimization
```
/orchestration/optimize --auto-apply --threshold conservative
```

Automatically applies optimizations meeting conservative safety criteria.

### Notification System
```
/orchestration/optimize --alerts bottleneck,velocity,quality
```

Sets up alerts for optimization opportunities.

### Historical Learning
```
/orchestration/optimize --learn-from previous_projects/
```

Incorporates lessons from past orchestrations.

## Reporting

### Optimization Report
```
/orchestration/optimize --report detailed
```

Generates comprehensive optimization report with:
- Current state analysis
- Identified opportunities  
- Recommended actions
- Expected impact metrics
- Implementation timeline

### Executive Summary
```
/orchestration/optimize --summary executive
```

High-level optimization insights for leadership.

## Best Practices

1. **Regular Analysis**: Run optimization weekly on active orchestrations
2. **Incremental Changes**: Apply optimizations gradually to measure impact
3. **Monitor Impact**: Track metrics before and after optimization
4. **Team Communication**: Share optimization insights with the team
5. **Continuous Learning**: Use historical data to improve future orchestrations

## Examples

### Example 1: Daily Optimization Check
```
/orchestration/optimize --quick --auto-rebalance
```

### Example 2: Deep Analysis for Struggling Project
```
/orchestration/optimize --date 03_15_2024 --project auth_system --deep-analysis
```

### Example 3: Team Performance Review
```
/orchestration/optimize --trends --days 90 --team-focus
```

## Configuration

### Optimization Rules
Set in orchestration config:
```yaml
optimization:
  auto_rebalance: true
  bottleneck_threshold: 2h
  velocity_target: 3.0
  quality_threshold: 85%
  parallel_execution_target: 60%
```

## Notes

- All optimizations are reversible through audit trail
- Simulation mode allows safe experimentation
- Historical data improves optimization accuracy over time
- Integrates with all other orchestration commands
- Supports custom optimization rules per project type