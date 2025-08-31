---
allowed-tools: Read, Write, Edit, Bash
argument-hint: [schema-type] | --relational | --nosql | --hybrid | --normalize
description: Design optimized database schemas with proper relationships, constraints, and performance considerations
model: sonnet
---

# Design Database Schema

Design optimized database schemas with comprehensive data modeling: **$ARGUMENTS**

## Current Project Context

- Application type: Based on $ARGUMENTS or codebase analysis
- Data requirements: @requirements/ or project documentation
- Existing schema: @prisma/schema.prisma or @migrations/ or database dumps
- Performance needs: Expected scale, query patterns, and data volume

## Task

Design comprehensive database schema with optimal structure and performance:

**Schema Type**: Use $ARGUMENTS to specify relational, NoSQL, hybrid approach, or normalization level

**Design Framework**:
1. **Requirements Analysis** - Business entities, relationships, data flow, and access patterns
2. **Entity Modeling** - Tables/collections, attributes, primary/foreign keys, constraints
3. **Relationship Design** - One-to-one, one-to-many, many-to-many associations
4. **Normalization Strategy** - Data consistency vs performance trade-offs
5. **Performance Optimization** - Indexing strategy, query optimization, partitioning
6. **Security Design** - Access control, data encryption, audit trails

**Advanced Patterns**: Implement temporal data, soft deletes, JSONB fields, full-text search, audit logging, and scalability patterns.

**Validation**: Ensure referential integrity, data consistency, query performance, and future extensibility.

**Output**: Complete schema design with DDL scripts, ER diagrams, performance analysis, and migration strategy.