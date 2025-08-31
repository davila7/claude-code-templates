---
allowed-tools: Read, Write, Edit, Bash
argument-hint: [monitoring-type] | --metrics | --logging | --tracing | --full-stack
description: Setup comprehensive monitoring and observability with metrics, logging, tracing, and alerting
model: sonnet
---

# Setup Monitoring & Observability

Setup comprehensive monitoring and observability infrastructure: **$ARGUMENTS**

## Current Application State

- Application type: @package.json or @requirements.txt (detect framework and services)
- Existing monitoring: !`find . -name "*prometheus*" -o -name "*grafana*" -o -name "*jaeger*" | wc -l`
- Infrastructure: @docker-compose.yml or @kubernetes/ or cloud platform detection
- Logging setup: !`grep -r "winston\|logging\|console.log" src/ 2>/dev/null | wc -l`

## Task

Implement production-ready monitoring and observability with comprehensive insights:

**Monitoring Type**: Use $ARGUMENTS to focus on metrics, logging, distributed tracing, or complete observability stack

**Observability Stack**:
1. **Metrics Collection** - Application metrics, infrastructure monitoring, business KPIs, custom dashboards
2. **Logging Infrastructure** - Centralized logging, structured logs, log aggregation, search capabilities
3. **Distributed Tracing** - Request tracing, performance analysis, bottleneck identification, service dependencies
4. **Alerting System** - Smart alerts, escalation policies, notification channels, incident management
5. **Performance Monitoring** - APM integration, real-user monitoring, synthetic monitoring, SLA tracking
6. **Analytics & Reports** - Usage analytics, performance trends, capacity planning, business insights

**Platform Integration**: Prometheus, Grafana, ELK Stack, Jaeger, DataDog, New Relic, cloud-native solutions.

**Production Features**: High availability, data retention policies, security controls, cost optimization.

**Output**: Complete observability platform with real-time monitoring, intelligent alerting, and comprehensive analytics dashboards.