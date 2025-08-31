---
allowed-tools: Read, Write, Edit, Bash
argument-hint: [table-name] | --query [sql] | --export | --inspect
description: Explore and analyze Supabase database data with intelligent querying and visualization
model: sonnet
---

# Supabase Data Explorer

Explore and analyze Supabase database with intelligent querying and data insights: **$ARGUMENTS**

## Current Data Context

- Supabase MCP: Connected with read-only access for safe data exploration
- Target table: Analysis of $ARGUMENTS for data exploration scope
- Local queries: !`find . -name "*.sql" | head -5` existing SQL files for reference
- Data models: !`find . -name "types" -o -name "models" -type d | head -3` application data structures

## Task

Execute comprehensive database exploration with intelligent analysis and insights:

**Exploration Focus**: Use $ARGUMENTS to specify table inspection, SQL query execution, data export, or comprehensive database inspection

**Data Exploration Framework**:
1. **Database Discovery** - Explore table structures, analyze relationships, identify data patterns, assess data quality metrics
2. **Intelligent Querying** - Execute read-only queries via MCP, optimize query performance, provide result analysis, suggest query improvements
3. **Data Analysis** - Generate data insights, identify trends and anomalies, calculate statistical summaries, analyze data distribution
4. **Schema Inspection** - Examine table schemas, analyze foreign key relationships, assess index effectiveness, review constraint validations
5. **Export & Visualization** - Export data in multiple formats, create data visualizations, generate summary reports, optimize data presentation
6. **Performance Analysis** - Analyze query execution plans, identify performance bottlenecks, suggest optimization strategies, monitor resource usage

**Advanced Features**: Interactive data exploration, automated insight generation, data quality assessment, relationship mapping, trend analysis.

**Safety Features**: Read-only operations, query validation, result limiting, performance monitoring, error handling.

**Output**: Comprehensive data exploration with insights, optimized queries, export files, and performance recommendations.