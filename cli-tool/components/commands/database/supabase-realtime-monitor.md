---
allowed-tools: Read, Write, Edit, Bash
argument-hint: [monitoring-type] | --connections | --subscriptions | --performance | --debug | --analytics
description: Monitor and optimize Supabase realtime connections with performance analysis and debugging
model: sonnet
---

# Supabase Realtime Monitor

Monitor and optimize Supabase realtime connections with comprehensive performance analysis: **$ARGUMENTS**

## Current Realtime Context

- Supabase realtime: Connection status and subscription management via MCP
- Application subscriptions: !`find . -name "*.ts" -o -name "*.js" | xargs grep -l "subscribe\|realtime\|channel" 2>/dev/null | head -5` active subscription code
- Performance metrics: Current connection performance and message throughput
- Error patterns: Recent realtime connection issues and debugging information

## Task

Execute comprehensive realtime monitoring with performance optimization and debugging support:

**Monitoring Type**: Use $ARGUMENTS to focus on connection monitoring, subscription analysis, performance optimization, debugging assistance, or analytics reporting

**Realtime Monitoring Framework**:
1. **Connection Analysis** - Monitor active connections, analyze connection stability, track connection lifecycle, identify connection issues
2. **Subscription Management** - Track active subscriptions, analyze subscription performance, optimize subscription patterns, manage subscription lifecycle
3. **Performance Optimization** - Analyze message throughput, optimize payload sizes, reduce connection overhead, improve subscription efficiency
4. **Error Monitoring** - Track connection errors, analyze failure patterns, implement retry strategies, provide debugging insights
5. **Analytics Dashboard** - Generate usage analytics, track performance trends, monitor resource utilization, provide optimization recommendations
6. **Developer Tools** - Provide debugging utilities, implement connection testing, create performance profiling, optimize development workflow

**Advanced Features**: Real-time performance monitoring, predictive analytics, automated optimization suggestions, comprehensive logging, alert management.

**Integration Support**: Application performance monitoring, CI/CD integration, team collaboration tools, documentation generation, troubleshooting guides.

**Output**: Comprehensive realtime monitoring with performance analytics, optimization recommendations, debugging tools, and developer documentation.