---
allowed-tools: Read, Write, Edit, Bash
argument-hint: [optimization-type] | --queries | --indexes | --storage | --rls | --functions
description: Optimize Supabase database performance with intelligent analysis and recommendations
---

# Supabase Performance Optimizer

Optimize Supabase database performance with intelligent analysis and automated improvements: **$ARGUMENTS**

## Current Performance Context

- Supabase metrics: Database performance data via MCP integration
- Query patterns: !`find . -name "*.sql" -o -name "*.ts" -o -name "*.js" | xargs grep -l "from\|select\|insert\|update" 2>/dev/null | head -5` application queries
- Schema analysis: Current table structures and relationship complexity
- Performance logs: Recent query execution times and resource usage patterns

## Task

Execute comprehensive performance optimization with intelligent analysis and automated improvements:

**Optimization Focus**: Use $ARGUMENTS to focus on query optimization, index management, storage optimization, RLS policies, or database functions

**Performance Optimization Framework**:
1. **Performance Analysis** - Analyze query execution times, identify slow operations, assess resource utilization, evaluate bottlenecks
2. **Index Optimization** - Analyze index usage, recommend new indexes, identify redundant indexes, optimize index strategies
3. **Query Optimization** - Review application queries, suggest query improvements, implement query caching, optimize join operations
4. **Storage Optimization** - Analyze storage patterns, recommend archival strategies, optimize data types, implement compression
5. **RLS Policy Review** - Analyze Row Level Security policies, optimize policy performance, reduce policy complexity, improve security efficiency
6. **Function Optimization** - Review database functions, optimize function performance, implement caching strategies, improve execution plans

**Advanced Features**: Automated index recommendations, query plan analysis, performance trend monitoring, cost optimization, scaling recommendations.

**Monitoring Integration**: Real-time performance tracking, alert configuration, performance regression detection, optimization impact measurement.

**Output**: Comprehensive optimization plan with performance improvements, index recommendations, query optimizations, and monitoring setup.