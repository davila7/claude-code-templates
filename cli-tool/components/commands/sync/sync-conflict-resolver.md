---
allowed-tools: Read, Write, Edit, Bash
argument-hint: [action] | detect | resolve | analyze | configure | report
description: Resolve synchronization conflicts with intelligent strategies and automated resolution
model: sonnet
---

# Sync Conflict Resolver

Resolve synchronization conflicts with intelligent automation: **$ARGUMENTS**

## Current Conflict State

- Sync database: @.sync-state.json or sync state files with potential conflicts
- Conflict history: !`find . -name "*conflict*" -o -name "*sync-errors*" | wc -l` conflict logs
- Resolution rules: @conflict-rules.json or existing resolution configuration
- Active conflicts: Current unresolved synchronization conflicts requiring attention

## Task

Implement comprehensive conflict resolution with intelligent automation:

**Resolution Action**: Use $ARGUMENTS to specify detect conflicts, resolve using strategies, analyze patterns, configure rules, or generate reports

**Conflict Resolution Framework**:
1. **Conflict Detection** - Scan synchronized items, compare field versions, identify timing conflicts, flag structural issues
2. **Intelligent Resolution** - Apply resolution strategies, handle field merging, preserve critical data, maintain relationships
3. **Pattern Analysis** - Study conflict trends, identify frequent issues, suggest process improvements, optimize strategies
4. **Configuration Management** - Set resolution preferences, define field priorities, configure merge rules, save automation settings
5. **Reporting & Analytics** - Generate conflict reports, track resolution success, analyze team patterns, provide insights
6. **Automated Prevention** - Implement locking mechanisms, optimize sync timing, enable change notifications, reduce conflicts

**Resolution Strategies**: Latest-wins, smart field-level merging, manual interactive resolution, system-priority resolution, custom rule-based resolution.

**Quality Assurance**: Backup before resolution, validation after changes, rollback capabilities, comprehensive audit trails.

**Output**: Resolved conflicts with detailed resolution reports, updated sync state, pattern analysis insights, and optimized conflict prevention strategies.