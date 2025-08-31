---
allowed-tools: Read, Write, Edit, Bash
argument-hint: [scope] | --github | --linear | --webhooks | --performance | --report
description: Monitor and diagnose GitHub-Linear sync health with performance analytics and automated troubleshooting
model: sonnet
---

# Sync Health Monitor

Monitor comprehensive GitHub-Linear synchronization health and performance: **$ARGUMENTS**

## Current Sync Environment

- GitHub API status: !`gh api rate_limit -q '.rate | "GitHub: \(.remaining)/\(.limit) requests"' 2>/dev/null || echo "GitHub API check needed"`
- Linear connectivity: Linear MCP server status and authentication validation
- Webhook status: Active webhook configurations and event processing health
- Sync performance: Current throughput, latency metrics, and error rates

## Task

Implement comprehensive sync health monitoring with automated diagnostics and performance optimization:

**Monitor Scope**: Use $ARGUMENTS to specify GitHub health, Linear connectivity, webhook diagnostics, performance analysis, or complete health report

**Health Monitoring Framework**:
1. **API Health Assessment** - Monitor GitHub/Linear API status, rate limits, authentication, connectivity issues
2. **Sync Performance Analysis** - Track throughput metrics, latency patterns, processing times, queue depths
3. **Error Pattern Detection** - Identify recurring failures, classify error types, analyze failure trends
4. **Webhook Diagnostics** - Validate webhook configurations, test event delivery, monitor processing latency
5. **Data Integrity Validation** - Verify sync consistency, detect orphaned records, validate cross-references
6. **Automated Troubleshooting** - Run diagnostic tests, suggest fixes, implement automated recovery procedures

**Advanced Features**: Real-time health dashboards, predictive failure detection, automated recovery workflows, comprehensive performance profiling.

**Diagnostic Capabilities**: Deep error analysis, bottleneck identification, configuration validation, automated testing suites.

**Output**: Complete health assessment with performance metrics, error analysis, recommended optimizations, and automated diagnostic reports.