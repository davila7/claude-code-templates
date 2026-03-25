# Orchestration Archive Command

Properly archive completed orchestrations while preserving valuable data, metrics, and lessons learned for future reference.

## Usage

```
/orchestration/archive [options]
```

## Description

Manages the archival process for completed orchestrations, extracting insights, preserving critical data, and organizing historical information for future analysis and learning.

## Basic Commands

### Archive Completed Orchestrations
```
/orchestration/archive
```
Identifies and archives all fully completed orchestrations automatically.

### Archive Specific Orchestration
```
/orchestration/archive --date 03_15_2024 --project auth_system
```
Archives a specific orchestration with full data preservation.

### Archive with Analysis
```
/orchestration/archive --analyze
```
Performs comprehensive analysis before archiving, extracting lessons learned.

## Archival Process

### Pre-Archive Analysis
```
## Pre-Archive Analysis for: auth_system (03_15_2024)

Completion Status:
- Total Tasks: 24 (24 completed, 0 active)
- Duration: 8 days (estimated: 6 days)
- Final Velocity: 3.0 tasks/day
- Quality Score: 92% (2 QA iterations avg)

Outstanding Items:
- No active tasks
- No blocked dependencies
- Git branches: 3 merged, 0 pending
- Documentation: Complete

Ready for Archive: ✓
```

### Data Extraction
```
## Extracting Archive Data

Performance Metrics:
✓ Task completion times
✓ Velocity calculations  
✓ Quality metrics
✓ Resource utilization
✓ Dependency patterns

Project Artifacts:
✓ All task files and metadata
✓ Git commit history correlation
✓ Status transition logs
✓ Agent assignment patterns

Learning Points:
✓ What worked well
✓ Pain points and bottlenecks
✓ Estimation accuracy
✓ Team collaboration insights
```

### Archive Structure
```
/archived-orchestrations/
└── 2024/
    └── Q1/
        └── 03_15_2024_auth_system/
            ├── ARCHIVE-SUMMARY.md
            ├── LESSONS-LEARNED.md
            ├── METRICS-REPORT.json
            ├── original-files/
            │   ├── MASTER-COORDINATION.md
            │   ├── EXECUTION-TRACKER.md
            │   ├── TASK-STATUS-TRACKER.yaml
            │   └── tasks/
            ├── analytics/
            │   ├── velocity-chart.png
            │   ├── dependency-graph.svg
            │   └── timeline-visualization.html
            └── git-correlation/
                ├── commit-task-mapping.json
                └── branch-analysis.md
```

## Archive Options

### Quick Archive
```
/orchestration/archive --quick
```
Fast archival without detailed analysis, suitable for simple orchestrations.

### Deep Analysis Archive
```
/orchestration/archive --deep-analysis
```
Comprehensive analysis including:
- Detailed performance metrics
- Pattern recognition
- Predictive insights
- Comparative analysis with similar projects

### Selective Archive
```
/orchestration/archive --include tasks,metrics --exclude original-files
```
Custom archive content selection.

## Analysis Features

### Performance Analysis
```
## Performance Analysis Summary

Velocity Analysis:
- Peak velocity: 4.2 tasks/day (Day 3)
- Average velocity: 3.0 tasks/day
- Velocity trend: Stable with 15% improvement over time

Task Metrics:
- Average task duration: 3.8h (vs 4.0h estimated)
- Estimation accuracy: 87% (excellent)
- Most accurate estimates: Backend tasks (95%)
- Least accurate estimates: UI tasks (72%)

Quality Metrics:
- First-pass QA success: 78%
- Average QA iterations: 1.3
- Zero critical bugs in production
- Documentation completeness: 95%
```

### Team Performance
```
## Team Performance Insights

Agent Effectiveness:
┌─────────────────┬──────────────┬─────────────┬──────────────┐
│ Agent           │ Tasks Done   │ Avg Duration│ Quality Score│
├─────────────────┼──────────────┼─────────────┼──────────────┤
│ dev-backend     │ 12 tasks     │ 3.2h        │ 94%          │
│ dev-frontend    │ 8 tasks      │ 4.1h        │ 89%          │
│ qa-engineer     │ 4 reviews    │ 1.5h        │ 96%          │
│ test-developer  │ 6 tasks      │ 2.8h        │ 91%          │
└─────────────────┴──────────────┴─────────────┴──────────────┘

Collaboration Patterns:
- Cross-functional tasks: 20% of total
- Pair programming events: 8 instances
- Knowledge transfer sessions: 3 sessions
- Optimal team size: 4 agents (confirmed)
```

### Lessons Learned Extraction
```
## Lessons Learned

What Worked Well:
1. Early dependency identification prevented major blocks
2. JWT implementation pattern reusable for future auth projects
3. Parallel testing approach reduced QA bottlenecks
4. Daily standup format kept team aligned

Pain Points:
1. OAuth provider documentation was incomplete (external factor)
2. Database schema changes mid-project caused 1-day delay
3. Test environment instability affected 3 tasks
4. Frontend-backend API contract unclear initially

Process Improvements:
1. Add API contract review gate before implementation
2. Implement test environment monitoring
3. Create OAuth integration template for future use
4. Add database change impact assessment

Estimation Insights:
- Security tasks consistently underestimated by 25%
- UI tasks with new libraries take 40% longer
- Integration tasks require 20% buffer for external dependencies
- Testing parallel to development saves 30% overall time
```

## Archive Validation

### Completeness Check
```
## Archive Completeness Validation

Required Data:
✓ All 24 task files preserved
✓ Status tracking history complete  
✓ Git commit correlation verified
✓ Performance metrics calculated
✓ Agent assignments recorded

Data Integrity:
✓ No corrupted files detected
✓ Timeline consistency verified
✓ Dependency graph validated
✓ Metrics calculations confirmed

Archive Quality: 100% Complete
```

### Historical Correlation
```
## Historical Correlation Analysis

Similar Projects Comparison:
- user_management (02_20_2024): 85% similar
- payment_system (01_15_2024): 60% similar  
- admin_dashboard (03_01_2024): 45% similar

Performance Comparison:
- This project: 3.0 tasks/day (above average)
- Team average: 2.7 tasks/day
- Best performance: 3.4 tasks/day (payment_system)
- Worst performance: 2.1 tasks/day (admin_dashboard)

Learning Application Opportunities:
- Apply JWT pattern to upcoming mobile_auth project
- Use dependency analysis template for API projects
- Replicate testing strategy for integration-heavy work
```

## Archive Formats

### Standard Archive
```
/orchestration/archive --format standard
```
Creates structured archive with all essential data and analysis.

### Lightweight Archive  
```
/orchestration/archive --format light
```
Minimal archive with key metrics and lessons learned only.

### Research Archive
```
/orchestration/archive --format research
```
Comprehensive archive suitable for academic research or deep analysis.

### Template Archive
```
/orchestration/archive --format template
```
Creates reusable templates from successful patterns.

## Query and Retrieval

### Search Archives
```
/orchestration/archive --search "JWT authentication"
```
Finds archived orchestrations with similar requirements.

### Compare Archives
```
/orchestration/archive --compare 03_15_2024 02_20_2024
```
Detailed comparison between two archived orchestrations.

### Extract Templates
```
/orchestration/archive --extract-template auth_system
```
Creates orchestration template from successful archive.

## Integration Features

### Metrics Dashboard
```
/orchestration/archive --dashboard
```
Generates visual dashboard of archived orchestration metrics.

### Knowledge Base
```
/orchestration/archive --knowledge-base
```
Integrates lessons learned into searchable knowledge base.

### Predictive Analysis
```
/orchestration/archive --predict similar_to:auth_system
```
Uses archived data to predict outcomes for similar future projects.

## Automation Options

### Auto-Archive Completed
```
/orchestration/archive --auto-schedule weekly
```
Automatically archives completed orchestrations weekly.

### Smart Archive Rules
```
/orchestration/archive --rules "age:>30days status:completed"
```
Archives orchestrations meeting specific criteria.

### Archive Notifications
```
/orchestration/archive --notify team@company.com
```
Sends archive completion notifications with key insights.

## Examples

### Example 1: Standard Project Archive
```
/orchestration/archive --date 03_15_2024 --project auth_system --analyze
```

### Example 2: Batch Archive Completed
```
/orchestration/archive --all-completed --since "last month"
```

### Example 3: Create Project Template
```
/orchestration/archive --date 03_15_2024 --create-template auth_pattern
```

### Example 4: Research Analysis
```
/orchestration/archive --search "authentication" --analyze-patterns
```

## Storage Management

### Archive Location
```
Default: ./archived-orchestrations/
Custom: /orchestration/archive --location /shared/archives/
```

### Compression Options
```
/orchestration/archive --compress high
```
Reduces storage requirements while preserving data integrity.

### Retention Policies
```
/orchestration/archive --retention "keep:2years delete:metrics-only"
```

## Best Practices

1. **Archive Regularly**: Don't let completed orchestrations accumulate
2. **Analyze Before Archive**: Extract maximum learning value
3. **Preserve Context**: Include sufficient context for future reference
4. **Template Creation**: Convert successful patterns to templates
5. **Team Review**: Share insights before archiving
6. **Search Optimization**: Use consistent tagging and keywords

## Configuration

### Archive Settings
```yaml
archive:
  auto_archive_after: "30 days"
  analysis_depth: "standard"
  preserve_git_history: true
  create_visualizations: true
  retention_period: "2 years"
  compression_level: "medium"
```

## Recovery Options

### Restore from Archive
```
/orchestration/archive --restore 03_15_2024_auth_system
```
Restores archived orchestration to active state (rare use case).

### Extract Specific Data
```
/orchestration/archive --extract metrics 03_15_2024_auth_system
```
Retrieves specific data from archived orchestration.

## Notes

- Archived orchestrations are read-only by default
- All archive operations are logged for audit purposes
- Archive analysis improves over time with machine learning
- Templates created from archives are immediately usable
- Archived data contributes to predictive orchestration models
- Integration with external backup systems supported