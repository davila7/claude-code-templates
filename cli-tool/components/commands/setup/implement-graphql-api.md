---
allowed-tools: Read, Write, Edit, Bash
argument-hint: [schema-approach] | --schema-first | --code-first | --federation
description: Implement GraphQL API with comprehensive schema, resolvers, and real-time subscriptions
model: sonnet
---

# Implement GraphQL API

Implement comprehensive GraphQL API with modern best practices: **$ARGUMENTS**

## Current Application Context

- Framework: @package.json or @requirements.txt (detect Apollo, GraphQL Yoga, etc.)
- Existing API: !`find . -name "*.graphql" -o -name "*schema*" -o -name "*resolver*" | wc -l`
- Database integration: @prisma/schema.prisma or database connection configs
- Authentication: !`grep -r "auth\|jwt\|context" src/ 2>/dev/null | wc -l`

## Task

Build production-ready GraphQL API with comprehensive functionality and performance optimization:

**Schema Approach**: Use $ARGUMENTS to specify schema-first, code-first, or federation architecture

**GraphQL Implementation**:
1. **Schema Design** - Type definitions, queries, mutations, subscriptions, custom scalars
2. **Resolver Architecture** - Data fetching, authentication, authorization, error handling
3. **DataLoader Integration** - N+1 query prevention, batch loading, caching strategies
4. **Real-time Features** - WebSocket subscriptions, live data updates, connection management
5. **Security & Performance** - Query complexity analysis, depth limiting, rate limiting
6. **Development Tools** - GraphQL Playground, introspection, schema stitching

**Advanced Features**: File uploads, federated schemas, Apollo Federation, schema directives, and monitoring.

**Production Readiness**: Implement comprehensive error handling, logging, metrics, and deployment strategies.

**Output**: Complete GraphQL API with optimized resolvers, real-time capabilities, security controls, and developer documentation.