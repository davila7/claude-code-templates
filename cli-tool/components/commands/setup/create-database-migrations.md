---
allowed-tools: Read, Write, Edit, Bash
argument-hint: [migration-name] | --create-table | --add-column | --alter-table
description: Create and manage database migrations with proper versioning and rollback support
model: sonnet
---

# Create Database Migrations

Create and manage database migrations: **$ARGUMENTS**

## Current Database State

- ORM detection: @package.json or @requirements.txt (detect Sequelize, Prisma, Alembic, etc.)
- Migration files: !`find . -name "*migration*" -type f | head -5`
- Database config: @config/database.* or @prisma/schema.prisma
- Current schema: !`ls migrations/ 2>/dev/null | wc -l` migrations found

## Task

Create comprehensive database migrations with proper versioning and rollback capabilities:

**Migration Types**: Use $ARGUMENTS to specify table creation, column addition, table alteration, or data migration

**Migration Framework**:
1. **Migration Planning** - Analyze schema changes, dependencies, and data impact
2. **Migration Generation** - Create timestamped migration files with up/down methods
3. **Schema Updates** - Table creation, column modifications, index management
4. **Data Migrations** - Safe data transformations and backfills
5. **Rollback Strategy** - Implement reliable rollback procedures for each change
6. **Testing** - Validate migrations in development and staging environments

**Best Practices**: Follow database-specific conventions, maintain referential integrity, handle large datasets efficiently, and ensure zero-downtime deployments.

**Output**: Production-ready migration files with comprehensive rollback support, proper indexing, and data safety measures.