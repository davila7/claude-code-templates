---
allowed-tools: Read, Write, Edit, Bash
argument-hint: [operation] | --backup | --restore | --schedule | --validate | --cleanup
description: Manage Supabase database backups with automated scheduling and recovery procedures
model: sonnet
---

# Supabase Backup Manager

Manage comprehensive Supabase database backups with automated scheduling and recovery validation: **$ARGUMENTS**

## Current Backup Context

- Supabase project: MCP integration for backup operations and status monitoring
- Backup storage: Current backup configuration and storage capacity
- Recovery testing: Last backup validation and recovery procedure verification
- Automation status: !`find . -name "*.yml" -o -name "*.json" | xargs grep -l "backup\|cron" 2>/dev/null | head -3` scheduled backup configuration

## Task

Execute comprehensive backup management with automated procedures and recovery validation:

**Backup Operation**: Use $ARGUMENTS to specify backup creation, data restoration, schedule management, backup validation, or cleanup procedures

**Backup Management Framework**:
1. **Backup Strategy** - Design backup schedules, implement retention policies, configure incremental backups, optimize storage usage
2. **Automated Backup** - Create database snapshots, export schema and data, validate backup integrity, monitor backup completion
3. **Recovery Procedures** - Test restore processes, validate data integrity, implement point-in-time recovery, optimize recovery time
4. **Schedule Management** - Configure automated backup schedules, implement backup monitoring, setup failure notifications, optimize backup windows
5. **Storage Optimization** - Manage backup storage, implement compression strategies, archive old backups, monitor storage costs
6. **Disaster Recovery** - Plan disaster recovery procedures, test recovery scenarios, document recovery processes, validate business continuity

**Advanced Features**: Automated backup validation, recovery time optimization, cross-region backup replication, backup encryption, compliance reporting.

**Monitoring Integration**: Backup success monitoring, failure alerting, storage usage tracking, recovery time measurement, compliance reporting.

**Output**: Complete backup management system with automated schedules, recovery procedures, validation reports, and disaster recovery planning.