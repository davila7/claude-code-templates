---
allowed-tools: Read, Write, Edit, Bash
argument-hint: [action] | --pull | --push | --diff | --validate
description: Synchronize database schema with Supabase using MCP integration
model: sonnet
---

# Supabase Schema Sync

Synchronize database schema between local and Supabase with comprehensive validation: **$ARGUMENTS**

## Current Supabase Context

- MCP connection: Supabase MCP server with read-only access configured
- Local schema: !`find . -name "schema.sql" -o -name "migrations" -type d | head -3` local database files
- Project config: !`find . -name "supabase" -type d -o -name ".env*" | grep -v node_modules | head -3` configuration files
- Git status: !`git status --porcelain | grep -E "\\.sql$|\\.ts$" | head -5` database-related changes

## Task

Execute comprehensive schema synchronization with Supabase integration:

**Sync Action**: Use $ARGUMENTS to specify pull from remote, push to remote, diff comparison, or schema validation

**Schema Synchronization Framework**:
1. **MCP Integration** - Connect to Supabase via MCP server, authenticate with project credentials, validate connection status
2. **Schema Analysis** - Compare local vs remote schema, identify structural differences, analyze migration requirements, assess breaking changes
3. **Sync Operations** - Execute pull/push operations, apply schema migrations, handle conflict resolution, validate data integrity
4. **Validation Process** - Verify schema consistency, validate foreign key constraints, check index performance, test query compatibility
5. **Migration Management** - Generate migration scripts, track version history, implement rollback procedures, optimize execution order
6. **Safety Checks** - Backup critical data, validate permissions, check production impact, implement dry-run mode

**Advanced Features**: Automated conflict resolution, schema version control, performance impact analysis, team collaboration workflows, CI/CD integration.

**Quality Assurance**: Schema validation, data integrity checks, performance optimization, rollback readiness, team synchronization.

**Output**: Complete schema sync with validation reports, migration scripts, conflict resolution, and team collaboration updates.